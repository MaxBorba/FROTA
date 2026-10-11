import React, { useState } from 'react';
import { DriverTripEntry, Vehicle } from '../types';
import { DRIVE_FOLDERS } from '../data/driveConfig';
import { LogOut, LogIn, Fuel, Car, History, Clock, User, Gauge, ShieldCheck, CheckCircle, AlertCircle, Wrench, FolderOpen, ExternalLink, Lock, Trash2, CheckCircle2, X } from 'lucide-react';

interface HomeViewProps {
  onSelectAction: (action: 'checkout' | 'checkin' | 'refuel' | 'status' | 'trips' | 'admin') => void;
  onOpenAdminModal?: () => void;
  recentTrips: DriverTripEntry[];
  vehicles: Vehicle[];
  onDeleteTrip?: (tripId: string, masterKey?: string) => Promise<boolean>;
  isAdminAuthenticated?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectAction,
  onOpenAdminModal,
  recentTrips,
  vehicles,
  onDeleteTrip,
  isAdminAuthenticated = false,
}) => {
  // Admin delete modal state
  const [deletingTrip, setDeletingTrip] = useState<DriverTripEntry | null>(null);
  const [deleteKeyInput, setDeleteKeyInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sort vehicles alphabetically
  const sortedVehicles = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const availableVehicles = vehicles.filter(v => v.status === 'AVAILABLE');
  const occupiedVehicles = vehicles.filter(v => v.status === 'UNAVAILABLE');
  const maintenanceVehicles = vehicles.filter(v => v.status === 'MAINTENANCE');

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingTrip || !onDeleteTrip) return;

    const key = deleteKeyInput.trim() || (isAdminAuthenticated ? '192026' : '');
    if (key !== '192026') {
      setDeleteError('Chave Mestre incorreta. Apenas o Administrador pode apagar algum dado deste aplicativo.');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const ok = await onDeleteTrip(deletingTrip.id, key);
      if (ok) {
        setDeleteSuccess('Registro excluído com sucesso pelo Administrador.');
        setTimeout(() => {
          setDeletingTrip(null);
          setDeleteSuccess(null);
          setDeleteKeyInput('');
          setIsDeleting(false);
        }, 1200);
      } else {
        setDeleteError('Erro ao excluir registro. Tente novamente.');
        setIsDeleting(false);
      }
    } catch {
      setDeleteError('Erro ao comunicar com o servidor.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto pb-10">
      {/* Driver notice */}
      <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex items-start gap-3 text-sky-900 text-xs shadow-xs">
        <div className="bg-[#27a3df] text-white p-2 rounded-xl shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
        <div className="space-y-0.5">
          <p className="leading-snug font-bold">
            Aplicativo Mestre Centralizado (Todos os Celulares):
          </p>
          <p className="text-[11px] text-sky-800 leading-tight">
            Sincronização em tempo real ativa. Quando um motorista registra a saída, o veículo fica reservado e visível para todos os outros aparelhos instantaneamente.
          </p>
        </div>
      </div>

      {/* Real-time Shared Fleet Metrics Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-black text-xs uppercase tracking-wider text-emerald-400">
              Frota ao Vivo em Tempo Real ({vehicles.length} Veículos)
            </span>
          </div>
          <button
            onClick={() => onSelectAction('status')}
            className="text-[11px] text-[#27a3df] hover:underline font-bold flex items-center gap-1"
          >
            Ver Detalhes
          </button>
        </div>

        {/* Quick Numbers */}
        <div className={`grid gap-2 ${maintenanceVehicles.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-800/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-emerald-300 block uppercase">No Pátio</span>
            <span className="text-base font-black text-emerald-400">{availableVehicles.length} Livres</span>
          </div>

          <div className="bg-amber-950/60 p-2.5 rounded-xl border border-amber-800/50 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-amber-300 block uppercase">Em Uso</span>
            <span className="text-base font-black text-amber-400">{occupiedVehicles.length} Carros</span>
          </div>

          {maintenanceVehicles.length > 0 && (
            <div className="bg-red-950/60 p-2.5 rounded-xl border border-red-800/50 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-red-300 block uppercase flex items-center gap-1">
                <Wrench className="w-3 h-3 text-red-400" /> Manutenção
              </span>
              <span className="text-base font-black text-red-400">{maintenanceVehicles.length} Carros</span>
            </div>
          )}
        </div>

        {/* Live List Preview in Alphabetical Order */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Status por Veículo em Ordem Alfabética:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
            {sortedVehicles.map((v) => {
              const isFree = v.status === 'AVAILABLE';
              const isMaint = v.status === 'MAINTENANCE';

              let cardStyle = 'bg-slate-800/60 border-slate-700/60 text-slate-200';
              if (isMaint) {
                cardStyle = 'bg-red-950/40 border-red-800/60 text-red-200';
              } else if (!isFree) {
                cardStyle = 'bg-amber-950/40 border-amber-800/60 text-amber-200';
              }

              return (
                <div
                  key={v.id}
                  className={`p-2 rounded-xl text-[11px] font-bold flex items-center justify-between border ${cardStyle}`}
                >
                  <span className="truncate pr-1">{v.name}</span>
                  {isMaint ? (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-2 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                      <Wrench className="w-2.5 h-2.5" /> Manutenção
                    </span>
                  ) : isFree ? (
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded-full shrink-0">
                      Disponível
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[100px]" title={`Em uso por ${v.lastDriver || 'Motorista'}`}>
                      {v.lastDriver ? `Em uso: ${v.lastDriver.split(' ')[0]}` : 'Em uso'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Executive Admin Quick Access Card */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white p-4 rounded-2xl shadow-lg border-2 border-indigo-400/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm shrink-0 border border-white/10">
            <ShieldCheck className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-white tracking-tight">
                Aba do Administrador & Aferições
              </h3>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                Chave Mestre
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              Aferição de KM/Odômetro, Calibragem de Tanque, Manutenção em Lote e Auditoria Geral.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelectAction('admin')}
          id="btn-quick-access-admin"
          className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Acessar com Senha</span>
        </button>
      </div>

      {/* Main Action Buttons Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Menu Principal de Ações
        </h2>

        {/* 1. REGISTRAR SAÍDA - Blue #27a3df */}
        <button
          onClick={() => onSelectAction('checkout')}
          id="btn-action-checkout"
          style={{ backgroundColor: '#27a3df' }}
          className="w-full text-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <LogOut className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="block font-black text-base tracking-tight leading-tight">
                REGISTRAR SAÍDA
              </span>
              <span className="text-xs text-white/80 font-normal">
                Retirar veículo do pátio
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 2. REGISTRAR CHEGADA - Green #03bb85 */}
        <button
          onClick={() => onSelectAction('checkin')}
          id="btn-action-checkin"
          style={{ backgroundColor: '#03bb85' }}
          className="w-full text-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="block font-black text-base tracking-tight leading-tight">
                REGISTRAR CHEGADA
              </span>
              <span className="text-xs text-white/80 font-normal">
                Devolver veículo ao NRE
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 3. REGISTRAR ABASTECIMENTO - Yellow #efb810 */}
        <button
          onClick={() => onSelectAction('refuel')}
          id="btn-action-refuel"
          style={{ backgroundColor: '#efb810' }}
          className="w-full text-slate-950 p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-slate-950/15 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <Fuel className="w-6 h-6 text-slate-950" />
            </div>
            <div className="text-left">
              <span className="block font-black text-base tracking-tight leading-tight">
                REGISTRAR ABASTECIMENTO
              </span>
              <span className="text-xs text-slate-900/80 font-medium">
                Anotar litros e foto da nota
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-slate-950/70 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 4. MOSTRAR O STATUS DOS CARROS DA FROTA - Black #022022 */}
        <button
          onClick={() => onSelectAction('status')}
          id="btn-action-status"
          style={{ backgroundColor: '#022022' }}
          className="w-full text-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group border border-slate-800"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <Car className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <span className="block font-black text-sm sm:text-base tracking-tight leading-tight">
                MOSTRAR O STATUS DOS CARROS DA FROTA
              </span>
              <span className="text-xs text-slate-300 font-normal">
                Disponibilidade e combustível
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 5. MOSTRAR AS ÚLTIMAS 5 VIAGENS DO MOTORISTA - Purple #ab00ed */}
        <button
          onClick={() => onSelectAction('trips')}
          id="btn-action-trips"
          style={{ backgroundColor: '#ab00ed' }}
          className="w-full text-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <History className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <span className="block font-black text-sm sm:text-base tracking-tight leading-tight">
                MOSTRAR AS ÚLTIMAS 5 VIAGENS DO MOTORISTA
              </span>
              <span className="text-xs text-white/80 font-normal">
                Histórico anotado no aplicativo
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 6. ABA DO ADMINISTRADOR E AFERIÇÕES - Indigo #4338ca */}
        <button
          onClick={() => onSelectAction('admin')}
          id="btn-action-admin-afericoes"
          style={{ backgroundColor: '#4338ca' }}
          className="w-full text-white p-4 rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-between group border-2 border-indigo-400/50"
        >
          <div className="flex items-center gap-3.5">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 text-indigo-200" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="block font-black text-sm sm:text-base tracking-tight leading-tight">
                  ABA DO ADMINISTRADOR & AFERIÇÕES
                </span>
                <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Aferição
                </span>
              </div>
              <span className="text-xs text-indigo-200 font-normal">
                Aferição de KM/Odômetro, Tanque, Manutenção em Lote e Auditoria
              </span>
            </div>
          </div>
          <svg className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Google Drive 3 Folders Box */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <span className="font-black text-xs uppercase tracking-wider text-slate-100">
              Pastas no Google Drive (Anexos de Fotos)
            </span>
          </div>
          <span className="text-[10px] text-sky-400 font-bold bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800/60">
            Nuvem NRE
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <a
            href={DRIVE_FOLDERS.departure.url}
            target="_blank"
            rel="noopener noreferrer"
            id="link-home-drive-saida"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-sky-500/40 flex flex-col items-center justify-center text-center transition group"
          >
            <span className="w-2 h-2 rounded-full bg-[#27a3df] mb-1"></span>
            <span className="text-[11px] font-extrabold text-sky-300 leading-tight">Fotos Saída</span>
            <span className="text-[9px] text-slate-400 group-hover:text-sky-300 flex items-center gap-0.5 mt-0.5">
              Abrir <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>

          <a
            href={DRIVE_FOLDERS.arrival.url}
            target="_blank"
            rel="noopener noreferrer"
            id="link-home-drive-chegada"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-500/40 flex flex-col items-center justify-center text-center transition group"
          >
            <span className="w-2 h-2 rounded-full bg-[#03bb85] mb-1"></span>
            <span className="text-[11px] font-extrabold text-emerald-300 leading-tight">Fotos Chegada</span>
            <span className="text-[9px] text-slate-400 group-hover:text-emerald-300 flex items-center gap-0.5 mt-0.5">
              Abrir <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>

          <a
            href={DRIVE_FOLDERS.refuel.url}
            target="_blank"
            rel="noopener noreferrer"
            id="link-home-drive-abastecimento"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-amber-500/40 flex flex-col items-center justify-center text-center transition group"
          >
            <span className="w-2 h-2 rounded-full bg-[#efb810] mb-1"></span>
            <span className="text-[11px] font-extrabold text-amber-300 leading-tight">Abastecimento</span>
            <span className="text-[9px] text-slate-400 group-hover:text-amber-300 flex items-center gap-0.5 mt-0.5">
              Abrir <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>
        </div>
      </div>

      {/* Bottom Section: Histórico de Registros do Condutor (Permanente) */}
      <div id="home-recent-records" className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#27a3df]" />
            <h3 className="font-extrabold text-sm text-slate-800">
              Histórico de Registros do Condutor
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {recentTrips.length} {recentTrips.length === 1 ? 'Registro' : 'Registros'} (Permanente)
          </span>
        </div>

        {recentTrips.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center italic">
            Nenhum registro encontrado ainda. Registre uma saída ou chegada.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
            {recentTrips.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/60 transition text-xs flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 uppercase tracking-wide">
                    {item.vehicle}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        item.type === 'SAÍDA'
                          ? 'bg-sky-100 text-sky-800 border border-sky-300/50'
                          : item.type === 'CHEGADA'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/50'
                          : 'bg-amber-100 text-amber-800 border border-amber-300/50'
                      }`}
                    >
                      {item.type}
                    </span>
                    {onDeleteTrip && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingTrip(item);
                          setDeleteKeyInput('');
                          setDeleteError(null);
                          setDeleteSuccess(null);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Apagar este registro (Apenas Administrador com Chave Mestre)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-0.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{item.date} às {item.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold text-slate-800">{item.driver}</span>
                  </div>
                </div>

                {/* Destination & Location Details if present */}
                {(item.visitCity || item.visitLocation) && (
                  <div className="text-[11px] text-slate-700 bg-slate-100/70 p-1.5 rounded-lg border border-slate-200/50 flex flex-col gap-0.5">
                    <div className="font-bold text-slate-900">
                      📍 {item.visitCity || 'MARINGÁ'} {item.visitLocation ? `• ${item.visitLocation}` : ''}
                    </div>
                    {item.passengers && item.passengers !== 'Nenhum' && (
                      <div className="text-[10px] text-slate-500">
                        👥 Acomp: {item.passengers}
                      </div>
                    )}
                    {(item.visitReason || item.details) && (
                      <div className="text-[10px] text-indigo-900 font-medium">
                        📌 Motivo: {item.visitReason || item.details}
                      </div>
                    )}
                  </div>
                )}

                {/* KM & Fuel / Liters */}
                {(item.km !== undefined || item.fuelLevel || item.liters) && (
                  <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200/40 pt-1 mt-0.5">
                    {item.km !== undefined && item.km !== null && item.km !== '' ? (
                      <span className="flex items-center gap-1 font-mono font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200/70">
                        <Gauge className="w-3 h-3 text-sky-600" />
                        {Number(item.km).toLocaleString('pt-BR')} KM
                      </span>
                    ) : <span></span>}
                    {item.type === 'ABASTECIMENTO' && item.liters ? (
                      <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        ⛽ {item.liters} Litros
                      </span>
                    ) : item.fuelLevel ? (
                      <span className="font-medium text-slate-700">
                        Tanque: <strong>{item.fuelLevel}</strong>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Delete Confirmation Modal */}
      {deletingTrip && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-red-600 font-black text-sm">
                <Trash2 className="w-5 h-5" />
                <span>Excluir Registro de Veículo</span>
              </div>
              <button
                type="button"
                onClick={() => setDeletingTrip(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-50 border border-red-200 p-3.5 rounded-2xl text-xs space-y-1.5 text-red-900">
              <p className="font-extrabold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-red-600" />
                Apenas o Administrador pode apagar algum dado deste aplicativo!
              </p>
              <p className="text-[11px] text-red-800">
                Você solicitou excluir o registro de <strong>{deletingTrip.type}</strong> do veículo <strong>{deletingTrip.vehicle}</strong> (Motorista: {deletingTrip.driver || 'Não informado'}, {deletingTrip.date} às {deletingTrip.time}).
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {deleteSuccess && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{deleteSuccess}</span>
              </div>
            )}

            {!deleteSuccess && (
              <form onSubmit={handleConfirmDelete} className="space-y-3">
                {!isAdminAuthenticated && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Digite a Chave Mestre do Administrador:
                    </label>
                    <input
                      type="password"
                      value={deleteKeyInput}
                      onChange={(e) => setDeleteKeyInput(e.target.value)}
                      placeholder="Chave Mestre de Segurança"
                      required
                      autoFocus
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-bold tracking-widest outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeletingTrip(null)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
