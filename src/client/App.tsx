import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { AgentFleet } from './components/AgentFleet.tsx';
import { AgentStudio } from './components/AgentStudio.tsx';
import { AgentRunnerModal } from './components/AgentRunnerModal.tsx';
import { OpenRouterModal } from './components/OpenRouterModal.tsx';
import { Agent } from '../types.ts';
import { STARTER_AGENTS } from '../presets.ts';

export const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(STARTER_AGENTS);
  const [activeTab, setActiveTab] = useState<'fleet' | 'studio'>('fleet');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [openRouterKey, setOpenRouterKey] = useState<string | null>(() => {
    return localStorage.getItem('openrouter_key');
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
    if (code) {
      const verifier = sessionStorage.getItem('openrouter_code_verifier');
      if (verifier) {
        fetch('/api/auth/openrouter-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier: verifier })
        })
          .then(res => res.json())
          .then(data => {
            if (data.key) {
              setOpenRouterKey(data.key);
              localStorage.setItem('openrouter_key', data.key);
            }
          })
          .catch(err => console.error('OAuth exchange error:', err))
          .finally(() => {
            sessionStorage.removeItem('openrouter_code_verifier');
            window.history.replaceState({}, '', window.location.pathname);
          });
      }
    }
  }, []);

  const handleSaveOpenRouterKey = (key: string | null) => {
    setOpenRouterKey(key);
    if (key) {
      localStorage.setItem('openrouter_key', key);
    } else {
      localStorage.removeItem('openrouter_key');
    }
  };

  const handleDeploySuccess = (newAgent: Agent) => {
    setAgents(prev => [newAgent, ...prev.filter(a => a.id !== newAgent.id)]);
    setActiveTab('fleet');
    setSelectedAgent(newAgent); // Open runner modal immediately!
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
