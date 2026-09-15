import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap,
  Sparkles,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  BookOpen,
  Loader2,
  Target,
} from 'lucide-react';
import { api, LearningPath } from '../api/client';

export const LearnPathPage: React.FC = () => {
  const { repoId, pathId } = useParams<{ repoId: string; pathId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState('I know Python and need to understand authentication and payment failures in this project.');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [topic, setTopic] = useState('Authentication & Payment Service');
  const [showForm, setShowForm] = useState(false);

  // Fetch learning paths
  const { data: paths, isLoading } = useQuery({
    queryKey: ['learning-paths', repoId],
    queryFn: () => (repoId ? api.listLearningPaths(repoId) : []),
    enabled: !!repoId,
  });

  // Selected path detail
  const activePathId = pathId || (paths && paths.length > 0 ? paths[0].id : null);
  const { data: selectedPath } = useQuery({
    queryKey: ['learning-path', activePathId],
    queryFn: () => (activePathId ? api.getLearningPath(activePathId) : null),
    enabled: !!activePathId,
  });

  // Create path mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!repoId) throw new Error('Missing repoId');
      return api.createLearningPath(repoId, goal, experienceLevel, topic);
    },
    onSuccess: (newPath) => {
      queryClient.invalidateQueries({ queryKey: ['learning-paths', repoId] });
      setShowForm(false);
      navigate(`/app/repositories/${repoId}/learn/${newPath.id}`);
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Learn the Codebase
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Personalized onboarding curriculum grounded in parsed source code, with check-for-understanding exercises.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1.5 self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          New Learning Goal
        </button>
      </div>

      {/* Goal Creator Modal / Collapsible Form */}
      {showForm && (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-text-primary mb-1">
            Define Your Onboarding Goal
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            CodeMentor will retrieve relevant architecture modules and synthesize progressive lessons with evaluation rubrics.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Learning Goal
              </label>
              <textarea
                rows={2}
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g., I know Python and need to understand authentication in this project."
                className="w-full p-2.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:border-primary text-text-primary"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full p-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:border-primary text-text-primary"
                >
                  <option value="beginner">Beginner (Need step-by-step guidance)</option>
                  <option value="intermediate">Intermediate (Familiar with Python / architecture)</option>
                  <option value="advanced">Advanced (Deep dive into contracts & edge cases)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Topic Focus (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Auth & Error Handling"
                  className="w-full p-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:border-primary text-text-primary"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || !goal.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating Curriculum...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate Learning Path
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Learning Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Previous Paths List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
            Learning Paths ({paths?.length ?? 0})
          </h3>

          {isLoading ? (
            <div className="text-xs text-text-secondary">Loading paths...</div>
          ) : !paths || paths.length === 0 ? (
            <div className="p-4 bg-surface border border-border rounded-lg text-xs text-text-secondary">
              No learning paths yet. Create your first onboarding goal above!
            </div>
          ) : (
            paths.map((p) => {
              const isSelected = p.id === activePathId;
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/app/repositories/${repoId}/learn/${p.id}`)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-surface border-primary shadow-sm ring-1 ring-primary'
                      : 'bg-surface border-border hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-text-secondary mb-1">
                    <span className="capitalize font-medium text-primary">
                      {p.experience_level}
                    </span>
                    <span>{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary line-clamp-2">
                    {p.goal}
                  </h4>
                  <div className="mt-2 flex items-center text-[11px] text-text-secondary">
                    <BookOpen className="w-3.5 h-3.5 mr-1" />
                    {p.lessons.length} Lessons Planned
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Selected Path & Lessons Overview */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPath ? (
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <div className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium mb-2">
                  <Target className="w-3 h-3" />
                  <span>Active Onboarding Plan</span>
                </div>
                <h2 className="text-base font-bold text-text-primary">
                  {selectedPath.goal}
                </h2>
                {selectedPath.topic && (
                  <p className="text-xs text-text-secondary mt-1">
                    Focus: {selectedPath.topic}
                  </p>
                )}
              </div>

              {/* Ordered Lesson Steps */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Lessons in this Path
                </h3>

                <div className="divide-y divide-border/60">
                  {selectedPath.lessons.map((lesson, idx) => {
                    const isDemonstrated = lesson.status === 'demonstrated';
                    const isPracticing = lesson.status === 'practicing';

                    return (
                      <div
                        key={lesson.id}
                        className="py-3.5 flex items-start justify-between gap-4 group"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="mt-0.5 shrink-0">
                            {isDemonstrated ? (
                              <div className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            ) : isPracticing ? (
                              <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px]">
                                P
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-100 text-text-secondary flex items-center justify-center font-bold text-[11px]">
                                {idx + 1}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
                              {lesson.title}
                            </h4>
                            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                              {lesson.objective}
                            </p>
                          </div>
                        </div>

                        <Link
                          to={`/app/repositories/${repoId}/learn/${selectedPath.id}/lessons/${lesson.id}`}
                          className="shrink-0 px-3 py-1 text-xs font-medium text-primary bg-primary-light hover:bg-blue-100 rounded transition-colors flex items-center gap-1"
                        >
                          {isDemonstrated ? 'Review' : 'Start'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-12 text-center text-xs text-text-secondary">
              Select or generate a learning path to begin your onboarding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
