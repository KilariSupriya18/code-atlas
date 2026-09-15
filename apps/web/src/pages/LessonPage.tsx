import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Code2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { api, LessonReference, ExerciseAttempt } from '../api/client';
import { CodeViewer } from '../components/code/CodeViewer';

export const LessonPage: React.FC = () => {
  const { repoId, pathId, lessonId } = useParams<{ repoId: string; pathId: string; lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [userAnswer, setUserAnswer] = useState('');
  const [activeRef, setActiveRef] = useState<LessonReference | null>(null);
  const [refFileContent, setRefFileContent] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<ExerciseAttempt | null>(null);

  // Restore draft response from localStorage
  useEffect(() => {
    if (lessonId) {
      const draft = localStorage.getItem(`draft_lesson_${lessonId}`);
      if (draft) setUserAnswer(draft);
    }
  }, [lessonId]);

  // Save draft on change
  const handleAnswerChange = (val: string) => {
    setUserAnswer(val);
    if (lessonId) {
      localStorage.setItem(`draft_lesson_${lessonId}`, val);
    }
  };

  // Fetch lesson detail
  const { data: lesson, isLoading } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => (lessonId ? api.getLesson(lessonId) : null),
    enabled: !!lessonId,
  });

  // Fetch learning path to get next/prev lesson links
  const { data: pathData } = useQuery({
    queryKey: ['learning-path', pathId],
    queryFn: () => (pathId ? api.getLearningPath(pathId) : null),
    enabled: !!pathId,
  });

  // Submit exercise attempt mutation
  const attemptMutation = useMutation({
    mutationFn: async (answerText: string) => {
      if (!lessonId) throw new Error('Missing lessonId');
      return api.submitAttempt(lessonId, answerText);
    },
    onSuccess: (attempt) => {
      setLatestAttempt(attempt);
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['learning-path', pathId] });
      queryClient.invalidateQueries({ queryKey: ['progress', repoId] });
      if (attempt.outcome === 'correct') {
        localStorage.removeItem(`draft_lesson_${lessonId}`);
      }
    },
  });

  const handleOpenRef = async (ref: LessonReference) => {
    if (!repoId) return;
    setActiveRef(ref);
    try {
      const src = await api.getSource(repoId, ref.file_path);
      setRefFileContent(src.content);
    } catch {
      setRefFileContent(ref.code_snippet);
    }
  };

  if (isLoading || !lesson) {
    return <div className="p-8 text-center text-xs text-text-secondary">Loading lesson...</div>;
  }

  // Find next lesson
  const currentIdx = pathData?.lessons?.findIndex((l) => l.id === lessonId) ?? -1;
  const nextLesson = currentIdx >= 0 && pathData?.lessons && currentIdx < pathData.lessons.length - 1
    ? pathData.lessons[currentIdx + 1]
    : null;
  const prevLesson = currentIdx > 0 && pathData?.lessons
    ? pathData.lessons[currentIdx - 1]
    : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lesson Content Column */}
      <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between text-xs text-text-secondary pb-4 border-b border-border">
          <Link
            to={`/app/repositories/${repoId}/learn/${pathId}`}
            className="flex items-center gap-1 hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Learning Path
          </Link>

          <span className="font-mono">
            Lesson {lesson.order_index} of {pathData?.lessons?.length ?? 1}
          </span>
        </div>

        {/* Lesson Header */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                lesson.status === 'demonstrated'
                  ? 'bg-success-light text-success'
                  : lesson.status === 'practicing'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-text-secondary'
              }`}
            >
              {lesson.status === 'demonstrated' ? 'Demonstrated' : lesson.status === 'practicing' ? 'Practicing' : 'Not Started'}
            </span>
          </div>

          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            {lesson.title}
          </h1>

          <p className="text-xs text-text-secondary font-medium">
            <span className="font-semibold text-text-primary">Objective: </span>
            {lesson.objective}
          </p>
        </div>

        {/* Why it Matters Card */}
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-text-primary space-y-1">
          <div className="font-semibold text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Why This Code Matters in Production
          </div>
          <p className="text-text-secondary leading-relaxed">
            {lesson.why_it_matters}
          </p>
        </div>

        {/* Technical Explanation */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Architecture & Behavior
          </h3>
          <div className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap bg-surface border border-border rounded-xl p-5 shadow-sm">
            {lesson.explanation}
          </div>
        </div>

        {/* Read the Code References */}
        {lesson.code_references && lesson.code_references.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Read the Code ({lesson.code_references.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {lesson.code_references.map((ref, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenRef(ref)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-surface hover:bg-primary-light border border-border hover:border-primary/50 text-text-primary hover:text-primary transition-all text-xs font-mono shadow-sm group"
                >
                  <FileCode className="w-3.5 h-3.5 text-text-secondary group-hover:text-primary" />
                  <span>{ref.file_path}</span>
                  <span className="text-text-secondary">
                    :L{ref.start_line}–{ref.end_line}
                  </span>
                  {ref.symbol_name && (
                    <span className="text-[11px] text-primary ml-1">
                      ({ref.symbol_name})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Check Understanding Exercise */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              Check Your Understanding
            </div>
            <h3 className="text-xs font-semibold text-text-primary leading-relaxed">
              {lesson.exercise_prompt}
            </h3>
            <p className="text-[11px] text-text-secondary">
              Explain conceptually in your own words. Your response is evaluated against hidden server-side rubrics and the actual codebase.
            </p>
          </div>

          <textarea
            rows={4}
            value={userAnswer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            placeholder="Type your explanation here..."
            className="w-full p-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-primary font-mono text-text-primary"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-text-secondary">
              Draft is auto-saved locally
            </span>

            <button
              onClick={() => {
                handleAnswerChange(userAnswer);
                attemptMutation.mutate(userAnswer);
              }}
              disabled={attemptMutation.isPending || !userAnswer.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {attemptMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Grading Submission...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Answer
                </>
              )}
            </button>
          </div>

          {/* Feedback Section */}
          {latestAttempt && (
            <div
              className={`mt-4 p-5 rounded-xl border text-xs space-y-3 ${
                latestAttempt.outcome === 'correct'
                  ? 'bg-success-light/40 border-success-border text-text-primary'
                  : 'bg-amber-50/50 border-amber-200 text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {latestAttempt.outcome === 'correct' ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  )}
                  <span className="font-bold capitalize text-text-primary">
                    Evaluation Result: {latestAttempt.outcome}
                  </span>
                </div>
              </div>

              {latestAttempt.feedback_what_understood && (
                <div>
                  <span className="font-semibold text-success">What was understood: </span>
                  <p className="text-text-secondary mt-0.5">{latestAttempt.feedback_what_understood}</p>
                </div>
              )}

              {latestAttempt.feedback_what_missed && (
                <div>
                  <span className="font-semibold text-amber-700">What was missed: </span>
                  <p className="text-text-secondary mt-0.5">{latestAttempt.feedback_what_missed}</p>
                </div>
              )}

              <div>
                <span className="font-semibold text-text-primary">Source Explanation: </span>
                <p className="text-text-secondary mt-0.5">{latestAttempt.explanation}</p>
              </div>

              {latestAttempt.remediation_question && (
                <div className="p-3 bg-white rounded border border-amber-200 space-y-1">
                  <span className="font-semibold text-amber-800">Targeted Remediation Question: </span>
                  <p className="text-text-primary">{latestAttempt.remediation_question}</p>
                </div>
              )}

              <div className="text-[11px] text-text-secondary font-medium">
                → {latestAttempt.recommended_next_action}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Lesson Navigation */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          {prevLesson ? (
            <Link
              to={`/app/repositories/${repoId}/learn/${pathId}/lessons/${prevLesson.id}`}
              className="px-3.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-surface border border-border rounded-md transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous Lesson
            </Link>
          ) : <div />}

          {nextLesson ? (
            <Link
              to={`/app/repositories/${repoId}/learn/${pathId}/lessons/${nextLesson.id}`}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary-hover rounded-md shadow-sm transition-colors flex items-center gap-1"
            >
              Next Lesson
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <Link
              to={`/app/repositories/${repoId}/progress`}
              className="px-4 py-1.5 text-xs font-medium text-white bg-success hover:bg-emerald-700 rounded-md shadow-sm transition-colors flex items-center gap-1"
            >
              View Progress Report
              <CheckCircle2 className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Side Code Viewer Panel (35-40% width) */}
      {activeRef && (
        <div className="w-5/12 h-full shrink-0">
          <CodeViewer
            filePath={activeRef.file_path}
            symbolName={activeRef.symbol_name}
            startLine={activeRef.start_line}
            endLine={activeRef.end_line}
            content={refFileContent || activeRef.code_snippet}
            onClose={() => {
              setActiveRef(null);
              setRefFileContent(null);
            }}
          />
        </div>
      )}
    </div>
  );
};
