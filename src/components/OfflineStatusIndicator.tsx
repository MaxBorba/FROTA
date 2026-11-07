import React from 'react';
import { Wifi, WifiOff, CloudUpload, HardDrive, CheckCircle2, Info } from 'lucide-react';

interface OfflineStatusIndicatorProps {
  isOnline: boolean;
  wasOffline: boolean;
  onOpenInstallModal: () => void;
  isInstalled: boolean;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  isOnline,
  wasOffline,
  onOpenInstallModal,
  isInstalled,
}) => {
  return (
    <div className="w-full">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow-md flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
            <div className="p-1.5 bg-black/20 rounded-lg shrink-0">
              <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
            </div>
            <div className="flex-1">
              <span className="font-bold">Modo Offline Ativo:</span> Registros de saída, chegada e abastecimento continuam funcionando 100%! Os dados estão salvos com segurança no aparelho (IndexedDB) e serão sincronizados com o Firebase assim que a internet voltar.
            </div>
            <button
              onClick={onOpenInstallModal}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-white text-amber-900 font-bold px-2.5 py-1 rounded-md shadow hover:bg-amber-50 shrink-0 transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Verificar Aparelho
            </button>
          </div>
        </div>
      )}

      {/* Online Reconnection / Synced Banner */}
      {wasOffline && isOnline && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-medium shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <CloudUpload className="w-4 h-4 text-emerald-200 animate-bounce" />
          <span>
            <strong>Conexão restabelecida!</strong> Sincronizando registros locais salvos no dispositivo com o Firebase em nuvem...
          </span>
        </div>
      )}
    </div>
  );
};
