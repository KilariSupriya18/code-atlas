import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FolderGit2,
  Plus,
  ArrowRight,
  MessageSquare,
  GraduationCap,
  Sparkles,
  GitBranch,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: repos, isLoading, refetch } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.listRepositories,
  });

  const handleDemoClick = async () => {
    try {
      const res = await api.createRepository('https://github.com/demo/sample-repo', 'main');
      navigate(`/app/repositories/${res.repository_id}/indexing?jobId=${res.job_id}`);
    } catch {
      refetch();
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Repository Dashboard
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Manage your ingested repositories, inspect architecture, and track learning progress.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleDemoClick}
            className="px-3 py-1.5 text-xs font-medium text-text-primary bg-surface border border-border hover:bg-slate-50 rounded-md transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Index Sample Demo
          </button>
          <Link
            to="/app/repositories/new"
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Repository
          </Link>
        </div>
      </div>

      {/* Repository Cards Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-xs text-text-secondary">
          Loading repositories...
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-text-secondary">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              No repositories connected yet
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
              Connect a public GitHub repository or index our pre-built Python sample repository to explore CodeMentor immediately.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleDemoClick}
              className="px-4 py-2 text-xs font-medium text-primary bg-primary-light hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
            >
              Explore Sample Demo
            </button>
            <Link
              to="/app/repositories/new"
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md transition-colors"
            >
              Connect GitHub URL
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="bg-surface border border-border rounded-xl p-5 hover:border-slate-300 transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <FolderGit2 className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-text-primary truncate max-w-[180px]">
                      {repo.name}
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-text-secondary bg-slate-100 px-2 py-0.5 rounded">
                    {repo.default_branch}
                  </span>
                </div>

                <p className="text-xs text-text-secondary mt-1 font-mono truncate">
                  {repo.full_name}
                </p>

                <div className="mt-4 flex items-center space-x-2 text-[11px] text-text-secondary">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Added {new Date(repo.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                <Link
                  to={`/app/repositories/${repo.id}/overview`}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1"
                >
                  Overview
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <div className="flex items-center space-x-2">
                  <Link
                    to={`/app/repositories/${repo.id}/chat`}
                    className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary-light rounded transition-colors"
                    title="Ask Codebase"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/app/repositories/${repo.id}/learn`}
                    className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary-light rounded transition-colors"
                    title="Learn Codebase"
                  >
                    <GraduationCap className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
