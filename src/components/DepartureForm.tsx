import React, { useState, useRef, useMemo } from 'react';
import { PREDEFINED_VEHICLES, PREDEFINED_CITIES } from '../data/initialData';
import { getBrasiliaDateISO, getBrasiliaDateFormatted, getBrasiliaTime } from '../utils/dateTime';
import { compressImage } from '../utils/imageCompressor';
import { Vehicle } from '../types';
import { DRIVE_FOLDERS } from '../data/driveConfig';
import { validateDate, validateTime, validateKm, validateRequiredText } from '../utils/validators';
import { FormFieldFeedback } from './FormFieldFeedback';
import {
  LogOut,
  ArrowLeft,
  Calendar,
  Clock,
  Gauge,
  User,
  Users,
  MapPin,
  Building,
  FileText,
  CheckCircle2,
  Camera,
  Image as ImageIcon,
  X,
  Wrench,
  AlertTriangle,
  AlertCircle,
  FolderOpen,
  ExternalLink,
} from 'lucide-react';

interface DepartureFormProps {
  vehicles: Vehicle[];
  onBack: () => void;
  onSubmit: (data: {
    vehicle: string;
    date: string;
    time: string;
    km: number;
    driver: string;
    passengers: string;
    visitCity: string;
    visitLocation: string;
    visitReason: string;
    receiptImage?: string | null;
  }) => Promise<void>;
}

