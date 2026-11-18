import React, { useState } from 'react';
import { FlagshipHeroFlowView, ViewTab } from './Views/FlagshipHeroFlowView';
import { CurrencyToggle } from '../CurrencyToggle';
import { audioVibe } from '../../utils/audioVibe';
import { useAuth } from '../../context/AuthContext';
import {
  Compass,
  FileCode2,
  FileText,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  Volume2,
  VolumeX,
  Workflow,
  X,
  Zap,
} from 'lucide-react';

interface NavTabItem {
  id: ViewTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_TABS: NavTabItem[] = [
  { id: 'flagship_demo', label: '1. Control Plane', shortLabel: 'Control Plane', icon: Workflow },
  { id: 'lifecycle_workflow', label: '2. Lifecycle', shortLabel: 'Lifecycle', icon: Compass },
  { id: 'agentforce_spec', label: '3. OpenAPI Spec', shortLabel: 'OpenAPI', icon: FileCode2 },
  { id: 'security_baseline', label: '4. Security', shortLabel: 'Security', icon: ShieldCheck },
  { id: 'technical_dossier', label: '5. Dossier', shortLabel: 'Dossier', icon: FileText },
  { id: 'live_connectors', label: '6. Connectors & RBAC', shortLabel: 'Connectors', icon: Zap },
];

export const NexusV4Master: React.FC = () => {
  const { user, authProfile, loading: authLoading, signInWithGoogle, signOutUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewTab>('flagship_demo');
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectTab = (tab: ViewTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    audioVibe.playClick();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* TOP MASTER HEADER - 3-ZONE LAYOUT */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
          {/* ZONE 1: BRAND IDENTITY */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => handleSelectTab('flagship_demo')}
              className="flex items-center gap-2.5 group cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500 text-black flex items-center justify-center font-mono font-black text-base tracking-wider border border-emerald-400 shadow-sm transition-transform group-hover:scale-105">
                N
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold tracking-tight text-white font-sans text-lg">NEXUS</span>
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                    ENTERPRISE OS
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 tracking-wider hidden sm:block">
                  CLOUD SQL ACID CLEARING &amp; MARGIN GUARDRAILS
                </div>
              </div>
            </button>
          </div>

          {/* ZONE 2: 6 LIVE CONTROL-PLANE NAVIGATION TABS */}
          <nav className="hidden lg:flex items-center gap-1 font-mono text-xs">
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-950/90 text-emerald-300 font-bold border border-emerald-500/80 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ZONE 3: CURRENCY, TENANT RBAC BADGE, AUTH & AUDIO */}
          <div className="flex items-center gap-2 shrink-0">
            <CurrencyToggle />

            {user ? (
              <div className="flex items-center gap-1.5 shrink-0">
                {authProfile && (
                  <span
                    className="hidden xl:inline-block px-2 py-1 rounded bg-slate-900 border border-emerald-800/70 text-[10px] font-mono text-emerald-300"
                    title={`Tenant: ${authProfile.tenantId} | Role: ${authProfile.role}`}
                  >
                    {authProfile.role.toUpperCase()} · {authProfile.tenantId}
                  </span>
                )}
                <span
                  className="hidden 2xl:inline-block max-w-[140px] truncate text-[11px] font-mono text-slate-300"
                  title={user.email || user.displayName || 'Signed in'}
                >
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={() => {
                    audioVibe.playClick();
                    void signOutUser();
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  audioVibe.playClick();
                  void signInWithGoogle();
                }}
                disabled={authLoading}
                className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Sign in with Google to run Cloud SQL ACID transactions & benchmarks"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Checking...' : 'Sign in with Google'}</span>
              </button>
            )}

            <button
              onClick={() => {
                const muted = audioVibe.toggleMute();
                setIsMuted(muted);
                if (!muted) audioVibe.playClick();
              }}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Audio Feedback' : 'Mute Audio Feedback'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-slate-300" />}
            </button>

            <button
              onClick={() => {
                audioVibe.playClick();
                setIsMobileMenuOpen((prev) => !prev);
              }}
              className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-[#0B0F17] border-b border-slate-800 p-4 space-y-3">
          {authProfile && (
            <div className="px-3 py-2 rounded-md bg-slate-900 border border-emerald-800/70 text-[11px] font-mono text-emerald-300">
              {authProfile.role.toUpperCase()} · {authProfile.tenantId}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`p-2.5 rounded-md border text-left flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Clearing Currency:</span>
            <CurrencyToggle />
          </div>
        </div>
      )}

      {/* FULL-WIDTH MAIN WORKSPACE */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
        <FlagshipHeroFlowView controlledTab={activeTab} onTabChange={setActiveTab} />
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800 py-2 px-2 grid grid-cols-6 gap-1 text-[10px] font-mono shadow-[0_-4px_20px_rgba(0,0,0,0.65)]"
      >
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-md transition-colors cursor-pointer touch-manipulation ${
                isActive
                  ? 'bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-700/70'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full leading-none">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
