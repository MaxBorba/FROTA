import React, { useState } from 'react';
import { 
  Download, 
  Share2, 
  PlusSquare, 
  ShieldCheck, 
  Smartphone, 
  Monitor, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive,
  WifiOff,
  CloudUpload
} from 'lucide-react';
import { requestPersistentStorage } from '../firebase/config';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  canPromptDirectly: boolean;
  onPromptInstall: () => void;
  isIOS: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  isInstalled: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  canPromptDirectly,
  onPromptInstall,
  isIOS,
  isAndroid,
  isWindows,
  isInstalled,
}) => {
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'windows'>(
    isIOS ? 'ios' : isAndroid ? 'android' : 'windows'
  );
  const [storageStatus, setStorageStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestStorage = async () => {
    const granted = await requestPersistentStorage();
    if (granted) {
      setStorageStatus('Armazenamento Permanente CONCEDIDO pelo dispositivo!');
    } else {
      setStorageStatus('Armazenamento gerenciado pelo navegador (IndexedDB ativo).');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Download className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Instalar Aplicativo Oficial</h2>
              <p className="text-xs text-blue-200">Garante funcionamento 100% offline e proteção total de dados</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status banner */}
          {isInstalled ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">Aplicativo Instalado no Aparelho!</p>
                <p className="text-emerald-700 text-xs mt-0.5">
                  Os dados estão protegidos contra exclusão automática do navegador e funcionarão sem internet.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">Por que instalar como Aplicativo?</p>
                <p className="text-amber-800 text-xs mt-0.5">
                  Protege o banco local (IndexedDB) contra limpeza de cache do sistema (como a regra de 7 dias do iOS Safari), garantindo que os seus registros permaneçam salvos por 6 meses e continuem acessíveis mesmo sem sinal de internet.
                </p>
              </div>
            </div>
          )}

          {/* Quick Install Action if browser supports native prompt */}
          {canPromptDirectly && !isInstalled && (
            <button
              onClick={onPromptInstall}
              className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
            >
              <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              Instalar Aplicativo Agora
            </button>
          )}

          {/* Platform Guide Tabs */}
          <div>
            <div className="flex border-b border-slate-200 gap-1 mb-4">
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === 'ios'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                iPhone / iPad (iOS)
              </button>
              <button
                onClick={() => setActiveTab('android')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === 'android'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Android
              </button>
              <button
                onClick={() => setActiveTab('windows')}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                  activeTab === 'windows'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-4 h-4" />
                Windows / PC
              </button>
            </div>

            {/* iOS Instructions */}
            {activeTab === 'ios' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <p className="text-slate-700">
                    Abra este link no navegador <strong>Safari</strong> do iPhone/iPad.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <p className="text-slate-700">
                    Toque no botão <strong>Compartilhar</strong>{' '}
                    <Share2 className="inline w-4 h-4 text-blue-600 mx-1 align-sub" /> (quadrado com seta para cima).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <p className="text-slate-700">
                    Role a lista para baixo e toque em{' '}
                    <strong>Adicionar à Tela de Início</strong>{' '}
                    <PlusSquare className="inline w-4 h-4 text-slate-800 mx-1 align-sub" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    4
                  </div>
                  <p className="text-slate-700">
                    Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! O app fica fixo e protegido no aparelho.
                  </p>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {activeTab === 'android' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <p className="text-slate-700">
                    Abra o app no navegador <strong>Google Chrome</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <p className="text-slate-700">
                    Toque no menu de <strong>três pontinhos (⋮)</strong> no canto superior direito.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <p className="text-slate-700">
                    Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Windows Instructions */}
            {activeTab === 'windows' && (
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <p className="text-slate-700">
                    No <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>, olhe para a barra de endereços no topo.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <p className="text-slate-700">
                    Clique no ícone de computador com seta para baixo (ou menu ⋮ &gt; Salvar e Compartilhar &gt; Instalar Frota NRE).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </div>
                  <p className="text-slate-700">
                    O aplicativo abrirá em janela própria dedicada como um programa nativo do Windows.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Important Safe Usage Notice */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Recomendação Importante aos Motoristas:
            </div>
            <p>
              • <strong>Não utilize a aba em modo anônimo</strong> nem limpe os dados/cookies do navegador, pois isso apagaria o banco de dados interno local do aparelho.
            </p>
            <p>
              • Os registros offline sincronizam <strong>automaticamente com o Firebase</strong> assim que o dispositivo tiver conexão Wi-Fi ou 4G/5G.
            </p>
          </div>

          {/* Persistence status button */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={handleRequestStorage}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Verificar autorização de memória persistente
            </button>
            {storageStatus && (
              <span className="text-xs text-slate-600 italic">{storageStatus}</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
