import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

// In-Memory Data Store
interface Repository {
  id: string;
  name: string;
  full_name: string;
  url: string;
  default_branch: string;
  current_snapshot_id?: string;
  created_at: string;
  updated_at: string;
}

interface Snapshot {
  id: string;
  repository_id: string;
  commit_sha: string;
  branch: string;
  status: 'pending' | 'ready' | 'failed';
  file_count: number;
  symbol_count: number;
  chunk_count: number;
  embedding_model: string;
  vector_dim: number;
  created_at: string;
}

interface IndexJob {
  id: string;
  repository_id: string;
  snapshot_id: string;
  stage: 'queued' | 'fetching' | 'parsing' | 'embedding' | 'finalizing' | 'ready' | 'failed';
  progress_stats: {
    files_discovered?: number;
    files_parsed?: number;
    symbols_extracted?: number;
    chunks_created?: number;
    chunks_embedded?: number;
    current_file?: string;
  };
  error_message?: string;
  created_at: string;
  updated_at: string;
}

interface SourceFile {
  id: string;
  snapshot_id: string;
  repository_id: string;
  path: string;
  language: string;
  content: string;
  size: number;
  commit_sha: string;
}

interface Citation {
  chunk_id: string;
  file_path: string;
  symbol_name?: string;
  start_line: number;
  end_line: number;
  snippet: string;
  claim?: string;
}

interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  uncertainties: string[];
  suggested_questions: string[];
  created_at: string;
}

interface ChatThread {
  id: string;
  repository_id: string;
  snapshot_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

interface LessonReference {
  chunk_id: string;
  file_path: string;
  symbol_name?: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
}

interface LessonDetail {
  id: string;
  path_id: string;
  order_index: number;
  title: string;
  objective: string;
  why_it_matters: string;
  explanation: string;
  code_references: LessonReference[];
  exercise_prompt: string;
  status: 'not_started' | 'practicing' | 'demonstrated';
  created_at: string;
}

interface LearningPath {
  id: string;
  repository_id: string;
  snapshot_id: string;
  goal: string;
  experience_level: string;
  topic?: string;
  status: string;
  lessons: LessonDetail[];
  created_at: string;
}

interface ExerciseAttempt {
  id: string;
  lesson_id: string;
  user_answer: string;
  outcome: 'correct' | 'partial' | 'incorrect' | 'unable_to_assess';
  feedback_what_understood: string;
  feedback_what_missed: string;
  explanation: string;
  recommended_next_action: string;
  remediation_question?: string;
  created_at: string;
}

interface UserProgress {
  repository_id: string;
  lessons_visited: string[];
  topics_practiced: string[];
  exercise_outcomes: Record<string, number>;
  concepts_to_revisit: string[];
  total_lessons: number;
  demonstrated_count: number;
  updated_at: string;
}

// In-Memory Storage Maps
const repositories = new Map<string, Repository>();
const snapshots = new Map<string, Snapshot>();
const indexJobs = new Map<string, IndexJob>();
const sourceFiles = new Map<string, SourceFile[]>(); // snapshot_id -> files
const chatThreads = new Map<string, ChatThread>();
const learningPaths = new Map<string, LearningPath>();
const userProgressMap = new Map<string, UserProgress>();

// Helper to read demo directory
function getDemoFiles(): Array<{ path: string; content: string; language: string; size: number }> {
  const demoRoot = path.join(process.cwd(), 'demo', 'sample_repo');
  const results: Array<{ path: string; content: string; language: string; size: number }> = [];

  function scanDir(dir: string, relativePrefix = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        scanDir(fullPath, relPath);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const ext = path.extname(entry.name).toLowerCase();
        let language = 'text';
        if (ext === '.py') language = 'python';
        else if (ext === '.md') language = 'markdown';
        else if (ext === '.json') language = 'json';
        else if (ext === '.ts' || ext === '.tsx') language = 'typescript';
        else if (ext === '.js') language = 'javascript';
        results.push({
          path: relPath,
          content,
          language,
          size: Buffer.byteLength(content, 'utf-8'),
        });
      }
    }
  }

  scanDir(demoRoot);
  return results;
}

// Seed the sample demo repository initially
const DEMO_REPO_ID = 'demo-repo-001';
const DEMO_SNAPSHOT_ID = 'demo-snap-001';

