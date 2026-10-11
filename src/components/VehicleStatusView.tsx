import React, { useState } from 'react';
import { Vehicle } from '../types';
import { ArrowLeft, Car, Fuel, Clock, Search, Gauge, User, Wrench } from 'lucide-react';

interface VehicleStatusViewProps {
  vehicles: Vehicle[];
  onBack: () => void;
}

export const VehicleStatusView: React.FC<VehicleStatusViewProps> = ({ vehicles, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const sortedVehicles = [...vehicles].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const filtered = sortedVehicles.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.plate.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-12">
      {/* Upper Border Header: Left = "Status dos veículos", Right = Voltar in blue #27a3df */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/10 p-2 rounded-xl">
            <Car className="w-5 h-5 text-emerald-400" />
          </div>
          <h2 id="title-status-veiculos" className="text-base sm:text-lg font-black tracking-tight uppercase">
            Status dos veículos
          </h2>
        </div>
        <button
          onClick={onBack}
          id="btn-top-back-status"
          style={{ backgroundColor: '#27a3df' }}
          className="text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          placeholder="Buscar modelo ou placa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          id="input-search-vehicles"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#27a3df] shadow-sm"
        />
      </div>

      {/* List of Vehicles in Separate Cards (Alphabetical) */}
      <div className="space-y-3">
        {filtered.map((vehicle) => {
          const isAvailable = vehicle.status === 'AVAILABLE';
          const isMaintenance = vehicle.status === 'MAINTENANCE';

          return (
            <div
              key={vehicle.id}
              id={`card-vehicle-${vehicle.plate.replace(/\s+/g, '')}`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3 hover:shadow-md transition"
            >
              {/* Header: Modelo e Placa + Status Badge */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-500" />
                  <span className="font-black text-sm uppercase tracking-wide text-slate-900">
                    {vehicle.name.toUpperCase()}
                  </span>
                </div>
                {/* Status Badge */}
                {isMaintenance ? (
                  <span
                    style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
                    className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-red-300"
                  >
                    <Wrench className="w-3 h-3 text-red-700" />
                    Em Manutenção
                  </span>
                ) : isAvailable ? (
                  <span
                    style={{ backgroundColor: '#56FF95', color: '#064e3b' }}
                    className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-700 animate-pulse"></span>
                    Disponível no Pátio
                  </span>
                ) : (
                  <span
                    style={{ backgroundColor: '#fed7aa', color: '#7c2d12' }}
                    className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-amber-300"
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-700 animate-ping"></span>
                    Em Uso / Reservado
                  </span>
                )}
              </div>

              {/* Vehicle Info Rows */}
              <div className="grid grid-cols-1 gap-2 text-xs">
                {isMaintenance && (
                  <div className="bg-red-500/15 border border-red-300/80 p-2.5 rounded-xl text-red-950 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1 text-red-900">
                        <Wrench className="w-3.5 h-3.5 text-red-700" />
                        Status da Manutenção:
                      </span>
                      <span className="text-red-950 font-black">Fora de Serviço</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-red-800">Motivo:</span>
                      <span className="font-bold text-red-950">{vehicle.maintenanceReason || 'Revisão mecânica'}</span>
                    </div>
                    {vehicle.maintenanceDate && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-red-800">Registrado em:</span>
                        <span className="font-bold text-red-950">{vehicle.maintenanceDate}</span>
                      </div>
                    )}
                  </div>
                )}

                {!isAvailable && !isMaintenance && vehicle.lastDriver && (
                  <div className="bg-amber-500/15 border border-amber-300/80 p-2.5 rounded-xl text-amber-950 space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1 text-amber-900">
                        <User className="w-3.5 h-3.5 text-amber-700" />
                        Motorista Atual:
                      </span>
                      <span className="text-amber-950 font-black">{vehicle.lastDriver}</span>
                    </div>
                    {vehicle.lastDestination && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-800">Destino da viagem:</span>
                        <span className="font-bold text-amber-950">{vehicle.lastDestination}</span>
                      </div>
                    )}
                    {vehicle.lastReason && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-800">Motivo da visita:</span>
                        <span className="font-bold text-amber-950">{vehicle.lastReason}</span>
                      </div>
                    )}
                    {vehicle.lastDeparture && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-amber-800">Saída registrada em:</span>
                        <span className="font-bold text-amber-950">{vehicle.lastDeparture}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Última Chegada */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-slate-700">
                  <span className="font-bold flex items-center gap-1.5 text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-[#27a3df]" />
                    Última devolução/chegada:
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {vehicle.lastArrival || 'Sem registro recente'}
                  </span>
                </div>

                {/* Combustível */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-slate-700">
                  <span className="font-bold flex items-center gap-1.5 text-slate-500">
                    <Fuel className="w-3.5 h-3.5 text-amber-500" />
                    Combustível:
                  </span>
                  <span className="font-extrabold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {vehicle.fuelLevel || 'N/A'}
                  </span>
                </div>

                {/* Additional metadata */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-slate-400" />
                    Odômetro: <strong>{vehicle.odometer ? `${vehicle.odometer.toLocaleString('pt-BR')} KM` : 'N/A'}</strong>
                  </span>
                  {vehicle.lastDriver && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      Motorista: <strong>{vehicle.lastDriver}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Voltar button in blue #27a3df */}
      <button
        onClick={onBack}
        id="btn-bottom-back-status"
        style={{ color: '#27a3df', borderColor: '#27a3df' }}
        className="w-full bg-white border-2 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-sky-50 transition active:scale-[0.98] mt-4"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>
    </div>
  );
};
