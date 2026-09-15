import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Github, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';

export const NewRepositoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.createRepository(url.trim(), branch.trim() || 'main');
      navigate(`/app/repositories/${res.repository_id}/indexing?jobId=${res.job_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to initiate repository indexing.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDemo = () => {
    setUrl('https://github.com/demo/sample-repo');
    setBranch('main');
  };

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <div className="bg-surface border border-border rounded-2xl shadow-sm p-8 sm:p-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
            INGESTION PIPELINE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Connect a Repository
          </h1>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed">
            Provide a public GitHub repository URL. We'll parse Python functions, extract AST symbols, compute Sentence Transformer embeddings, and store them in Qdrant.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-primary">
              GitHub Repository URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Github className="w-5 h-5 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/pallets/flask"
                className="w-full pl-11 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20 font-mono text-text-primary transition-all"
              />
            </div>
            <p className="text-xs text-text-secondary">
              Supports public Python repositories (HTTPS format).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text-primary">
              Branch (Optional)
            </label>
            <div className="relative">
              <GitBranch className="w-5 h-5 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full pl-11 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20 font-mono text-text-primary transition-all"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={handleUseDemo}
              className="text-sm text-indigo hover:text-indigo-hover font-semibold flex items-center gap-1.5 py-2 px-1 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Use Pre-built Python Demo
            </button>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              {loading ? 'Initializing Index...' : 'Start Indexing'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
