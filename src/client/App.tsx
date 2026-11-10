import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { LandingPage } from './components/landing/LandingPage.tsx';
import { Agent } from '../types.ts';
import { STARTER_AGENTS } from '../presets.ts';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, exchangeOAuthCode } from './lib/openrouter-auth.ts';
import { getStoredWireApiKey } from './lib/runtime-init.ts';
import { CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

const AgentFleet = lazy(() => import('./components/AgentFleet.tsx').then(m => ({ default: m.AgentFleet })));
const AgentStudio = lazy(() => import('./components/AgentStudio.tsx').then(m => ({ default: m.AgentStudio })));
const AgentRunnerModal = lazy(() =>
  import('./components/AgentRunnerModal.tsx').then(m => ({ default: m.AgentRunnerModal }))
);
const OpenRouterModal = lazy(() =>
  import('./components/OpenRouterModal.tsx').then(m => ({ default: m.OpenRouterModal }))
);
const ApiKeysModal = lazy(() => import('./components/ApiKeysModal.tsx').then(m => ({ default: m.ApiKeysModal })));

export const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(STARTER_AGENTS);
  const [activeTab, setActiveTab] = useState<'landing' | 'fleet' | 'studio'>('landing');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState<string | null>(() => getStoredApiKey());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isKeysModalOpen, setIsKeysModalOpen] = useState(false);
  const [authBanner, setAuthBanner] = useState<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);

  // Load agents from backend API
  const fetchAgents = async () => {
    try {
      const wireKey = getStoredWireApiKey();
      const res = await fetch('/api/agents', {
        headers: wireKey ? { 'X-AgentWire-Key': wireKey } : undefined
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data);
        }
      }
    } catch {
      // Fallback to bundled STARTER_AGENTS when offline
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

      const returnedState = searchParams.get('state');
      exchangeOAuthCode(code, returnedState)
        .then(key => {
          setOpenRouterKey(key);
          setAuthBanner({ type: 'success', message: 'Successfully connected to OpenRouter!' });
          setTimeout(() => setAuthBanner(null), 5000);
        })
        .catch(err => {
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
      const wireKey = getStoredWireApiKey();
      const res = await fetch(`/api/agents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: wireKey ? { 'X-AgentWire-Key': wireKey } : undefined
      });
      if (res.ok) {
        setAgents(prev => prev.filter(a => a.id !== id));
        if (selectedAgent?.id === id) {
          setSelectedAgent(null);
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        setAuthBanner({ type: 'error', message: errBody.error || `Failed to delete agent (HTTP ${res.status}).` });
      }
    } catch {
      setAuthBanner({ type: 'error', message: 'Failed to delete agent. Please try again.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col text-zinc-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-zinc-950 focus:text-white focus:text-xs focus:font-mono focus:shadow-lg"
      >
        Skip to main content
      </a>

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        agentCount={agents.length}
        openRouterKey={openRouterKey}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenKeysModal={() => setIsKeysModalOpen(true)}
      />

      {/* Auth Banner Feedback */}
      {authBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`px-4 py-2.5 text-xs font-mono border-b flex items-center justify-between transition-all ${
            authBanner.type === 'loading'
              ? 'bg-zinc-100 border-zinc-200 text-zinc-900'
              : authBanner.type === 'success'
              ? 'bg-white border-zinc-300 text-zinc-950'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2 flex-1">
            {authBanner.type === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600 shrink-0" aria-hidden="true" />}
            {authBanner.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />}
            {authBanner.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" aria-hidden="true" />}
            <span className="font-medium">{authBanner.message}</span>
          </div>
          <button
            onClick={() => setAuthBanner(null)}
            className="p-1 hover:bg-black/5 rounded text-zinc-600 hover:text-zinc-900"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center text-xs font-mono text-zinc-600" role="status" aria-busy="true">
              Loading view...
            </div>
          }
        >
          {activeTab === 'landing' ? (
            <LandingPage
              agents={agents}
              onSelectAgent={setSelectedAgent}
              onDeleteAgent={handleDeleteAgent}
              onGoToStudio={() => setActiveTab('studio')}
              onGoToFleet={() => setActiveTab('fleet')}
            />
          ) : activeTab === 'fleet' ? (
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
        </Suspense>
      </main>

      {/* Runner / Sandbox Modal */}
      {selectedAgent && (
        <Suspense fallback={null}>
          <AgentRunnerModal
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            openRouterKey={openRouterKey}
          />
        </Suspense>
      )}

      {/* OpenRouter PKCE Auth Modal */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <OpenRouterModal
            currentKey={openRouterKey}
            onSaveKey={handleSaveOpenRouterKey}
            onClose={() => setIsAuthModalOpen(false)}
          />
        </Suspense>
      )}

      {/* API Keys & Permissions Modal */}
      {isKeysModalOpen && (
        <Suspense fallback={null}>
          <ApiKeysModal
            isOpen={isKeysModalOpen}
            onClose={() => setIsKeysModalOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