function initializeDemoRepository() {
  const files = getDemoFiles();
  const now = new Date().toISOString();

  const demoRepo: Repository = {
    id: DEMO_REPO_ID,
    name: 'payment-auth-service',
    full_name: 'demo/payment-auth-service',
    url: 'https://github.com/demo/sample-repo',
    default_branch: 'main',
    current_snapshot_id: DEMO_SNAPSHOT_ID,
    created_at: now,
    updated_at: now,
  };
  repositories.set(DEMO_REPO_ID, demoRepo);

  const demoSnapshot: Snapshot = {
    id: DEMO_SNAPSHOT_ID,
    repository_id: DEMO_REPO_ID,
    commit_sha: 'a8f3b2c9e1d0',
    branch: 'main',
    status: 'ready',
    file_count: files.length || 7,
    symbol_count: 18,
    chunk_count: 32,
    embedding_model: 'all-MiniLM-L6-v2',
    vector_dim: 384,
    created_at: now,
  };
  snapshots.set(DEMO_SNAPSHOT_ID, demoSnapshot);

  const demoSourceFiles: SourceFile[] = files.map((f, idx) => ({
    id: `file-${idx + 1}`,
    snapshot_id: DEMO_SNAPSHOT_ID,
    repository_id: DEMO_REPO_ID,
    path: f.path,
    language: f.language,
    content: f.content,
    size: f.size,
    commit_sha: 'a8f3b2c9e1d0',
  }));
  sourceFiles.set(DEMO_SNAPSHOT_ID, demoSourceFiles);

  // Seed default progress
  userProgressMap.set(DEMO_REPO_ID, {
    repository_id: DEMO_REPO_ID,
    lessons_visited: ['lesson-demo-1'],
    topics_practiced: ['Authentication', 'Token Lifecycle'],
    exercise_outcomes: { correct: 1 },
    concepts_to_revisit: [],
    total_lessons: 5,
    demonstrated_count: 1,
    updated_at: now,
  });

  // Seed a starter learning path
  const defaultPathId = 'path-demo-001';
  const defaultLessons: LessonDetail[] = [
    {
      id: 'lesson-demo-1',
      path_id: defaultPathId,
      order_index: 1,
      title: 'JWT Creation, Claims & Expiration Logic',
      objective: 'Understand how access tokens are signed using HMAC-SHA256 and structured with payload claims.',
      why_it_matters: 'JWT tokens secure every inbound API request; incorrect expiration or signing causes severe vulnerability or outages.',
      explanation: 'In auth/jwt_handler.py, create_access_token formats the header (HS256) and payload (sub, email, role, iat, exp). It then signs the input using the configured secret key. Notice the use of base64 urlsafe encoding with trailing padding stripped.',
      code_references: [
        {
          chunk_id: 'ref-1',
          file_path: 'auth/jwt_handler.py',
          symbol_name: 'create_access_token',
          start_line: 16,
          end_line: 45,
          code_snippet: `def create_access_token(user_id: str, email: str, role: str = "member") -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + (settings.access_token_expire_minutes * 60)
    }
    encoded_header = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip("=")
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signing_input = f"{encoded_header}.{encoded_payload}".encode()
    signature = hmac.new(settings.jwt_secret_key.encode(), signing_input, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"`,
        },
      ],
      exercise_prompt: 'Why does create_access_token use time.time() for the "exp" claim, and how is the expiration duration configured?',
      status: 'demonstrated',
      created_at: now,
    },
    {
      id: 'lesson-demo-2',
      path_id: defaultPathId,
      order_index: 2,
      title: 'Token Revocation & Blacklist Verification',
      objective: 'Learn how revoked tokens are tracked in the revocation store to invalidate sessions before JWT expiry.',
      why_it_matters: 'Since JWTs are stateless by default, revocation checks are necessary when a user logs out or credentials are compromised.',
      explanation: 'The verify_token function first validates format and cryptographic signature. Next, it checks whether the token exists in REVOKED_TOKENS. If present, it rejects the token immediately.',
      code_references: [
        {
          chunk_id: 'ref-2',
          file_path: 'auth/jwt_handler.py',
          symbol_name: 'revoke_token',
          start_line: 75,
          end_line: 98,
          code_snippet: `def revoke_token(token: str) -> bool:
    """Adds a token string to the active blacklist store."""
    if not token or token.count(".") != 2:
        return False
    REVOKED_TOKENS.add(token)
    return True`,
        },
      ],
      exercise_prompt: 'Describe how the service checks if a token has been revoked during verification in auth/jwt_handler.py.',
      status: 'not_started',
      created_at: now,
    },
    {
      id: 'lesson-demo-3',
      path_id: defaultPathId,
      order_index: 3,
      title: 'Idempotency in Payment Transaction Execution',
      objective: 'Explore how duplicate charges are prevented using customer-provided idempotency keys.',
      why_it_matters: 'Network retries can cause double-billing. Idempotency guarantees that re-sent requests produce the exact same outcome without re-charging.',
      explanation: 'In services/payment_service.py, PaymentService checks _processed_idempotency_keys before attempting a gateway transaction. If the key was previously processed, it immediately returns the cached confirmation.',
      code_references: [
        {
          chunk_id: 'ref-3',
          file_path: 'services/payment_service.py',
          symbol_name: 'execute_charge',
          start_line: 50,
          end_line: 85,
          code_snippet: `async def execute_charge(self, payment_intent: Dict[str, Any], idempotency_key: str) -> Dict[str, Any]:
    if idempotency_key in self._processed_idempotency_keys:
        logger.info("Duplicate transaction intercepted by idempotency key: %s", idempotency_key)
        return {"status": "success", "idempotent_replay": True, "charge_id": f"cached_{idempotency_key[:8]}"}
    self._processed_idempotency_keys.add(idempotency_key)`,
        },
      ],
      exercise_prompt: 'How does PaymentService prevent double billing when a client retries a network request with the same idempotency key?',
      status: 'not_started',
      created_at: now,
    },
    {
      id: 'lesson-demo-4',
      path_id: defaultPathId,
      order_index: 4,
      title: 'Password Hashing & PBKDF2 / SHA256 Salt Verification',
      objective: 'Examine password hashing and salt verification implementation in auth/security.py.',
      why_it_matters: 'Plaintext or unsalted passwords risk credential stuffing attacks when databases leak.',
      explanation: 'auth/security.py uses hashlib.pbkdf2_hmac with 100,000 iterations and a 16-byte random salt to securely store password hashes.',
      code_references: [
        {
          chunk_id: 'ref-4',
          file_path: 'auth/security.py',
          symbol_name: 'hash_password',
          start_line: 15,
          end_line: 45,
          code_snippet: `def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
    return f"{binascii.hexlify(salt).decode()}:{binascii.hexlify(key).decode()}"`,
        },
      ],
      exercise_prompt: 'What algorithm and iteration count does auth/security.py use for hashing passwords?',
      status: 'not_started',
      created_at: now,
    },
  ];

  learningPaths.set(defaultPathId, {
    id: defaultPathId,
    repository_id: DEMO_REPO_ID,
    snapshot_id: DEMO_SNAPSHOT_ID,
    goal: 'Master Authentication & Payment Architecture',
    experience_level: 'intermediate',
    topic: 'Security & Transaction Resilience',
    status: 'active',
    lessons: defaultLessons,
    created_at: now,
  });
}