export const DepartureForm: React.FC<DepartureFormProps> = ({ vehicles, onBack, onSubmit }) => {
  // Sort vehicle list alphabetically
  const sortedVehicleNames = [...PREDEFINED_VEHICLES].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const [selectedVehicle, setSelectedVehicle] = useState<string>(sortedVehicleNames[0]);
  const [dateIso, setDateIso] = useState<string>(getBrasiliaDateISO());
  const [time, setTime] = useState<string>(getBrasiliaTime());
  const [km, setKm] = useState<string>('');
  const [driver, setDriver] = useState<string>('');
  const [passengers, setPassengers] = useState<string>('');
  const [visitCity, setVisitCity] = useState<string>('MARINGÁ');
  const [visitLocation, setVisitLocation] = useState<string>('');
  const [visitReason, setVisitReason] = useState<string>('');
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Field interaction tracking for visual feedback
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setPhotoImage(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotoImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const selectedVehicleObj = vehicles.find((item) => item.name.trim() === selectedVehicle.trim());
  const isSelectedVehicleOccupied = selectedVehicleObj?.status === 'UNAVAILABLE';
  const isSelectedVehicleMaintenance = selectedVehicleObj?.status === 'MAINTENANCE';

  const availableCount = vehicles.filter((v) => v.status === 'AVAILABLE').length;
  const occupiedCount = vehicles.filter((v) => v.status === 'UNAVAILABLE').length;
  const maintenanceCount = vehicles.filter((v) => v.status === 'MAINTENANCE').length;

  // Validation calculations
  const dateValidation = useMemo(() => validateDate(dateIso), [dateIso]);
  const timeValidation = useMemo(() => validateTime(time), [time]);
  const kmValidation = useMemo(
    () => validateKm(km, selectedVehicleObj?.odometer, 'DEPARTURE'),
    [km, selectedVehicleObj?.odometer]
  );
  const driverValidation = useMemo(() => validateRequiredText(driver, 'Motorista', 3), [driver]);
  const reasonValidation = useMemo(() => validateRequiredText(visitReason, 'Motivo da visita', 3), [visitReason]);
  const locationValidation = useMemo(
    () => (visitLocation.trim().length > 0 ? { isValid: true } : { isValid: true, warning: 'Recomendado informar o local (ex: Colégio / Escola)' }),
    [visitLocation]
  );

  const isFormValid =
    !isSelectedVehicleMaintenance &&
    dateValidation.isValid &&
    timeValidation.isValid &&
    kmValidation.isValid &&
    driverValidation.isValid &&
    reasonValidation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    // Mark all fields as touched on submit attempt
    setTouched({
      vehicle: true,
      date: true,
      time: true,
      km: true,
      driver: true,
      visitReason: true,
      visitLocation: true,
    });

    if (isSelectedVehicleMaintenance) {
      alert('Este veículo está em MANUTENÇÃO e não pode ser retirado no momento. Selecione outro veículo.');
      return;
    }

    if (!isFormValid) {
      // Gather errors to notify
      const errors: string[] = [];
      if (!driverValidation.isValid) errors.push(driverValidation.message || 'Nome do motorista inválido');
      if (!kmValidation.isValid) errors.push(kmValidation.message || 'KM inválido');
      if (!dateValidation.isValid) errors.push(dateValidation.message || 'Data inválida');
      if (!timeValidation.isValid) errors.push(timeValidation.message || 'Horário inválido');
      if (!reasonValidation.isValid) errors.push(reasonValidation.message || 'Motivo da visita obrigatório');

      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = getBrasiliaDateFormatted(dateIso);
      const cleanKm = Number(km.toString().replace(/\./g, '').replace(/,/g, '.').trim());

      await onSubmit({
        vehicle: selectedVehicle,
        date: formattedDate,
        time,
        km: cleanKm,
        driver: driver.trim(),
        passengers: passengers.trim() || 'Nenhum',
        visitCity,
        visitLocation: visitLocation.trim(),
        visitReason: visitReason.trim(),
        receiptImage: photoImage,
      });

      // Save to localStorage for instant vehicle recognition on Android / Safari
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(
          'nre_active_departure',
          JSON.stringify({
            vehicle: selectedVehicle,
            driver: driver.trim(),
            km: cleanKm,
            date: formattedDate,
            time,
            timestamp: Date.now(),
          })
        );
        localStorage.setItem('nre_preferred_driver', driver.trim());
      }

      setSuccessMsg('Saída registrada com sucesso!');
      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err) {
      alert('Erro ao registrar saída. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shouldShowError = (fieldName: string, validation: { isValid: boolean }) => {
    return (touched[fieldName] || hasAttemptedSubmit) && !validation.isValid;
  };

  return (
    <div className="p-3 sm:p-4 max-w-lg mx-auto space-y-4 pb-12">
      {/* Top Header */}
      <div className="bg-[#27a3df] text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <LogOut className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 id="title-registrar-saida" className="text-lg font-black tracking-tight">REGISTRAR SAÍDA</h2>
            <p className="text-xs text-white/80">Controle de saída de veículos do NRE</p>
          </div>
        </div>
        <button
          onClick={onBack}
          id="btn-top-back-departure"
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span className="font-bold text-sm">{successMsg}</span>
        </div>
      )}

      {/* Top Validation Warning Card on failed submit attempt */}
      {hasAttemptedSubmit && !isFormValid && (
        <div className="bg-red-50 border-2 border-red-400 p-4 rounded-2xl space-y-2 animate-shake shadow-sm">
          <div className="flex items-center gap-2 text-red-900 font-black text-xs uppercase">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>Existem campos com dados incompletos ou inválidos:</span>
          </div>
          <ul className="text-xs text-red-800 space-y-1 list-disc pl-5 font-semibold">
            {shouldShowError('driver', driverValidation) && <li>{driverValidation.message}</li>}
            {shouldShowError('km', kmValidation) && <li>{kmValidation.message}</li>}
            {shouldShowError('date', dateValidation) && <li>{dateValidation.message}</li>}
            {shouldShowError('time', timeValidation) && <li>{timeValidation.message}</li>}
            {shouldShowError('visitReason', reasonValidation) && <li>{reasonValidation.message}</li>}
            {isSelectedVehicleMaintenance && <li>O veículo selecionado está em manutenção.</li>}
          </ul>
        </div>
      )}

      {/* Live Fleet Availability Bar */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-bold text-slate-200">Status da Frota em Tempo Real:</span>
        </div>
        <div className="flex items-center gap-1.5 font-black text-[11px]">
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2.5 py-1 rounded-full">
            🟢 {availableCount} Livres
          </span>
          <span className="bg-amber-950 text-amber-300 border border-amber-800/80 px-2.5 py-1 rounded-full">
            🔴 {occupiedCount} Em Uso
          </span>
          {maintenanceCount > 0 && (
            <span className="bg-red-950 text-red-400 border border-red-800/80 px-2.5 py-1 rounded-full flex items-center gap-1">
              🔧 {maintenanceCount} Manut.
            </span>
          )}
        </div>
      </div>

      {/* Form Container */}
      <form onSubmit={handleSubmit} noValidate className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        {/* 1ª linha “Veículo” - Ordem Alfabética */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <span className="text-[#27a3df] font-black">1ª Linha:</span> Veículo (Ordem Alfabética)
            </span>
            <span className="text-[10px] text-slate-400 font-medium lowercase">
              (Status sincronizado)
            </span>
          </label>
          <select
            value={selectedVehicle}
            onChange={(e) => {
              setSelectedVehicle(e.target.value);
              markTouched('vehicle');
            }}
            id="select-departure-vehicle"
            className={`w-full min-h-[44px] p-3 border rounded-xl font-bold text-slate-800 text-sm focus:ring-2 outline-none transition ${
              isSelectedVehicleMaintenance
                ? 'bg-red-50 border-red-400 text-red-950 focus:ring-red-500'
                : isSelectedVehicleOccupied
                ? 'bg-amber-50 border-amber-400 text-amber-950 focus:ring-amber-500'
                : 'bg-slate-50 border-slate-300 focus:ring-[#27a3df] focus:border-[#27a3df]'
            }`}
          >
            {sortedVehicleNames.map((vName) => {
              const vMatch = vehicles.find((item) => item.name.trim() === vName.trim());
              const isAvailable = !vMatch || vMatch.status === 'AVAILABLE';
              const isUnderMaintenance = vMatch?.status === 'MAINTENANCE';

              let label = `🟢 [DISPONÍVEL NO PÁTIO] - ${vName}`;
              if (isUnderMaintenance) {
                label = `🔧 [EM MANUTENÇÃO / FORA DE SERVIÇO] - ${vName}`;
              } else if (!isAvailable) {
                label = `🔴 [EM USO POR ${vMatch?.lastDriver || 'MOTORISTA'}] - ${vName}`;
              }

              return (
                <option key={vName} value={vName}>
                  {label}
                </option>
              );
            })}
          </select>

          {/* Maintenance Banner */}
          {isSelectedVehicleMaintenance && (
            <div className="bg-red-500/15 border-2 border-red-400 p-3 rounded-xl space-y-1 animate-fade-in text-xs text-red-950">
              <span className="font-extrabold flex items-center gap-1.5 text-red-900">
                <Wrench className="w-4 h-4 text-red-600" />
                VEÍCULO FORA DE SERVIÇO DEVIDO A MANUTENÇÃO
              </span>
              <p className="leading-snug text-[11px] font-medium text-slate-800">
                O administrador sinalizou este veículo como em manutenção:{' '}
                <strong>{selectedVehicleObj?.maintenanceReason || 'Revisão mecânica'}</strong>.
              </p>
              <p className="text-[10px] font-bold text-red-900 pt-0.5">
                💡 Por favor, selecione outro veículo disponível no pátio.
              </p>
            </div>
          )}

          {/* Occupied Vehicle Warning Banner */}
          {!isSelectedVehicleMaintenance && isSelectedVehicleOccupied && (
            <div className="bg-amber-500/15 border-2 border-amber-400 p-3 rounded-xl space-y-1 animate-fade-in text-xs text-amber-950">
              <span className="font-extrabold flex items-center gap-1.5 text-amber-900">
                ⚠️ ATENÇÃO: VEÍCULO JÁ RETIRADO DO PÁTIO
              </span>
              <p className="leading-snug text-[11px] font-medium text-slate-800">
                Este veículo foi reservado/retirado por{' '}
                <strong>{selectedVehicleObj?.lastDriver || 'outro motorista'}</strong>
                {selectedVehicleObj?.lastDeparture ? ` em ${selectedVehicleObj.lastDeparture}` : ''}
                {selectedVehicleObj?.lastDestination ? ` (Destino: ${selectedVehicleObj.lastDestination})` : ''}.
              </p>
              <p className="text-[10px] font-bold text-amber-900 pt-0.5">
                💡 Por favor, escolha um dos veículos marcados como 🟢 [DISPONÍVEL NO PÁTIO] no menu acima.
              </p>
            </div>
          )}

          {!isSelectedVehicleMaintenance && !isSelectedVehicleOccupied && (
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl text-[11px] text-emerald-900 font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Veículo livre para retirada no Pátio NRE
              </span>
              <span className="text-emerald-700 text-[10px] font-mono font-bold">
                Placa: {selectedVehicleObj?.plate || '-'}
              </span>
            </div>
          )}
        </div>

        {/* 2ª linha “Data” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Calendar className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">2ª Linha:</span> Data <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            onBlur={() => markTouched('date')}
            id="input-departure-date"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('date', dateValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#27a3df]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('date', dateValidation) ? dateValidation.message : undefined}
            warning={dateValidation.warning}
          />
        </div>

        {/* 3ª linha “Horário” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Clock className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">3ª Linha:</span> Horário (Horário real de Brasília) <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => markTouched('time')}
            id="input-departure-time"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('time', timeValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#27a3df]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('time', timeValidation) ? timeValidation.message : undefined}
            warning={timeValidation.warning}
          />
        </div>

        {/* 4ª linha “KM do veículo” (Em branco por padrão para o condutor digitar o KM real) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-[#27a3df]" />
              <span className="text-[#27a3df] font-black">4ª Linha:</span> KM do veículo (Digite o Odômetro Real) <span className="text-red-500">*</span>
            </span>
            {selectedVehicleObj?.odometer && selectedVehicleObj.odometer > 0 ? (
              <span className="text-[10px] text-slate-500 font-mono">
                Último KM: <strong>{selectedVehicleObj.odometer.toLocaleString('pt-BR')}</strong>
              </span>
            ) : (
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                🏁 1º Registro Inicial (Odômetro Zerado)
              </span>
            )}
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            onBlur={() => markTouched('km')}
            placeholder="Digite o KM atual marcado no painel..."
            autoComplete="off"
            id="input-departure-km"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 outline-none transition placeholder:font-normal placeholder:text-slate-400 ${
              shouldShowError('km', kmValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#27a3df]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('km', kmValidation) ? kmValidation.message : undefined}
            warning={kmValidation.warning}
            hint={!km ? 'Insira a quilometragem exata exibida no painel do carro.' : undefined}
          />
          {(!selectedVehicleObj?.odometer || selectedVehicleObj.odometer === 0) && (
            <div className="text-[11px] text-indigo-900 bg-indigo-50 border border-indigo-200 p-2.5 rounded-xl font-medium flex items-center gap-2">
              <span className="text-base shrink-0">🏁</span>
              <span>
                <strong>Primeiro registro do veículo:</strong> O odômetro está zerado. Digite o KM real do painel do carro; o aplicativo irá registrar e fixar este valor como o odômetro inicial oficial.
              </span>
            </div>
          )}
        </div>

        {/* 5ª linha “Motorista” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <User className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">5ª Linha:</span> Motorista <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="text"
            value={driver}
            onChange={(e) => setDriver(e.target.value)}
            onBlur={() => markTouched('driver')}
            placeholder="Nome completo do motorista"
            autoComplete="name"
            id="input-departure-driver"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 outline-none transition ${
              shouldShowError('driver', driverValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#27a3df]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('driver', driverValidation) ? driverValidation.message : undefined}
          />
        </div>

        {/* 6ª linha “Passageiros” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Users className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">6ª Linha:</span> Passageiros
          </label>
          <input
            type="text"
            inputMode="text"
            value={passengers}
            onChange={(e) => setPassengers(e.target.value)}
            placeholder="Nomes dos passageiros ou NENHUM"
            id="input-departure-passengers"
            className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#27a3df] outline-none"
          />
        </div>

        {/* 7ª linha “Cidade de visita” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <MapPin className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">7ª Linha:</span> Cidade de visita <span className="text-red-500">*</span>
          </label>
          <select
            value={visitCity}
            onChange={(e) => setVisitCity(e.target.value)}
            id="select-departure-city"
            className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#27a3df] outline-none"
          >
            {PREDEFINED_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 8ª linha “Local da visita” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Building className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">8ª Linha:</span> Local da visita
          </label>
          <input
            type="text"
            inputMode="text"
            value={visitLocation}
            onChange={(e) => setVisitLocation(e.target.value)}
            placeholder="Ex: Colégio Estadual, Prefeitura, Escola..."
            id="input-departure-location"
            className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-[#27a3df] outline-none"
          />
          <FormFieldFeedback warning={locationValidation.warning} />
        </div>

        {/* 9ª linha “Motivo da visita” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <FileText className="w-4 h-4 text-[#27a3df]" />
            <span className="text-[#27a3df] font-black">9ª Linha:</span> Motivo da visita <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="text"
            value={visitReason}
            onChange={(e) => setVisitReason(e.target.value)}
            onBlur={() => markTouched('visitReason')}
            placeholder="Ex: Reunião pedagógica, Fiscalização de obras, Atendimento escolar..."
            id="input-departure-reason"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 outline-none transition ${
              shouldShowError('visitReason', reasonValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#27a3df]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('visitReason', reasonValidation) ? reasonValidation.message : undefined}
          />
        </div>

        {/* 10ª linha “Registro do Odômetro com Foto” */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#27a3df]" />
              <span className="text-[#27a3df] font-black">10ª Linha:</span> Registro do Odômetro com a Foto do Painel / Veículo
            </span>
          </label>

          {/* Google Drive Destination Badge */}
          <div className="bg-sky-50/90 border border-sky-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-[#27a3df] text-white p-2 rounded-xl shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black text-slate-800 block truncate">
                  Google Drive: Pasta de Fotos de Saída
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Toda foto registrada aqui fica guardada nesta pasta do Google Drive
                </span>
              </div>
            </div>
            <a
              href={DRIVE_FOLDERS.departure.url}
              target="_blank"
              rel="noopener noreferrer"
              id="link-departure-drive-folder"
              className="bg-white hover:bg-sky-50 text-[#27a3df] border border-sky-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
              title="Abrir pasta no Google Drive"
            >
              <span>Abrir Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            id="input-departure-file"
            className="hidden"
          />

          {photoImage ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#27a3df] bg-slate-900 group">
              <img
                src={photoImage}
                alt="Foto da Saída"
                className="w-full h-48 object-contain bg-slate-950"
              />
              <button
                type="button"
                onClick={() => setPhotoImage(null)}
                id="btn-remove-departure-photo"
                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition"
                title="Remover foto"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-sky-300 font-bold border border-sky-500/30">
                <span className="flex items-center gap-1.5 truncate">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                  Foto Pronta para Upload no Google Drive
                </span>
                <a
                  href={DRIVE_FOLDERS.departure.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white bg-[#27a3df] hover:bg-sky-500 px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 shrink-0"
                >
                  Ver Pasta <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              id="btn-choose-departure-photo"
              className="w-full py-3.5 px-4 bg-sky-50/60 border-2 border-dashed border-[#27a3df] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-sky-100/50 transition cursor-pointer min-h-[44px]"
            >
              <div className="p-2.5 bg-[#27a3df] text-white rounded-full shadow-sm">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block font-black text-xs text-slate-800">
                  Tirar Foto / Escolher Foto (Câmera do Celular)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Salva a foto e gera link automático na pasta de Saída do Google Drive
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Submit Button in Blue #27a3df */}
        <button
          type="submit"
          disabled={isSubmitting || isSelectedVehicleMaintenance}
          id="btn-submit-departure"
          style={{ backgroundColor: isSelectedVehicleMaintenance ? '#94a3b8' : '#27a3df' }}
          className="w-full text-white py-4 px-6 rounded-2xl font-black text-base shadow-md hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2 mt-4 min-h-[48px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
              Registrando...
            </span>
          ) : (
            <>
              <LogOut className="w-5 h-5" />
              REGISTRAR SAÍDA
            </>
          )}
        </button>
      </form>

      {/* Voltar button in blue #27a3df below */}
      <button
        onClick={onBack}
        id="btn-bottom-back-departure"
        style={{ color: '#27a3df', borderColor: '#27a3df' }}
        className="w-full bg-white border-2 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-sky-50 transition active:scale-[0.98] min-h-[44px]"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>
    </div>
  );
};
