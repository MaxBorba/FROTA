import React, { useState } from 'react';
import { X, ExternalLink, Download, Link, Check, Copy, FileSpreadsheet, RefreshCw, FolderOpen } from 'lucide-react';
import { DRIVE_FOLDERS } from '../data/driveConfig';

interface SheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetId: string;
  webhookUrl?: string;
  onSaveConfig: (config: { webhookUrl: string; spreadsheetId: string }) => Promise<void>;
  onExportCsv: () => void;
}

export const SheetsSyncModal: React.FC<SheetsSyncModalProps> = ({
  isOpen,
  onClose,
  spreadsheetId,
  webhookUrl = '',
  onSaveConfig,
  onExportCsv,
}) => {
  const [urlInput, setUrlInput] = useState(webhookUrl);
  const [sheetIdInput, setSheetIdInput] = useState(spreadsheetId);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const fullSheetUrl = `https://docs.google.com/spreadsheets/d/${sheetIdInput}/edit?usp=sharing`;

  const appsScriptCode = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // Criar cabeçalho em colunas na 1ª linha se a planilha estiver em branco
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'TIPO',
      'VEÍCULO',
      'DATA',
      'HORA',
      'KM',
      'MOTORISTA',
      'PASSAGEIROS',
      'CIDADE DE VISITA',
      'LOCAL DE VISITA',
      'MOTIVO DA VISITA',
      'COMBUSTÍVEL',
      'LITROS',
      'FOTO (LINK GOOGLE DRIVE)'
    ]);
  }

  // IDs Oficiais das 3 Pastas do Google Drive configuradas para o NRE Maringá
  var FOLDER_SAIDA = '1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz';
  var FOLDER_CHEGADA = '1tN3i9WirFjLldHsUcYnWT14AowcisbMc';
  var FOLDER_ABASTECIMENTO = '1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ';

  // Upload e Organização Automática das Imagens na Pasta Correta do Google Drive
  var photoUrl = '';
  var rawPhoto = data.receiptImage || data.photoUrl || '';
  if (rawPhoto && rawPhoto.indexOf('data:image') === 0) {
    try {
      var recordType = (data.type || data.action || '').toUpperCase();
      var targetFolderId = FOLDER_SAIDA;
      
      // Separar fotos por categoria nas pastas específicas do Google Drive
      if (recordType.indexOf('SAÍDA') !== -1 || recordType.indexOf('SAIDA') !== -1) {
        targetFolderId = FOLDER_SAIDA;
      } else if (recordType.indexOf('CHEGADA') !== -1) {
        targetFolderId = FOLDER_CHEGADA;
      } else if (recordType.indexOf('ABASTECIMENTO') !== -1) {
        targetFolderId = FOLDER_ABASTECIMENTO;
      }

      var folder;
      try {
        folder = DriveApp.getFolderById(targetFolderId);
      } catch (fErr) {
        folder = DriveApp.getRootFolder();
      }
      
      var base64Data = rawPhoto.split(',')[1];
      var fileName = recordType + '_' + (data.vehicle || 'veiculo').replace(/\\s+/g, '_') + '_' + new Date().getTime() + '.jpg';
      var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', fileName);
      var file = folder.createFile(blob);

      // Liberar acesso de leitura e download via link
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    } catch(err) {
      photoUrl = 'Erro no Drive: ' + err.toString();
    }
  } else {
    photoUrl = rawPhoto;
  }

  // Inserir os dados coletados organizados por colunas
  sheet.appendRow([
    data.type || data.action || 'REGISTRO',
    data.vehicle || '',
    data.date || '',
    data.time || '',
    data.km || '',
    data.driver || data.techName || '',
    data.passengers || '',
    data.visitCity || '',
    data.visitLocation || '',
    data.visitReason || '',
    data.fuelLevel || '',
    data.liters || '',
    photoUrl || ''
  ]);
  
  return ContentService.createTextOutput(JSON.stringify({"result":"success", "driveUrl": photoUrl}))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveConfig({ webhookUrl: urlInput, spreadsheetId: sheetIdInput });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Integração Google Sheets & Drive</h3>
              <p className="text-xs text-slate-500">Compilação dos dados da frota NRE</p>
            </div>
          </div>
          <button
            onClick={onClose}
            id="btn-close-sheets-modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Spreadsheet Link Box */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
          <span className="text-xs font-bold text-emerald-900 block uppercase tracking-wider">
            Planilha Oficial Vinculada
          </span>
          <a
            href={fullSheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            id="link-open-google-sheet"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1.5 break-all"
          >
            {fullSheetUrl}
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
          </a>
        </div>

        {/* Google Drive Photos Folders List */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-slate-900 block uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-sky-600" />
            Pastas Oficiais de Anexos no Google Drive
          </span>
          <p className="text-[11px] text-slate-600 font-medium">
            Cada foto registrada no app é guardada em sua respectiva pasta no Google Drive:
          </p>

          <div className="space-y-1.5 pt-0.5">
            {/* Saída */}
            <a
              href={DRIVE_FOLDERS.departure.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-white border border-sky-200 hover:border-sky-400 flex items-center justify-between transition group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#27a3df]"></span>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-[#27a3df]">
                    1. Fotos de Saída de Veículo
                  </span>
                  <span className="text-[10px] text-slate-500">ID: {DRIVE_FOLDERS.departure.id}</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#27a3df]" />
            </a>

            {/* Chegada */}
            <a
              href={DRIVE_FOLDERS.arrival.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-400 flex items-center justify-between transition group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#03bb85]"></span>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-[#03bb85]">
                    2. Fotos de Chegada de Veículo
                  </span>
                  <span className="text-[10px] text-slate-500">ID: {DRIVE_FOLDERS.arrival.id}</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#03bb85]" />
            </a>

            {/* Abastecimento */}
            <a
              href={DRIVE_FOLDERS.refuel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-white border border-amber-200 hover:border-amber-400 flex items-center justify-between transition group shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#efb810]"></span>
                <div>
                  <span className="text-xs font-bold text-slate-800 block group-hover:text-amber-600">
                    3. Comprovantes de Abastecimento
                  </span>
                  <span className="text-[10px] text-slate-500">ID: {DRIVE_FOLDERS.refuel.id}</span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600" />
            </a>
          </div>
        </div>

        {/* Export CSV Section */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-slate-800 block">Exportar para Planilha</span>
              <span className="text-[11px] text-slate-500">Baixar arquivo CSV completo com todas as viagens</span>
            </div>
            <button
              onClick={onExportCsv}
              id="btn-export-csv"
              className="bg-[#27a3df] hover:bg-sky-600 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
            >
              <Download className="w-4 h-4" />
              Baixar CSV
            </button>
          </div>
        </div>

        {/* Webhook Configuration Form */}
        <form onSubmit={handleSave} className="space-y-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              URL do Webhook (Google Apps Script)
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              id="input-webhook-url"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <p className="text-[10px] text-slate-500">
              Opcional: insira o Webhook do Google Apps Script para salvar automaticamente a cada registro.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            id="btn-save-webhook-config"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> Configuração Salva!
              </>
            ) : (
              'Salvar Configuração de Webhook'
            )}
          </button>
        </form>

        {/* Script Copy Accordion */}
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Código para Apps Script (Automático)</span>
            <button
              onClick={handleCopyScript}
              id="btn-copy-script"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copiado!' : 'Copiar Script'}
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-32 border border-slate-800">
            {appsScriptCode}
          </pre>
        </div>
      </div>
    </div>
  );
};