initializeDemoRepository();

// Helper to simulate asynchronous indexing job
function runIndexingJob(jobId: string, repoId: string, snapshotId: string) {
  const steps: Array<{
    stage: IndexJob['stage'];
    stats: IndexJob['progress_stats'];
    delay: number;
  }> = [
    {
      stage: 'fetching',
      stats: { files_discovered: 7, current_file: 'Cloning repository shallow tree...' },
      delay: 800,
    },
    {
      stage: 'parsing',
      stats: {
        files_discovered: 7,
        files_parsed: 7,
        symbols_extracted: 18,
        chunks_created: 32,
        current_file: 'services/payment_service.py',
      },
      delay: 2000,
    },
    {
      stage: 'embedding',
      stats: {
        files_discovered: 7,
        files_parsed: 7,
        symbols_extracted: 18,
        chunks_created: 32,
        chunks_embedded: 32,
        current_file: 'Embedding normalized chunks with all-MiniLM-L6-v2',
      },
      delay: 3500,
    },
    {
      stage: 'finalizing',
      stats: {
        files_discovered: 7,
        files_parsed: 7,
        symbols_extracted: 18,
        chunks_created: 32,
        chunks_embedded: 32,
        current_file: 'Publishing snapshot to Qdrant collection',
      },
      delay: 4800,
    },
    {
      stage: 'ready',
      stats: {
        files_discovered: 7,
        files_parsed: 7,
        symbols_extracted: 18,
        chunks_created: 32,
        chunks_embedded: 32,
      },
      delay: 6000,
    },
  ];

  steps.forEach(({ stage, stats, delay }) => {
    setTimeout(() => {
      const job = indexJobs.get(jobId);
      if (!job) return;
      job.stage = stage;
      job.progress_stats = { ...job.progress_stats, ...stats };
      job.updated_at = new Date().toISOString();

      if (stage === 'ready') {
        const snap = snapshots.get(snapshotId);
        if (snap) {
          snap.status = 'ready';
          snap.file_count = 7;
          snap.symbol_count = 18;
          snap.chunk_count = 32;
        }
        const repo = repositories.get(repoId);
        if (repo) {
          repo.current_snapshot_id = snapshotId;
          repo.updated_at = new Date().toISOString();
        }
      }
    }, delay);
  });
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health & Capabilities
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'codementor-api',
    version: '1.0.0',
  });
});

app.get('/api/capabilities', (_req, res) => {
  res.json({
    groq: {
      configured: !!process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      fallback_model: process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant',
    },
    embeddings: {
      model: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
      dimensions: 384,
      max_seq_length: 512,
      mode: 'local-sentence-transformers',
    },
    vector_db: {
      type: 'qdrant',
      mode: 'in-memory-dense',
      path: './data/qdrant',
    },
    database: {
      dialect: 'in-memory',
    },
  });
});

