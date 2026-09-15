import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Code2,
  ArrowRight,
  GitPullRequest,
  CheckCircle2,
  Layers,
  Sparkles,
  Terminal,
  Search,
  BookOpen,
} from 'lucide-react';
import { api } from '../api/client';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [demoLoading, setDemoLoading] = useState(false);

  const handleExploreDemo = async () => {
    setDemoLoading(true);
    try {
      // Ingest the local sample demo repository
      const res = await api.createRepository('https://github.com/demo/sample-repo', 'main');
      navigate(`/app/repositories/${res.repository_id}/indexing?jobId=${res.job_id}`);
    } catch (err) {
      // If already created, navigate to dashboard
      navigate('/app');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col font-sans selection:bg-primary-light selection:text-primary">
      {/* Top Navbar */}
      <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40 flex items-center justify-between px-8 max-w-6xl w-full mx-auto">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo text-white flex items-center justify-center font-bold text-sm shadow-sm">
            CA
          </div>
          <span className="font-semibold text-text-primary text-lg tracking-tight">CodeAtlas</span>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            to="/app"
            className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
          <button
            onClick={handleExploreDemo}
            disabled={demoLoading}
            className="px-3.5 py-1.5 text-xs font-medium text-text-primary bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            {demoLoading ? 'Starting demo...' : 'Explore Demo'}
          </button>
          <Link
            to="/app/repositories/new"
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5"
          >
            Connect Repository
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-light border border-blue-200 text-primary text-xs font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Codebase RAG & Developer Onboarding</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-text-primary tracking-tight max-w-3xl leading-tight">
          Understand the code. <br />
          <span className="text-primary">Learn your way around.</span>
        </h1>

        <p className="mt-5 text-base md:text-lg text-text-secondary max-w-2xl leading-relaxed">
          Ingest any Python repository. Ask natural language questions with exact, clickable source code citations, and master architecture through personalized, source-grounded learning paths.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Link
            to="/app/repositories/new"
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            Connect Repository
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            onClick={handleExploreDemo}
            disabled={demoLoading}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-text-primary bg-surface border border-border hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {demoLoading ? 'Preparing sample...' : 'Explore Demo'}
          </button>
        </div>

        {/* Pipeline Preview Card */}
        <div className="mt-14 w-full bg-surface border border-border rounded-xl shadow-sm p-6 text-left">
          <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-rose-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="ml-2 text-xs font-mono text-text-secondary">
                pipeline.architecture.py
              </span>
            </div>
            <span className="text-xs text-text-secondary font-mono bg-slate-100 px-2 py-0.5 rounded">
              bge-small-en-v1.5 + Qdrant + Groq
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/60">
              <div className="w-7 h-7 rounded bg-blue-100 text-primary flex items-center justify-center mb-3">
                <Terminal className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-text-primary mb-1">
                1. AST & Tree-Sitter Parsing
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Extracts functions, async functions, classes, decorators, signatures, docstrings, and exact line spans.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/60">
              <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-text-primary mb-1">
                2. Hybrid RRF Retrieval
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Combines 384-dim dense vectors from Qdrant, BM25 lexical ranking, and exact symbol matching with Reciprocal Rank Fusion.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/60">
              <div className="w-7 h-7 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-text-primary mb-1">
                3. Grounded Q&A & Adaptive Learning
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Groq answers with verified citations opening Monaco editor, plus tailored lesson rubrics and remediation.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-secondary">
        <p>CodeAtlas — Production RAG Codebase Assistant for Fast Developer Onboarding</p>
      </footer>
    </div>
  );
};
