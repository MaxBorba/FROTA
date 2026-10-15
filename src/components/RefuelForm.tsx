import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PREDEFINED_VEHICLES } from '../data/initialData';
import { getBrasiliaDateISO, getBrasiliaDateFormatted, getBrasiliaTime } from '../utils/dateTime';
import { compressImage } from '../utils/imageCompressor';
import { Vehicle, DriverTripEntry } from '../types';
import { DRIVE_FOLDERS } from '../data/driveConfig';
import { validateDate, validateTime, validateLiters, validateRequiredText } from '../utils/validators';
import { FormFieldFeedback } from './FormFieldFeedback';
import {
  Fuel,
  ArrowLeft,
  Calendar,
  Clock,
  Camera,
  User,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Sparkles,
  FolderOpen,
  ExternalLink,
  AlertCircle,
  MapPin,
} from 'lucide-react';

interface RefuelFormProps {
  vehicles?: Vehicle[];
  recentTrips?: DriverTripEntry[];
  onBack: () => void;
  onSubmit: (data: {
    vehicle: string;
    date: string;
    time: string;
    liters: number;
    receiptImage: string | null;
    techName: string;
  }) => Promise<void>;
}

export const RefuelForm: React.FC<RefuelFormProps> = ({
  vehicles = [],
  recentTrips = [],
  onBack,
  onSubmit,
}) => {
  // Sort vehicle list alphabetically
  const sortedVehicleNames = [...PREDEFINED_VEHICLES].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  // Find the vehicle that the driver registered for departure
  const lastDepartureTrip = recentTrips.find((t) => t.type === 'SAÍDA');
  const defaultVehicle = lastDepartureTrip?.vehicle || sortedVehicleNames[0];

  const [selectedVehicle, setSelectedVehicle] = useState<string>(defaultVehicle);
  const [dateIso, setDateIso] = useState<string>(getBrasiliaDateISO());
  const [time, setTime] = useState<string>(getBrasiliaTime());
  const [liters, setLiters] = useState<string>('');
  const [techName, setTechName] = useState<string>(lastDepartureTrip?.driver || '');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
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

  // Auto-detect vehicle from Android/Safari client session or last departure on load
  useEffect(() => {
    let matched = false;

    // 1. Check local storage from this device
    try {
      const stored = localStorage.getItem('nre_active_departure');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.vehicle) {
          setSelectedVehicle(parsed.vehicle);
          if (parsed.driver && !techName) setTechName(parsed.driver);
          setAutoMatchMsg(
            `🎯 Veículo ${parsed.vehicle} selecionado automaticamente da sua saída (${parsed.driver || 'Dispositivo'})`
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
          if (dep.driver && !techName) setTechName(dep.driver);
          setAutoMatchMsg(
            `🎯 Veículo ${dep.vehicle} detectado automaticamente pelo IP (${json.clientIp || 'Dispositivo'}) da saída de ${dep.driver}`
          );
          matched = true;
        } else if (!matched && lastDepartureTrip?.vehicle) {
          setSelectedVehicle(lastDepartureTrip.vehicle);
          if (lastDepartureTrip.driver && !techName) {
            setTechName(lastDepartureTrip.driver);
          }
          setAutoMatchMsg(`Veículo ${lastDepartureTrip.vehicle} pré-selecionado da última saída registrada`);
        }
      })
      .catch(() => {
        if (!matched && lastDepartureTrip?.vehicle) {
          setSelectedVehicle(lastDepartureTrip.vehicle);
          if (lastDepartureTrip.driver && !techName) {
            setTechName(lastDepartureTrip.driver);
          }
        }
      });
  }, [lastDepartureTrip]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        setReceiptImage(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setReceiptImage(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTriggerCamera = () => {
    fileInputRef.current?.click();
  };

  // Validation calculations
  const dateValidation = useMemo(() => validateDate(dateIso), [dateIso]);
  const timeValidation = useMemo(() => validateTime(time), [time]);
  const litersValidation = useMemo(() => validateLiters(liters), [liters]);
  const techNameValidation = useMemo(
    () => validateRequiredText(techName, 'Técnico Responsável', 3),
    [techName]
  );

  const isFormValid =
    dateValidation.isValid &&
    timeValidation.isValid &&
    litersValidation.isValid &&
    techNameValidation.isValid;

  const shouldShowError = (fieldName: string, validation: { isValid: boolean }) => {
    return (touched[fieldName] || hasAttemptedSubmit) && !validation.isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);

    setTouched({
      vehicle: true,
      date: true,
      time: true,
      liters: true,
      techName: true,
    });

    if (!isFormValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedDate = getBrasiliaDateFormatted(dateIso);
      const parsedLiters = litersValidation.parsedLiters || Number(liters.toString().replace(',', '.'));

      await onSubmit({
        vehicle: selectedVehicle,
        date: formattedDate,
        time,
        liters: parsedLiters,
        receiptImage,
        techName: techName.trim(),
      });
      setSuccessMsg('Abastecimento registrado com sucesso!');
      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err) {
      alert('Erro ao registrar abastecimento. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 max-w-lg mx-auto space-y-4 pb-12">
      {/* Top Header in Yellow #efb810 */}
      <div
        style={{ backgroundColor: '#efb810' }}
        className="text-slate-950 p-4 rounded-2xl shadow-md flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/15 p-2.5 rounded-xl">
            <Fuel className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h2 id="title-registrar-abastecimento" className="text-lg font-black tracking-tight">
              REGISTRAR ABASTECIMENTO
            </h2>
            <p className="text-xs text-slate-900/80 font-medium">Lançamento de comprovante de combustível</p>
          </div>
        </div>
        <button
          onClick={onBack}
          id="btn-top-back-refuel"
          className="bg-slate-950/15 hover:bg-slate-950/25 text-slate-950 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>

      {/* Quick link to accredited gas stations map */}
      <a
        href="https://www.google.com/maps/d/u/0/viewer?mid=1ROWBRq9hQr4lwjM5E28p2JEOyfjiUWs&ll=-23.416769991918358%2C-51.9236281&z=13"
        target="_blank"
        rel="noopener noreferrer"
        id="btn-refuel-view-postos-map"
        className="bg-rose-50 hover:bg-rose-100/90 border border-rose-300 text-rose-950 rounded-2xl p-3 flex items-center justify-between transition shadow-xs group"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black block text-rose-950">
              Consultar Postos Credenciados (Mapa Google)
            </span>
            <span className="text-[11px] text-rose-700">
              Ver mapa da rede credenciada NRE Maringá
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-rose-600 group-hover:text-rose-700">
          <span>Abrir Mapa</span>
          <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
        </div>
      </a>

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
            <span>Verifique os seguintes dados antes de registrar:</span>
          </div>
          <ul className="text-xs text-red-800 space-y-1 list-disc pl-5 font-semibold">
            {shouldShowError('liters', litersValidation) && <li>{litersValidation.message}</li>}
            {shouldShowError('techName', techNameValidation) && <li>{techNameValidation.message}</li>}
            {shouldShowError('date', dateValidation) && <li>{dateValidation.message}</li>}
            {shouldShowError('time', timeValidation) && <li>{timeValidation.message}</li>}
          </ul>
        </div>
      )}

      {/* Context-aware Departure Vehicle Banner */}
      {(autoMatchMsg || lastDepartureTrip) && (
        <div className="bg-amber-50 border-2 border-amber-300 p-3.5 rounded-2xl flex items-start gap-3 shadow-xs animate-fade-in">
          <div className="bg-[#efb810] text-slate-950 p-2 rounded-xl shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-black text-slate-900 block">
              {autoMatchMsg ? 'Veículo Reconhecido Automaticamente:' : 'Veículo Selecionado da Última Saída:'}
            </span>
            <p className="text-xs text-slate-800 font-bold">
              {selectedVehicle} {techName ? `(Condutor: ${techName})` : ''}
            </p>
            <p className="text-[10px] text-slate-600">
              {autoMatchMsg || 'O veículo foi pré-selecionado automaticamente para agilizar seu preenchimento.'}
            </p>
          </div>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} noValidate className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
        {/* 1ª linha “Veículo” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <span style={{ color: '#efb810' }} className="font-black">
                1ª Linha:
              </span>{' '}
              Veículo (Ordem Alfabética)
            </span>
            {lastDepartureTrip?.vehicle === selectedVehicle && (
              <span className="text-[10px] text-amber-700 font-bold lowercase bg-amber-100 px-2 py-0.5 rounded-full">
                (veículo da saída)
              </span>
            )}
          </label>
          <select
            value={selectedVehicle}
            onChange={(e) => {
              setSelectedVehicle(e.target.value);
              markTouched('vehicle');
            }}
            id="select-refuel-vehicle"
            className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm focus:ring-2 focus:ring-[#efb810] outline-none"
          >
            {sortedVehicleNames.map((v) => (
              <option key={v} value={v}>
                {v} {lastDepartureTrip?.vehicle === v ? '⭐ [VEÍCULO DA ÚLTIMA SAÍDA]' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* 2º linha “Data” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <Calendar style={{ color: '#efb810' }} className="w-4 h-4" />
            <span style={{ color: '#efb810' }} className="font-black">
              2ª Linha:
            </span>{' '}
            Data <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            onBlur={() => markTouched('date')}
            id="input-refuel-date"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('date', dateValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#efb810]'
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
            <Clock style={{ color: '#efb810' }} className="w-4 h-4" />
            <span style={{ color: '#efb810' }} className="font-black">
              3ª Linha:
            </span>{' '}
            Horário (Horário real de Brasília) <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => markTouched('time')}
            id="input-refuel-time"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 outline-none transition appearance-none ${
              shouldShowError('time', timeValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#efb810]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('time', timeValidation) ? timeValidation.message : undefined}
            warning={timeValidation.warning}
          />
        </div>

        {/* 4ª linha “Litros abastecidos” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Fuel style={{ color: '#efb810' }} className="w-4 h-4" />
              <span style={{ color: '#efb810' }} className="font-black">
                4ª Linha:
              </span>{' '}
              Litros Abastecidos <span className="text-red-500">*</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              (Aceita vírgula ou ponto, ex: 45,50)
            </span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            onBlur={() => markTouched('liters')}
            placeholder="Ex: 45,50"
            autoComplete="off"
            id="input-refuel-liters"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 outline-none transition ${
              shouldShowError('liters', litersValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#efb810]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('liters', litersValidation) ? litersValidation.message : undefined}
            warning={litersValidation.warning}
            hint={!liters ? 'Informe a quantidade em litros impressa no comprovante do posto.' : undefined}
          />
        </div>

        {/* 5ª linha – Botão “escolher arquivo” / Câmera */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center justify-between uppercase">
            <span className="flex items-center gap-1.5">
              <Camera style={{ color: '#efb810' }} className="w-4 h-4" />
              <span style={{ color: '#efb810' }} className="font-black">
                5ª Linha:
              </span>{' '}
              Foto da Nota do Abastecimento
            </span>
          </label>

          {/* Google Drive Destination Badge */}
          <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="bg-[#efb810] text-slate-950 p-2 rounded-xl shrink-0">
                <FolderOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black text-slate-900 block truncate">
                  Google Drive: Pasta de Comprovantes
                </span>
                <span className="text-[10px] text-slate-600 block leading-tight">
                  Toda nota fiscal e cupom registrado fica guardado nesta pasta do Google Drive
                </span>
              </div>
            </div>
            <a
              href={DRIVE_FOLDERS.refuel.url}
              target="_blank"
              rel="noopener noreferrer"
              id="link-refuel-drive-folder"
              className="bg-white hover:bg-amber-50 text-slate-900 border border-amber-300 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
              title="Abrir pasta no Google Drive"
            >
              <span>Abrir Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Hidden HTML camera / file input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            id="input-refuel-file"
            className="hidden"
          />

          {receiptImage ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#efb810] bg-slate-900 group">
              <img
                src={receiptImage}
                alt="Nota de Abastecimento"
                className="w-full h-48 object-contain bg-slate-950"
              />
              <button
                type="button"
                onClick={() => setReceiptImage(null)}
                id="btn-remove-receipt-photo"
                className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition"
                title="Remover foto"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] text-amber-300 font-bold border border-amber-500/30">
                <span className="flex items-center gap-1.5 truncate">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  Comprovante Pronto para Upload no Drive
                </span>
                <a
                  href={DRIVE_FOLDERS.refuel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-950 bg-[#efb810] hover:bg-amber-400 font-bold px-2 py-0.5 rounded-md text-[10px] flex items-center gap-1 shrink-0"
                >
                  Ver Pasta <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleTriggerCamera}
              id="btn-choose-file-camera"
              style={{ borderColor: '#efb810' }}
              className="w-full py-4 px-4 bg-amber-50/60 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-amber-100/50 transition cursor-pointer min-h-[44px]"
            >
              <div className="p-3 bg-[#efb810] text-slate-950 rounded-full shadow-sm">
                <Camera className="w-6 h-6" />
              </div>
              <div className="text-center">
                <span className="block font-black text-sm text-slate-800">
                  Escolher arquivo / Tirar Foto
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Habilita a câmera do celular para fotografar a nota e salvar no Google Drive
                </span>
              </div>
            </button>
          )}
        </div>

        {/* 6ª linha “Técnico responsável” */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase">
            <User style={{ color: '#efb810' }} className="w-4 h-4" />
            <span style={{ color: '#efb810' }} className="font-black">
              6ª Linha:
            </span>{' '}
            Técnico responsável <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="text"
            value={techName}
            onChange={(e) => setTechName(e.target.value)}
            onBlur={() => markTouched('techName')}
            placeholder="Nome de quem tirou a foto e registrou"
            autoComplete="name"
            id="input-refuel-tech-name"
            className={`w-full min-h-[44px] p-3 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 outline-none transition ${
              shouldShowError('techName', techNameValidation)
                ? 'bg-red-50/50 border-2 border-red-500 focus:ring-red-400'
                : 'bg-slate-50 border border-slate-300 focus:ring-[#efb810]'
            }`}
          />
          <FormFieldFeedback
            error={shouldShowError('techName', techNameValidation) ? techNameValidation.message : undefined}
          />
        </div>

        {/* Submit button in Yellow #efb810 */}
        <button
          type="submit"
          disabled={isSubmitting}
          id="btn-submit-refuel"
          style={{ backgroundColor: '#efb810' }}
          className="w-full text-slate-950 py-4 px-6 rounded-2xl font-black text-base shadow-md hover:brightness-105 active:scale-[0.98] transition flex items-center justify-center gap-2 mt-4 min-h-[48px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-slate-950/40 border-t-slate-950 rounded-full animate-spin"></span>
              Registrando...
            </span>
          ) : (
            <>
              <Fuel className="w-5 h-5 text-slate-950" />
              REGISTRAR ABASTECIMENTO
            </>
          )}
        </button>
      </form>

      {/* Voltar button in blue #27a3df */}
      <button
        onClick={onBack}
        id="btn-bottom-back-refuel"
        style={{ color: '#27a3df', borderColor: '#27a3df' }}
        className="w-full bg-white border-2 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-sky-50 transition active:scale-[0.98] min-h-[44px]"
      >
        <ArrowLeft className="w-5 h-5" />
        Voltar
      </button>
    </div>
  );
};