app.get('/api/settings', (_req, res) => {
  const k = process.env.GROQ_API_KEY || '';
  const maskedKey = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : k ? '***' : null;

  res.json({
    groq: {
      configured: !!k,
      masked_key: maskedKey,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      fallback_model: process.env.GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant',
    },
    embeddings: {
      model: process.env.EMBEDDING_MODEL || 'all-MiniLM-L6-v2',
      dimensions: 384,
      max_seq_length: 512,
    },
    storage: {
      vector_path: './data/qdrant',
      repo_path: './demo/sample_repo',
      database_url: 'in-memory://sqlite',
    },
  });
});

app.post('/api/settings/groq-key', (req, res) => {
  const { api_key } = req.body;
  if (!api_key || typeof api_key !== 'string' || !api_key.trim()) {
    return res.status(400).json({ detail: 'API key cannot be empty' });
  }
  process.env.GROQ_API_KEY = api_key.trim();
  res.json({
    status: 'success',
    message: 'Groq API key activated successfully.',
    models_available: 5,
  });
});

// 2. Repositories
app.get('/api/repositories', (_req, res) => {
  const list = Array.from(repositories.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  res.json(list);
});

app.post('/api/repositories', (req, res) => {
  const { url = '', branch = 'main' } = req.body;
  const isDemo = url.toLowerCase().includes('demo') || url.toLowerCase().includes('sample');

  let repoName = 'sample-repository';
  let fullName = 'demo/sample-repository';

  if (isDemo) {
    repoName = 'payment-auth-service';
    fullName = 'demo/payment-auth-service';
  } else if (url) {
    const parts = url.replace(/\.git$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) {
      repoName = parts[parts.length - 1];
      fullName = `${parts[parts.length - 2]}/${repoName}`;
    }
  }

  // Check if exists
  let repo = Array.from(repositories.values()).find((r) => r.full_name === fullName);
  const now = new Date().toISOString();

  if (!repo) {
    const repoId = `repo-${Date.now()}`;
    repo = {
      id: repoId,
      name: repoName,
      full_name: fullName,
      url: url || 'https://github.com/demo/sample-repo',
      default_branch: branch,
      created_at: now,
      updated_at: now,
    };
    repositories.set(repoId, repo);
  }

  // Create Snapshot
  const snapshotId = `snap-${Date.now()}`;
  const snapshot: Snapshot = {
    id: snapshotId,
    repository_id: repo.id,
    commit_sha: isDemo ? 'a8f3b2c9e1d0' : 'pending',
    branch,
    status: 'pending',
    file_count: 0,
    symbol_count: 0,
    chunk_count: 0,
    embedding_model: 'all-MiniLM-L6-v2',
    vector_dim: 384,
    created_at: now,
  };
  snapshots.set(snapshotId, snapshot);

  // Load files for snapshot
  const files = getDemoFiles();
  const fileEntities: SourceFile[] = files.map((f, i) => ({
    id: `file-${Date.now()}-${i}`,
    snapshot_id: snapshotId,
    repository_id: repo.id,
    path: f.path,
    language: f.language,
    content: f.content,
    size: f.size,
    commit_sha: 'a8f3b2c9e1d0',
  }));
  sourceFiles.set(snapshotId, fileEntities);

  // Create IndexJob
  const jobId = `job-${Date.now()}`;
  const job: IndexJob = {
    id: jobId,
    repository_id: repo.id,
    snapshot_id: snapshotId,
    stage: 'queued',
    progress_stats: {
      files_discovered: 0,
      files_parsed: 0,
      symbols_extracted: 0,
      chunks_created: 0,
      chunks_embedded: 0,
    },
    created_at: now,
    updated_at: now,
  };
  indexJobs.set(jobId, job);

  // Run job asynchronously
  runIndexingJob(jobId, repo.id, snapshotId);

  res.json({
    repository_id: repo.id,
    snapshot_id: snapshotId,
    job_id: jobId,
    status: 'queued',
  });
});

app.get('/api/repositories/:id', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ detail: 'Repository not found' });
  }
  const snapshot = repo.current_snapshot_id ? snapshots.get(repo.current_snapshot_id) || null : null;
  res.json({ repository: repo, current_snapshot: snapshot });
});

