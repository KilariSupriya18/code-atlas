import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Key,
  Cpu,
  Database,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react';
import { api } from '../api/client';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });

  const updateKeyMutation = useMutation({
    mutationFn: (key: string) => api.updateGroqKey(key),
    onSuccess: (data) => {
      setSuccessMessage(data.message || 'Groq API Key verified and saved successfully.');
      setErrorMessage(null);
      setApiKeyInput('');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to authenticate Groq API key.');
      setSuccessMessage(null);
    },
  });

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    updateKeyMutation.mutate(apiKeyInput.trim());
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-secondary">Loading settings...</div>;
  }

  const groq = settingsData?.groq;
  const embeddings = settingsData?.embeddings;
  const storage = settingsData?.storage;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          System Settings & Providers
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Inspect generative LLM configuration, local Sentence Transformers, and vector database status.
        </p>
      </div>

      {/* Groq Generative Provider Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Generative AI (Groq API)
            </h3>
          </div>

          <div>
            {groq?.configured ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-success-light text-success border border-success-border">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Configured ({groq.masked_key})
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Key Required
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-text-secondary">Primary Model</span>
            <div className="font-mono font-semibold text-text-primary mt-0.5">
              {groq?.model || 'llama-3.3-70b-versatile'}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-text-secondary">Fallback Model</span>
            <div className="font-mono font-semibold text-text-primary mt-0.5">
              {groq?.fallback_model || 'llama-3.1-8b-instant'}
            </div>
          </div>
        </div>

        {/* Update Key Form */}
        <form onSubmit={handleSaveKey} className="pt-2 space-y-3">
          <label className="block text-xs font-medium text-text-primary">
            {groq?.configured ? 'Update Groq API Key' : 'Enter Groq API Key'}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="w-4 h-4 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:border-primary font-mono text-text-primary"
              />
            </div>
            <button
              type="submit"
              disabled={updateKeyMutation.isPending || !apiKeyInput.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 shrink-0"
            >
              {updateKeyMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save & Test
            </button>
          </div>

          {successMessage && (
            <div className="p-2.5 bg-success-light border border-success-border rounded text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-danger-light border border-danger-border rounded text-xs text-danger flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Embeddings Provider Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 pb-3 border-b border-border">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Embeddings Provider (Local)
          </h3>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-text-secondary">Model</span>
            <div className="font-mono font-semibold text-text-primary mt-0.5">
              {embeddings?.model}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-text-secondary">Dimensions</span>
            <div className="font-mono font-semibold text-text-primary mt-0.5">
              {embeddings?.dimensions} dims
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-[11px] text-text-secondary">Max Tokens</span>
            <div className="font-mono font-semibold text-text-primary mt-0.5">
              {embeddings?.max_seq_length} tokens
            </div>
          </div>
        </div>
      </div>

      {/* Vector DB & Relational Storage Card */}
      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 pb-3 border-b border-border">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Storage & Persistence
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-text-secondary">Vector Database</span>
            <span className="font-mono font-semibold text-text-primary">
              Qdrant Embedded ({storage?.vector_path})
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-border">
            <span className="text-text-secondary">Relational Database</span>
            <span className="font-mono font-semibold text-text-primary">
              {storage?.database_url}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
