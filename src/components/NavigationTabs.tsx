import React from 'react';
import { Home, LogOut, CheckCircle2, Fuel, Car, History, ShieldCheck, Lock } from 'lucide-react';

export type AppView = 'home' | 'checkout' | 'checkin' | 'refuel' | 'status' | 'trips' | 'admin';

interface NavigationTabsProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  isAdminAuthenticated?: boolean;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  currentView,
  onSelectView,
  isAdminAuthenticated = false,
}) => {
  const tabs: { id: AppView; label: string; shortLabel: string; icon: React.ReactNode; colorClass: string; badge?: string }[] = [
    {
      id: 'home',
      label: 'Início',
      shortLabel: 'Início',
      icon: <Home className="w-4 h-4" />,
      colorClass: 'hover:text-sky-400',
    },
    {
      id: 'checkout',
      label: 'Saída',
      shortLabel: 'Saída',
      icon: <LogOut className="w-4 h-4" />,
      colorClass: 'hover:text-emerald-400',
    },
    {
      id: 'checkin',
      label: 'Chegada',
      shortLabel: 'Chegada',
      icon: <CheckCircle2 className="w-4 h-4" />,
      colorClass: 'hover:text-orange-400',
    },
    {
      id: 'refuel',
      label: 'Abastecer',
      shortLabel: 'Abastecer',
      icon: <Fuel className="w-4 h-4" />,
      colorClass: 'hover:text-amber-400',
    },
    {
      id: 'status',
      label: 'Status Frota',
      shortLabel: 'Status',
      icon: <Car className="w-4 h-4" />,
      colorClass: 'hover:text-teal-400',
    },
    {
      id: 'trips',
      label: 'Histórico',
      shortLabel: 'Viagens',
      icon: <History className="w-4 h-4" />,
      colorClass: 'hover:text-purple-400',
    },
    {
      id: 'admin',
      label: 'Aba Admin',
      shortLabel: 'Admin',
      icon: isAdminAuthenticated ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-300" />,
      colorClass: 'hover:text-indigo-300',
      badge: isAdminAuthenticated ? 'Ativo' : 'Senha',
    },
  ];

  return (
    <nav aria-label="Navegação Principal do Sistema" className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none py-1.5 -mx-1 px-1">
          {tabs.map((tab) => {
            const isActive = currentView === tab.id;
            const isAdmin = tab.id === 'admin';

            return (
              <button
                key={tab.id}
                type="button"
                id={`tab-nav-${tab.id}`}
                onClick={() => onSelectView(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-black transition-all shrink-0 select-none ${
                  isActive
                    ? isAdmin
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/50 scale-[1.02]'
                      : 'bg-slate-800 text-white shadow-sm border border-slate-700 scale-[1.02]'
                    : isAdmin
                    ? 'bg-indigo-950/70 text-indigo-200 hover:bg-indigo-900/90 border border-indigo-700/50 hover:text-white'
                    : `text-slate-300 hover:text-white hover:bg-slate-800/80 ${tab.colorClass}`
                }`}
                title={tab.label}
              >
                {tab.icon}
                <span className="inline">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                      isAdminAuthenticated
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