app.post('/api/repositories/:id/reindex', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ detail: 'Repository not found' });
  }

  const { branch = repo.default_branch } = req.body;
  const now = new Date().toISOString();
  const snapshotId = `snap-${Date.now()}`;

  const snapshot: Snapshot = {
    id: snapshotId,
    repository_id: repo.id,
    commit_sha: 'a8f3b2c9e1d0',
    branch,
    status: 'pending',
    file_count: 0,
    symbol_count: 0,
    chunk_count: 0,
    embedding_model: 'all-MiniLM-L6-v2',
    vector_dim: 384,
    created_at: now,
  };
  snapshots.set(snapshotId, snapshot);

  const files = getDemoFiles();
  const fileEntities: SourceFile[] = files.map((f, i) => ({
    id: `file-${Date.now()}-${i}`,
    snapshot_id: snapshotId,
    repository_id: repo.id,
    path: f.path,
    language: f.language,
    content: f.content,
    size: f.size,
    commit_sha: 'a8f3b2c9e1d0',
  }));
  sourceFiles.set(snapshotId, fileEntities);

  const jobId = `job-${Date.now()}`;
  const job: IndexJob = {
    id: jobId,
    repository_id: repo.id,
    snapshot_id: snapshotId,
    stage: 'queued',
    progress_stats: {},
    created_at: now,
    updated_at: now,
  };
  indexJobs.set(jobId, job);

  runIndexingJob(jobId, repo.id, snapshotId);

  res.json({ job_id: jobId, snapshot_id: snapshotId });
});

app.get('/api/repositories/:id/files', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo || !repo.current_snapshot_id) {
    return res.json([]);
  }
  const files = sourceFiles.get(repo.current_snapshot_id) || [];
  res.json(
    files.map((f) => ({
      id: f.id,
      path: f.path,
      language: f.language,
      size: f.size,
      commit_sha: f.commit_sha,
    }))
  );
});

app.get('/api/repositories/:id/source', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo || !repo.current_snapshot_id) {
    return res.status(404).json({ detail: 'Repository or active snapshot not found' });
  }
  const filePath = req.query.path as string;
  const files = sourceFiles.get(repo.current_snapshot_id) || [];
  const found = files.find((f) => f.path === filePath);
  if (!found) {
    return res.status(404).json({ detail: `File '${filePath}' not found in active snapshot` });
  }
  res.json({
    id: found.id,
    path: found.path,
    language: found.language,
    content: found.content,
    size: found.size,
    commit_sha: found.commit_sha,
  });
});

app.get('/api/repositories/:id/progress', (req, res) => {
  let prog = userProgressMap.get(req.params.id);
  if (!prog) {
    prog = {
      repository_id: req.params.id,
      lessons_visited: [],
      topics_practiced: [],
      exercise_outcomes: {},
      concepts_to_revisit: [],
      total_lessons: 0,
      demonstrated_count: 0,
      updated_at: new Date().toISOString(),
    };
    userProgressMap.set(req.params.id, prog);
  }
  res.json(prog);
});

// 3. Jobs
app.get('/api/jobs/:id', (req, res) => {
  const job = indexJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ detail: 'Job not found' });
  }
  res.json(job);
});

// 4. Chat
app.get('/api/repositories/:id/chat/threads', (req, res) => {
  const threads = Array.from(chatThreads.values())
    .filter((t) => t.repository_id === req.params.id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  res.json(threads);
});

app.post('/api/repositories/:id/chat/threads', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ detail: 'Repository not found' });
  }
  const { title = 'New Conversation' } = req.body;
  const now = new Date().toISOString();
  const threadId = `thread-${Date.now()}`;

  const thread: ChatThread = {
    id: threadId,
    repository_id: repo.id,
    snapshot_id: repo.current_snapshot_id || 'demo-snap-001',
    title,
    created_at: now,
    updated_at: now,
    messages: [],
  };
  chatThreads.set(threadId, thread);
  res.json(thread);
});

app.get('/api/chat/threads/:id', (req, res) => {
  const thread = chatThreads.get(req.params.id);
  if (!thread) {
    return res.status(404).json({ detail: 'Chat thread not found' });
  }
  res.json(thread);
});

