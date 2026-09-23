import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { AgentFleet } from './components/AgentFleet.tsx';
import { AgentStudio } from './components/AgentStudio.tsx';
import { AgentRunnerModal } from './components/AgentRunnerModal.tsx';
import { OpenRouterModal } from './components/OpenRouterModal.tsx';
import { Agent } from '../types.ts';
import { STARTER_AGENTS } from '../presets.ts';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, exchangeOAuthCode } from './lib/openrouter-auth.ts';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

export const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(STARTER_AGENTS);
  const [activeTab, setActiveTab] = useState<'fleet' | 'studio'>('fleet');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState<string | null>(() => getStoredApiKey());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authBanner, setAuthBanner] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);

  // Load agents from backend API
  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
        }
      }
    } catch (err) {
      console.warn('Using local starter agents:', err);
    }
  };

  useEffect(() => {
    fetchAgents();

    // Check for OpenRouter OAuth PKCE callback
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const authError = searchParams.get('error') || searchParams.get('error_description');

    if (authError) {
      setAuthBanner({ type: 'error', message: `OpenRouter authorization error: ${authError}` });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code) {
      setAuthBanner({ type: 'loading', message: 'Exchanging authorization code with OpenRouter...' });

      exchangeOAuthCode(code)
        .then(key => {
          setOpenRouterKey(key);
          setAuthBanner({ type: 'success', message: 'Successfully connected to OpenRouter!' });
          setTimeout(() => setAuthBanner(null), 5000);
        })
        .catch(err => {
          console.error('OAuth exchange error:', err);
          setAuthBanner({
            type: 'error',
            message: `OpenRouter sign-in failed: ${err.message || 'Key exchange failed'}. You can still paste your API key manually.`
          });
        })
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
    }
  }, []);

  const handleSaveOpenRouterKey = (key: string | null) => {
    setOpenRouterKey(key);
    if (key) {
      setStoredApiKey(key);
      setAuthBanner({ type: 'success', message: 'OpenRouter API key saved!' });
      setTimeout(() => setAuthBanner(null), 3000);
    } else {
      clearStoredApiKey();
      setAuthBanner(null);
    }
  };

  const handleDeploySuccess = (newAgent: Agent) => {
    setAgents(prev => [newAgent, ...prev.filter(a => a.id !== newAgent.id)]);
    setActiveTab('fleet');
    setSelectedAgent(newAgent);
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      setAgents(prev => prev.filter(a => a.id !== id));
      if (selectedAgent?.id === id) {
        setSelectedAgent(null);
      }
    } catch (err) {
      console.error('Failed to delete agent', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agentCount={agents.length}
        openRouterKey={openRouterKey}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Auth Banner Feedback */}
      {authBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`px-4 py-2.5 text-xs font-mono border-b flex items-center justify-between transition-all ${
            authBanner.type === 'loading'
              ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300'
              : authBanner.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 flex-1">
            {authBanner.type === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />}
            {authBanner.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
            {authBanner.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            <span>{authBanner.message}</span>
          </div>
          <button
            onClick={() => setAuthBanner(null)}
            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'fleet' ? (
          <AgentFleet
            agents={agents}
            onSelectAgent={setSelectedAgent}
            onDeleteAgent={handleDeleteAgent}
            onNewAgent={() => setActiveTab('studio')}
          />
        ) : (
          <AgentStudio
            onDeploySuccess={handleDeploySuccess}
            openRouterKey={openRouterKey}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Runner / Sandbox Modal */}
      {selectedAgent && (
        <AgentRunnerModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          openRouterKey={openRouterKey}
        />
      )}

      {/* OpenRouter PKCE Auth Modal */}
      {isAuthModalOpen && (
        <OpenRouterModal
          currentKey={openRouterKey}
          onSaveKey={handleSaveOpenRouterKey}
          onClose={() => setIsAuthModalOpen(false)}
        />
      )}
    </div>
  );
};
