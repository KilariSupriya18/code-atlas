import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from './pages/Landing';
import { DashboardPage } from './pages/Dashboard';
import { NewRepositoryPage } from './pages/NewRepository';
import { IndexingStatusPage } from './pages/IndexingStatus';
import { RepoOverviewPage } from './pages/RepoOverview';
import { ChatPage } from './pages/ChatPage';
import { LearnPathPage } from './pages/LearnPathPage';
import { LessonPage } from './pages/LessonPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppShell } from './components/layout/AppShell';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Landing / Preview */}
          <Route path="/" element={<LandingPage />} />

          {/* App Workspace Shell */}
          <Route path="/app" element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="repositories/new" element={<NewRepositoryPage />} />
            <Route path="repositories/:repoId/indexing" element={<IndexingStatusPage />} />
            <Route path="repositories/:repoId/overview" element={<RepoOverviewPage />} />
            <Route path="repositories/:repoId/chat" element={<ChatPage />} />
            <Route path="repositories/:repoId/learn" element={<LearnPathPage />} />
            <Route path="repositories/:repoId/learn/:pathId" element={<LearnPathPage />} />
            <Route
              path="repositories/:repoId/learn/:pathId/lessons/:lessonId"
              element={<LessonPage />}
            />
            <Route path="repositories/:repoId/progress" element={<ProgressPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