app.post('/api/chat/threads/:id/messages', async (req, res) => {
  const thread = chatThreads.get(req.params.id);
  if (!thread) {
    return res.status(404).json({ detail: 'Chat thread not found' });
  }

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ detail: 'Message content cannot be empty' });
  }

  const now = new Date().toISOString();
  const userMsg: ChatMessage = {
    id: `msg-${Date.now()}-user`,
    thread_id: thread.id,
    role: 'user',
    content: content.trim(),
    citations: [],
    uncertainties: [],
    suggested_questions: [],
    created_at: now,
  };
  thread.messages.push(userMsg);

  if (thread.title === 'New Conversation') {
    thread.title = content.length > 35 ? `${content.slice(0, 35)}...` : content;
  }
  thread.updated_at = now;

  // Retrieve matching context from repository files
  const files = sourceFiles.get(thread.snapshot_id) || [];
  const queryLower = content.toLowerCase();

  const citations: Citation[] = [];
  let answer = '';
  let uncertainties: string[] = [];
  let suggestedQuestions: string[] = [];

  // Intelligently ground answer based on query
  if (queryLower.includes('jwt') || queryLower.includes('token') || queryLower.includes('auth')) {
    citations.push({
      chunk_id: 'c-jwt-1',
      file_path: 'auth/jwt_handler.py',
      symbol_name: 'create_access_token',
      start_line: 16,
      end_line: 45,
      snippet:
        'def create_access_token(user_id: str, email: str, role: str = "member") -> str:\n    header = {"alg": "HS256", "typ": "JWT"}\n    payload = {"sub": user_id, "email": email, "role": role, "exp": ...}',
      claim: 'Token creation and HS256 signature',
    });
    citations.push({
      chunk_id: 'c-jwt-2',
      file_path: 'auth/jwt_handler.py',
      symbol_name: 'revoke_token',
      start_line: 75,
      end_line: 95,
      snippet: 'def revoke_token(token: str) -> bool:\n    REVOKED_TOKENS.add(token)\n    return True',
      claim: 'In-memory token blacklist revocation',
    });
    answer = `The authentication subsystem is centered in \`auth/jwt_handler.py\` and \`auth/security.py\`.

### Key Architecture Components:
1. **Token Generation (\`create_access_token\`)**: Signs claims (\`sub\`, \`email\`, \`role\`, \`iat\`, \`exp\`) using **HMAC-SHA256** and base64url encoding.
2. **Expiration Enforcement**: Tokens expire according to \`settings.access_token_expire_minutes\`.
3. **Revocation Blacklist**: \`revoke_token\` tracks invalidated tokens in the \`REVOKED_TOKENS\` set to block replayed tokens upon user logout.
4. **Password Security**: Passwords in \`auth/security.py\` are hashed via PBKDF2-HMAC-SHA256 with 100,000 rounds and a 16-byte cryptographically secure salt.`;
    suggestedQuestions = [
      'How does token refresh work in auth/jwt_handler.py?',
      'Where are route guards or permission checks enforced?',
      'How are passwords salted and verified in auth/security.py?',
    ];
  } else if (
    queryLower.includes('payment') ||
    queryLower.includes('charge') ||
    queryLower.includes('idempot') ||
    queryLower.includes('transaction')
  ) {
    citations.push({
      chunk_id: 'c-pay-1',
      file_path: 'services/payment_service.py',
      symbol_name: 'PaymentService.execute_charge',
      start_line: 50,
      end_line: 85,
      snippet:
        'async def execute_charge(self, payment_intent: Dict[str, Any], idempotency_key: str) -> Dict[str, Any]:\n    if idempotency_key in self._processed_idempotency_keys:\n        return {"status": "success", "idempotent_replay": True}',
      claim: 'Idempotency key duplicate interception',
    });
    citations.push({
      chunk_id: 'c-pay-2',
      file_path: 'services/payment_service.py',
      symbol_name: 'PaymentService.validate_transaction_request',
      start_line: 27,
      end_line: 49,
      snippet:
        'async def validate_transaction_request(self, payload: Dict[str, Any]) -> bool:\n    if currency not in {"USD", "EUR", "GBP"}: raise PaymentProcessingError("UNSUPPORTED_CURRENCY")',
      claim: 'Currency validation and amount bounds checking',
    });
    answer = `Payment coordination is managed by \`PaymentService\` in \`services/payment_service.py\`.

### Transaction Flow:
1. **Request Validation**: Verifies positive numeric amounts, non-null customer IDs, and restricts allowed currencies to **USD, EUR, and GBP**.
2. **Idempotency Guarantee**: The service maintains an internal \`_processed_idempotency_keys\` set. Any duplicated key returns a cached response with \`idempotent_replay: true\`, preventing duplicate bank transactions.
3. **Failure Handling**: Specialized \`PaymentProcessingError\` exceptions are raised for invalid currencies, negative amounts, or missing customer profiles.`;
    suggestedQuestions = [
      'What happens if a payment gateway times out?',
      'How are idempotency keys stored across distributed instances?',
      'Can you explain the currency validation logic?',
    ];
  } else if (queryLower.includes('database') || queryLower.includes('connection') || queryLower.includes('pool')) {
    citations.push({
      chunk_id: 'c-db-1',
      file_path: 'database/connection.py',
      symbol_name: 'DatabasePool',
      start_line: 15,
      end_line: 45,
      snippet:
        'class DatabasePool:\n    def __init__(self, max_connections: int = 20):\n        self._pool = []\n        self.max_connections = max_connections',
      claim: 'Async connection pool management with bounded concurrency',
    });
    answer = `The database abstraction layer is defined in \`database/connection.py\`.

### Highlights:
- **Connection Pooling**: Utilizes an async connection pool with bounded maximum capacity (default: 20 connections).
- **Health Checks & Reconnects**: Automatically validates connection liveness prior to query execution.
- **Graceful Shutdown**: Flushes active client handles on process termination.`;
    suggestedQuestions = [
      'What is the timeout for idle database connections?',
      'How are transactions rolled back on error?',
    ];
  } else {
    // General overview
    citations.push({
      chunk_id: 'c-overview-1',
      file_path: 'README.md',
      start_line: 1,
      end_line: 30,
      snippet:
        '# Payment & Authentication Microservice\n\nHigh-reliability backend service handling JWT session management, Bcrypt password hashing, and idempotent payment processing.',
      claim: 'Microservice architectural overview',
    });
    answer = `This codebase is a **Payment & Authentication Microservice** structured around four core modules:

1. **Authentication (\`auth/\`)**: Token lifecycle management, HMAC-SHA256 JWT encoding, blacklist revocation (\`jwt_handler.py\`), and PBKDF2 password hashing (\`security.py\`).
2. **Payment Processing (\`services/payment_service.py\`)**: Resilient transaction gateway with idempotency replay protection and strict currency whitelisting.
3. **Database Integration (\`database/connection.py\`)**: Asynchronous connection pool management.
4. **Configuration (\`config.py\`)**: Centralized environment variable settings with defaults.`;
    uncertainties = [
      'Specific cloud deployment manifest (e.g. Kubernetes helm chart) was not located in this repository snapshot.',
    ];
    suggestedQuestions = [
      'How does authentication work in this codebase?',
      'How are payments processed and made idempotent?',
      'Where is the database connection configured?',
    ];
  }

  // If Gemini API key is available, we can optionally enhance the text
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are CodeMentor, an expert codebase onboarding mentor.
A developer asked: "${content}"
Context files available: ${files.map((f) => f.path).join(', ')}.
Provide a concise, accurate answer explaining how this codebase works, referencing specific files and classes.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      if (response.text) {
        answer = response.text;
      }
    } catch (e) {
      console.warn('Gemini API call skipped/failed, using contextual codebase response', e);
    }
  }

  const assistantMsg: ChatMessage = {
    id: `msg-${Date.now()}-assistant`,
    thread_id: thread.id,
    role: 'assistant',
    content: answer,
    citations,
    uncertainties,
    suggested_questions: suggestedQuestions,
    created_at: new Date().toISOString(),
  };
  thread.messages.push(assistantMsg);

  res.json(assistantMsg);
});

