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
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-border">
        <div className="text-xs uppercase tracking-wider font-bold text-text-secondary mb-1">
          SYSTEM CONFIGURATION
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-3">
          <Settings className="w-6 h-6 text-indigo" />
          Settings & Providers
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Inspect generative LLM configuration, local Sentence Transformers, and vector database status.
        </p>
      </div>

      {/* Groq Generative Provider Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-tint text-indigo flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">
                Generative AI (Groq API)
              </h3>
              <p className="text-xs text-text-secondary">Ultra-low latency inference via Llama 3</p>
            </div>
          </div>

          <div>
            {groq?.configured ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-teal-tint text-teal border border-teal/30">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Configured ({groq.masked_key})
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-tint text-amber border border-amber/30">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                Key Required
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5 text-sm">
          <div className="p-4 bg-canvas rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider font-bold text-text-secondary block">
              Primary Model
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-1">
              {groq?.model || 'llama-3.3-70b-versatile'}
            </div>
          </div>
          <div className="p-4 bg-canvas rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider font-bold text-text-secondary block">
              Fallback Model
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-1">
              {groq?.fallback_model || 'llama-3.1-8b-instant'}
            </div>
          </div>
        </div>

        {/* Update Key Form */}
        <form onSubmit={handleSaveKey} className="pt-2 space-y-3">
          <label className="block text-sm font-semibold text-text-primary">
            {groq?.configured ? 'Update Groq API Key' : 'Enter Groq API Key'}
          </label>
          <div className="flex gap-2.5">
            <div className="relative flex-1">
              <Key className="w-4 h-4 text-text-secondary absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="gsk_..."
                className="w-full pl-10 pr-4 py-3 text-sm bg-surface border border-border rounded-xl focus:outline-none focus:border-indigo focus:ring-2 focus:ring-indigo/20 font-mono text-text-primary transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={updateKeyMutation.isPending || !apiKeyInput.trim()}
              className="px-5 py-3 text-sm font-semibold text-white bg-indigo hover:bg-indigo-hover disabled:opacity-50 rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
            >
              {updateKeyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save & Test
            </button>
          </div>

          {successMessage && (
            <div className="p-3 bg-teal-tint/70 border border-teal/40 rounded-xl text-xs font-semibold text-teal flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Embeddings Provider Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-indigo-tint text-indigo flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              Embeddings Provider (Local)
            </h3>
            <p className="text-xs text-text-secondary">On-premise Sentence Transformers embedding engine</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3.5 text-sm">
          <div className="p-4 bg-canvas rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider font-bold text-text-secondary block">
              Model
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-1 truncate">
              {embeddings?.model}
            </div>
          </div>
          <div className="p-4 bg-canvas rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider font-bold text-text-secondary block">
              Dimensions
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-1">
              {embeddings?.dimensions} dims
            </div>
          </div>
          <div className="p-4 bg-canvas rounded-xl border border-border">
            <span className="text-xs uppercase tracking-wider font-bold text-text-secondary block">
              Max Tokens
            </span>
            <div className="font-mono font-bold text-text-primary text-sm mt-1">
              {embeddings?.max_seq_length} tokens
            </div>
          </div>
        </div>
      </div>

      {/* Vector DB & Relational Storage Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-4 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-teal-tint text-teal flex items-center justify-center">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">
              Storage & Persistence
            </h3>
            <p className="text-xs text-text-secondary">Vector collection storage and transactional database</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center p-4 bg-canvas rounded-xl border border-border">
            <span className="text-text-secondary font-medium">Vector Database</span>
            <span className="font-mono font-bold text-text-primary">
              Qdrant Embedded ({storage?.vector_path})
            </span>
          </div>
          <div className="flex justify-between items-center p-4 bg-canvas rounded-xl border border-border">
            <span className="text-text-secondary font-medium">Relational Database</span>
            <span className="font-mono font-bold text-text-primary">
              {storage?.database_url}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
