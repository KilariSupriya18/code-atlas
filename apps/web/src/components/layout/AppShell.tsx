import React, { useState } from 'react';
import { NavLink, Outlet, useParams, useNavigate, Link } from 'react-router-dom';
import {
  Code2,
  MessageSquare,
  GraduationCap,
  TrendingUp,
  Settings,
  FolderGit2,
  ChevronDown,
  Plus,
  GitBranch,
  GitCommit,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export const AppShell: React.FC = () => {
  const { repoId } = useParams<{ repoId?: string }>();
  const navigate = useNavigate();
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  const { data: repos } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.listRepositories,
  });

  const { data: currentRepoData } = useQuery({
    queryKey: ['repository', repoId],
    queryFn: () => (repoId ? api.getRepository(repoId) : null),
    enabled: !!repoId,
  });

  const currentRepo = currentRepoData?.repository;
  const currentSnapshot = currentRepoData?.current_snapshot;

  const navLinks = repoId
    ? [
        { to: `/app/repositories/${repoId}/overview`, label: 'Overview', icon: FolderGit2 },
        { to: `/app/repositories/${repoId}/chat`, label: 'Ask Codebase', icon: MessageSquare },
        { to: `/app/repositories/${repoId}/learn`, label: 'Learn', icon: GraduationCap },
        { to: `/app/repositories/${repoId}/progress`, label: 'Progress', icon: TrendingUp },
      ]
    : [];

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden font-sans">
      {/* Sidebar (~224px width) */}
      <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link to="/app" className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
              CM
            </div>
            <span className="font-semibold text-text-primary tracking-tight text-base">
              CodeMentor
            </span>
          </Link>
        </div>

        {/* Repository Switcher */}
        <div className="p-3 border-b border-border relative">
          <button
            onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium text-text-primary bg-slate-50 hover:bg-slate-100 border border-border rounded-md transition-colors"
          >
            <span className="truncate">
              {currentRepo ? currentRepo.name : 'Select Repository'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-secondary shrink-0 ml-1" />
          </button>

          {repoDropdownOpen && (
            <div className="absolute left-3 right-3 top-14 bg-surface border border-border rounded-md shadow-lg z-50 py-1 text-xs">
              <div className="max-h-48 overflow-y-auto">
                {repos?.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRepoDropdownOpen(false);
                      navigate(`/app/repositories/${r.id}/overview`);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-primary-light hover:text-primary transition-colors truncate ${
                      r.id === repoId ? 'bg-primary-light text-primary font-medium' : 'text-text-primary'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-border mt-1 pt-1">
                <Link
                  to="/app/repositories/new"
                  onClick={() => setRepoDropdownOpen(false)}
                  className="flex items-center px-3 py-1.5 text-text-secondary hover:text-primary hover:bg-slate-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Connect Repository
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Primary Navigation Links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-2.5 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Settings Link */}
        <div className="p-2 border-t border-border">
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              `flex items-center px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
              }`
            }
          >
            <Settings className="w-4 h-4 mr-2.5 shrink-0" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center space-x-3 text-xs text-text-secondary">
            {currentRepo ? (
              <>
                <span className="font-semibold text-text-primary text-sm">
                  {currentRepo.full_name}
                </span>
                <span className="text-slate-300">/</span>
                <div className="flex items-center space-x-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-mono">
                  <GitBranch className="w-3 h-3" />
                  <span>{currentSnapshot?.branch || currentRepo.default_branch}</span>
                </div>
                {currentSnapshot?.commit_sha && (
                  <div className="flex items-center space-x-1 text-slate-400 font-mono text-[11px]">
                    <GitCommit className="w-3 h-3" />
                    <span>{currentSnapshot.commit_sha.slice(0, 7)}</span>
                  </div>
                )}
              </>
            ) : (
              <span className="font-medium text-text-secondary">CodeMentor Workspace</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/app/repositories/new"
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Connect Repository
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
