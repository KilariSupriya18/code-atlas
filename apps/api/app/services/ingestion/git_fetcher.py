import os
import re
import shutil
import subprocess
import logging
from typing import Tuple, List, Optional
from urllib.parse import urlparse
from apps.api.app.config import settings

logger = logging.getLogger(__name__)

# Excluded directory names and patterns
EXCLUDED_DIRS = {
    ".git", ".github", "__pycache__", ".pytest_cache", ".venv", "venv", "env",
    "node_modules", "dist", "build", ".idea", ".vscode", ".tox", "site-packages"
}

# Excluded file patterns
EXCLUDED_EXTENSIONS = {
    ".pyc", ".pyo", ".pyd", ".so", ".dll", ".dylib", ".exe", ".bin",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf", ".zip", ".tar", ".gz"
}

IGNORED_FILENAMES = {
    ".env", ".env.local", ".env.production", "id_rsa", "id_ed25519", "credentials.json"
}

class GitFetcher:
    """
    Safely clones and inspects public Git repositories.
    Guarantees array-based invocation, URL sanitization, and size boundary compliance.
    """

    @staticmethod
    def validate_repo_url(url: str) -> bool:
        """
        Validates that URL is a public HTTPS GitHub repository without embedded auth.
        """
        if not url or not isinstance(url, str):
            return False
        
        parsed = urlparse(url.strip())
        if parsed.scheme != "https":
            return False
        
        if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
            return False
        
        if parsed.username or parsed.password:
            return False
        
        # Path must look like /owner/repo or /owner/repo.git
        parts = [p for p in parsed.path.strip("/").split("/") if p]
        if len(parts) < 2:
            return False
        
        return True

    @staticmethod
    def resolve_and_clone(
        repo_url: str,
        target_dir: str,
        branch: Optional[str] = "main"
    ) -> Tuple[str, List[str]]:
        """
        Clones repository safely using array arguments and returns resolved commit SHA and file list.
        """
        if os.path.exists(target_dir):
            shutil.rmtree(target_dir, ignore_errors=True)
        os.makedirs(target_dir, exist_ok=True)

        logger.info("Cloning repository %s (branch: %s) to %s", repo_url, branch, target_dir)

        # Clone shallow single branch
        cmd = [
            "git", "clone",
            "--depth", "1",
            "--single-branch",
            *(["--branch", branch] if branch else []),
            repo_url,
            target_dir
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.git_clone_timeout_seconds,
                shell=False
            )
            if result.returncode != 0:
                # If specified branch failed, try default clone
                logger.warning("Branch clone failed (%s). Retrying default shallow clone...", result.stderr)
                cmd_fallback = ["git", "clone", "--depth", "1", repo_url, target_dir]
                fb_res = subprocess.run(
                    cmd_fallback,
                    capture_output=True,
                    text=True,
                    timeout=settings.git_clone_timeout_seconds,
                    shell=False
                )
                if fb_res.returncode != 0:
                    raise RuntimeError(f"Git clone failed: {fb_res.stderr.strip() or fb_res.stdout.strip()}")
        except subprocess.TimeoutExpired:
            raise TimeoutError(f"Git clone timed out after {settings.git_clone_timeout_seconds} seconds.")

        # Get exact commit SHA
        sha_cmd = ["git", "-C", target_dir, "rev-parse", "HEAD"]
        sha_res = subprocess.run(sha_cmd, capture_output=True, text=True, check=True, shell=False)
        commit_sha = sha_res.stdout.strip()

        # Collect eligible source files
        source_files = GitFetcher.collect_valid_files(target_dir)
        return commit_sha, source_files

    @staticmethod
    def collect_valid_files(repo_root: str) -> List[str]:
        valid_files = []
        max_size_bytes = settings.max_file_size_kb * 1024

        for root, dirs, files in os.walk(repo_root):
            # Prune excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and not d.startswith(".")]

            for file in files:
                if file in IGNORED_FILENAMES:
                    continue
                
                _, ext = os.path.splitext(file)
                if ext.lower() in EXCLUDED_EXTENSIONS:
                    continue
                
                full_path = os.path.join(root, file)
                try:
                    stat = os.stat(full_path)
                    if stat.st_size > max_size_bytes or stat.st_size == 0:
                        continue
                    
                    rel_path = os.path.relpath(full_path, repo_root).replace("\\", "/")
                    valid_files.append(rel_path)
                except OSError:
                    continue

        return valid_files
