import React, { useState, useMemo } from 'react';
import { Vehicle, DriverTripEntry, FuelLevel, VehicleStatus, AppNotification, AccessLogEntry } from '../types';
import { validateKm } from '../utils/validators';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, X, RefreshCw, Trash2, Fuel, Gauge, User, Car, Wrench, AlertTriangle, Send, Bell, Radio, Sparkles, Activity, Search, Calendar, Download, Smartphone, Laptop, Globe, CheckSquare, Square, Share2, Copy, ArrowLeft, LogOut, FileSpreadsheet, Printer, FileText, ExternalLink, FolderOpen } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  recentTrips: DriverTripEntry[];
  accessLogs?: AccessLogEntry[];
  embedded?: boolean;
  isAuthenticated?: boolean;
  onAuthenticate?: (auth: boolean) => void;
  onUpdateVehicle: (data: {
    vehicleName: string;
    status: VehicleStatus;
    odometer?: number;
    fuelLevel?: FuelLevel;
    lastDriver?: string;
    maintenanceReason?: string;
  }) => Promise<boolean>;
  onToggleMaintenance?: (
    vehicleName: string,
    isMaintenance: boolean,
    maintenanceReason?: string
  ) => Promise<boolean>;
  onBatchMaintenance?: (
    vehicleNames: string[],
    action: 'MAINTENANCE' | 'AVAILABLE',
    maintenanceReason?: string
  ) => Promise<boolean>;
  onReleaseAllVehicles: () => Promise<boolean>;
  onResetOdometers?: () => Promise<boolean>;
  onDeleteTrip: (tripId: string, masterKey?: string) => Promise<boolean>;
  onClearAllHistory?: (masterKey?: string) => Promise<boolean>;
  onClearAccessLogs?: () => Promise<boolean>;
  onBroadcastNotification?: (data: {
    title: string;
    message: string;
    urgent?: boolean;
    type?: string;
  }) => Promise<boolean>;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  recentTrips,
  accessLogs = [],
  embedded = false,
  isAuthenticated: propIsAuthenticated,
  onAuthenticate,
  onUpdateVehicle,
  onToggleMaintenance,
  onBatchMaintenance,
  onReleaseAllVehicles,
  onResetOdometers,
  onDeleteTrip,
  onClearAllHistory,
  onClearAccessLogs,
  onBroadcastNotification,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [localAuthenticated, setLocalAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nre_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : localAuthenticated;

  const setIsAuthenticated = (auth: boolean) => {
    setLocalAuthenticated(auth);
    try {
      if (auth) {
        sessionStorage.setItem('nre_admin_auth', 'true');
      } else {
        sessionStorage.removeItem('nre_admin_auth');
      }
    } catch {}
    onAuthenticate?.(auth);
  };

  const [authError, setAuthError] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [editKm, setEditKm] = useState<string>('');
  const [editFuel, setEditFuel] = useState<FuelLevel>('Cheio');
  const [editStatus, setEditStatus] = useState<VehicleStatus>('AVAILABLE');
  const [editDriver, setEditDriver] = useState<string>('');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');
  const [vehicleFilterStatus, setVehicleFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE'>('ALL');
  const [activeTab, setActiveTab] = useState<'vehicles' | 'maintenance' | 'reports' | 'access_logs' | 'broadcast' | 'trips'>('vehicles');
  
  // Daily reports export state
  const [reportDate, setReportDate] = useState<string>(() => {
    return new Date().toLocaleDateString('pt-BR');
  });
  
  // Maintenance modal & multi-selection state
  const [maintenanceVehicleName, setMaintenanceVehicleName] = useState<string | null>(null);
  const [maintenanceReasonInput, setMaintenanceReasonInput] = useState<string>('Revisão mecânica e preventiva');
  const [selectedVehiclesForMaintenance, setSelectedVehiclesForMaintenance] = useState<string[]>([]);
  const [batchReasonInput, setBatchReasonInput] = useState<string>('Revisão geral da frota');

  // Access Logs Period & Filter state
  const [logPeriod, setLogPeriod] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('⏰ Lembrete de Retorno da Frota');
  const [broadcastMessage, setBroadcastMessage] = useState('Favor retornar com os veículos ao pátio do NRE Maringá até as 17:30.');
  const [broadcastUrgent, setBroadcastUrgent] = useState(false);
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Link copy state
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen && !embedded) return null;

  const sortedVehicles = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const maintenanceCount = vehicles.filter(v => v.status === 'MAINTENANCE').length;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === '192026') {
      setIsAuthenticated(true);
      setAuthError(null);
      setPasswordInput('');
    } else {
      setAuthError('Chave Mestre incorreta. Apenas o Administrador pode acessar.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    setFeedbackMsg('Sessão do administrador finalizada com sucesso.');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleToggleStatus = async (vehicle: Vehicle) => {
    const newStatus: VehicleStatus = vehicle.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
    const success = await onUpdateVehicle({
      vehicleName: vehicle.name,
      status: newStatus,
    });
    if (success) {
      setFeedbackMsg(`Status do veículo ${vehicle.name} alterado para ${newStatus === 'AVAILABLE' ? 'DISPONÍVEL' : 'INDISPONÍVEL'}.`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleSetMaintenance = async (vehicleName: string, isMaintenance: boolean, reason?: string) => {
    if (onToggleMaintenance) {
      const success = await onToggleMaintenance(vehicleName, isMaintenance, reason);
      if (success) {
        setFeedbackMsg(
          isMaintenance
            ? `Veículo ${vehicleName} colocado em MANUTENÇÃO com sucesso!`
            : `Veículo ${vehicleName} liberado da manutenção e disponível no pátio!`
        );
        setMaintenanceVehicleName(null);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } else {
      const success = await onUpdateVehicle({
        vehicleName,
        status: isMaintenance ? 'MAINTENANCE' : 'AVAILABLE',
        maintenanceReason: isMaintenance ? (reason || 'Em manutenção preventiva') : undefined,
      });
      if (success) {
        setFeedbackMsg(
          isMaintenance
            ? `Veículo ${vehicleName} colocado em MANUTENÇÃO com sucesso!`
            : `Veículo ${vehicleName} liberado da manutenção!`
        );
        setMaintenanceVehicleName(null);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    }
  };

  // Batch Multi-Vehicle Maintenance Toggle
  const handleToggleSelectVehicle = (vehicleName: string) => {
    setSelectedVehiclesForMaintenance(prev =>
      prev.includes(vehicleName) ? prev.filter(n => n !== vehicleName) : [...prev, vehicleName]
    );
  };

  const handleSelectAllVehicles = () => {
    if (selectedVehiclesForMaintenance.length === sortedVehicles.length) {
      setSelectedVehiclesForMaintenance([]);
    } else {
      setSelectedVehiclesForMaintenance(sortedVehicles.map(v => v.name));
    }
  };

  const handleApplyBatchMaintenance = async (action: 'MAINTENANCE' | 'AVAILABLE') => {
    if (selectedVehiclesForMaintenance.length === 0) {
      alert('Selecione ao menos um veículo para aplicar a ação em lote.');
      return;
    }

    const actionText = action === 'MAINTENANCE' ? 'colocar em MANUTENÇÃO' : 'LIBERAR para DISPONÍVEL';
    if (!window.confirm(`Confirma ${actionText} os ${selectedVehiclesForMaintenance.length} veículo(s) selecionados?`)) {
      return;
    }

    if (onBatchMaintenance) {
      const success = await onBatchMaintenance(
        selectedVehiclesForMaintenance,
        action,
        batchReasonInput
      );
      if (success) {
        setFeedbackMsg(
          action === 'MAINTENANCE'
            ? `${selectedVehiclesForMaintenance.length} veículos colocados em MANUTENÇÃO com sucesso!`
            : `${selectedVehiclesForMaintenance.length} veículos liberados para o pátio com sucesso!`
        );
        setSelectedVehiclesForMaintenance([]);
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    }
  };

  const handleSaveVehicleEdit = async (vehicleName: string) => {
    const target = vehicles.find(v => v.name === vehicleName);
    if (editKm) {
      const kmCheck = validateKm(editKm, undefined, 'ADMIN');
      if (!kmCheck.isValid) {
        alert(kmCheck.message || 'Quilometragem inválida.');
        return;
      }
    }
    const success = await onUpdateVehicle({
      vehicleName,
      status: editStatus || target?.status || 'AVAILABLE',
      odometer: editKm ? Number(editKm.replace(/\./g, '').replace(/,/g, '.').trim()) : undefined,
      fuelLevel: editFuel,
      lastDriver: editDriver || undefined,
    });
    if (success) {
      setFeedbackMsg(`Aferição do veículo ${vehicleName} salva com sucesso! (KM: ${editKm || target?.odometer}, Tanque: ${editFuel})`);
      setEditingVehicle(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleCopyAfericaoReport = () => {
    const dateStr = new Date().toLocaleString('pt-BR');
    const header = `🚗 RELATÓRIO GERAL DE AFERIÇÃO DA FROTA - NRE MARINGÁ\nData/Hora da Aferição: ${dateStr}\n--------------------------------------------------\n`;
    const lines = sortedVehicles.map(v => {
      const statusText = v.status === 'AVAILABLE' ? 'LIVRE NO PÁTIO' : v.status === 'MAINTENANCE' ? `MANUTENÇÃO (${v.maintenanceReason || 'Oficina'})` : `EM USO (${v.lastDriver || 'Motorista'})`;
      return `• ${v.name} | Placa: ${v.plate} | KM: ${v.odometer.toLocaleString('pt-BR')} km | Tanque: ${v.fuelLevel} | Status: ${statusText}`;
    }).join('\n');
    const total = `\n--------------------------------------------------\nTotal de Veículos: ${vehicles.length} | Livres: ${vehicles.filter(v => v.status === 'AVAILABLE').length} | Em Uso: ${vehicles.filter(v => v.status === 'UNAVAILABLE').length} | Manutenção: ${maintenanceCount}`;
    navigator.clipboard.writeText(header + lines + total);
    setFeedbackMsg('📋 Relatório geral de aferição copiado para a área de transferência com sucesso!');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleReleaseAll = async () => {
    if (window.confirm('Deseja realmente alterar TODOS os veículos para DISPONÍVEL?')) {
      const success = await onReleaseAllVehicles();
      if (success) {
        setFeedbackMsg('Todos os veículos foram definidos como DISPONÍVEIS no pátio!');
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    }
  };

  const handleDeleteTripRecord = async (tripId: string) => {
    if (window.confirm('Deseja excluir este registro de acesso/viagem?')) {
      const success = await onDeleteTrip(tripId, '192026');
      if (success) {
        setFeedbackMsg('Registro excluído com sucesso!');
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    }
  };

  const handleClearAllHistory = async () => {
    if (window.confirm('ATENÇÃO: Deseja apagar TODO o histórico de viagens e abastecimento para que novos usuários alimentem o aplicativo do zero?')) {
      if (onClearAllHistory) {
        const success = await onClearAllHistory('192026');
        if (success) {
          setFeedbackMsg('Histórico completamente limpo com sucesso!');
          setTimeout(() => setFeedbackMsg(null), 3000);
        }
      }
    }
  };

  const handleClearAccessLogs = async () => {
    if (window.confirm('Deseja limpar os registros de auditoria de acessos?')) {
      if (onClearAccessLogs) {
        const success = await onClearAccessLogs();
        if (success) {
          setFeedbackMsg('Logs de auditoria de acessos limpos com sucesso!');
          setTimeout(() => setFeedbackMsg(null), 3000);
        }
      }
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    setBroadcastSending(true);
    try {
      if (onBroadcastNotification) {
        const ok = await onBroadcastNotification({
          title: broadcastTitle,
          message: broadcastMessage,
          urgent: broadcastUrgent,
          type: 'BROADCAST',
        });
        if (ok) {
          setFeedbackMsg('📢 Notificação enviada em tempo real para todos os celulares da frota!');
          setTimeout(() => setFeedbackMsg(null), 4000);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBroadcastSending(false);
    }
  };

  const applyPreset = (title: string, msg: string, urgent: boolean) => {
    setBroadcastTitle(title);
    setBroadcastMessage(msg);
    setBroadcastUrgent(urgent);
  };

  const handleCopyAppShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Filtered Access Logs by Period & Keyword
  const filteredAccessLogs = useMemo(() => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return accessLogs.filter(log => {
      // Period filter
      if (logPeriod === 'today') {
        const todayStr = new Date().toLocaleDateString('pt-BR');
        if (log.date !== todayStr) return false;
      } else if (logPeriod === 'yesterday') {
        const yesterday = new Date(now - oneDayMs).toLocaleDateString('pt-BR');
        if (log.date !== yesterday) return false;
      } else if (logPeriod === '7days') {
        if (now - log.timestamp > 7 * oneDayMs) return false;
      } else if (logPeriod === '30days') {
        if (now - log.timestamp > 30 * oneDayMs) return false;
      }

      // Keyword search
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const match =
          (log.action && log.action.toLowerCase().includes(q)) ||
          (log.driverName && log.driverName.toLowerCase().includes(q)) ||
          (log.device && log.device.toLowerCase().includes(q)) ||
          (log.ip && log.ip.toLowerCase().includes(q)) ||
          (log.details && log.details.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [accessLogs, logPeriod, logSearchQuery]);

  // Metric computations for access logs
  const todayDateStr = new Date().toLocaleDateString('pt-BR');
  const todayAccessCount = accessLogs.filter(l => l.date === todayDateStr).length;
  const mobileAccessCount = accessLogs.filter(l => l.device && (l.device.includes('Android') || l.device.includes('iPhone') || l.device.includes('Mobile'))).length;
  const desktopAccessCount = accessLogs.length - mobileAccessCount;

  const containerClasses = embedded
    ? 'w-full max-w-5xl mx-auto py-3 sm:py-6 px-2 sm:px-4 space-y-4 animate-fade-in pb-16'
    : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in';

  const cardClasses = embedded
    ? 'bg-white w-full rounded-2xl shadow-xl overflow-hidden border border-slate-200/90 flex flex-col'
    : 'bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]';

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        {/* Header Modal / Embedded Page */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Aba do Administrador & Aferições
                {isAuthenticated ? (
                  <span className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                    Chave Mestre Ativa
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full uppercase">
                    Acesso Restrito
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">Controle total da frota, aferição de KM/tanque, manutenção em lote e auditoria</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                id="btn-admin-logout"
                className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 active:scale-95"
                title="Bloquear sessão do Administrador"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Bloquear</span>
              </button>
            )}
            <button
              onClick={onClose}
              id={embedded ? 'btn-back-admin-view' : 'btn-close-admin-modal'}
              className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 active:scale-95"
              title={embedded ? 'Voltar ao Início' : 'Fechar Janela'}
            >
              {embedded ? (
                <>
                  <ArrowLeft className="w-4 h-4 text-slate-300" />
                  <span className="hidden sm:inline">Início</span>
                </>
              ) : (
                <X className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 sm:p-6 flex-1 space-y-4 ${embedded ? '' : 'overflow-y-auto'}`}>
          {!isAuthenticated ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="max-w-md mx-auto py-8 space-y-5">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-black text-slate-900">Autenticação Mestre do Administrador</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Para garantir a integridade dos dados e impedir alterações indevidas, apenas o Administrador com a Chave Mestre pode editar a frota, definir manutenções em lote e visualizar relatórios de auditoria de acessos.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Chave Mestre de Acesso:
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite a Chave Mestre"
                  required
                  autoFocus
                  id="input-admin-master-key"
                  className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-center text-xl tracking-widest text-slate-900 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>

              <button
                type="submit"
                id="btn-submit-admin-auth"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-sm shadow-md transition active:scale-98"
              >
                Acessar Painel do Administrador
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400">
                  🔒 Os condutores e técnicos utilizam o aplicativo normalmente sem necessidade de senha para preencher saídas, chegadas e abastecimentos.
                </p>
              </div>
            </form>
          ) : (
            /* Admin Dashboard Panel */
            <div className="space-y-4">
              {/* Alert Feedback Banner */}
              {feedbackMsg && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-fade-in shadow-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{feedbackMsg}</span>
                </div>
              )}

              {/* Master Control Summary Banner */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 shadow-md border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">
                      Aplicativo Online & Sistema Centralizado
                    </span>
                  </div>
                  
                  {/* Share button */}
                  <button
                    type="button"
                    onClick={handleCopyAppShareLink}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Link Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Copiar Link para Condutores</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Frota Cadastrada</span>
                    <span className="text-lg font-black text-white">{vehicles.length} Veículos</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/40">
                    <span className="text-[10px] font-bold text-emerald-300 block uppercase">Livres no Pátio</span>
                    <span className="text-lg font-black text-emerald-400">
                      {vehicles.filter(v => v.status === 'AVAILABLE').length} Carros
                    </span>
                  </div>
                  <div className="bg-red-950/40 p-2.5 rounded-xl border border-red-800/40">
                    <span className="text-[10px] font-bold text-red-300 block uppercase">Em Manutenção</span>
                    <span className="text-lg font-black text-red-400">
                      {maintenanceCount} Bloqueados
                    </span>
                  </div>
                  <div className="bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-800/40">
                    <span className="text-[10px] font-bold text-indigo-300 block uppercase">Acessos Monitorados</span>
                    <span className="text-lg font-black text-indigo-400">
                      {accessLogs.length} Entradas
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                  <span>🔒 <strong>Garantia de Persistência:</strong> Dados salvos em espelhamento primário + backup em tempo real.</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex flex-wrap gap-2">
                  {/* Tab 1: Aferição e Gerenciamento de Carros */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('vehicles')}
                    id="tab-admin-vehicles"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'vehicles'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Gauge className="w-4 h-4" />
                    Aferição da Frota ({vehicles.length})
                  </button>

                  {/* Tab 2: Manutenção (COM SUPORTE A MÚLTIPLOS VEÍCULOS EM LOTE) */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('maintenance')}
                    id="tab-admin-maintenance"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'maintenance'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    Manutenção em Lote {maintenanceCount > 0 ? `(${maintenanceCount} fora)` : ''}
                  </button>

                  {/* Tab 3: Relatórios Diários (Excel e PDF) */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    id="tab-admin-reports"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'reports'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Relatórios (Excel / PDF)
                  </button>

                  {/* Tab 4: Auditoria e Log de Acessos no Período (NOVA) */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('access_logs')}
                    id="tab-admin-access-logs"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'access_logs'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Log de Acessos ({accessLogs.length})
                  </button>

                  {/* Tab 4: Comunicados Push para Motoristas */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('broadcast')}
                    id="tab-admin-broadcast"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'broadcast'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    Avisos Push
                  </button>

                  {/* Tab 5: Registros de Viagens */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('trips')}
                    id="tab-admin-trips"
                    className={`px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                      activeTab === 'trips'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Viagens ({recentTrips.length})
                  </button>
                </div>

                {activeTab === 'vehicles' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAfericaoReport}
                      id="btn-copy-afericao-report"
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                      title="Copiar relatório completo de KM e combustível de todos os veículos"
                    >
                      <Copy className="w-3.5 h-3.5 text-amber-300" />
                      Copiar Aferição
                    </button>
                    <button
                      type="button"
                      onClick={handleReleaseAll}
                      id="btn-release-all-vehicles"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Liberar Frota
                    </button>
                    {onResetOdometers && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('Atenção: Deseja zerar os odômetros de todos os veículos da frota? O sistema registrará e fixará o odômetro inicial na primeira saída de cada condutor.')) {
                            const ok = await onResetOdometers();
                            if (ok) {
                              setFeedbackMsg('Odômetros de todos os veículos zerados com sucesso para fixar o 1º registro.');
                              setTimeout(() => setFeedbackMsg(null), 4000);
                            }
                          }
                        }}
                        id="btn-admin-reset-all-odometers"
                        className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                        title="Zerar odômetros de todos os veículos da frota"
                      >
                        <Gauge className="w-3.5 h-3.5" />
                        Zerar Odômetros
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1: Vehicles & Aferições Management */}
              {activeTab === 'vehicles' && (
                <div className="space-y-4">
                  {/* Search and Filters Header */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-indigo-400" />
                        <div>
                          <h4 className="font-black text-sm text-white">Central de Aferição & Calibragem da Frota</h4>
                          <p className="text-xs text-slate-300">Ajuste e certifique a quilometragem (KM), tanque e status dos 13 veículos.</p>
                        </div>
                      </div>
                      <span className="text-[11px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2.5 py-1 rounded-lg font-bold self-start sm:self-auto">
                        13 Veículos Ativos
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <div className="sm:col-span-8 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={vehicleSearchQuery}
                          onChange={(e) => setVehicleSearchQuery(e.target.value)}
                          placeholder="Buscar por nome do carro, placa ou motorista..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-800 text-white text-xs rounded-xl border border-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-400"
                        />
                        {vehicleSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setVehicleSearchQuery('')}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="sm:col-span-4 flex gap-1">
                        <select
                          value={vehicleFilterStatus}
                          onChange={(e) => setVehicleFilterStatus(e.target.value as any)}
                          className="w-full py-2 px-2.5 bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 focus:outline-hidden focus:border-indigo-400"
                        >
                          <option value="ALL">Todos os Status ({vehicles.length})</option>
                          <option value="AVAILABLE">Disponíveis ({vehicles.filter(v => v.status === 'AVAILABLE').length})</option>
                          <option value="UNAVAILABLE">Em Uso ({vehicles.filter(v => v.status === 'UNAVAILABLE').length})</option>
                          <option value="MAINTENANCE">Em Manutenção ({maintenanceCount})</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Vehicles List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedVehicles
                      .filter(v => {
                        if (vehicleFilterStatus !== 'ALL' && v.status !== vehicleFilterStatus) return false;
                        if (vehicleSearchQuery.trim()) {
                          const q = vehicleSearchQuery.toLowerCase();
                          const matchName = v.name.toLowerCase().includes(q);
                          const matchPlate = v.plate.toLowerCase().includes(q);
                          const matchDriver = (v.lastDriver || '').toLowerCase().includes(q);
                          return matchName || matchPlate || matchDriver;
                        }
                        return true;
                      })
                      .map((v) => {
                        const isAvailable = v.status === 'AVAILABLE';
                        const isMaintenance = v.status === 'MAINTENANCE';
                        const isEditing = editingVehicle === v.name;

                        return (
                          <div
                            key={v.id}
                            className={`p-4 rounded-2xl border transition-all shadow-xs ${
                              isMaintenance
                                ? 'bg-red-50/70 border-red-200'
                                : isAvailable
                                ? 'bg-slate-50/90 border-slate-200 hover:border-indigo-300'
                                : 'bg-amber-50/60 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-slate-900 text-sm">{v.name}</span>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                      isMaintenance
                                        ? 'bg-red-100 text-red-900 border-red-300'
                                        : isAvailable
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : 'bg-amber-100 text-amber-900 border-amber-300'
                                    }`}
                                  >
                                    {isMaintenance ? 'MANUTENÇÃO' : isAvailable ? 'DISPONÍVEL' : 'EM USO'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>Placa: <strong className="text-slate-900 font-black">{v.plate}</strong></span>
                                  <span>•</span>
                                  <span className="text-indigo-900 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                    KM: <strong>{v.odometer.toLocaleString('pt-BR')} km</strong>
                                  </span>
                                  <span>•</span>
                                  <span>Tanque: <strong className="text-slate-900">{v.fuelLevel}</strong></span>
                                </div>
                                {isMaintenance && v.maintenanceReason && (
                                  <p className="text-xs font-bold text-red-800 mt-1 bg-red-100/70 p-1.5 rounded-lg border border-red-200">
                                    🔧 Manutenção: {v.maintenanceReason}
                                  </p>
                                )}
                                {v.lastDriver && (
                                  <p className="text-xs text-slate-600">
                                    Condutor/Responsável: <strong className="text-slate-800">{v.lastDriver}</strong>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(v)}
                                  className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                                    isAvailable
                                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                      : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                  }`}
                                  title={isAvailable ? 'Marcar como Em Uso' : 'Marcar como Disponível'}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Aferição & Quick Edit Inline Form */}
                            {isEditing ? (
                              <div className="mt-3 pt-3 border-t-2 border-indigo-200 bg-indigo-50/50 -mx-4 -mb-4 p-4 rounded-b-2xl space-y-3 animate-fade-in">
                                <div className="flex items-center gap-1.5 text-indigo-950 font-black text-xs">
                                  <Gauge className="w-4 h-4 text-indigo-600" />
                                  <span>Painel de Aferição & Calibragem ({v.name})</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                                      Quilometragem Aferida (KM)
                                    </label>
                                    <input
                                      type="number"
                                      value={editKm}
                                      onChange={(e) => setEditKm(e.target.value)}
                                      className="w-full p-2 bg-white border-2 border-indigo-300 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:border-indigo-600"
                                      placeholder="Ex: 45200"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                                      Nível do Tanque Aferido
                                    </label>
                                    <select
                                      value={editFuel}
                                      onChange={(e) => setEditFuel(e.target.value as FuelLevel)}
                                      className="w-full p-2 bg-white border-2 border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-indigo-600"
                                    >
                                      <option value="Cheio">Cheio</option>
                                      <option value="3/4">3/4</option>
                                      <option value="Meio tanque">Meio tanque</option>
                                      <option value="1/4">1/4</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                                      Status do Veículo
                                    </label>
                                    <select
                                      value={editStatus}
                                      onChange={(e) => setEditStatus(e.target.value as VehicleStatus)}
                                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                                    >
                                      <option value="AVAILABLE">Disponível no Pátio</option>
                                      <option value="UNAVAILABLE">Em Uso (Em Rota)</option>
                                      <option value="MAINTENANCE">Em Manutenção</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-indigo-900 uppercase block mb-1">
                                      Condutor / Responsável
                                    </label>
                                    <input
                                      type="text"
                                      value={editDriver}
                                      onChange={(e) => setEditDriver(e.target.value)}
                                      placeholder="Nome do motorista..."
                                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingVehicle(null)}
                                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveVehicleEdit(v.name)}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Salvar Aferição
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between">
                                <span className="text-[10px] text-slate-600 font-medium">
                                  Última aferição: {v.odometer.toLocaleString('pt-BR')} km ({v.fuelLevel})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVehicle(v.name);
                                    setEditKm(v.odometer.toString());
                                    setEditFuel(v.fuelLevel as FuelLevel);
                                    setEditStatus(v.status);
                                    setEditDriver(v.lastDriver || '');
                                  }}
                                  id={`btn-aferir-${v.id}`}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                                >
                                  <Gauge className="w-3.5 h-3.5" />
                                  Realizar Aferição / Ajustar KM
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tab 2: Maintenance Management (COM SELEÇÃO MÚLTIPLA EM LOTE) */}
              {activeTab === 'maintenance' && (
                <div className="space-y-4">
                  {/* Informative Header */}
                  <div className="bg-amber-500/10 border-2 border-amber-400 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-950 font-black text-sm">
                      <Wrench className="w-5 h-5 text-amber-600" />
                      <span>Gerenciamento de Manutenção Individual e em Lote (Vários Carros)</span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      O Administrador pode selecionar <strong>vários carros simultaneamente</strong> para colocar em manutenção (oficina, revisão periódica, troca de pneus) ou liberá-los juntos de volta ao pátio.
                    </p>
                  </div>

                  {/* Multi-Selection Control Panel (LOTE) */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3 shadow-md border border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllVehicles}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                        >
                          {selectedVehiclesForMaintenance.length === sortedVehicles.length ? (
                            <>
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                              <span>Desmarcar Todos</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 text-slate-400" />
                              <span>Selecionar Todos ({sortedVehicles.length})</span>
                            </>
                          )}
                        </button>

                        <span className="text-xs text-amber-300 font-black bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-800">
                          {selectedVehiclesForMaintenance.length} veículo(s) selecionado(s)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={selectedVehiclesForMaintenance.length === 0}
                          onClick={() => handleApplyBatchMaintenance('MAINTENANCE')}
                          id="btn-batch-maintenance"
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-sm"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Colocar Selecionados em Manutenção
                        </button>

                        <button
                          type="button"
                          disabled={selectedVehiclesForMaintenance.length === 0}
                          onClick={() => handleApplyBatchMaintenance('AVAILABLE')}
                          id="btn-batch-release"
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Liberar Selecionados para o Pátio
                        </button>
                      </div>
                    </div>

                    {/* Motivo do lote */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 uppercase block">
                        Motivo / Descrição do Reparo em Lote:
                      </label>
                      <input
                        type="text"
                        value={batchReasonInput}
                        onChange={(e) => setBatchReasonInput(e.target.value)}
                        placeholder="Ex: Revisão geral preventiva da frota / Oficina autorizada"
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          'Revisão periódica / Troca de Óleo',
                          'Revisão de Freios e Suspensão',
                          'Troca e Alinhamento de Pneus',
                          'Manutenção de Ar Condicionado',
                          'Funilaria e Pintura',
                        ].map((quickReason) => (
                          <button
                            key={quickReason}
                            type="button"
                            onClick={() => setBatchReasonInput(quickReason)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-medium border border-slate-700 transition"
                          >
                            {quickReason}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modal/Form to place individual vehicle in maintenance */}
                  {maintenanceVehicleName && (
                    <div className="bg-white p-4 rounded-2xl border-2 border-amber-500 shadow-md space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 uppercase">
                          Colocar em Manutenção Individual: <strong className="text-amber-700">{maintenanceVehicleName}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setMaintenanceVehicleName(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 block">
                          Motivo / Descrição do Reparo:
                        </label>
                        <input
                          type="text"
                          value={maintenanceReasonInput}
                          onChange={(e) => setMaintenanceReasonInput(e.target.value)}
                          placeholder="Ex: Oficina Mecânica - Revisão de Freios / Troca de Óleo / Pneus"
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setMaintenanceVehicleName(null)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetMaintenance(maintenanceVehicleName, true, maintenanceReasonInput)}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                        >
                          <Wrench className="w-4 h-4" />
                          Confirmar Bloqueio por Manutenção
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Vehicles List sorted alphabetically with Checkboxes and Maintenance Controls */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 px-1">
                      Frota de Veículos (Marque a caixa para selecionar múltiplos):
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sortedVehicles.map((v) => {
                        const isUnderMaintenance = v.status === 'MAINTENANCE';
                        const isSelected = selectedVehiclesForMaintenance.includes(v.name);

                        return (
                          <div
                            key={v.id}
                            className={`p-3.5 rounded-2xl border transition-all ${
                              isSelected
                                ? 'ring-2 ring-indigo-600 bg-indigo-50/50 border-indigo-300'
                                : isUnderMaintenance
                                ? 'bg-red-50 border-red-300 shadow-xs'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectVehicle(v.name)}
                                  className="w-4 h-4 mt-1 accent-indigo-600 rounded cursor-pointer shrink-0"
                                />

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900 text-sm">{v.name}</span>
                                    {isUnderMaintenance ? (
                                      <span className="bg-red-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Wrench className="w-2.5 h-2.5" />
                                        Fora de Serviço
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                                        Operacional
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Placa: <strong className="text-slate-800">{v.plate}</strong> | KM:{' '}
                                    <strong>{v.odometer.toLocaleString('pt-BR')}</strong>
                                  </p>
                                  {isUnderMaintenance ? (
                                    <div className="mt-2 bg-red-100/80 p-2 rounded-xl border border-red-200 text-[11px] text-red-950 space-y-0.5">
                                      <span className="font-black block text-red-900">
                                        🔧 Motivo: {v.maintenanceReason || 'Em manutenção'}
                                      </span>
                                      {v.maintenanceDate && (
                                        <span className="text-[10px] text-red-800 block">
                                          Data do envio: {v.maintenanceDate}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      Status atual:{' '}
                                      <strong className={v.status === 'AVAILABLE' ? 'text-emerald-700' : 'text-amber-700'}>
                                        {v.status === 'AVAILABLE' ? 'Disponível no Pátio' : `Em Uso (${v.lastDriver || 'Motorista'})`}
                                      </strong>
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isUnderMaintenance ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSetMaintenance(v.name, false)}
                                    id={`btn-release-maintenance-${v.plate}`}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Liberar Carro
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMaintenanceVehicleName(v.name);
                                      setMaintenanceReasonInput('Revisão mecânica e preventiva');
                                    }}
                                    id={`btn-set-maintenance-${v.plate}`}
                                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 whitespace-nowrap active:scale-95"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                    Manutenção
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Access Logs & Audit in Period (NOVA ABA DE AUDITORIA DE ACESSOS) */}
              {activeTab === 'access_logs' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Overview Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
                      <div className="flex items-center justify-between text-blue-900 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Total de Acessos</span>
                        <Globe className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-2xl font-black text-blue-950">{accessLogs.length}</span>
                      <span className="text-[10px] text-blue-700 block mt-0.5">Auditoria Completa</span>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="flex items-center justify-between text-emerald-900 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Acessos Hoje</span>
                        <Activity className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="text-2xl font-black text-emerald-950">{todayAccessCount}</span>
                      <span className="text-[10px] text-emerald-700 block mt-0.5">{todayDateStr}</span>
                    </div>

                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl">
                      <div className="flex items-center justify-between text-purple-900 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Acessos Mobile</span>
                        <Smartphone className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-2xl font-black text-purple-950">{mobileAccessCount}</span>
                      <span className="text-[10px] text-purple-700 block mt-0.5">Smartphones / Celulares</span>
                    </div>

                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-2xl">
                      <div className="flex items-center justify-between text-slate-800 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider">Acessos PC</span>
                        <Laptop className="w-4 h-4 text-slate-600" />
                      </div>
                      <span className="text-2xl font-black text-slate-900">{desktopAccessCount}</span>
                      <span className="text-[10px] text-slate-600 block mt-0.5">Computadores / Terminais</span>
                    </div>
                  </div>

                  {/* Filter Toolbar by Period and Search */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-slate-700 mr-1 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          Filtrar Período:
                        </span>

                        {[
                          { id: 'today', label: 'Hoje' },
                          { id: 'yesterday', label: 'Ontem' },
                          { id: '7days', label: 'Últimos 7 Dias' },
                          { id: '30days', label: 'Últimos 30 Dias' },
                          { id: 'all', label: 'Todo o Período' },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setLogPeriod(btn.id as any)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                              logPeriod === btn.id
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href="/api/fleet/admin/export-access-logs-csv"
                          download="auditoria_acessos_frota_nre.csv"
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Exportar CSV</span>
                        </a>

                        {onClearAccessLogs && (
                          <button
                            type="button"
                            onClick={handleClearAccessLogs}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl transition flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Limpar Logs</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        placeholder="Buscar por condutor, IP, dispositivo (Android, iPhone, Windows) ou ação realizada..."
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  {/* Logs Table / List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-black uppercase text-slate-600">
                        Histórico Detalhado ({filteredAccessLogs.length} registros no filtro)
                      </span>
                    </div>

                    <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                      {filteredAccessLogs.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200">
                          <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-500 font-bold">Nenhum acesso registrado no período selecionado.</p>
                        </div>
                      ) : (
                        filteredAccessLogs.map((log) => {
                          const isMobile = log.device && (log.device.includes('Android') || log.device.includes('iPhone') || log.device.includes('Mobile'));

                          return (
                            <div
                              key={log.id}
                              className="p-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md font-black text-[10px] bg-blue-100 text-blue-900 border border-blue-200">
                                    {log.action}
                                  </span>

                                  <strong className="text-slate-900 font-black">
                                    {log.driverName || 'Condutor / Visitante'}
                                  </strong>

                                  <span className="text-slate-400 text-[11px]">
                                    • {log.date} às {log.time}
                                  </span>
                                </div>

                                {log.details && (
                                  <p className="text-slate-700 text-xs font-medium">
                                    {log.details}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 ${
                                  isMobile ? 'bg-purple-100 text-purple-900' : 'bg-slate-200 text-slate-800'
                                }`}>
                                  {isMobile ? <Smartphone className="w-3 h-3" /> : <Laptop className="w-3 h-3" />}
                                  {log.device || 'Navegador Web'}
                                </span>

                                <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  IP: {log.ip || '127.0.0.1'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Daily Reports & Official Exports (Excel & PDF) */}
              {activeTab === 'reports' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Top Banner */}
                  <div className="p-4 bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl border border-emerald-800 shadow-md space-y-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Central de Relatórios Diários Oficiais (Excel & PDF)
                      </h3>
                    </div>
                    <p className="text-xs text-emerald-200 leading-relaxed">
                      Exporte e baixe diariamente todas as movimentações da frota (saídas, chegadas e comprovantes de abastecimento) em planilha Excel compatível (.csv com UTF-8 BOM) ou documento oficial impresso em PDF pronto para auditoria e arquivo.
                    </p>
                  </div>

                  {/* Filter & Export Controls Card */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Date Filter Selection */}
                      <div className="space-y-1.5 flex-1">
                        <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Data de Referência do Relatório:</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            placeholder="DD/MM/AAAA ou TODOS"
                            className="p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 w-36 focus:ring-2 focus:ring-emerald-600 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setReportDate(new Date().toLocaleDateString('pt-BR'))}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition"
                          >
                            Hoje
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() - 1);
                              setReportDate(d.toLocaleDateString('pt-BR'));
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition"
                          >
                            Ontem
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportDate('TODOS')}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition"
                          >
                            Todos os Registros
                          </button>
                        </div>
                      </div>

                      {/* Download Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => {
                            const dateParam = reportDate === 'TODOS' ? '' : `?date=${encodeURIComponent(reportDate)}`;
                            window.open(`/api/fleet/admin/export-excel${dateParam}`, '_blank');
                          }}
                          id="btn-export-excel-daily"
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Baixar Excel Diário (.csv)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const dateParam = reportDate === 'TODOS' ? '' : `?date=${encodeURIComponent(reportDate)}`;
                            window.open(`/api/fleet/admin/export-pdf-report${dateParam}`, '_blank');
                          }}
                          id="btn-export-pdf-daily"
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          <span>Imprimir / PDF Oficial</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary metrics for filtered date */}
                    {(() => {
                      const filtered = recentTrips.filter((t) =>
                        reportDate === 'TODOS' || !reportDate ? true : t.date === reportDate || t.date.includes(reportDate)
                      );
                      const saidas = filtered.filter((t) => t.type === 'SAÍDA').length;
                      const chegadas = filtered.filter((t) => t.type === 'CHEGADA').length;
                      const abastecimentos = filtered.filter((t) => t.type === 'ABASTECIMENTO');
                      const totalLiters = abastecimentos.reduce((acc, curr) => acc + (curr.liters || 0), 0);

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total de Registros</span>
                            <span className="text-base font-black text-slate-900">{filtered.length} lançamentos</span>
                          </div>
                          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            <span className="text-[10px] font-bold text-amber-800 uppercase block">Saídas no Período</span>
                            <span className="text-base font-black text-amber-900">{saidas} veículos</span>
                          </div>
                          <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Chegadas / Retornos</span>
                            <span className="text-base font-black text-emerald-900">{chegadas} veículos</span>
                          </div>
                          <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200">
                            <span className="text-[10px] font-bold text-blue-800 uppercase block">Abastecimentos</span>
                            <span className="text-base font-black text-blue-900">{abastecimentos.length} ({totalLiters.toFixed(1)} L)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Google Drive Integration Links */}
                  <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-black uppercase text-amber-300">
                        Pastas de Armazenamento Automático no Google Drive
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      As fotos de odômetros e comprovantes enviadas pelos condutores ficam salvas no servidor e vinculadas às pastas registradas:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <a
                        href="https://drive.google.com/drive/folders/1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz?usp=drive_link"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 transition flex items-center justify-between"
                      >
                        <span>📁 Fotos de Saída</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href="https://drive.google.com/drive/folders/1tN3i9WirFjLldHsUcYnWT14AowcisbMc?usp=drive_link"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-emerald-300 transition flex items-center justify-between"
                      >
                        <span>📁 Fotos de Chegada</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href="https://drive.google.com/drive/folders/1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ?usp=drive_link"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-blue-300 transition flex items-center justify-between"
                      >
                        <span>📁 Fotos de Abastecimento</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Filtered Records Preview List */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase">
                        Pré-visualização dos Lançamentos ({reportDate}):
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Use os botões no topo para gerar o arquivo final
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1">
                      {(() => {
                        const filtered = recentTrips.filter((t) =>
                          reportDate === 'TODOS' || !reportDate ? true : t.date === reportDate || t.date.includes(reportDate)
                        );

                        if (filtered.length === 0) {
                          return (
                            <p className="text-center text-xs text-slate-400 py-6">
                              Nenhum registro encontrado para a data {reportDate}.
                            </p>
                          );
                        }

                        return filtered.map((trip) => (
                          <div key={trip.id} className="p-2.5 hover:bg-slate-50/80 transition flex items-center justify-between gap-2 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                                    trip.type === 'SAÍDA'
                                      ? 'bg-amber-100 text-amber-900'
                                      : trip.type === 'CHEGADA'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : 'bg-blue-100 text-blue-900'
                                  }`}
                                >
                                  {trip.type}
                                </span>
                                <strong className="text-slate-900 font-bold">{trip.vehicle}</strong>
                                <span className="text-slate-400">• {trip.date} às {trip.time}</span>
                              </div>
                              <p className="text-slate-600 text-[11px]">
                                Condutor: <strong className="text-slate-800">{trip.driver || 'Não informado'}</strong> | KM:{' '}
                                <strong>{trip.km || '-'}</strong> | Motivo/Destino:{' '}
                                <strong className="text-indigo-900">{trip.visitReason || trip.details || 'Não informado'}</strong>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {trip.odometerImage || trip.receiptImage ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold text-[10px] rounded-md border border-emerald-200">
                                  📸 Foto Salva
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Sem foto</span>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Broadcast Notifications Panel */}
              {activeTab === 'broadcast' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-2xl border border-purple-800 shadow-md space-y-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-5 h-5 text-purple-300 animate-pulse" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        Disparar Notificação Push para Todos os Motoristas
                      </h3>
                    </div>
                    <p className="text-xs text-purple-200 leading-relaxed">
                      Envie comunicados, lembretes de devolução urgente e avisos operacionais. Todos os aparelhos e celulares conectados receberão o alerta simultaneamente na tela e na barra de notificações.
                    </p>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">Modelos Rápidos de Comunicado:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          applyPreset(
                            '⏰ Lembrete: Retorno da Frota ao Pátio',
                            'Atenção motoristas: Todos os veículos devem retornar ao pátio do NRE impreterivelmente até as 17:30.',
                            true
                          )
                        }
                        className="p-2.5 text-left bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-950 transition flex items-center gap-2"
                      >
                        <span className="text-base">⏰</span>
                        <span>Lembrete de Devolução (17:30)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          applyPreset(
                            '🔧 Aviso: Veículos em Manutenção',
                            'Informamos que os veículos sinalizados em vermelho estão bloqueados para manutenção preventiva no momento.',
                            false
                          )
                        }
                        className="p-2.5 text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-950 transition flex items-center gap-2"
                      >
                        <span className="text-base">🔧</span>
                        <span>Aviso de Manutenção Preventiva</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          applyPreset(
                            '⛽ Lembrete de Abastecimento',
                            'Favor abastecer o veículo caso o ponteiro de combustível esteja abaixo de meio tanque e anexar a foto da nota fiscal.',
                            false
                          )
                        }
                        className="p-2.5 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold text-blue-950 transition flex items-center gap-2"
                      >
                        <span className="text-base">⛽</span>
                        <span>Lembrete de Abastecimento e Nota</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          applyPreset(
                            '📸 Foto Obrigatória do Odômetro',
                            'Lembramos a todos que é obrigatório registrar a foto do painel/odômetro na saída e na chegada dos veículos.',
                            false
                          )
                        }
                        className="p-2.5 text-left bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 transition flex items-center gap-2"
                      >
                        <span className="text-base">📸</span>
                        <span>Aviso: Foto Legível do Odômetro</span>
                      </button>
                    </div>
                  </div>

                  {/* Broadcast Form */}
                  <form onSubmit={handleSendBroadcast} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase block mb-1">
                        Título do Alerta:
                      </label>
                      <input
                        type="text"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="Ex: ⏰ Horário Limite de Retorno"
                        required
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-800 uppercase block mb-1">
                        Mensagem do Comunicado:
                      </label>
                      <textarea
                        rows={3}
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Digite a mensagem para os motoristas..."
                        required
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-purple-600 outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={broadcastUrgent}
                          onChange={(e) => setBroadcastUrgent(e.target.checked)}
                          className="w-4 h-4 accent-red-600 rounded cursor-pointer"
                        />
                        <span>Marcar como Urgente / Alta Prioridade 🚨</span>
                      </label>

                      <button
                        type="submit"
                        disabled={broadcastSending}
                        id="btn-dispatch-broadcast"
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {broadcastSending ? (
                          <span>Enviando...</span>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Disparar para Toda a Frota</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab 5: Trips & Movement Records */}
              {activeTab === 'trips' && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Histórico Geral de Movimentações ({recentTrips.length} lançamentos)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Todos os registros de saída, chegada e abastecimento preenchidos pelos usuários.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => window.open('/api/fleet/admin/export-excel', '_blank')}
                        id="btn-quick-export-excel"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
                        title="Baixar todos os registros em planilha Excel"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Excel (.csv)
                      </button>

                      <button
                        type="button"
                        onClick={() => window.open('/api/fleet/admin/export-pdf-report', '_blank')}
                        id="btn-quick-export-pdf"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
                        title="Imprimir relatório completo em PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        PDF Oficial
                      </button>

                      {onClearAllHistory && (
                        <button
                          type="button"
                          onClick={handleClearAllHistory}
                          id="btn-clear-all-history"
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Limpar Histórico
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                    {recentTrips.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-6">Nenhum registro encontrado.</p>
                    ) : (
                      recentTrips.map((trip) => (
                        <div
                          key={trip.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                                  trip.type === 'SAÍDA'
                                    ? 'bg-amber-100 text-amber-900'
                                    : trip.type === 'CHEGADA'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : 'bg-blue-100 text-blue-900'
                                }`}
                              >
                                {trip.type}
                              </span>
                              <strong className="text-slate-900 font-bold">{trip.vehicle}</strong>
                              <span className="text-slate-400">• {trip.date} às {trip.time}</span>
                            </div>
                            <div className="text-slate-600 text-[11px] space-y-0.5">
                              <div>
                                Motorista: <strong className="text-slate-800">{trip.driver || 'Não informado'}</strong>
                                {trip.passengers && trip.passengers !== 'Nenhum' && (
                                  <span className="text-slate-500"> • 👥 Acomp: <strong>{trip.passengers}</strong></span>
                                )}
                                {' • '}KM: <strong className="text-sky-900 font-mono">{trip.km !== undefined && trip.km !== null && trip.km !== '' ? Number(trip.km).toLocaleString('pt-BR') : '-'}</strong>
                                {trip.type === 'ABASTECIMENTO' && trip.liters ? (
                                  <span> • Litros: <strong className="text-amber-900">{trip.liters} L</strong></span>
                                ) : trip.fuelLevel ? (
                                  <span> • Tanque: <strong className="text-slate-800">{trip.fuelLevel}</strong></span>
                                ) : null}
                              </div>
                              {(trip.visitCity || trip.visitLocation || trip.visitReason || trip.details) && (
                                <div className="text-slate-700">
                                  {trip.visitCity && <span>📍 <strong>{trip.visitCity}</strong>{trip.visitLocation ? ` (${trip.visitLocation})` : ''} • </span>}
                                  Motivo: <strong className="text-indigo-900">{trip.visitReason || trip.details || 'Não informado'}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTripRecord(trip.id)}
                            id={`btn-delete-trip-${trip.id}`}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
