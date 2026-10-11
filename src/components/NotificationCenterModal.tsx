import React, { useState } from 'react';
import { AppNotification, NotificationSettings } from '../types';
import {
  Bell,
  Clock,
  Wrench,
  Fuel,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Volume2,
  VolumeX,
  Smartphone,
  Check,
  Trash2,
  X,
  Sparkles,
  Sliders,
  Send,
  Radio,
} from 'lucide-react';
import {
  requestPushPermission,
  triggerBrowserPushNotification,
  playNotificationSound,
} from '../utils/notificationService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  readIds: Set<string>;
  settings: NotificationSettings;
  onUpdateSettings: (newSettings: NotificationSettings) => void;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onTriggerTestNotification: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  readIds,
  settings,
  onUpdateSettings,
  onMarkAllAsRead,
  onMarkAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onTriggerTestNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [permissionState, setPermissionState] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !readIds.has(n.id) && !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'RETURN') return n.type === 'RETURN_REMINDER';
    if (filterType === 'MAINTENANCE') return n.type === 'MAINTENANCE_ALERT';
    if (filterType === 'BROADCAST') return n.type === 'BROADCAST';
    if (filterType === 'FUEL') return n.type === 'FUEL_ALERT';
    return true;
  });

  const handleRequestPermission = async () => {
    const res = await requestPushPermission();
    setPermissionState(res);
    if (res === 'granted') {
      onUpdateSettings({ ...settings, browserPushEnabled: true });
      triggerBrowserPushNotification(
        '🔔 Notificações Ativadas!',
        'Você receberá alertas em tempo real sobre a frota NRE Maringá.'
      );
      if (settings.soundEnabled) playNotificationSound();
    }
  };

  const handleTestNotification = () => {
    onTriggerTestNotification();
    setTestSuccess('Notificação de teste disparada com sucesso!');
    setTimeout(() => setTestSuccess(null), 3500);
  };

  const handleClearNotificationsWithAdminKey = () => {
    const key = prompt('Apenas o Administrador pode apagar notificações deste aplicativo.\nDigite a Chave Mestre de Segurança:');
    if (key === null) return;
    if (key.trim() === '192026') {
      onClearAllNotifications();
    } else {
      alert('Chave Mestre incorreta! Apenas o Administrador pode apagar dados deste aplicativo.');
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'RETURN_REMINDER':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'MAINTENANCE_ALERT':
        return <Wrench className="w-4 h-4 text-red-500" />;
      case 'FUEL_ALERT':
        return <Fuel className="w-4 h-4 text-orange-500" />;
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'BROADCAST':
        return <AlertTriangle className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bell className="w-4 h-4 text-[#27a3df]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div
        id="notification-center-modal"
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2 text-white">
                Central de Notificações
              </h2>
              <p className="text-xs text-slate-300">
                Prazos de devolução, status de veículos e comunicados NRE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab('list')}
            id="tab-notif-list"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              activeTab === 'list'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Avisos Recebidos</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            id="tab-notif-settings"
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configurar Alertas</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'list' && (
            <>
              {/* Actions & Filters bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'RETURN', label: '⏰ Devolução' },
                    { id: 'MAINTENANCE', label: '🔧 Manutenção' },
                    { id: 'BROADCAST', label: '📢 Comunicados' },
                    { id: 'FUEL', label: '⛽ Combustível' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFilterType(f.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap transition ${
                        filterType === f.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Marcar lidas
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearNotificationsWithAdminKey}
                      className="text-slate-400 hover:text-red-600 font-medium transition"
                      title="Limpar histórico (Apenas Administrador)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Nenhuma notificação no momento</p>
                    <p className="text-xs text-slate-400">
                      Você será avisado sobre prazos de devolução, manutenção e status dos veículos.
                    </p>
                  </div>
                  <button
                    onClick={handleTestNotification}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Testar Disparo de Notificação
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredNotifications.map((notif) => {
                    const isRead = readIds.has(notif.id) || notif.read;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => onMarkAsRead(notif.id)}
                        className={`p-3.5 rounded-2xl border transition relative group cursor-pointer flex items-start gap-3 ${
                          isRead
                            ? 'bg-slate-50/70 border-slate-200/70 opacity-80'
                            : 'bg-white border-indigo-200/90 shadow-xs ring-1 ring-indigo-500/10'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                            isRead
                              ? 'bg-slate-100 border-slate-200'
                              : notif.urgent
                              ? 'bg-amber-100 border-amber-300'
                              : 'bg-indigo-50 border-indigo-200'
                          }`}
                        >
                          {getIconForType(notif.type)}
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <h4
                              className={`text-xs font-black tracking-tight ${
                                isRead ? 'text-slate-700' : 'text-slate-950'
                              }`}
                            >
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(notif.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>

                          {notif.vehicleName && (
                            <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                              🚗 {notif.vehicleName}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(notif.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition"
                            title="Excluir notificação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {!isRead && (
                          <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Push permission banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200/80 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                        Notificações Push no Navegador / Celular
                      </h4>
                      <p className="text-xs text-slate-600">
                        Receba lembretes na barra de notificações do seu celular Android ou Safari.
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      permissionState === 'granted'
                        ? 'bg-emerald-100 text-emerald-800'
                        : permissionState === 'denied'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {permissionState === 'granted'
                      ? 'Ativo'
                      : permissionState === 'denied'
                      ? 'Bloqueado'
                      : 'Pendente'}
                  </span>
                </div>

                {permissionState !== 'granted' && (
                  <button
                    onClick={handleRequestPermission}
                    id="btn-request-push-perm"
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-2"
                  >
                    <Radio className="w-4 h-4 animate-pulse" />
                    Permitir Notificações Push neste Aparelho
                  </button>
                )}
              </div>

              {/* Notification Toggles */}
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
                {/* Sound Chime Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      {settings.soundEnabled ? (
                        <Volume2 className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Som dos Alertas (Chime)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Tocar toque sonoro suave sintetizado ao receber avisos
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, soundEnabled: e.target.checked })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Return Reminder Toggle & Time Selector */}
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Lembrete de Prazo de Retorno da Frota
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Avisar motoristas sobre o horário de devolução dos veículos ao pátio
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.returnReminderEnabled}
                      onChange={(e) =>
                        onUpdateSettings({ ...settings, returnReminderEnabled: e.target.checked })
                      }
                      className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  {settings.returnReminderEnabled && (
                    <div className="pl-10 flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-700">Horário Limite Diário:</label>
                      <input
                        type="time"
                        value={settings.returnReminderTime}
                        onChange={(e) =>
                          onUpdateSettings({ ...settings, returnReminderTime: e.target.value })
                        }
                        className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400">(Padrão NRE: 17:30)</span>
                    </div>
                  )}
                </div>

                {/* Maintenance Alert Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-red-100 text-red-700">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Alertas de Manutenção
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Notificar quando qualquer veículo entrar ou sair de manutenção
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.maintenanceAlertsEnabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        maintenanceAlertsEnabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Yard Return Alert Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Alertas de Devolução no Pátio
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Avisar quando um carro for devolvido e liberado para novo uso
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.yardReturnAlertsEnabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        yardReturnAlertsEnabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* Low Fuel Alert Toggle */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
                      <Fuel className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Alertas de Combustível Baixo (1/4)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Avisar quando um veículo for entregue com tanque em nível baixo
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lowFuelAlertsEnabled}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        lowFuelAlertsEnabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Button */}
              <div className="pt-2">
                <button
                  onClick={handleTestNotification}
                  id="btn-test-notification"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Disparar Notificação de Teste Agora
                </button>
                {testSuccess && (
                  <p className="text-center text-xs font-bold text-emerald-600 mt-2 animate-fade-in">
                    ✓ {testSuccess}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Sistema Push Ativo
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
