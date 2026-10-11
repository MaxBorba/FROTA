import React, { useState } from 'react';
import { DriverTripEntry } from '../types';
import { DRIVE_FOLDERS } from '../data/driveConfig';
import { ArrowLeft, History, Fuel, Calendar, Clock, Car, Search, Filter, Camera, ExternalLink, X, FolderOpen, Trash2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DriverTripsViewProps {
  recentTrips: DriverTripEntry[];
  onBack: () => void;
  onDeleteTrip?: (tripId: string, masterKey?: string) => Promise<boolean>;
  isAdminAuthenticated?: boolean;
}

export const DriverTripsView: React.FC<DriverTripsViewProps> = ({
  recentTrips,
  onBack,
  onDeleteTrip,
  isAdminAuthenticated = false,
}) => {
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Admin delete modal state
  const [deletingTrip, setDeletingTrip] = useState<DriverTripEntry | null>(null);
  const [deleteKeyInput, setDeleteKeyInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get list of unique drivers for filter dropdown
  const uniqueDrivers = Array.from(
    new Set(recentTrips.map(t => t.driver).filter(Boolean))
  );

  const filteredTrips = recentTrips.filter(t => {
    if (driverFilter && !t.driver.toLowerCase().includes(driverFilter.toLowerCase())) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchVehicle = (t.vehicle || '').toLowerCase().includes(q);
      const matchDriver = (t.driver || '').toLowerCase().includes(q);
      const matchCity = (t.visitCity || '').toLowerCase().includes(q);
      const matchLocation = (t.visitLocation || '').toLowerCase().includes(q);
      const matchReason = (t.visitReason || t.details || '').toLowerCase().includes(q);
      const matchKm = String(t.km || '').includes(q);
      if (!matchVehicle && !matchDriver && !matchCity && !matchLocation && !matchReason && !matchKm) {
        return false;
      }
    }
    return true;
  });

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
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-12">
      {/* Upper Border Header in Purple #ab00ed */}
      <div style={{ backgroundColor: '#ab00ed' }} className="text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <History className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 id="title-ultimas-viagens" className="text-base sm:text-lg font-black tracking-tight leading-snug">
              ÚLTIMAS VIAGENS DO MOTORISTA
            </h2>
            <p className="text-xs text-white/80">Registros anotados no aplicativo</p>
          </div>
        </div>
        <button
          onClick={onBack}
          id="btn-top-back-trips"
          style={{ backgroundColor: '#27a3df' }}
          className="text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      {/* Google Drive 3 Folders Quick Access Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
            <FolderOpen className="w-4 h-4 text-purple-600" />
            Pastas Oficiais no Google Drive
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">Anexos em Nuvem</span>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <a
            href={DRIVE_FOLDERS.departure.url}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-drive-trips-saida"
            className="p-2 rounded-xl bg-sky-50 border border-sky-200 hover:border-sky-400 flex flex-col items-center justify-center text-center transition group shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-[#27a3df] mb-1"></span>
            <span className="text-[11px] font-extrabold text-sky-900 leading-tight">Fotos Saída</span>
            <span className="text-[9px] text-sky-700 flex items-center gap-0.5 mt-0.5">
              Drive <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>

          <a
            href={DRIVE_FOLDERS.arrival.url}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-drive-trips-chegada"
            className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 hover:border-emerald-400 flex flex-col items-center justify-center text-center transition group shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-[#03bb85] mb-1"></span>
            <span className="text-[11px] font-extrabold text-emerald-900 leading-tight">Fotos Chegada</span>
            <span className="text-[9px] text-emerald-700 flex items-center gap-0.5 mt-0.5">
              Drive <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>

          <a
            href={DRIVE_FOLDERS.refuel.url}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-drive-trips-abastecimento"
            className="p-2 rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 flex flex-col items-center justify-center text-center transition group shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-[#efb810] mb-1"></span>
            <span className="text-[11px] font-extrabold text-amber-950 leading-tight">Abastecimento</span>
            <span className="text-[9px] text-amber-800 flex items-center gap-0.5 mt-0.5">
              Drive <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </a>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-600" /> Foto do Comprovante / Painel
              </span>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {selectedPhoto.startsWith('data:image') ? (
              <img src={selectedPhoto} alt="Comprovante" className="w-full max-h-[60vh] object-contain rounded-2xl bg-slate-900" />
            ) : (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-slate-600">Esta foto está salva no Google Drive:</p>
                <a
                  href={selectedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Abrir Foto no Google Drive <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver & General Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-purple-600 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por veículo, placa, cidade, destino ou motivo..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {uniqueDrivers.length > 0 && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <Filter className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Motorista:</span>
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              id="select-filter-driver"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos os Motoristas</option>
              {uniqueDrivers.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Table Container (Veículo - Data - Hora - Combustível em forma de tabela) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">
            Tabela de Histórico de Viagens e Operações
          </span>
          <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
            {filteredTrips.length} registro(s) salvo(s)
          </span>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 italic">
            Nenhuma viagem registrada ainda para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-black uppercase text-[10px] tracking-wider">
                  <th className="p-3">Operação</th>
                  <th className="p-3">Veículo</th>
                  <th className="p-3">Data/Hora</th>
                  <th className="p-3">Odômetro (KM)</th>
                  <th className="p-3">Condutor & Acomp.</th>
                  <th className="p-3">Destino / Local</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Combustível</th>
                  <th className="p-3 text-center">Foto</th>
                  <th className="p-3 text-center">Apagar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-purple-50/40 transition">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                          trip.type === 'SAÍDA'
                            ? 'bg-sky-100 text-sky-900 border border-sky-300'
                            : trip.type === 'CHEGADA'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {trip.type}
                      </span>
                    </td>
                    <td className="p-3 font-extrabold text-slate-900 uppercase whitespace-nowrap">
                      {trip.vehicle}
                    </td>
                    <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">
                      <div>{trip.date}</div>
                      <div className="text-[10px] text-slate-500">{trip.time}</div>
                    </td>
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {trip.km !== undefined && trip.km !== null && trip.km !== '' ? (
                        <span className="bg-sky-50 text-sky-900 px-2 py-0.5 rounded-md border border-sky-200 text-[11px] font-mono font-bold">
                          {Number(trip.km).toLocaleString('pt-BR')} km
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-800">
                      <div className="font-bold">{trip.driver || '-'}</div>
                      {trip.passengers && trip.passengers !== 'Nenhum' && (
                        <div className="text-[10px] text-slate-500">
                          👥 {trip.passengers}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-800">
                      <div className="font-bold">{trip.visitCity || 'MARINGÁ'}</div>
                      {trip.visitLocation && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                          {trip.visitLocation}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-slate-700 max-w-[180px]">
                      <div className="text-[11px] truncate" title={trip.visitReason || trip.details || ''}>
                        {trip.visitReason || trip.details || '-'}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {trip.type === 'ABASTECIMENTO' && trip.liters ? (
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300 text-[11px]">
                          ⛽ {trip.liters} L
                        </span>
                      ) : trip.fuelLevel ? (
                        <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          {trip.fuelLevel}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {trip.receiptImage || trip.photoUrl ? (
                        <button
                          onClick={() => setSelectedPhoto(trip.receiptImage || trip.photoUrl!)}
                          className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs"
                          title="Ver foto do comprovante / registro"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Foto</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingTrip(trip);
                          setDeleteKeyInput('');
                          setDeleteError(null);
                          setDeleteSuccess(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title={`Apagar registro de ${trip.type} do ${trip.vehicle} (Requer Chave Mestre)`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Voltar button in blue #27a3df */}
      <button
        onClick={onBack}
        id="btn-bottom-back-trips"
        style={{ color: '#27a3df', borderColor: '#27a3df' }}
        className="w-full bg-white border-2 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-sky-50 transition active:scale-[0.98]"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>

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
