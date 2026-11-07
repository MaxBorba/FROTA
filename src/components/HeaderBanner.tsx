import React from 'react';
import headerBannerImg from '../assets/images/nre_header_banner_1786536834253.jpg';
import { ShieldCheck, Bell, LogIn, LogOut, User as UserIcon, Flame, Download, WifiOff, HardDrive } from 'lucide-react';
import { useAuth } from '../firebase/context/AuthContext';

interface HeaderBannerProps {
  onOpenSheetsModal?: () => void;
  onOpenAdminModal?: () => void;
  onOpenNotifications?: () => void;
  onOpenInstallModal?: () => void;
  unreadCount?: number;
  isOnline?: boolean;
  isInstalled?: boolean;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  onOpenSheetsModal,
  onOpenAdminModal,
  onOpenNotifications,
  onOpenInstallModal,
  unreadCount = 0,
  isOnline = true,
  isInstalled = false,
}) => {
  const { currentUser, userProfile, isAdmin, loginWithGoogle, logout, authReady } = useAuth();

  return (
    <header className="bg-slate-900 text-white shadow-md rounded-b-2xl overflow-hidden border-b border-slate-800">
      <div className="relative h-44 sm:h-52 w-full overflow-hidden">
        <img
          src={headerBannerImg}
          alt="Frota NRE Maringá"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center brightness-95 contrast-105 transform hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-slate-900/20" />
        <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-[#27a3df] text-white shadow-sm">
                Núcleo Regional de Educação
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                Firebase + Offline IndexedDB
              </span>
            </div>
            <h1 id="app-header-title" className="text-lg sm:text-2xl font-black tracking-tight text-white drop-shadow-md leading-tight">
              FROTA – NRE DE MARINGÁ
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Install PWA / Offline Protection Button */}
            {onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                id="btn-pwa-install-header"
                className="bg-blue-600/90 hover:bg-blue-500 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-blue-400/40 shadow-lg transition active:scale-95 shrink-0"
                title="Instalar aplicativo no aparelho para funcionamento offline"
              >
                <Download className="w-3.5 h-3.5 text-blue-200" />
                <span>{isInstalled ? 'App Instalado' : 'Instalar no Aparelho'}</span>
              </button>
            )}

            {/* Google Authentication */}
            {authReady && (
              currentUser ? (
                <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl px-2.5 py-1.5 shadow-lg">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'Usuário'}
                      className="w-6 h-6 rounded-full border border-amber-400 object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="text-left leading-tight hidden sm:block max-w-[110px] truncate">
                    <div className="text-[11px] font-bold text-white truncate">
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
                    </div>
                    <div className="text-[9px] font-medium text-amber-400">
                      {isAdmin ? 'Administrador' : 'Motorista'}
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    title="Desconectar do Google"
                    className="p-1 text-slate-400 hover:text-rose-400 transition ml-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={loginWithGoogle}
                  id="btn-firebase-login"
                  className="bg-white/10 hover:bg-white/20 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-white/20 shadow-lg transition active:scale-95 shrink-0"
                  title="Conectar com sua conta Google"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400" />
                  <span>Login Google</span>
                </button>
              )
            )}

            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                id="btn-notifications-bell"
                className="relative bg-slate-900/90 hover:bg-slate-800 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-md border border-slate-700 shadow-lg transition active:scale-95"
                title="Central de Notificações e Prazos"
              >
                <div className="relative">
                  <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-300'}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>
                <span className="hidden sm:inline">Avisos</span>
                {unreadCount > 0 && (
                  <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {onOpenAdminModal && (
              <button
                onClick={onOpenAdminModal}
                id="btn-admin-access-tab"
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 sm:px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 backdrop-blur-md border border-indigo-300/40 shadow-lg shadow-indigo-900/40 transition active:scale-95 shrink-0"
                title="Acesso de Administrador e Aferições (Acesso Restrito)"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-200" />
                <span className="inline">Aba Admin & Aferições</span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-md uppercase ml-0.5">
                  Restrito
                </span>
              </button>
            )}

            {onOpenSheetsModal && (
              <button
                onClick={onOpenSheetsModal}
                id="btn-sheets-config"
                className="bg-emerald-600/90 hover:bg-emerald-600 text-white p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border border-emerald-400/30 shadow-lg transition active:scale-95"
                title="Sincronizar com Planilha Google"
              >
                <svg className="w-4 h-4 text-emerald-200" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H6v-2h3v2zm0-4H6v-2h3v2zm0-4H6V7h3v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z"/>
                </svg>
                <span className="hidden sm:inline">Planilha</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 py-2.5 bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 border-t border-slate-800">
        <div className="flex items-center gap-3">
          {isOnline ? (
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              Cloud Firestore + Dados no Aparelho
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-bold text-amber-400">
              <WifiOff className="w-3.5 h-3.5" />
              Offline: Gravando no Banco do Aparelho
            </span>
          )}

          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="text-amber-400 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 hover:underline"
            >
              <Bell className="w-3 h-3" />
              {unreadCount > 0 ? `${unreadCount} aviso(s) novo(s)` : 'Alertas e Prazos'}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              className="text-blue-300 hover:text-blue-200 text-xs font-semibold flex items-center gap-1 hover:underline"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Memória Local & Guia PWA</span>
            </button>
          )}

          <button
            onClick={onOpenAdminModal}
            id="btn-admin-access-subtext"
            className="bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 hover:text-white px-2.5 py-1 rounded-lg font-bold text-xs border border-indigo-700/60 flex items-center gap-1.5 transition active:scale-95"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-300" />
            <span>Aba Administrador</span>
          </button>
        </div>
      </div>
    </header>
  );
};
