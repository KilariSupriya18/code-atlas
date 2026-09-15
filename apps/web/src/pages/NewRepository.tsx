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
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-surface border border-border rounded-xl shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-text-primary tracking-tight">
            Connect a Repository
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Provide a public GitHub repository URL. We'll parse Python functions, extract AST symbols, compute Sentence Transformer embeddings, and store them in Qdrant.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-md bg-danger-light border border-danger-border text-danger text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              GitHub Repository URL <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Github className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/pallets/flask"
                className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-md bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-text-primary"
              />
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Supports public Python repositories (HTTPS format).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-primary mb-1">
              Branch (Optional)
            </label>
            <div className="relative">
              <GitBranch className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full pl-9 pr-3 py-2 text-xs border border-border rounded-md bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono text-text-primary"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={handleUseDemo}
              className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Use Pre-built Python Demo
            </button>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-md shadow-sm transition-colors flex items-center gap-1.5"
            >
              {loading ? 'Initializing Index...' : 'Start Indexing'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
