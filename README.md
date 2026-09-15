# CodeAtlas — Codebase RAG & Adaptive Onboarding Platform

[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Qdrant](https://img.shields.io/badge/Vector_DB-Qdrant-DC2626.svg)](https://qdrant.tech/)
[![Groq](https://img.shields.io/badge/LLM-Groq_LPU-F55036.svg)](https://groq.com/)

CodeAtlas is a developer onboarding platform designed to solve the codebase comprehension challenge. It ingests public Git repositories, parses raw code files into function-level and class-level semantic chunks using AST & Tree-sitter, computes dense vector embeddings using local Sentence Transformers, stores them in Qdrant, and provides grounded question answering and adaptive learning paths powered by Groq.

---

## Key Features

1. **Deterministic Repository Ingestion**:
   - Safely accepts public HTTPS GitHub URLs.
   - Restricts operations through argument arrays (`shell=False`) to prevent path traversal or shell injection.
   - Parses functions, async functions, classes, methods, signatures, decorators, docstrings, and exact line ranges.
   - Splits oversized functions while preserving parent identity.
   - Exposes live pipeline stages: `queued -> fetching -> parsing -> embedding -> finalizing -> ready/failed`.

2. **Accurate Hybrid Retrieval & Grounding**:
   - **Dense Vectors**: 384-dimensional normalized embeddings generated locally with `BAAI/bge-small-en-v1.5` and stored in Qdrant.
   - **Lexical Ranking**: True BM25Plus ranked retrieval over code symbols, signatures, and docstrings.
   - **Exact Identifier Matching**: Keyword boost for target function and class names.
   - **Reciprocal Rank Fusion (RRF)**: Merges dense, lexical, and exact rankings with rank constant $k=60$.
   - **Strict Server-Side Citation Validation**: Resolves model citations against database records, ensuring cited files, symbols, line numbers, and snippets match canonical code.

3. **Adaptive Onboarding ("Learn the Codebase")**:
   - Tailored learning paths based on developer experience level (beginner, intermediate, advanced) and goal.
   - Progressive lessons citing exact codebase modules.
   - Repository-specific short-answer exercises evaluated against hidden server-side rubrics.
   - Structured remediation: what was understood, what was missed, source-backed explanation, and targeted remediation questions.
   - Saved progress tracking lessons visited, demonstrated mastery, and concepts to revisit.

4. **Calm Developer Workspace UI**:
   - Built with React, TypeScript, Tailwind CSS, TanStack Query, and lazy-loaded Monaco Editor.
   - Split-view code panel with highlighted line ranges, file breadcrumbs, and GitHub commit links.
   - Responsive design with collapsible navigation and draft response persistence.

---

## Architecture Diagram

```
                              [ GitHub Repository ]
                                        │
                                        ▼ (Safe git fetch)
                             [ AST / Tree-sitter ]
                           (Functions, Classes, Lines)
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
     [ Sentence Transformers ]                         [ BM25 Tokenizer ]
      (BAAI/bge-small-en-v1.5)                            (Lexical index)
                 │                                             │
                 ▼                                             ▼
          [ Qdrant Vector ]                            [ BM25 Ranker ]
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        ▼
                           [ Reciprocal Rank Fusion ]
                                        │
                                        ▼ (Top ~6-8 Chunks)
                              [ Groq LPU Adapter ]
                           (llama-3.3-70b-versatile)
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
         [ Ask Codebase ]                              [ Learn Codebase ]
   (Cited QA + Monaco Viewer)                     (Rubric Grading + Progress)
```

---

## Quickstart & Local Startup

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+
- Git

### 1. Backend Setup

```bash
# Activate the virtual environment
# Windows PowerShell:
C:\Users\supri\.venv_codementor\Scripts\activate

# Start the FastAPI server on port 8000
python -m uvicorn apps.api.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup

```bash
cd apps/web

# Install dependencies (already installed in workspace)
npm install

# Start Vite development server on port 5173
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 1-Click Demo Walkthrough

1. **Landing Page (`/`)**:
   - Click **"Explore Demo"** or **"Connect Repository"**.
   - CodeAtlas automatically ingests the realistic sample authentication and payment service (`demo/sample_repo`).
2. **Live Indexing (`/app/repositories/:id/indexing`)**:
   - Observe live real-time pipeline stages: `queued -> fetching -> parsing -> embedding -> finalizing -> ready`.
   - Real counts for files parsed, functions/classes extracted, and vectors embedded.
3. **Repository Overview (`/app/repositories/:id/overview`)**:
   - View snapshot statistics (files, symbols, vector chunks, commit SHA).
   - Browse canonical source files.
4. **Ask the Codebase (`/app/repositories/:id/chat`)**:
   - Click starter query: *"Where is the authentication logic handled?"*
   - Groq synthesizes the grounded answer.
   - Click the citation chip (`[auth/security.py:L14-L45]`) to view the code in Monaco Editor with the exact highlighted line range.
   - Ask: *"What happens when a payment transaction fails?"* to inspect failure branching logic.
5. **Learn the Codebase (`/app/repositories/:id/learn`)**:
   - Click *"New Learning Goal"*: *"I know Python and need to understand authentication and payment failures in this project."*
   - Read Lesson 1, review code references.
   - Submit an answer to the check-for-understanding exercise.
   - Inspect the rubric evaluation: what was understood, what was missed, and recommended next action.
6. **Progress Tracking (`/app/repositories/:id/progress`)**:
   - View demonstrated competencies and auto-populated concepts to revisit.

---

## Retrieval Evaluation Benchmark Results

Tested on `demo/sample_repo` using `tests/test_evaluation_benchmark.py`:

| Query | Measured Latency | Expected Symbols | Matched? | Top Symbols Retrieved |
|---|---|---|---|---|
| *"Where is password hashing and authentication handled?"* | **49.42 ms** | `hash_password`, `verify_password`, `login_endpoint` | **PASS** | `hash_password`, `login_endpoint` |
| *"What happens when a payment fails or encounters an error?"* | **42.13 ms** | `PaymentProcessingError`, `execute_charge` | **PASS** | `PaymentProcessingError`, `execute_charge` |
| *"Where are database connections initialized?"* | **35.13 ms** | `DatabasePoolManager`, `initialize_pool` | **PASS** | `DatabasePoolManager`, `initialize_pool` |
| *"How is JWT token signature verified?"* | **37.58 ms** | `decode_and_verify_token`, `create_access_token` | **PASS** | `decode_and_verify_token`, `create_access_token` |

---

## Test Suite Execution

Run all unit, integration, and benchmark tests:

```bash
C:\Users\supri\.venv_codementor\Scripts\python.exe -m pytest tests -v
```

All 9 tests pass with 100% success.