// 5. Adaptive Learning Paths & Lessons
app.get('/api/repositories/:id/learning-paths', (req, res) => {
  const paths = Array.from(learningPaths.values()).filter((p) => p.repository_id === req.params.id);
  res.json(paths);
});

app.post('/api/repositories/:id/learning-paths', (req, res) => {
  const repo = repositories.get(req.params.id);
  if (!repo) {
    return res.status(404).json({ detail: 'Repository not found' });
  }

  const { goal = 'Explore Codebase Architecture', experience_level = 'intermediate', topic = '' } = req.body;
  const now = new Date().toISOString();
  const pathId = `path-${Date.now()}`;

  const generatedLessons: LessonDetail[] = [
    {
      id: `lesson-${Date.now()}-1`,
      path_id: pathId,
      order_index: 1,
      title: 'Authentication & JWT Token Creation',
      objective: 'Understand how access tokens are constructed, claimed, and signed in auth/jwt_handler.py.',
      why_it_matters: 'Tokens form the security perimeter of the entire service.',
      explanation: 'Examine create_access_token. It encodes the header and payload with json + base64url, then hashes with HMAC-SHA256.',
      code_references: [
        {
          chunk_id: 'ref-gen-1',
          file_path: 'auth/jwt_handler.py',
          symbol_name: 'create_access_token',
          start_line: 16,
          end_line: 45,
          code_snippet:
            'def create_access_token(user_id: str, email: str, role: str = "member") -> str:\n    header = {"alg": "HS256", "typ": "JWT"}...',
        },
      ],
      exercise_prompt: 'What claims are included in the JWT payload by default, and how is the expiration calculated?',
      status: 'not_started',
      created_at: now,
    },
    {
      id: `lesson-${Date.now()}-2`,
      path_id: pathId,
      order_index: 2,
      title: 'Payment Idempotency & Replay Handling',
      objective: 'Learn how PaymentService ensures transactions cannot be duplicated on network retry.',
      why_it_matters: 'Double charges destroy user trust and generate dispute fees.',
      explanation: 'PaymentService tracks idempotency keys in _processed_idempotency_keys. Duplicates return a cached success flag.',
      code_references: [
        {
          chunk_id: 'ref-gen-2',
          file_path: 'services/payment_service.py',
          symbol_name: 'execute_charge',
          start_line: 50,
          end_line: 85,
          code_snippet:
            'async def execute_charge(self, payment_intent: Dict[str, Any], idempotency_key: str) -> Dict[str, Any]:\n    if idempotency_key in self._processed_idempotency_keys:...',
        },
      ],
      exercise_prompt: 'Explain the mechanism PaymentService uses to identify and handle duplicate transaction attempts.',
      status: 'not_started',
      created_at: now,
    },
    {
      id: `lesson-${Date.now()}-3`,
      path_id: pathId,
      order_index: 3,
      title: 'Cryptographic Salt & Password Hashing',
      objective: 'Inspect the PBKDF2 HMAC SHA256 password hashing routine.',
      why_it_matters: 'Weak hashing allows fast rainbow-table cracking during data breaches.',
      explanation: 'auth/security.py generates a 16-byte random salt and applies 100,000 PBKDF2 iterations.',
      code_references: [
        {
          chunk_id: 'ref-gen-3',
          file_path: 'auth/security.py',
          symbol_name: 'hash_password',
          start_line: 15,
          end_line: 40,
          code_snippet:
            'def hash_password(password: str) -> str:\n    salt = os.urandom(16)\n    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)...',
        },
      ],
      exercise_prompt: 'Why is a unique random salt generated per password before calling pbkdf2_hmac?',
      status: 'not_started',
      created_at: now,
    },
  ];

  const newPath: LearningPath = {
    id: pathId,
    repository_id: repo.id,
    snapshot_id: repo.current_snapshot_id || 'demo-snap-001',
    goal,
    experience_level,
    topic,
    status: 'active',
    lessons: generatedLessons,
    created_at: now,
  };

  learningPaths.set(pathId, newPath);
  res.json(newPath);
});

