export interface Repository {
  id: string;
  name: string;
  full_name: string;
  url: string;
  default_branch: string;
  current_snapshot_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: string;
  repository_id: string;
  commit_sha: string;
  branch: string;
  status: string;
  file_count: number;
  symbol_count: number;
  chunk_count: number;
  embedding_model: string;
  vector_dim: number;
  created_at: string;
}

export interface IndexJob {
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

export interface Citation {
  chunk_id: string;
  file_path: string;
  symbol_name?: string;
  start_line: number;
  end_line: number;
  snippet: string;
  claim?: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  uncertainties: string[];
  suggested_questions: string[];
  created_at: string;
}

export interface ChatThread {
  id: string;
  repository_id: string;
  snapshot_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface LessonReference {
  chunk_id: string;
  file_path: string;
  symbol_name?: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
}

export interface LessonSummary {
  id: string;
  path_id: string;
  order_index: number;
  title: string;
  objective: string;
  status: 'not_started' | 'practicing' | 'demonstrated';
  created_at: string;
}

export interface LessonDetail {
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

export interface LearningPath {
  id: string;
  repository_id: string;
  snapshot_id: string;
  goal: string;
  experience_level: string;
  topic?: string;
  status: string;
  lessons: LessonSummary[];
  created_at: string;
}

export interface ExerciseAttempt {
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

export interface UserProgress {
  repository_id: string;
  lessons_visited: string[];
  topics_practiced: string[];
  exercise_outcomes: Record<string, number>;
  concepts_to_revisit: string[];
  total_lessons: number;
  demonstrated_count: number;
  updated_at: string;
}

const BASE_URL = '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Capabilities & Settings
  getCapabilities: () => fetch(`${BASE_URL}/api/capabilities`).then(handleResponse<any>),
  getSettings: () => fetch(`${BASE_URL}/api/settings`).then(handleResponse<any>),
  updateGroqKey: (apiKey: string) =>
    fetch(`${BASE_URL}/api/settings/groq-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    }).then(handleResponse<any>),

  // Repositories
  listRepositories: () => fetch(`${BASE_URL}/api/repositories`).then(handleResponse<Repository[]>),
  getRepository: (repoId: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}`).then(
      handleResponse<{ repository: Repository; current_snapshot: Snapshot | null }>
    ),
  createRepository: (url: string, branch: string = 'main') =>
    fetch(`${BASE_URL}/api/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, branch }),
    }).then(handleResponse<{ repository_id: string; snapshot_id: string; job_id: string; status: string }>),
  reindexRepository: (repoId: string, branch?: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch }),
    }).then(handleResponse<{ job_id: string; snapshot_id: string }>),
  listFiles: (repoId: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/files`).then(
      handleResponse<Array<{ id: string; path: string; language: string; size: number; commit_sha: string }>>
    ),
  getSource: (repoId: string, path: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/source?path=${encodeURIComponent(path)}`).then(
      handleResponse<{ id: string; path: string; language: string; content: string; size: number; commit_sha: string }>
    ),
  getProgress: (repoId: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/progress`).then(handleResponse<UserProgress>),

  // Jobs
  getJob: (jobId: string) => fetch(`${BASE_URL}/api/jobs/${jobId}`).then(handleResponse<IndexJob>),

  // Chat
  listThreads: (repoId: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/chat/threads`).then(handleResponse<ChatThread[]>),
  createThread: (repoId: string, title?: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/chat/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then(handleResponse<ChatThread>),
  getThread: (threadId: string) =>
    fetch(`${BASE_URL}/api/chat/threads/${threadId}`).then(handleResponse<ChatThread>),
  sendMessage: (threadId: string, content: string) =>
    fetch(`${BASE_URL}/api/chat/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).then(handleResponse<ChatMessage>),

  // Learning
  listLearningPaths: (repoId: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/learning-paths`).then(handleResponse<LearningPath[]>),
  createLearningPath: (repoId: string, goal: string, experienceLevel: string, topic?: string) =>
    fetch(`${BASE_URL}/api/repositories/${repoId}/learning-paths`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, experience_level: experienceLevel, topic }),
    }).then(handleResponse<LearningPath>),
  getLearningPath: (pathId: string) =>
    fetch(`${BASE_URL}/api/learning-paths/${pathId}`).then(handleResponse<LearningPath>),
  getLesson: (lessonId: string) =>
    fetch(`${BASE_URL}/api/lessons/${lessonId}`).then(handleResponse<LessonDetail>),
  submitAttempt: (lessonId: string, userAnswer: string) =>
    fetch(`${BASE_URL}/api/lessons/${lessonId}/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_answer: userAnswer }),
    }).then(handleResponse<ExerciseAttempt>),
};
