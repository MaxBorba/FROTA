import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PREDEFINED_VEHICLES } from '../data/initialData';
import { getBrasiliaDateISO, getBrasiliaDateFormatted, getBrasiliaTime } from '../utils/dateTime';
import { compressImage } from '../utils/imageCompressor';
import { Vehicle, FuelLevel, DriverTripEntry } from '../types';
import { DRIVE_FOLDERS } from '../data/driveConfig';
import { validateDate, validateTime, validateKm, validateRequiredText } from '../utils/validators';
import { FormFieldFeedback } from './FormFieldFeedback';
import {
  LogIn,
  ArrowLeft,
  Calendar,
  Clock,
  Gauge,
  Fuel,
  User,
  CheckCircle2,
  Car,
  Camera,
  Image as ImageIcon,
  X,
  FolderOpen,
  ExternalLink,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';

interface ArrivalFormProps {
  vehicles: Vehicle[];
  recentTrips?: DriverTripEntry[];
  onBack: () => void;
  onSubmit: (data: {
    vehicle: string;
    date: string;
    time: string;
    km: number;
    fuelLevel: FuelLevel;
    driver?: string;
    receiptImage?: string | null;
  }) => Promise<void>;
}

export const ArrivalForm: React.FC<ArrivalFormProps> = ({
  vehicles,
  recentTrips = [],
  onBack,
  onSubmit,
}) => {
  const sortedVehicleNames = [...PREDEFINED_VEHICLES].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const [selectedVehicle, setSelectedVehicle] = useState<string>(sortedVehicleNames[0]);
  const [ipLinkedVehicle, setIpLinkedVehicle] = useState<string | null>(null);
  const [showAllVehicles, setShowAllVehicles] = useState<boolean>(false);
  const [dateIso, setDateIso] = useState<string>(getBrasiliaDateISO());
  const [time, setTime] = useState<string>(getBrasiliaTime());
  const [km, setKm] = useState<string>('');
  const [fuelLevel, setFuelLevel] = useState<FuelLevel>('Cheio');
  const [driver, setDriver] = useState<string>('');
  const [photoImage, setPhotoImage] = useState<string | null>(null);
  const [autoMatchMsg, setAutoMatchMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Field interaction tracking
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

  // Map drivers to their registered departures
  const departuresByDriver = useMemo(() => {
    const map = new Map<string, { driver: string; vehicle: string; km?: number }>();
    if (recentTrips && recentTrips.length > 0) {
      for (const trip of recentTrips) {
        if (trip.type === 'SAÍDA' && trip.driver && trip.vehicle) {
          const key = trip.driver.trim().toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              driver: trip.driver,
              vehicle: trip.vehicle,
              km: typeof trip.km === 'number' ? trip.km : Number(trip.km) || undefined,
            });
          }
        }
      }
    }
    for (const v of vehicles) {
      if (v.lastDriver) {
        const key = v.lastDriver.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { driver: v.lastDriver, vehicle: v.name, km: v.odometer });
        }
      }
    }
    return Array.from(map.values());
  }, [recentTrips, vehicles]);

  // Find departure trip KM for validation
  const matchedDeparture = useMemo(() => {
    if (driver.trim()) {
      const match = departuresByDriver.find(
        (item) => item.driver.trim().toLowerCase() === driver.trim().toLowerCase()
      );
      if (match) return match;
    }
    // Fallback: match by vehicle
    const vehicleObj = vehicles.find((v) => v.name.trim() === selectedVehicle.trim());
    if (vehicleObj && vehicleObj.odometer) {
      return { driver: vehicleObj.lastDriver || '', vehicle: vehicleObj.name, km: vehicleObj.odometer };
    }
    return undefined;
  }, [driver, departuresByDriver, vehicles, selectedVehicle]);

  const departureKm = matchedDeparture?.km;

  // Handle Driver change & auto-match vehicle
  const handleDriverChange = (newDriver: string) => {
    setDriver(newDriver);
    markTouched('driver');
    if (!newDriver.trim()) {
      setAutoMatchMsg(null);
      return;
    }
    const match = departuresByDriver.find(
      (item) => item.driver.trim().toLowerCase() === newDriver.trim().toLowerCase()
    );
    if (match) {
      setSelectedVehicle(match.vehicle);
      if (match.km && !km) setKm(match.km.toString());
      setAutoMatchMsg(`Carro ${match.vehicle} localizado e preenchido automaticamente para ${match.driver}`);
    } else {
      setAutoMatchMsg(null);
    }
  };

  // Auto-detect vehicle from Android/Safari client session on mount
  useEffect(() => {
    let matched = false;

    // 1. Check client local storage (saved when this device submitted departure)
    try {
      const stored = localStorage.getItem('nre_active_departure');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.vehicle) {
          setSelectedVehicle(parsed.vehicle);
          setIpLinkedVehicle(parsed.vehicle);
          if (parsed.driver) setDriver(parsed.driver);
          if (parsed.km && !km) setKm(parsed.km.toString());
          setAutoMatchMsg(
            `📱 Veículo ${parsed.vehicle} vinculado à sua saída neste aparelho (${parsed.driver || 'Dispositivo'})`
          );
          matched = true;
        }
      }
    } catch {
      // ignore
    }

    // 2. Query server for IP/device matched checkout
    fetch('/api/fleet/my-vehicle')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.activeDeparture) {
          const dep = json.activeDeparture;
          setSelectedVehicle(dep.vehicle);
          setIpLinkedVehicle(dep.vehicle);
          if (dep.driver) setDriver(dep.driver);
          if (dep.km && !km) setKm(dep.km.toString());
          setAutoMatchMsg(
            `📱 Veículo ${dep.vehicle} vinculado ao IP do seu celular (${json.clientIp || 'Dispositivo'}) - Motorista: ${dep.driver}`
          );
          matched = true;
        } else if (!matched && departuresByDriver.length > 0 && !driver) {
          // 3. Fallback to latest active driver if not yet set
          const first = departuresByDriver[0];
          setDriver(first.driver);
          setSelectedVehicle(first.vehicle);
          if (first.km) setKm(first.km.toString());
          setAutoMatchMsg(`Carro ${first.vehicle} localizado e preenchido automaticamente para ${first.driver}`);
        }
      })
      .catch(() => {
        if (!matched && departuresByDriver.length > 0 && !driver) {
          const first = departuresByDriver[0];
          setDriver(first.driver);
          setSelectedVehicle(first.vehicle);
          if (first.km) setKm(first.km.toString());
        }
      });
  }, [departuresByDriver]);

  const displayedVehicles = useMemo(() => {
    if (ipLinkedVehicle && !showAllVehicles) {
      return [ipLinkedVehicle];
    }
    return sortedVehicleNames;
  }, [ipLinkedVehicle, showAllVehicles, sortedVehicleNames]);

  // Update odometer when vehicle changes manually
  useEffect(() => {
    const v = vehicles.find((item) => item.name.trim() === selectedVehicle.trim());
    if (v && v.odometer && !km) {
      setKm(v.odometer.toString());
    }
  }, [selectedVehicle, vehicles]);

  // Validation calculations
  const driverValidation = useMemo(() => validateRequiredText(driver, 'Motorista Responsável', 3), [driver]);
  const dateValidation = useMemo(() => validateDate(dateIso), [dateIso]);
  const timeValidation = useMemo(() => validateTime(time), [time]);
  const kmValidation = useMemo(
    () => validateKm(km, departureKm, 'ARRIVAL'),
    [km, departureKm]
  );

  // Calculated distance traveled
  const numericKm = Number(km.toString().replace(/\./g, '').replace(/,/g, '.').trim());
  const distanceTraveled = useMemo(() => {
    if (departureKm && !isNaN(numericKm) && numericKm >= departureKm) {
      return numericKm - departureKm;
    }
    return null;
  }, [departureKm, numericKm]);

  const isFormValid =
    driverValidation.isValid &&
    dateValidation.isValid &&
    timeValidation.isValid &&
    kmValidation.isValid;

  const shouldShowError = (fieldName: string, validation: { isValid: boolean }) => {
    return (touched[fieldName] || hasAttemptedSubmit) && !validation.isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    setTouched({
      driver: true,
      vehicle: true,
      date: true,
      time: true,
      km: true,
      fuelLevel: true,
    });

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = getBrasiliaDateFormatted(dateIso);
      await onSubmit({
        vehicle: selectedVehicle,
        date: formattedDate,
        time,
        km: numericKm,
        fuelLevel,
        driver: driver.trim() || undefined,
        receiptImage: photoImage,
      });

      // Clear local active departure after arrival is successfully concluded
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('nre_active_departure');
      }
      setIpLinkedVehicle(null);

      setSuccessMsg('Chegada registrada com sucesso!');
      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err) {
      alert('Erro ao registrar chegada. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-lg mx-auto space-y-4 pb-12">
      {/* Top Header in Green #03bb85 */}
      <div
        style={{ backgroundColor: '#03bb85' }}
        className="text-white p-4 rounded-2xl shadow-md flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 id="title-registrar-chegada" className="text-lg font-black tracking-tight">
              REGISTRAR CHEGADA
            </h2>
            <p className="text-xs text-white/80">Devolução de veículo ao NRE</p>
          </div>
        </div>
        <button
          onClick={onBack}
          id="btn-top-back-arrival"
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
            <span>Verifique os seguintes dados antes de registrar a chegada:</span>
          </div>
          <ul className="text-xs text-red-800 space-y-1 list-disc pl-5 font-semibold">
            {shouldShowError('driver', driverValidation) && <li>{driverValidation.message}</li>}
            {shouldShowError('km', kmValidation) && <li>{kmValidation.message}</li>}
            {shouldShowError('date', dateValidation) && <li>{dateValidation.message}</li>}
            {shouldShowError('time', timeValidation) && <li>{timeValidation.message}</li>}
          </ul>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} noValidate className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        {/* Quick Driver Selection Buttons */}
        {departuresByDriver.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl space-y-2">
            <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase">
              <Car className="w-4 h-4 text-[#03bb85]" />
              Motoristas com saída recente (Toque para selecionar):
            </label>
            <div className="flex flex-wrap gap-2">
              {departuresByDriver.map((dep) => {
                const isSelected = driver.trim().toLowerCase() === dep.driver.trim().toLowerCase();
                return (
                  <button
                    key={dep.driver}
                    type="button"
                    onClick={() => handleDriverChange(dep.driver)}
                    id={`btn-select-driver-${dep.driver.replace(/[^a-zA-Z0-9]/g, '')}`}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-xs min-h-[44px] ${
                      isSelected
                        ? 'bg-[#03bb85] text-white border-[#03bb85] shadow-sm scale-105'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{dep.driver}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {dep.vehicle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Auto Match Notification Banner */}
        {autoMatchMsg && (
          <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-900 p-3 rounded-xl text-xs font-black flex items-center gap-2 animate-fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{autoMatchMsg}</span>
          </div>
        )}

        {/* Motorista Responsável Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <User style={{ color: '#03bb85' }} className="w-4 h-4" />
            <span style={{ color: '#03bb85' }} className="font-black">
              1ª Linha:
            </span>{' '}
            Motorista Responsável <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="text"
            value={driver}
            onChange={(e) => handleDriverChange(e.target.value)}
            onBlur={() => markTouched('driver')}
            placeholder="Digite ou selecione o nome do motorista"
            autoComplete="name"
            id="input-arrival-driver"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 outline-none transition ${
              shouldShowError('driver', driverValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#03bb85]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('driver', driverValidation) ? driverValidation.message : undefined}
          />
        </div>

        {/* 2ª linha “Veículo” */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
              <Car style={{ color: '#03bb85' }} className="w-4 h-4" />
              <span style={{ color: '#03bb85' }} className="font-black">
                2ª Linha:
              </span>{' '}
              Veículo (Preenchido Automático)
            </label>
            {ipLinkedVehicle && !showAllVehicles ? (
              <button
                type="button"
                onClick={() => setShowAllVehicles(true)}
                className="text-[10px] text-[#03bb85] font-bold hover:underline"
              >
                Ver todos os carros
              </button>
            ) : ipLinkedVehicle && showAllVehicles ? (
              <button
                type="button"
                onClick={() => {
                  setShowAllVehicles(false);
                  if (ipLinkedVehicle) setSelectedVehicle(ipLinkedVehicle);
                }}
                className="text-[10px] text-emerald-700 font-bold hover:underline"
              >
                Apenas meu carro da saída
              </button>
            ) : null}
          </div>

          {ipLinkedVehicle && !showAllVehicles && (
            <div className="bg-emerald-50 border border-emerald-300 p-2.5 rounded-xl text-xs text-emerald-950 font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
              <span>
                📱 Vinculado ao seu celular: Apenas o veículo da sua saída (<strong>{ipLinkedVehicle}</strong>) está liberado para finalização.
              </span>
            </div>
          )}

          <select
            value={selectedVehicle}
            onChange={(e) => {
              setSelectedVehicle(e.target.value);
              markTouched('vehicle');
            }}
            id="select-arrival-vehicle"
            className="w-full min-h-[44px] p-3 bg-slate-50 border-2 border-[#03bb85] rounded-xl font-black text-slate-900 text-sm focus:ring-2 focus:ring-[#03bb85] outline-none"
          >
            {displayedVehicles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {/* 3º linha “Data” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Calendar style={{ color: '#03bb85' }} className="w-4 h-4" />
            <span style={{ color: '#03bb85' }} className="font-black">
              3ª Linha:
            </span>{' '}
            Data <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            onBlur={() => markTouched('date')}
            id="input-arrival-date"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('date', dateValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#03bb85]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('date', dateValidation) ? dateValidation.message : undefined}
            warning={dateValidation.warning}
          />
        </div>

        {/* 4ª linha “Horário” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Clock style={{ color: '#03bb85' }} className="w-4 h-4" />
            <span style={{ color: '#03bb85' }} className="font-black">
              4ª Linha:
            </span>{' '}
            Horário (Horário real de Brasília) <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => markTouched('time')}
            id="input-arrival-time"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('time', timeValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#03bb85]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('time', timeValidation) ? timeValidation.message : undefined}
            warning={timeValidation.warning}
          />
        </div>

        {/* 5ª linha “KM do veículo” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Gauge style={{ color: '#03bb85' }} className="w-4 h-4" />
              <span style={{ color: '#03bb85' }} className="font-black">
                5ª Linha:
              </span>{' '}
              KM de Chegada do Veículo <span className="text-red-500">*</span>
            </span>
            {departureKm !== undefined && (
              <span className="text-[10px] text-slate-600 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                Saída: {departureKm.toLocaleString('pt-BR')} km
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
            placeholder="Ex: 142650"
            autoComplete="off"
            id="input-arrival-km"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 outline-none transition ${
              shouldShowError('km', kmValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#03bb85]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('km', kmValidation) ? kmValidation.message : undefined}
            warning={kmValidation.warning}
          />

          {/* Real-time Trip Distance calculation badge */}
          {distanceTraveled !== null && distanceTraveled > 0 && kmValidation.isValid && (
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-bold mt-1">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                Distância percorrida na viagem:
              </span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg font-mono font-black">
                +{distanceTraveled.toLocaleString('pt-BR')} km
              </span>
            </div>
          )}
        </div>

        {/* 6ª linha “Nível de combustível” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Fuel style={{ color: '#03bb85' }} className="w-4 h-4" />
            <span style={{ color: '#03bb85' }} className="font-black">
              6ª Linha:
            </span>{' '}
            Nível de combustível <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {(['Cheio', '3/4', 'Meio tanque', '1/4'] as FuelLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFuelLevel(level)}
                id={`btn-fuel-${level.replace(/[^a-zA-Z0-9]/g, '')}`}
                className={`p-3 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 min-h-[44px] ${
                  fuelLevel === level
                    ? 'bg-[#03bb85] text-white border-[#03bb85] shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {fuelLevel === level && <CheckCircle2 className="w-3.5 h-3.5" />}
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* 7ª linha “Foto do Painel / Veículo (Opcional)” */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#03bb85]" />
              <span style={{ color: '#03bb85' }} className="font-black">
                7ª Linha:
              </span>{' '}
              Foto do Painel / Odômetro (Anexo do Drive)
            </span>
          </label>

          {/* Google Drive Destination Badge */}
          <div className="bg-emerald-50/90 border border-emerald-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-[#03bb85] text-white p-2 rounded-xl shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black text-slate-800 block truncate">
                  Google Drive: Pasta de Fotos de Chegada
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight">
                  Toda foto de chegada registrada fica guardada nesta pasta do Google Drive
                </span>
              </div>
            </div>
            <a
              href={DRIVE_FOLDERS.arrival.url}
              target="_blank"
              rel="noopener noreferrer"
              id="link-arrival-drive-folder"
              className="bg-white hover:bg-emerald-50 text-[#03bb85] border border-emerald-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
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
            id="input-arrival-file"
            className="hidden"
          />

          {photoImage ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#03bb85] bg-slate-900 group">
              <img
                src={photoImage}
                alt="Foto da Chegada"
                className="w-full h-48 object-contain bg-slate-950"
              />
              <button
                type="button"
                onClick={() => setPhotoImage(null)}
                id="btn-remove-arrival-photo"
                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition"
                title="Remover foto"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-emerald-300 font-bold border border-emerald-500/30">
                <span className="flex items-center gap-1.5 truncate">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  Foto Pronta para Upload no Google Drive
                </span>
                <a
                  href={DRIVE_FOLDERS.arrival.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white bg-[#03bb85] hover:bg-emerald-600 px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 shrink-0"
                >
                  Ver Pasta <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              id="btn-choose-arrival-photo"
              className="w-full py-3.5 px-4 bg-emerald-50/60 border-2 border-dashed border-[#03bb85] rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-emerald-100/50 transition cursor-pointer min-h-[44px]"
            >
              <div className="p-2.5 bg-[#03bb85] text-white rounded-full shadow-sm">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="block font-black text-xs text-slate-800">
                  Tirar Foto / Escolher Foto (Câmera do Celular)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Salva a foto e gera link automático na pasta de Chegada do Google Drive
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Submit button in Green #03bb85 */}
        <button
          type="submit"
          disabled={isSubmitting}
          id="btn-submit-arrival"
          style={{ backgroundColor: '#03bb85' }}
          className="w-full text-white py-4 px-6 rounded-2xl font-black text-base shadow-md hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2 mt-4 min-h-[48px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
              Registrando...
            </span>
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              REGISTRAR CHEGADA
            </>
          )}
        </button>
      </form>

      {/* Voltar button in blue #27a3df */}
      <button
        onClick={onBack}
        id="btn-bottom-back-arrival"
        style={{ color: '#27a3df', borderColor: '#27a3df' }}
        className="w-full bg-white border-2 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-sky-50 transition active:scale-[0.98] min-h-[44px]"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>
    </div>
  );
};
