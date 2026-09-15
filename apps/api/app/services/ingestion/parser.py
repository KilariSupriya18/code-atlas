import ast
import hashlib
import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)

@dataclass
class ParsedChunk:
    chunk_type: str  # function, async_function, method, class, module_code, readme, config
    symbol_name: Optional[str]
    parent_symbol: Optional[str]
    signature: Optional[str]
    docstring: Optional[str]
    start_line: int
    end_line: int
    original_code: str
    content_hash: str

class CodeParser:
    """
    Parses source code into structured semantic chunks.
    Extracts functions, async functions, classes, methods, docstrings, signatures,
    and configurations with exact 1-indexed line ranges and parent context.
    """

    @staticmethod
    def compute_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @classmethod
    def parse_python(cls, file_content: str, rel_path: str) -> List[ParsedChunk]:
        """Parses Python source file into class, method, function, and module chunks."""
        chunks: List[ParsedChunk] = []
        lines = file_content.splitlines(keepends=True)
        total_lines = len(lines)

        try:
            tree = ast.parse(file_content, filename=rel_path)
        except SyntaxError as exc:
            logger.warning("AST parse syntax error in %s: %s. Falling back to whole-file chunk.", rel_path, exc)
            return [
                ParsedChunk(
                    chunk_type="module_code",
                    symbol_name=rel_path,
                    parent_symbol=None,
                    signature=None,
                    docstring=None,
                    start_line=1,
                    end_line=total_lines or 1,
                    original_code=file_content,
                    content_hash=cls.compute_hash(file_content)
                )
            ]

        # Extract module-level docstring if present
        module_doc = ast.get_docstring(tree)

        # Track visited nodes so we can also capture module-level statements if significant
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                chunks.extend(cls._parse_function_node(node, lines, parent_symbol=None))
            elif isinstance(node, ast.ClassDef):
                chunks.extend(cls._parse_class_node(node, lines))
            elif isinstance(node, (ast.Assign, ast.AnnAssign)) and (
                "config" in rel_path.lower() or "setting" in rel_path.lower()
            ):
                start = node.lineno
                end = getattr(node, "end_lineno", node.lineno)
                code = "".join(lines[start - 1:end])
                chunks.append(
                    ParsedChunk(
                        chunk_type="config",
                        symbol_name=getattr(node.targets[0], "id", "CONFIG") if hasattr(node, "targets") else "CONFIG",
                        parent_symbol=None,
                        signature=None,
                        docstring=None,
                        start_line=start,
                        end_line=end,
                        original_code=code,
                        content_hash=cls.compute_hash(code)
                    )
                )

        # If no functions or classes were found (e.g. flat script or config), include the whole module
        if not chunks and file_content.strip():
            chunks.append(
                ParsedChunk(
                    chunk_type="module_code",
                    symbol_name=rel_path,
                    parent_symbol=None,
                    signature=None,
                    docstring=module_doc,
                    start_line=1,
                    end_line=total_lines or 1,
                    original_code=file_content,
                    content_hash=cls.compute_hash(file_content)
                )
            )

        return chunks

    @classmethod
    def _parse_function_node(
        cls,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        lines: List[str],
        parent_symbol: Optional[str] = None
    ) -> List[ParsedChunk]:
        start = node.lineno
        # Include decorators in start_line if present
        if node.decorator_list:
            start = min(d.lineno for d in node.decorator_list)
        
        end = getattr(node, "end_lineno", node.lineno)
        code = "".join(lines[start - 1:end])
        docstring = ast.get_docstring(node)
        
        chunk_type = "async_function" if isinstance(node, ast.AsyncFunctionDef) else (
            "method" if parent_symbol else "function"
        )

        # Reconstruct clean signature
        sig_args = []
        for arg in node.args.args:
            arg_str = arg.arg
            if arg.annotation:
                try:
                    arg_str += f": {ast.unparse(arg.annotation)}"
                except Exception:
                    pass
            sig_args.append(arg_str)
        
        ret_annotation = ""
        if node.returns:
            try:
                ret_annotation = f" -> {ast.unparse(node.returns)}"
            except Exception:
                pass
        
        prefix = "async def " if isinstance(node, ast.AsyncFunctionDef) else "def "
        signature = f"{prefix}{node.name}({', '.join(sig_args)}){ret_annotation}"

        # If function is very large (> 120 lines), split into logical chunks while retaining symbol identity
        if (end - start) > 120:
            return cls._split_large_function(node.name, parent_symbol, signature, docstring, lines, start, end, chunk_type)

        return [
            ParsedChunk(
                chunk_type=chunk_type,
                symbol_name=node.name,
                parent_symbol=parent_symbol,
                signature=signature,
                docstring=docstring,
                start_line=start,
                end_line=end,
                original_code=code,
                content_hash=cls.compute_hash(code)
            )
        ]

    @classmethod
    def _parse_class_node(cls, node: ast.ClassDef, lines: List[str]) -> List[ParsedChunk]:
        start = node.lineno
        if node.decorator_list:
            start = min(d.lineno for d in node.decorator_list)
        end = getattr(node, "end_lineno", node.lineno)
        
        class_code = "".join(lines[start - 1:end])
        docstring = ast.get_docstring(node)
        
        # Base classes
        bases = [ast.unparse(b) for b in node.bases if hasattr(ast, "unparse")]
        signature = f"class {node.name}" + (f"({', '.join(bases)}):" if bases else ":")

        chunks = [
            ParsedChunk(
                chunk_type="class",
                symbol_name=node.name,
                parent_symbol=None,
                signature=signature,
                docstring=docstring,
                start_line=start,
                end_line=end,
                original_code=class_code if (end - start) <= 60 else "".join(lines[start - 1:min(end, start + 30)]),
                content_hash=cls.compute_hash(class_code)
            )
        ]

        # Parse methods
        for item in node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                chunks.extend(cls._parse_function_node(item, lines, parent_symbol=node.name))

        return chunks

    @classmethod
    def _split_large_function(
        cls,
        name: str,
        parent_symbol: Optional[str],
        signature: str,
        docstring: Optional[str],
        lines: List[str],
        start: int,
        end: int,
        chunk_type: str
    ) -> List[ParsedChunk]:
        """Splits an oversized function into logical ~60 line windows with overlap."""
        split_chunks = []
        chunk_size = 60
        overlap = 10
        cur_start = start
        idx = 1

        while cur_start <= end:
            cur_end = min(cur_start + chunk_size, end)
            sub_code = "".join(lines[cur_start - 1:cur_end])
            split_chunks.append(
                ParsedChunk(
                    chunk_type=chunk_type,
                    symbol_name=f"{name} (part {idx})",
                    parent_symbol=parent_symbol or name,
                    signature=signature,
                    docstring=docstring,
                    start_line=cur_start,
                    end_line=cur_end,
                    original_code=sub_code,
                    content_hash=cls.compute_hash(sub_code)
                )
            )
            idx += 1
            if cur_end >= end:
                break
            cur_start = cur_end - overlap + 1

        return split_chunks

    @classmethod
    def parse_markdown(cls, file_content: str, rel_path: str) -> List[ParsedChunk]:
        """Parses Markdown/README files into logical section chunks based on headers."""
        lines = file_content.splitlines(keepends=True)
        chunks: List[ParsedChunk] = []
        section_start = 1
        current_title = "Introduction"
        current_lines = []

        for idx, line in enumerate(lines, start=1):
            if line.startswith(("# ", "## ", "### ")):
                if current_lines:
                    text = "".join(current_lines)
                    chunks.append(
                        ParsedChunk(
                            chunk_type="readme",
                            symbol_name=current_title,
                            parent_symbol=rel_path,
                            signature=None,
                            docstring=None,
                            start_line=section_start,
                            end_line=idx - 1,
                            original_code=text,
                            content_hash=cls.compute_hash(text)
                        )
                    )
                section_start = idx
                current_title = line.strip("# \r\n")
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            text = "".join(current_lines)
            chunks.append(
                ParsedChunk(
                    chunk_type="readme",
                    symbol_name=current_title,
                    parent_symbol=rel_path,
                    signature=None,
                    docstring=None,
                    start_line=section_start,
                    end_line=len(lines),
                    original_code=text,
                    content_hash=cls.compute_hash(text)
                )
            )

        return chunks

    @classmethod
    def parse_file(cls, file_content: str, rel_path: str) -> List[ParsedChunk]:
        ext = rel_path.lower().split(".")[-1] if "." in rel_path else ""
        if ext == "py":
            return cls.parse_python(file_content, rel_path)
        elif ext in {"md", "markdown", "rst"}:
            return cls.parse_markdown(file_content, rel_path)
        elif ext in {"json", "toml", "yaml", "yml", "ini"}:
            return [
                ParsedChunk(
                    chunk_type="config",
                    symbol_name=rel_path,
                    parent_symbol=None,
                    signature=None,
                    docstring=None,
                    start_line=1,
                    end_line=len(file_content.splitlines()) or 1,
                    original_code=file_content,
                    content_hash=cls.compute_hash(file_content)
                )
            ]
        return []
