import React, { useState } from 'react';
import {
  MapPin,
  ExternalLink,
  Fuel,
  ArrowLeft,
  Copy,
  Check,
  Navigation,
  Info,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface GasStationsViewProps {
  onBack: () => void;
  onSelectRefuel?: () => void;
}

export const GOOGLE_MAPS_STATIONS_URL =
  'https://www.google.com/maps/d/u/0/viewer?mid=1ROWBRq9hQr4lwjM5E28p2JEOyfjiUWs&ll=-23.416769991918358%2C-51.9236281&z=13';

export const GOOGLE_MAPS_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1ROWBRq9hQr4lwjM5E28p2JEOyfjiUWs&ll=-23.416769991918358%2C-51.9236281&z=13';

export const GasStationsView: React.FC<GasStationsViewProps> = ({
  onBack,
  onSelectRefuel,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_MAPS_STATIONS_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = GOOGLE_MAPS_STATIONS_URL;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4 pb-14">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border-2 border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md shrink-0 border border-white/15 shadow-inner">
            <MapPin className="w-7 h-7 text-rose-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 id="title-postos-credenciados" className="text-lg sm:text-xl font-black tracking-tight uppercase">
                POSTOS CREDENCIADOS
              </h1>
              <span className="text-[10px] font-black bg-rose-500/30 text-rose-200 border border-rose-400/50 px-2 py-0.5 rounded-full uppercase">
                Mapa Oficial NRE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-rose-100/90 font-medium mt-0.5">
              Rede autorizada para abastecimento dos veículos oficiais da Frota NRE Maringá
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={onBack}
            id="btn-back-postos"
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-white/15 active:scale-95 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <a
            href={GOOGLE_MAPS_STATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            id="btn-open-maps-top"
            className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95 min-h-[40px]"
          >
            <Navigation className="w-4 h-4" />
            Abrir no Maps
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Quick Actions & Guidance Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Action 1: Open Google Maps */}
        <a
          href={GOOGLE_MAPS_STATIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          id="card-action-open-gmaps"
          className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-rose-400 shadow-xs hover:shadow-md transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 rounded-xl group-hover:bg-rose-100 transition text-rose-600">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block group-hover:text-rose-600 transition">
                Abrir no Google Maps
              </span>
              <span className="text-[11px] text-slate-500">
                Navegar por GPS até o posto
              </span>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition group-hover:translate-x-0.5" />
        </a>

        {/* Action 2: Copy Map Link */}
        <button
          type="button"
          onClick={handleCopyLink}
          id="btn-copy-map-link"
          className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition flex items-center justify-between text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition text-slate-700">
              {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 block">
                {copied ? 'Link Copiado com Sucesso!' : 'Copiar Link do Mapa'}
              </span>
              <span className="text-[11px] text-slate-500">
                Compartilhar com outros motoristas
              </span>
            </div>
          </div>
          {copied ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Copiado!
            </span>
          ) : (
            <Copy className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
          )}
        </button>

        {/* Action 3: Go to Refuel registration */}
        {onSelectRefuel && (
          <button
            type="button"
            onClick={onSelectRefuel}
            id="btn-goto-refuel-form"
            className="p-3.5 bg-amber-50 hover:bg-amber-100/90 rounded-2xl border border-amber-300 shadow-xs hover:shadow-md transition flex items-center justify-between text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-400 rounded-xl text-slate-950 font-black shadow-xs">
                <Fuel className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-950 block">
                  Registrar Abastecimento
                </span>
                <span className="text-[11px] text-amber-900/80">
                  Lançar litros e foto do comprovante
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-950 bg-amber-200 px-2.5 py-1 rounded-xl group-hover:bg-amber-300 transition">
              Acessar
            </span>
          </button>
        )}
      </div>

      {/* Driver Instructions Banner */}
      <div className="bg-sky-50 border border-sky-200/90 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-sky-950 shadow-xs">
        <div className="bg-[#27a3df] text-white p-2 rounded-xl shrink-0 mt-0.5 shadow-xs">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sky-900">Orientações aos Condutores NRE Maringá:</span>
            <span className="text-[10px] bg-sky-200/70 text-sky-800 font-bold px-2 py-0.2 rounded-full">
              Procedimento Padrão
            </span>
          </div>
          <p className="text-sky-800/90 leading-relaxed">
            Abasteça sempre nos postos autorizados exibidos no mapa. Ao finalizar, exija a <strong>nota/cupom fiscal</strong> contendo a <strong>placa do veículo</strong> e a <strong>quantidade exata de litros</strong>. Em seguida, utilize a aba <strong>Abastecer</strong> para anexar a foto nítida e registrar os dados no sistema.
          </p>
        </div>
      </div>

      {/* Interactive Map Embed Container */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Frame Top Header */}
        <div className="p-3 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-xs font-bold text-slate-300 ml-1">
              Visualizador Interativo • Google My Maps NRE Maringá
            </span>
          </div>

          <a
            href={GOOGLE_MAPS_STATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-rose-300 hover:text-white font-bold flex items-center gap-1 transition bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700"
          >
            <span>Tela Cheia / App</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Embedded Iframe */}
        <div className="relative w-full h-[520px] sm:h-[620px] bg-slate-950">
          <iframe
            src={GOOGLE_MAPS_EMBED_URL}
            title="Postos Credenciados NRE Maringá"
            width="100%"
            height="100%"
            className="w-full h-full border-0"
            loading="lazy"
            allowFullScreen
          />
        </div>

        {/* Frame Footer with quick link */}
        <div className="p-3 bg-slate-850 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Maringá e Região Metropolitana (Mandaguari, Sarandi, Marialva, Paiçandu e municípios jurisdicionados)</span>
          </div>
          <a
            href={GOOGLE_MAPS_STATIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-rose-400 hover:text-rose-300 underline underline-offset-2"
          >
            Abrir mapa direto no aplicativo Google Maps &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};