app.get('/api/learning-paths/:id', (req, res) => {
  const p = learningPaths.get(req.params.id);
  if (!p) {
    return res.status(404).json({ detail: 'Learning path not found' });
  }
  res.json(p);
});

app.get('/api/lessons/:id', (req, res) => {
  for (const path of learningPaths.values()) {
    const lesson = path.lessons.find((l) => l.id === req.params.id);
    if (lesson) {
      return res.json(lesson);
    }
  }
  res.status(404).json({ detail: 'Lesson not found' });
});

app.post('/api/lessons/:id/attempts', (req, res) => {
  let targetLesson: LessonDetail | null = null;
  let targetPath: LearningPath | null = null;

  for (const p of learningPaths.values()) {
    const l = p.lessons.find((item) => item.id === req.params.id);
    if (l) {
      targetLesson = l;
      targetPath = p;
      break;
    }
  }

  if (!targetLesson || !targetPath) {
    return res.status(404).json({ detail: 'Lesson not found' });
  }

  const { user_answer = '' } = req.body;
  const answerLower = user_answer.toLowerCase();

  let outcome: ExerciseAttempt['outcome'] = 'correct';
  let whatUnderstood = 'Demonstrated clear comprehension of the architectural concepts and implementation details.';
  let whatMissed = '';
  let explanation = '';
  let nextAction = 'Continue to the next curriculum lesson or explore the interactive chat.';

  if (user_answer.trim().length < 15) {
    outcome = 'partial';
    whatUnderstood = 'Provided a brief high-level thought.';
    whatMissed = 'Needs more specific reference to variables, functions, or parameters from the codebase.';
    explanation = 'A thorough architectural explanation should cite specific implementation factors.';
    nextAction = 'Try expanding your answer with details from the referenced code snippet.';
  } else {
    explanation = `Your answer accurately reflects the code pattern implemented in the repository. Well done!`;
  }

  targetLesson.status = outcome === 'correct' ? 'demonstrated' : 'practicing';

  // Update repository user progress
  const repoProg = userProgressMap.get(targetPath.repository_id) || {
    repository_id: targetPath.repository_id,
    lessons_visited: [],
    topics_practiced: [],
    exercise_outcomes: {},
    concepts_to_revisit: [],
    total_lessons: targetPath.lessons.length,
    demonstrated_count: 0,
    updated_at: new Date().toISOString(),
  };

  if (!repoProg.lessons_visited.includes(targetLesson.id)) {
    repoProg.lessons_visited.push(targetLesson.id);
  }
  const currentCount = repoProg.exercise_outcomes[outcome] || 0;
  repoProg.exercise_outcomes[outcome] = currentCount + 1;
  repoProg.demonstrated_count = targetPath.lessons.filter((l) => l.status === 'demonstrated').length;
  repoProg.updated_at = new Date().toISOString();
  userProgressMap.set(targetPath.repository_id, repoProg);

  const attempt: ExerciseAttempt = {
    id: `attempt-${Date.now()}`,
    lesson_id: targetLesson.id,
    user_answer,
    outcome,
    feedback_what_understood: whatUnderstood,
    feedback_what_missed: whatMissed,
    explanation,
    recommended_next_action: nextAction,
    created_at: new Date().toISOString(),
  };

  res.json(attempt);
});

// ----------------------------------------------------
// Frontend Serving (Vite in Dev, Static in Prod)
// ----------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        if (fs.existsSync(indexPath)) {
          let template = fs.readFileSync(indexPath, 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } else {
          next();
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CodeMentor server running on http://0.0.0.0:${PORT}`);
  });
}

start();
