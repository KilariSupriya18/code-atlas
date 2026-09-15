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
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

export const AppShell: React.FC = () => {
  const { repoId } = useParams<{ repoId?: string }>();
  const navigate = useNavigate();
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="h-[70px] flex items-center px-5 border-b border-border shrink-0">
        <Link to="/app" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-indigo text-white flex items-center justify-center shadow-xs group-hover:bg-indigo-hover transition-colors">
            <Code2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-text-primary tracking-tight text-[17px] leading-tight">
              CodeMentor
            </span>
            <span className="text-[11px] font-mono text-text-secondary tracking-wide">
              developer workspace
            </span>
          </div>
        </Link>
      </div>

      {/* Repository Switcher */}
      <div className="p-3.5 border-b border-border relative shrink-0">
        <button
          onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
          className="w-full h-11 flex items-center justify-between px-3 text-[14px] font-medium text-text-primary bg-slate-50 hover:bg-slate-100 border border-border rounded-xl transition-colors"
        >
          <div className="flex items-center space-x-2 truncate">
            <FolderGit2 className="w-4 h-4 text-text-secondary shrink-0" />
            <span className="truncate">
              {currentRepo ? currentRepo.name : 'Select Repository'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-text-secondary shrink-0 ml-1.5" />
        </button>

        {repoDropdownOpen && (
          <div className="absolute left-3.5 right-3.5 top-16 bg-surface border border-border rounded-xl shadow-lg z-50 py-1.5 text-[14px]">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              Available Repositories
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
              {repos?.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setRepoDropdownOpen(false);
                    setMobileMenuOpen(false);
                    navigate(`/app/repositories/${r.id}/overview`);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-indigo-tint hover:text-indigo transition-colors truncate ${
                    r.id === repoId ? 'bg-indigo-tint text-indigo font-semibold' : 'text-text-primary'
                  }`}
                >
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-[12px] text-text-secondary font-mono truncate">
                    {r.url}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-border mt-1 pt-1">
              <Link
                to="/app/repositories/new"
                onClick={() => {
                  setRepoDropdownOpen(false);
                  setMobileMenuOpen(false);
                }}
                className="flex items-center px-3.5 py-2 text-[13px] text-text-secondary hover:text-indigo hover:bg-indigo-tint/50 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Repository
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-text-secondary/70">
          Navigation
        </div>
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center h-12 px-3.5 rounded-xl text-[15px] font-medium transition-all relative ${
                  isActive
                    ? 'bg-indigo-tint text-indigo font-semibold shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-2.5 bottom-2.5 w-1 bg-indigo rounded-r" />
                  )}
                  <Icon className={`w-5 h-5 mr-3 shrink-0 ${isActive ? 'text-indigo' : 'text-text-secondary'}`} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Settings Link */}
      <div className="p-3 border-t border-border shrink-0">
        <NavLink
          to="/app/settings"
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center h-12 px-3.5 rounded-xl text-[15px] font-medium transition-colors ${
              isActive
                ? 'bg-indigo-tint text-indigo font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-slate-100'
            }`
          }
        >
          <Settings className="w-5 h-5 mr-3 shrink-0" />
          Settings
        </NavLink>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-canvas text-text-primary overflow-hidden font-sans">
      {/* Desktop Sidebar (256px wide) */}
      <aside className="w-64 bg-surface border-r border-border flex flex-col shrink-0 hidden md:flex">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-text-primary/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-surface h-full shadow-2xl flex flex-col z-10">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar (70px height) */}
        <header className="h-[70px] bg-surface border-b border-border flex items-center justify-between px-6 sm:px-8 shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-slate-100 rounded-lg md:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {currentRepo ? (
              <div className="flex items-center space-x-2.5 min-w-0">
                <span
                  className="font-bold text-text-primary text-[15px] sm:text-[17px] truncate"
                  title={currentRepo.full_name}
                >
                  {currentRepo.full_name}
                </span>
                <span className="text-border hidden sm:inline">|</span>
                <div className="hidden sm:flex items-center space-x-1.5 bg-slate-100 text-text-secondary px-2.5 py-1 rounded-md text-[13px] font-mono border border-border/60">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{currentSnapshot?.branch || currentRepo.default_branch}</span>
                </div>
                {currentSnapshot?.commit_sha && (
                  <div className="hidden lg:flex items-center space-x-1.5 text-text-secondary font-mono text-[13px] bg-slate-50 px-2.5 py-1 rounded-md border border-border/40" title={currentSnapshot.commit_sha}>
                    <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                    <span>{currentSnapshot.commit_sha.slice(0, 7)}</span>
                  </div>
                )}
              </div>
            ) : (
              <span className="font-semibold text-text-primary text-[16px]">
                CodeMentor Workspace
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Link
              to="/app/repositories/new"
              className="inline-flex items-center h-11 px-4 text-[15px] font-medium text-white bg-indigo hover:bg-indigo-hover rounded-xl shadow-xs transition-colors gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Repository</span>
            </Link>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-auto bg-canvas">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
