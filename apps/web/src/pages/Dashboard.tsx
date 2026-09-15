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
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
            WORKSPACE
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Repository Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your indexed repositories, inspect architecture, and track onboarding journeys.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDemoClick}
            className="px-4 py-2.5 text-sm font-semibold text-text-primary bg-surface border border-border hover:bg-canvas rounded-lg transition-all flex items-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-indigo" />
            Index Sample Demo
          </button>
          <Link
            to="/app/repositories/new"
            className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Connect Repository
          </Link>
        </div>
      </div>

      {/* Repository Cards Grid */}
      {isLoading ? (
        <div className="text-center py-20 text-sm text-text-secondary">
          Loading repositories...
        </div>
      ) : !repos || repos.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 sm:p-16 text-center space-y-5 max-w-xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-indigo-tint flex items-center justify-center mx-auto text-indigo border border-indigo/20">
            <FolderGit2 className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-text-primary">
              No repositories connected yet
            </h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
              Connect a public GitHub repository or index our pre-built Python demo to explore CodeAtlas immediately.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleDemoClick}
              className="px-4 py-2.5 text-sm font-semibold text-indigo bg-indigo-tint hover:bg-indigo-tint/80 border border-indigo/30 rounded-lg transition-colors"
            >
              Explore Sample Demo
            </button>
            <Link
              to="/app/repositories/new"
              className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover rounded-lg transition-colors"
            >
              Connect GitHub URL
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="bg-surface border border-border rounded-2xl p-6 hover:border-indigo/40 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-tint text-indigo flex items-center justify-center shrink-0">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-text-primary truncate">
                      {repo.name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-text-secondary bg-canvas px-2 py-0.5 rounded border border-border shrink-0">
                    {repo.default_branch}
                  </span>
                </div>

                <p className="text-xs text-text-secondary font-mono truncate bg-canvas px-2.5 py-1.5 rounded-md border border-border/60">
                  {repo.full_name}
                </p>

                <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Added {new Date(repo.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <Link
                  to={`/app/repositories/${repo.id}/overview`}
                  className="text-sm font-semibold text-text-primary hover:text-indigo inline-flex items-center gap-1.5 transition-colors"
                >
                  Overview
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>

                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/app/repositories/${repo.id}/chat`}
                    className="p-2 text-text-secondary hover:text-indigo hover:bg-indigo-tint rounded-lg transition-colors"
                    title="Ask Codebase"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/app/repositories/${repo.id}/learn`}
                    className="p-2 text-text-secondary hover:text-teal hover:bg-teal-tint rounded-lg transition-colors"
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
