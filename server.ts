import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { INITIAL_VEHICLES, INITIAL_RECENT_TRIPS } from './src/data/initialData.js';

const app = express();
const PORT = 3000;
const MASTER_KEY = '192026';

app.use(express.json({ limit: '50mb' }));

// Helper to detect operating system / client (Android, Safari iOS, etc.)
function detectPlatform(userAgent?: string): string {
  if (!userAgent) return 'Desconhecido';
  const ua = userAgent.toLowerCase();
  let os = 'Web Client';
  if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone')) os = 'iPhone (iOS)';
  else if (ua.includes('ipad')) os = 'iPad (iPadOS)';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows PC';
  else if (ua.includes('linux')) os = 'Linux';

  let browser = '';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';

  return browser ? `${os} (${browser})` : os;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

function getBrasiliaDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const time = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { date, time, timestamp: Date.now() };
}

// File persistence setup with Automatic Mirrored Backup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'fleet_store.json');
const DATA_BACKUP_FILE = path.join(DATA_DIR, 'fleet_store_backup.json');

// Uploaded photos directory structure for Saída, Chegada, Abastecimento
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const UPLOADS_SAIDA = path.join(UPLOADS_DIR, 'saida');
const UPLOADS_CHEGADA = path.join(UPLOADS_DIR, 'chegada');
const UPLOADS_ABASTECIMENTO = path.join(UPLOADS_DIR, 'abastecimento');

[DATA_DIR, UPLOADS_DIR, UPLOADS_SAIDA, UPLOADS_CHEGADA, UPLOADS_ABASTECIMENTO].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

interface AccessLogEntry {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  ip: string;
  userAgent: string;
  device: string;
  action: string;
  details?: string;
  driverName?: string;
  sessionDuration?: string;
}

interface ActiveCheckout {
  id: string;
  vehicle: string;
  driver: string;
  km: number;
  date: string;
  time: string;
  ip: string;
  userAgent: string;
  device: string;
  timestamp: number;
  photoUrl?: string;
}

interface StoreSchema {
  vehicles: any[];
  departures: any[];
  arrivals: any[];
  refuels: any[];
  driverTrips: any[];
  notifications: any[];
  accessLogs: AccessLogEntry[];
  activeCheckouts: ActiveCheckout[];
  deletedTripIds: string[];
  spreadsheetId: string;
  webhookUrl: string;
}

function getInitialStore(): StoreSchema {
  return {
    vehicles: INITIAL_VEHICLES,
    departures: [],
    arrivals: [],
    refuels: [],
    driverTrips: INITIAL_RECENT_TRIPS,
    activeCheckouts: [],
    deletedTripIds: [],
    notifications: [
      {
        id: 'notif_welcome',
        title: '🔔 Sistema Online e Ativo',
        message: 'Frota NRE Maringá online com sincronização em tempo real para todos os condutores.',
        type: 'INFO',
        timestamp: Date.now(),
      },
    ],
    accessLogs: [
      {
        id: 'acc_' + Date.now(),
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        time: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        ip: '127.0.0.1',
        userAgent: 'Sistema Inicializador NRE',
        device: 'Servidor Nuvem NRE',
        action: 'Inicialização do Sistema Online',
        details: 'Serviço de gerenciamento de frota iniciado.',
        driverName: 'Sistema',
      },
    ],
    spreadsheetId: '1hN8y59EoyQWwcUmLegqsOfjXGiwEI4z4g5xzavIABYE',
    webhookUrl: '',
  };
}

function loadStore(): StoreSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const readAndSanitize = (filePath: string): StoreSchema | null => {
      if (!fs.existsSync(filePath)) return null;
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.vehicles)) {
          const loadedVehicles = parsed.vehicles.map((v: any) => ({
            ...v,
            status: v.status || 'AVAILABLE',
          }));

          const departures = Array.isArray(parsed.departures) ? parsed.departures : [];
          const arrivals = Array.isArray(parsed.arrivals) ? parsed.arrivals : [];
          const refuels = Array.isArray(parsed.refuels) ? parsed.refuels : [];
          let driverTrips = Array.isArray(parsed.driverTrips) ? parsed.driverTrips : [];
          const deletedTripIds = Array.isArray(parsed.deletedTripIds) ? parsed.deletedTripIds : [];
          const deletedSet = new Set(deletedTripIds);

          // Guarantee complete persistence: ensure every departure, arrival, and refuel is reflected in driverTrips
          const tripIdSet = new Set(driverTrips.map((t: any) => t.id));
          [...departures, ...arrivals, ...refuels].forEach((rec: any) => {
            if (rec && rec.id && !tripIdSet.has(rec.id) && !deletedSet.has(rec.id)) {
              driverTrips.push({
                ...rec,
                details: rec.details || (rec.visitReason ? `${rec.visitCity || ''} (${rec.visitLocation || ''}): ${rec.visitReason}` : ''),
              });
              tripIdSet.add(rec.id);
            }
          });

          // Filter out tombstones
          driverTrips = driverTrips.filter((t: any) => !deletedSet.has(t.id));

          return {
            vehicles: loadedVehicles,
            departures,
            arrivals,
            refuels,
            driverTrips,
            activeCheckouts: parsed.activeCheckouts || [],
            notifications: parsed.notifications || [],
            accessLogs: parsed.accessLogs || [],
            deletedTripIds,
            spreadsheetId: parsed.spreadsheetId || '1hN8y59EoyQWwcUmLegqsOfjXGiwEI4z4g5xzavIABYE',
            webhookUrl: parsed.webhookUrl || '',
          };
        }
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
      }
      return null;
    };

    // Try primary file first
    const primary = readAndSanitize(DATA_FILE);
    if (primary) return primary;

    // Try backup file if primary failed
    const backup = readAndSanitize(DATA_BACKUP_FILE);
    if (backup) {
      console.log('Restored state from backup file successfully.');
      return backup;
    }
  } catch (err) {
    console.error('Error reading fleet store, using defaults:', err);
  }

  const init = getInitialStore();
  saveStore(init);
  return init;
}

function saveStore(storeToSave: StoreSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonStr = JSON.stringify(storeToSave, null, 2);

    // Atomic write with physical fsync for primary file
    const tmpFile = `${DATA_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    const fd = fs.openSync(tmpFile, 'w');
    fs.writeSync(fd, jsonStr, 0, 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpFile, DATA_FILE);

    // Atomic mirror write with physical fsync for backup file
    const tmpBackup = `${DATA_BACKUP_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
    const fdBackup = fs.openSync(tmpBackup, 'w');
    fs.writeSync(fdBackup, jsonStr, 0, 'utf-8');
    fs.fsyncSync(fdBackup);
    fs.closeSync(fdBackup);
    fs.renameSync(tmpBackup, DATA_BACKUP_FILE);
  } catch (err) {
    console.error('Error saving fleet store and backup atomically:', err);
  }
}

// Save base64 uploaded photo to disk and return accessible URL
function saveUploadedPhoto(
  base64Data?: string | null,
  category: 'saida' | 'chegada' | 'abastecimento' = 'saida',
  vehicleName: string = 'veiculo'
): { filePath: string; relativeUrl: string; fileName: string } | null {
  if (!base64Data || typeof base64Data !== 'string') {
    return null;
  }
  const trimmed = base64Data.trim();
  if (!trimmed.startsWith('data:image')) {
    return null;
  }
  try {
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) return null;

    const mimePart = trimmed.substring(0, commaIndex);
    const dataPart = trimmed.substring(commaIndex + 1).replace(/\s/g, '');

    const ext = mimePart.includes('png') ? 'png' : mimePart.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(dataPart, 'base64');
    const sanitizedVehicle = vehicleName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${category.toUpperCase()}_${sanitizedVehicle}_${Date.now()}.${ext}`;
    const targetDir =
      category === 'saida'
        ? UPLOADS_SAIDA
        : category === 'chegada'
        ? UPLOADS_CHEGADA
        : UPLOADS_ABASTECIMENTO;

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const fullPath = path.join(targetDir, fileName);
    fs.writeFileSync(fullPath, buffer);
    return {
      filePath: fullPath,
      relativeUrl: `/api/photos/${category}/${fileName}`,
      fileName,
    };
  } catch (err) {
    console.error('Error saving uploaded photo file to disk:', err);
    return null;
  }
}

let store = loadStore();

function addAccessLog(
  action: string,
  ip: string,
  userAgent: string,
  details?: string,
  driverName?: string
): AccessLogEntry {
  const { date, time, timestamp } = getBrasiliaDateTime();
  const entry: AccessLogEntry = {
    id: 'acc_' + timestamp + '_' + Math.random().toString(36).substring(2, 6),
    timestamp,
    date,
    time,
    ip,
    userAgent: userAgent || 'Desconhecido',
    device: detectPlatform(userAgent),
    action,
    details: details || '',
    driverName: driverName || 'Visitante/Condutor',
  };

  if (!store.accessLogs) store.accessLogs = [];
  store.accessLogs.unshift(entry);
  return entry;
}

function addNotification(
  title: string,
  message: string,
  type: string,
  vehicleName?: string,
  driver?: string,
  urgent = false
) {
  const notif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title,
    message,
    type,
    vehicleName,
    driver,
    urgent,
    timestamp: Date.now(),
  };
  if (!store.notifications) store.notifications = [];
  store.notifications.unshift(notif);
  return notif;
}

// Helper to push to external Webhook / Google Sheets Apps Script if configured
async function pushToGoogleSheetsWebhook(payload: any) {
  if (!store.webhookUrl) return;
  try {
    await fetch(store.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to post to Google Sheets webhook:', err);
  }
}

// API Routes

// Serve uploaded photos statically
app.use('/api/photos', express.static(UPLOADS_DIR));

// 1. Get full state + client identification
app.get('/api/fleet', (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const clientDevice = detectPlatform(userAgent);

  // Auto-detect active checkout for this IP, userAgent, or device
  const activeCheckoutsList = store.activeCheckouts || [];
  const myActiveCheckout =
    activeCheckoutsList.find((ac) => ac.ip === clientIp) ||
    activeCheckoutsList.find((ac) => userAgent && ac.userAgent === userAgent) ||
    null;

  res.json({
    success: true,
    data: store,
    deletedTripIds: store.deletedTripIds || [],
    clientInfo: {
      ip: clientIp,
      device: clientDevice,
      activeDeparture: myActiveCheckout,
    },
  });
});

// 1.1 Detect vehicle actively in use by this client (Android / Safari / PC)
app.get('/api/fleet/my-vehicle', (req, res) => {
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const driverQuery = typeof req.query.driver === 'string' ? req.query.driver.trim().toLowerCase() : '';

  const activeCheckoutsList = store.activeCheckouts || [];
  let match: ActiveCheckout | undefined;

  // Match 1: driver name if supplied
  if (driverQuery) {
    match = activeCheckoutsList.find((ac) => ac.driver.trim().toLowerCase() === driverQuery);
  }
  // Match 2: client IP address
  if (!match) {
    match = activeCheckoutsList.find((ac) => ac.ip === clientIp);
  }
  // Match 3: device / userAgent fingerprint
  if (!match && userAgent) {
    match = activeCheckoutsList.find((ac) => ac.userAgent === userAgent);
  }

  res.json({
    success: true,
    clientIp,
    clientDevice: detectPlatform(userAgent),
    activeDeparture: match || null,
  });
});

// 1.2 Log User Access (Audit and Access Tracker)
app.post('/api/fleet/log-access', (req, res) => {
  const { action, details, driverName } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'Desconhecido';

  const entry = addAccessLog(
    action || 'Acesso ao Aplicativo',
    ip,
    userAgent,
    details || '',
    driverName || 'Condutor NRE'
  );

  saveStore(store);
  res.json({ success: true, entry, accessLogsCount: store.accessLogs.length });
});

// 1.3 Bi-directional Persistent Sync (Todos os dados inseridos ficam salvos permanentemente)
app.post('/api/fleet/sync', (req, res) => {
  const { trips, vehicles, accessLogs, deletedTripIds, masterKey } = req.body;

  if (!store.deletedTripIds) store.deletedTripIds = [];

  // Diretriz Oficial de Persistência Permanente:
  // Apenas aceita tombstones / exclusões se autenticado com a Chave Mestre 192026
  if (Array.isArray(deletedTripIds) && deletedTripIds.length > 0) {
    if (masterKey === MASTER_KEY) {
      for (const delId of deletedTripIds) {
        if (delId && !store.deletedTripIds.includes(delId)) {
          store.deletedTripIds.push(delId);
        }
      }
      const deletedSet = new Set(store.deletedTripIds);
      store.driverTrips = (store.driverTrips || []).filter(t => !deletedSet.has(t.id));
      store.departures = (store.departures || []).filter(d => !deletedSet.has(d.id));
      store.arrivals = (store.arrivals || []).filter(a => !deletedSet.has(a.id));
      store.refuels = (store.refuels || []).filter(r => !deletedSet.has(r.id));
      saveStore(store);
    } else {
      console.warn('[Diretriz Oficial de Persistência Permanente] Sync de exclusão ignorado: Chave Mestre 192026 ausente.');
    }
  }

  const deletedSet = new Set(store.deletedTripIds);

  let hasChanges = false;

  // Merge incoming trips from client storage (guarantees no data loss across restarts)
  if (Array.isArray(trips) && trips.length > 0) {
    const existingIds = new Set(store.driverTrips.map(t => t.id));
    for (const trip of trips) {
      if (trip && trip.id && !deletedSet.has(trip.id) && !existingIds.has(trip.id)) {
        store.driverTrips.unshift(trip);
        existingIds.add(trip.id);
        hasChanges = true;

        if (trip.type === 'SAÍDA' && !store.departures.some(d => d.id === trip.id)) {
          store.departures.unshift(trip);
        } else if (trip.type === 'CHEGADA' && !store.arrivals.some(a => a.id === trip.id)) {
          store.arrivals.unshift(trip);
        } else if (trip.type === 'ABASTECIMENTO' && !store.refuels.some(r => r.id === trip.id)) {
          store.refuels.unshift(trip);
        }
      }
    }
  }

  // Merge vehicle calibrated odometers and status
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    for (const incV of vehicles) {
      const idx = store.vehicles.findIndex(
        v => v.name.trim().toUpperCase() === (incV.name || '').trim().toUpperCase()
      );
      if (idx !== -1) {
        if (incV.odometer && incV.odometer > 0 && (!store.vehicles[idx].odometer || store.vehicles[idx].odometer === 0)) {
          store.vehicles[idx].odometer = incV.odometer;
          if (incV.lastDriver && !store.vehicles[idx].lastDriver) {
            store.vehicles[idx].lastDriver = incV.lastDriver;
          }
          hasChanges = true;
        }
      }
    }
  }

  // Merge access logs
  if (Array.isArray(accessLogs) && accessLogs.length > 0) {
    const existingLogIds = new Set((store.accessLogs || []).map(l => l.id));
    for (const log of accessLogs) {
      if (log && log.id && !existingLogIds.has(log.id)) {
        store.accessLogs.unshift(log);
        existingLogIds.add(log.id);
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    saveStore(store);
  }

  res.json({
    success: true,
    data: store,
    deletedTripIds: store.deletedTripIds,
    updatedVehicles: store.vehicles,
    recentTrips: store.driverTrips,
    accessLogs: store.accessLogs,
  });
});

// 2. Register Departure (Saída)
app.post('/api/fleet/checkout', (req, res) => {
  const {
    vehicle,
    date,
    time,
    km,
    driver,
    passengers,
    visitCity,
    visitLocation,
    visitReason,
    receiptImage,
    photoUrl,
  } = req.body;

  if (!vehicle || !driver || !driver.trim() || km === undefined || km === null || isNaN(Number(km)) || Number(km) < 0) {
    return res.status(400).json({ error: 'Campos obrigatórios inválidos. Verifique motorista e odômetro.' });
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const clientDevice = detectPlatform(userAgent);

  // Save uploaded photo to disk if base64 provided
  const savedPhoto = saveUploadedPhoto(receiptImage || photoUrl, 'saida', vehicle);
  const effectivePhotoUrl = savedPhoto?.relativeUrl || (typeof receiptImage === 'string' && receiptImage.startsWith('http') ? receiptImage : '');

  const vIndex = store.vehicles.findIndex(v => v.name.trim() === vehicle.trim());
  const currentFuel = vIndex !== -1 ? store.vehicles[vIndex].fuelLevel : 'N/A';

  const record = {
    id: 'dep_' + Date.now(),
    type: 'SAÍDA',
    vehicle,
    date: date || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    time: time || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    km: Number(km),
    driver,
    passengers: passengers || 'Nenhum',
    visitCity: visitCity || 'MARINGÁ',
    visitLocation: visitLocation || '',
    visitReason: visitReason || '',
    fuelLevel: currentFuel,
    liters: '',
    receiptImage: effectivePhotoUrl || receiptImage || '',
    photoUrl: effectivePhotoUrl,
    driveFolderUrl: 'https://drive.google.com/drive/folders/1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz?usp=drive_link',
    targetFolderId: '1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz',
    platform: clientDevice,
    device: clientDevice,
    ip: clientIp,
    timestamp: Date.now(),
  };

  store.departures.unshift(record);

  // Update active checkouts cache for quick auto-detect on Arrival and Refuel
  if (!store.activeCheckouts) store.activeCheckouts = [];
  store.activeCheckouts = store.activeCheckouts.filter((ac) => ac.vehicle.trim() !== vehicle.trim());
  store.activeCheckouts.unshift({
    id: record.id,
    vehicle,
    driver,
    km: Number(km),
    date: record.date,
    time: record.time,
    ip: clientIp,
    userAgent,
    device: clientDevice,
    timestamp: Date.now(),
    photoUrl: effectivePhotoUrl,
  });

  // Update vehicle status
  if (vIndex !== -1) {
    store.vehicles[vIndex].status = 'UNAVAILABLE';
    store.vehicles[vIndex].odometer = Number(km);
    store.vehicles[vIndex].lastDriver = driver;
    store.vehicles[vIndex].lastDestination = `${visitCity} - ${visitLocation}`;
    store.vehicles[vIndex].lastDeparture = `${record.date} - ${record.time}`;
    store.vehicles[vIndex].lastReason = visitReason || '';
  }

  // Update recent driver trips
  const tripEntry = {
    ...record,
    details: `${visitCity} (${visitLocation}): ${visitReason}`,
  };

  store.driverTrips.unshift(tripEntry);

  // Record access audit log with driver's IP
  addAccessLog(
    'Registro de Saída de Veículo',
    clientIp,
    userAgent,
    `Saída de ${vehicle} (KM ${km}) para ${visitCity} (${visitLocation})`,
    driver
  );

  // Create event notification
  addNotification(
    '🚗 Saída de Veículo Registrada',
    `${driver} registrou saída com o veículo ${vehicle} para ${visitCity} (${visitLocation}).`,
    'STATUS_CHANGE',
    vehicle,
    driver
  );

  saveStore(store);

  // Background Google Apps Script sync with target Google Drive folder ID
  pushToGoogleSheetsWebhook({
    action: 'SAÍDA',
    ...record,
    targetFolderId: '1QQpEqMtLkZaaDyeCLXyOA6TPrxT8qTAz',
    spreadsheetId: store.spreadsheetId,
  });

  res.json({
    success: true,
    record,
    clientInfo: {
      ip: clientIp,
      device: clientDevice,
      activeDeparture: store.activeCheckouts[0],
    },
    updatedVehicles: store.vehicles,
    recentTrips: store.driverTrips,
    notifications: store.notifications,
    accessLogs: store.accessLogs,
  });
});

// 3. Register Arrival (Chegada)
app.post('/api/fleet/checkin', (req, res) => {
  const { vehicle, date, time, km, fuelLevel, driver, receiptImage, photoUrl } = req.body;

  if (!vehicle || km === undefined || km === null || isNaN(Number(km)) || Number(km) < 0 || !fuelLevel) {
    return res.status(400).json({ error: 'Campos obrigatórios inválidos. Verifique odômetro e nível de combustível.' });
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const clientDevice = detectPlatform(userAgent);

  // Save uploaded photo to disk if base64 provided
  const savedPhoto = saveUploadedPhoto(receiptImage || photoUrl, 'chegada', vehicle);
  const effectivePhotoUrl = savedPhoto?.relativeUrl || (typeof receiptImage === 'string' && receiptImage.startsWith('http') ? receiptImage : '');

  const vIndex = store.vehicles.findIndex(v => v.name.trim() === vehicle.trim());

  const record = {
    id: 'arr_' + Date.now(),
    type: 'CHEGADA',
    vehicle,
    date: date || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    time: time || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    km: Number(km),
    driver: driver || (vIndex !== -1 ? store.vehicles[vIndex].lastDriver : 'Motorista'),
    passengers: '',
    visitCity: 'MARINGÁ',
    visitLocation: 'PÁTIO NRE',
    visitReason: 'Devolução / Chegada NRE',
    fuelLevel,
    liters: '',
    receiptImage: effectivePhotoUrl || receiptImage || '',
    photoUrl: effectivePhotoUrl,
    driveFolderUrl: 'https://drive.google.com/drive/folders/1tN3i9WirFjLldHsUcYnWT14AowcisbMc?usp=drive_link',
    targetFolderId: '1tN3i9WirFjLldHsUcYnWT14AowcisbMc',
    platform: clientDevice,
    device: clientDevice,
    ip: clientIp,
    timestamp: Date.now(),
  };

  store.arrivals.unshift(record);

  // Remove vehicle from activeCheckouts since it has returned to the yard
  if (!store.activeCheckouts) store.activeCheckouts = [];
  store.activeCheckouts = store.activeCheckouts.filter((ac) => ac.vehicle.trim() !== vehicle.trim());

  // Update vehicle status to Available
  if (vIndex !== -1) {
    store.vehicles[vIndex].status = 'AVAILABLE';
    store.vehicles[vIndex].odometer = Number(km);
    store.vehicles[vIndex].fuelLevel = fuelLevel;
    store.vehicles[vIndex].lastArrival = `${record.date} - ${record.time}`;
    if (driver) store.vehicles[vIndex].lastDriver = driver;
  }

  // Update recent driver trips
  const tripEntry = {
    ...record,
    details: `Chegada NRE - Combustível: ${fuelLevel}`,
  };

  store.driverTrips.unshift(tripEntry);

  // Record access audit log with driver's IP
  addAccessLog(
    'Registro de Chegada de Veículo',
    clientIp,
    userAgent,
    `Devolução de ${vehicle} (KM ${km}, Combustível: ${fuelLevel}) no Pátio NRE`,
    record.driver
  );

  // Create event notification for yard return
  addNotification(
    '🟢 Veículo Devolvido ao Pátio',
    `O veículo ${vehicle} foi devolvido ao pátio do NRE por ${record.driver} e está disponível para novo uso.`,
    'STATUS_CHANGE',
    vehicle,
    record.driver
  );

  // If tank is 1/4, add low fuel alert
  if (fuelLevel === '1/4') {
    addNotification(
      '⛽ Alerta: Nível de Combustível Baixo',
      `O veículo ${vehicle} foi devolvido com 1/4 de tanque. Necessita abastecimento.`,
      'FUEL_ALERT',
      vehicle,
      record.driver,
      true
    );
  }

  saveStore(store);

  // Background sync with target Google Drive folder ID
  pushToGoogleSheetsWebhook({
    action: 'CHEGADA',
    ...record,
    targetFolderId: '1tN3i9WirFjLldHsUcYnWT14AowcisbMc',
    spreadsheetId: store.spreadsheetId,
  });

  res.json({
    success: true,
    record,
    clientInfo: {
      ip: clientIp,
      device: clientDevice,
      activeDeparture: null,
    },
    updatedVehicles: store.vehicles,
    recentTrips: store.driverTrips,
    notifications: store.notifications,
    accessLogs: store.accessLogs,
  });
});

// 4. Register Refuel (Abastecimento)
app.post('/api/fleet/refuel', (req, res) => {
  const { vehicle, date, time, liters, receiptImage, techName, driver } = req.body;

  const parsedLiters = Number(String(liters || '').replace(',', '.'));
  if (!vehicle || !techName || !techName.trim() || isNaN(parsedLiters) || parsedLiters <= 0 || parsedLiters > 200) {
    return res.status(400).json({ error: 'Campos obrigatórios inválidos. Verifique quantidade de litros e nome do técnico.' });
  }

  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const clientDevice = detectPlatform(userAgent);

  // Save uploaded photo to disk if base64 provided
  const savedPhoto = saveUploadedPhoto(receiptImage, 'abastecimento', vehicle);
  const effectivePhotoUrl = savedPhoto?.relativeUrl || (typeof receiptImage === 'string' && receiptImage.startsWith('http') ? receiptImage : '');

  const vIndex = store.vehicles.findIndex(v => v.name.trim() === vehicle.trim());
  const currentKm = vIndex !== -1 ? store.vehicles[vIndex].odometer : '';

  const record = {
    id: 'ref_' + Date.now(),
    type: 'ABASTECIMENTO',
    vehicle,
    date: date || new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    time: time || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }),
    km: currentKm,
    driver: driver || techName,
    passengers: '',
    visitCity: '',
    visitLocation: 'Posto de Combustível',
    visitReason: 'Abastecimento',
    fuelLevel: 'Cheio',
    liters: Number(liters),
    receiptImage: effectivePhotoUrl || receiptImage || null,
    photoUrl: effectivePhotoUrl,
    driveFolderUrl: 'https://drive.google.com/drive/folders/1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ?usp=drive_link',
    targetFolderId: '1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ',
    techName,
    platform: clientDevice,
    device: clientDevice,
    ip: clientIp,
    timestamp: Date.now(),
  };

  store.refuels.unshift(record);

  // Update vehicle fuel level to Cheio upon refuel
  if (vIndex !== -1) {
    store.vehicles[vIndex].fuelLevel = 'Cheio';
  }

  // Add entry to driver trips
  const tripEntry = {
    ...record,
    details: `Abastecimento de ${liters}L registrado por ${techName}`,
  };

  store.driverTrips.unshift(tripEntry);

  // Record access audit log
  addAccessLog(
    'Registro de Abastecimento',
    clientIp,
    userAgent,
    `Abastecimento de ${liters}L no veículo ${vehicle} registrado por ${techName}`,
    techName
  );

  // Notification
  addNotification(
    '⛽ Abastecimento Realizado',
    `${techName} registrou abastecimento de ${liters} litros para o veículo ${vehicle}. Tanque cheio.`,
    'FUEL_ALERT',
    vehicle,
    techName
  );

  saveStore(store);

  // Background sync with target Google Drive folder ID
  pushToGoogleSheetsWebhook({
    action: 'ABASTECIMENTO',
    ...record,
    targetFolderId: '1-l1lk0GGVKxDTL6ZvNt5StGHOJt-iwYJ',
    spreadsheetId: store.spreadsheetId,
  });

  res.json({
    success: true,
    record,
    clientInfo: {
      ip: clientIp,
      device: clientDevice,
    },
    updatedVehicles: store.vehicles,
    recentTrips: store.driverTrips,
    notifications: store.notifications,
    accessLogs: store.accessLogs,
  });
});

// 5. Config Webhook / Google Sheets
app.post('/api/fleet/config-sheets', (req, res) => {
  const { webhookUrl, spreadsheetId } = req.body;
  if (spreadsheetId) store.spreadsheetId = spreadsheetId;
  if (webhookUrl !== undefined) store.webhookUrl = webhookUrl;
  saveStore(store);
  res.json({ success: true, store });
});

// 6. Daily Excel Export endpoint (CSV formatado com UTF-8 BOM para Excel)
app.get('/api/fleet/admin/export-excel', (req, res) => {
  const filterDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const isAll = filterDate.toLowerCase() === 'all' || filterDate.toLowerCase() === 'todos';
  const todayDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const targetDate = isAll ? '' : (filterDate || todayDate);

  let filteredTrips = store.driverTrips || [];
  if (targetDate) {
    filteredTrips = filteredTrips.filter((t) => t.date === targetDate);
  }

  let csv = 'TIPO;VEÍCULO;DATA;HORA;ODÔMETRO (KM);MOTORISTA / CONDUTOR;PASSAGEIROS;CIDADE;LOCAL DE DESTINO;MOTIVO DA OPERAÇÃO;COMBUSTÍVEL;LITROS;FOTO REGISTRADA;IP DO DISPOSITIVO;DISPOSITIVO\n';

  filteredTrips.forEach((t) => {
    const photoStatus = t.photoUrl || t.receiptImage ? 'COM FOTO REGISTRADA' : 'SEM FOTO';
    const clean = (str: any) => String(str || '').replace(/"/g, '""');
    csv += `"${clean(t.type)}";"${clean(t.vehicle)}";"${clean(t.date)}";"${clean(t.time)}";"${clean(t.km)}";"${clean(t.driver)}";"${clean(t.passengers)}";"${clean(t.visitCity)}";"${clean(t.visitLocation)}";"${clean(t.visitReason || t.details)}";"${clean(t.fuelLevel)}";"${clean(t.liters)}";"${photoStatus}";"${clean(t.ip || 'Registrado')}";"${clean(t.device || t.platform)}"\n`;
  });

  const filenameDate = targetDate ? targetDate.replace(/\//g, '-') : 'todos_registros';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="relatorio_diario_frota_nre_${filenameDate}.csv"`);
  res.send('\uFEFF' + csv);
});

// Standard CSV export for compatibility
app.get('/api/fleet/export-csv', (req, res) => {
  let csv = 'TIPO;VEÍCULO;DATA;HORA;KM;MOTORISTA;PASSAGEIROS;CIDADE DE VISITA;LOCAL DE VISITA;MOTIVO DA VISITA;COMBUSTÍVEL;LITROS;FOTO;IP;DISPOSITIVO\n';

  store.driverTrips.forEach(t => {
    const photoText = t.photoUrl || t.receiptImage ? 'COM FOTO' : '';
    csv += `"${t.type || ''}";"${t.vehicle || ''}";"${t.date || ''}";"${t.time || ''}";"${t.km || ''}";"${t.driver || ''}";"${t.passengers || ''}";"${t.visitCity || ''}";"${t.visitLocation || ''}";"${t.visitReason || ''}";"${t.fuelLevel || ''}";"${t.liters || ''}";"${photoText}";"${t.ip || ''}";"${t.device || t.platform || ''}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="frota_nre_maringa.csv"');
  res.send('\uFEFF' + csv);
});

// 6.1 Daily Printable Official PDF Report Endpoint
app.get('/api/fleet/admin/export-pdf-report', (req, res) => {
  const filterDate = typeof req.query.date === 'string' ? req.query.date.trim() : '';
  const todayDate = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const targetDate = filterDate || todayDate;

  const dayTrips = (store.driverTrips || []).filter((t) => filterDate === 'all' ? true : t.date === targetDate);
  const totalSaidas = dayTrips.filter((t) => t.type === 'SAÍDA').length;
  const totalChegadas = dayTrips.filter((t) => t.type === 'CHEGADA').length;
  const totalAbastecimentos = dayTrips.filter((t) => t.type === 'ABASTECIMENTO').length;
  const totalLiters = dayTrips
    .filter((t) => t.type === 'ABASTECIMENTO' && t.liters)
    .reduce((acc, curr) => acc + (Number(curr.liters) || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório Diário Oficial - Frota NRE Maringá (${targetDate})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 24px; background: #fff; font-size: 12px; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 4px 0; font-size: 18px; text-transform: uppercase; color: #0f172a; }
    .header h2 { margin: 0 0 4px 0; font-size: 14px; font-weight: normal; color: #334155; }
    .header p { margin: 0; font-size: 11px; color: #64748b; }
    .kpi-bar { display: flex; gap: 12px; margin-bottom: 20px; }
    .kpi-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #f8fafc; text-align: center; }
    .kpi-card .val { font-size: 18px; font-weight: 900; color: #0f172a; display: block; }
    .kpi-card .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 8px 6px; font-size: 10px; text-transform: uppercase; }
    td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; }
    .badge-saida { background: #fef3c7; color: #92400e; }
    .badge-chegada { background: #d1fae5; color: #065f46; }
    .badge-abastecimento { background: #dbeafe; color: #1e40af; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
    .sig-box { width: 45%; text-align: center; border-top: 1px solid #0f172a; padding-top: 6px; font-size: 11px; font-weight: bold; color: #334155; }
    .no-print { margin-bottom: 16px; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; }
    @media print {
      .no-print { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
  </div>
  <div class="header">
    <h1>ESTADO DO PARANÁ - SECRETARIA DE ESTADO DA EDUCAÇÃO</h1>
    <h2>NÚCLEO REGIONAL DE EDUCAÇÃO DE MARINGÁ - CONTROLE DE FROTA OFICIAL</h2>
    <p>Relatório Diário de Operações de Veículos • Data de Referência: <strong>${targetDate}</strong> • Emitido em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
  </div>

  <div class="kpi-bar">
    <div class="kpi-card"><span class="val">${dayTrips.length}</span><span class="lbl">Total de Operações</span></div>
    <div class="kpi-card"><span class="val">${totalSaidas}</span><span class="lbl">Saídas Registradas</span></div>
    <div class="kpi-card"><span class="val">${totalChegadas}</span><span class="lbl">Chegadas no Pátio</span></div>
    <div class="kpi-card"><span class="val">${totalAbastecimentos}</span><span class="lbl">Abastecimentos</span></div>
    <div class="kpi-card"><span class="val">${totalLiters.toFixed(1)} L</span><span class="lbl">Litros Abastecidos</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Tipo</th>
        <th>Hora</th>
        <th>Veículo</th>
        <th>Condutor</th>
        <th>KM / Odômetro</th>
        <th>Destino / Local</th>
        <th>Motivo / Observações</th>
        <th>Tanque / L</th>
        <th>IP Registro</th>
      </tr>
    </thead>
    <tbody>
      ${dayTrips.length === 0 ? '<tr><td colspan="9" style="text-align: center; padding: 20px; color: #94a3b8;">Nenhum registro encontrado para esta data.</td></tr>' : dayTrips.map((t) => `
        <tr>
          <td><span class="badge badge-${(t.type || '').toLowerCase()}">${t.type}</span></td>
          <td><strong>${t.time}</strong></td>
          <td><strong>${t.vehicle}</strong></td>
          <td>${t.driver || '-'}</td>
          <td><strong>${t.km ? Number(t.km).toLocaleString('pt-BR') + ' km' : '-'}</strong></td>
          <td>${t.visitCity ? t.visitCity + (t.visitLocation ? ' (' + t.visitLocation + ')' : '') : (t.visitLocation || '-')}</td>
          <td>${t.visitReason || t.details || '-'}</td>
          <td>${t.type === 'ABASTECIMENTO' ? t.liters + ' L' : (t.fuelLevel || '-')}</td>
          <td style="font-family: monospace; font-size: 10px; color: #64748b;">${t.ip || '127.0.0.1'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">
      Responsável pelo Controle de Frota NRE<br>
      <span style="font-size: 9px; font-weight: normal; color: #64748b;">Assinatura / Matrícula</span>
    </div>
    <div class="sig-box">
      Visto da Chefia / Coordenação NRE Maringá<br>
      <span style="font-size: 9px; font-weight: normal; color: #64748b;">Assinatura / Carimbo</span>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 7. Admin Endpoints (Chave Mestre: 192026)
app.post('/api/fleet/admin/update-vehicle', (req, res) => {
  const { masterKey, vehicleName, status, odometer, fuelLevel, lastDriver, maintenanceReason } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  const vIndex = store.vehicles.findIndex(v => v.name.trim() === vehicleName.trim());
  if (vIndex !== -1) {
    if (status) {
      store.vehicles[vIndex].status = status;
      if (status === 'MAINTENANCE') {
        store.vehicles[vIndex].maintenanceReason = maintenanceReason || 'Em manutenção preventiva / corretiva';
        store.vehicles[vIndex].maintenanceDate = new Date().toLocaleDateString('pt-BR');
      } else if (status === 'AVAILABLE') {
        store.vehicles[vIndex].maintenanceReason = undefined;
        store.vehicles[vIndex].maintenanceDate = undefined;
      }
    }
    if (odometer !== undefined && odometer !== '') store.vehicles[vIndex].odometer = Number(odometer);
    if (fuelLevel) store.vehicles[vIndex].fuelLevel = fuelLevel;
    if (lastDriver !== undefined) store.vehicles[vIndex].lastDriver = lastDriver;
    if (maintenanceReason !== undefined) store.vehicles[vIndex].maintenanceReason = maintenanceReason;
    
    addAccessLog(
      'Admin: Edição Direta de Veículo',
      getClientIp(req),
      req.headers['user-agent'] || '',
      `Edição de ${vehicleName} (KM: ${store.vehicles[vIndex].odometer}, Combustível: ${store.vehicles[vIndex].fuelLevel}, Status: ${store.vehicles[vIndex].status})`,
      'Administrador'
    );

    saveStore(store);
    return res.json({ success: true, updatedVehicles: store.vehicles, accessLogs: store.accessLogs });
  }

  return res.status(404).json({ error: 'Veículo não encontrado.' });
});

app.post('/api/fleet/admin/toggle-maintenance', (req, res) => {
  const { masterKey, vehicleName, isMaintenance, maintenanceReason } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  const vIndex = store.vehicles.findIndex(v => v.name.trim() === vehicleName.trim());
  if (vIndex !== -1) {
    if (isMaintenance) {
      store.vehicles[vIndex].status = 'MAINTENANCE';
      store.vehicles[vIndex].maintenanceReason = maintenanceReason || 'Em manutenção preventiva / corretiva';
      store.vehicles[vIndex].maintenanceDate = new Date().toLocaleDateString('pt-BR');

      addNotification(
        '🔧 Veículo em Manutenção',
        `O veículo ${vehicleName} foi colocado em MANUTENÇÃO pelo Administrador. Motivo: ${store.vehicles[vIndex].maintenanceReason}.`,
        'MAINTENANCE_ALERT',
        vehicleName,
        undefined,
        true
      );
    } else {
      store.vehicles[vIndex].status = 'AVAILABLE';
      store.vehicles[vIndex].maintenanceReason = undefined;
      store.vehicles[vIndex].maintenanceDate = undefined;

      addNotification(
        '🟢 Veículo Liberado da Manutenção',
        `O veículo ${vehicleName} concluiu a manutenção e está DISPONÍVEL no pátio para utilização.`,
        'STATUS_CHANGE',
        vehicleName
      );
    }

    addAccessLog(
      isMaintenance ? 'Admin: Veículo em Manutenção' : 'Admin: Veículo Liberado',
      getClientIp(req),
      req.headers['user-agent'] || '',
      `${vehicleName} -> ${isMaintenance ? 'Manutenção (' + (maintenanceReason || '') + ')' : 'Disponível no Pátio'}`,
      'Administrador'
    );

    saveStore(store);
    return res.json({ success: true, updatedVehicles: store.vehicles, notifications: store.notifications, accessLogs: store.accessLogs });
  }

  return res.status(404).json({ error: 'Veículo não encontrado.' });
});

// 7.1 Batch Multi-Vehicle Maintenance (Colocar / Liberar múltiplos veículos em manutenção simultaneamente)
app.post('/api/fleet/admin/batch-maintenance', (req, res) => {
  const { masterKey, vehicleNames, action, maintenanceReason } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  if (!Array.isArray(vehicleNames) || vehicleNames.length === 0) {
    return res.status(400).json({ error: 'Nenhum veículo selecionado.' });
  }

  const isMaintenance = action === 'MAINTENANCE';
  const updatedList: string[] = [];

  store.vehicles = store.vehicles.map(v => {
    if (vehicleNames.includes(v.name)) {
      updatedList.push(v.name);
      if (isMaintenance) {
        return {
          ...v,
          status: 'MAINTENANCE',
          maintenanceReason: maintenanceReason || 'Manutenção preventiva / revisão técnica',
          maintenanceDate: new Date().toLocaleDateString('pt-BR'),
        };
      } else {
        return {
          ...v,
          status: 'AVAILABLE',
          maintenanceReason: undefined,
          maintenanceDate: undefined,
        };
      }
    }
    return v;
  });

  if (isMaintenance) {
    addNotification(
      '🔧 Múltiplos Veículos em Manutenção',
      `O Administrador colocou ${updatedList.length} veículo(s) em MANUTENÇÃO: ${updatedList.join(', ')}. Motivo: ${maintenanceReason || 'Revisão geral'}.`,
      'MAINTENANCE_ALERT',
      undefined,
      'Administrador',
      true
    );
  } else {
    addNotification(
      '🟢 Veículos Liberados da Manutenção',
      `O Administrador liberou ${updatedList.length} veículo(s) da manutenção para DISPONÍVEL no pátio: ${updatedList.join(', ')}.`,
      'STATUS_CHANGE',
      undefined,
      'Administrador'
    );
  }

  addAccessLog(
    isMaintenance ? 'Admin: Manutenção em Lote' : 'Admin: Liberação em Lote',
    getClientIp(req),
    req.headers['user-agent'] || '',
    `${updatedList.length} veículos alterados: ${updatedList.join(', ')}`,
    'Administrador'
  );

  saveStore(store);
  return res.json({ success: true, updatedVehicles: store.vehicles, notifications: store.notifications, accessLogs: store.accessLogs });
});

app.post('/api/fleet/admin/release-all', (req, res) => {
  const { masterKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  store.vehicles = store.vehicles.map(v => ({
    ...v,
    status: 'AVAILABLE',
  }));

  addNotification(
    '🟢 Frota Totalmente Liberada',
    'O Administrador liberou todos os veículos da frota como disponíveis no pátio.',
    'STATUS_CHANGE'
  );

  addAccessLog(
    'Admin: Liberação Geral da Frota',
    getClientIp(req),
    req.headers['user-agent'] || '',
    'Todos os veículos definidos como DISPONÍVEL',
    'Administrador'
  );

  saveStore(store);

  return res.json({ success: true, updatedVehicles: store.vehicles, notifications: store.notifications, accessLogs: store.accessLogs });
});

app.post('/api/fleet/admin/broadcast-notification', (req, res) => {
  const { masterKey, title, message, urgent, type } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  if (!title || !message) {
    return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
  }

  const notif = addNotification(
    title,
    message,
    type || 'BROADCAST',
    undefined,
    'Administrador',
    !!urgent
  );

  addAccessLog(
    'Admin: Envio de Notificação Push',
    getClientIp(req),
    req.headers['user-agent'] || '',
    `Aviso: "${title}"`,
    'Administrador'
  );

  saveStore(store);

  return res.json({ success: true, notification: notif, notifications: store.notifications, accessLogs: store.accessLogs });
});

app.post('/api/fleet/admin/clear-notifications', (req, res) => {
  const { masterKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  store.notifications = [];
  
  addAccessLog(
    'Admin: Limpeza de Notificações',
    getClientIp(req),
    req.headers['user-agent'] || '',
    'Todas as notificações limpas',
    'Administrador'
  );

  saveStore(store);

  return res.json({ success: true, notifications: [], accessLogs: store.accessLogs });
});

app.post('/api/fleet/admin/delete-trip', (req, res) => {
  const { masterKey, tripId } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  const targetTrip = store.driverTrips.find(t => t.id === tripId);
  store.driverTrips = store.driverTrips.filter(t => t.id !== tripId);
  store.departures = (store.departures || []).filter(d => d.id !== tripId);
  store.arrivals = (store.arrivals || []).filter(a => a.id !== tripId);
  store.refuels = (store.refuels || []).filter(r => r.id !== tripId);

  if (!store.deletedTripIds) store.deletedTripIds = [];
  if (!store.deletedTripIds.includes(tripId)) {
    store.deletedTripIds.push(tripId);
  }

  // If the deleted trip was an active departure, also clean up checkout
  if (targetTrip && targetTrip.vehicle) {
    store.activeCheckouts = (store.activeCheckouts || []).filter(
      ac => ac.vehicle.trim().toLowerCase() !== targetTrip.vehicle.trim().toLowerCase()
    );
  }

  addAccessLog(
    'Admin: Exclusão de Registro',
    getClientIp(req),
    req.headers['user-agent'] || '',
    `Excluído registro ${targetTrip ? targetTrip.type + ' (' + targetTrip.vehicle + ')' : tripId}`,
    'Administrador'
  );

  saveStore(store);

  return res.json({
    success: true,
    recentTrips: store.driverTrips,
    updatedVehicles: store.vehicles,
    accessLogs: store.accessLogs,
    deletedTripIds: store.deletedTripIds,
  });
});

// 7.1.1 Reset All Odometers (Zerar todos os odômetros com Chave Mestre 192026)
app.post('/api/fleet/admin/reset-odometers', (req, res) => {
  const { masterKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  store.vehicles = store.vehicles.map(v => ({
    ...v,
    odometer: 0,
  }));

  addAccessLog(
    'Admin: Zerar Odômetros da Frota',
    getClientIp(req),
    req.headers['user-agent'] || '',
    'Todos os odômetros foram zerados para o primeiro registro do condutor fixar o valor real',
    'Administrador'
  );

  saveStore(store);
  return res.json({ success: true, updatedVehicles: store.vehicles, accessLogs: store.accessLogs });
});

app.post('/api/fleet/admin/clear-all-history', (req, res) => {
  const { masterKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  store.departures = [];
  store.arrivals = [];
  store.refuels = [];
  store.driverTrips = [];
  store.deletedTripIds = [];
  store.vehicles = store.vehicles.map(v => ({
    ...v,
    status: 'AVAILABLE',
    lastDriver: undefined,
    lastArrival: undefined,
  }));

  addAccessLog(
    'Admin: Limpeza de Histórico Geral',
    getClientIp(req),
    req.headers['user-agent'] || '',
    'Histórico resetado pelo Administrador',
    'Administrador'
  );

  saveStore(store);

  return res.json({
    success: true,
    recentTrips: [],
    updatedVehicles: store.vehicles,
    accessLogs: store.accessLogs,
    deletedTripIds: [],
  });
});

// 7.2 Export Access Logs to CSV (Auditoria e Relatório de Acessos)
app.get('/api/fleet/admin/export-access-logs-csv', (req, res) => {
  let csv = 'DATA;HORA;AÇÃO;USUÁRIO / MOTORISTA;DISPOSITIVO;IP;DETALHES DA ATIVIDADE\n';

  const logs = store.accessLogs || [];
  logs.forEach(l => {
    csv += `"${l.date || ''}";"${l.time || ''}";"${l.action || ''}";"${l.driverName || ''}";"${l.device || ''}";"${l.ip || ''}";"${(l.details || '').replace(/"/g, '""')}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="auditoria_acessos_frota_nre.csv"');
  res.send('\uFEFF' + csv);
});

// 7.3 Clear Access Logs (Somente com Senha Mestre)
app.post('/api/fleet/admin/clear-access-logs', (req, res) => {
  const { masterKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(401).json({ error: 'Chave mestre incorreta.' });
  }

  store.accessLogs = [];
  addAccessLog(
    'Admin: Limpeza de Log de Acessos',
    getClientIp(req),
    req.headers['user-agent'] || '',
    'Logs de acesso anteriores limpos pelo Administrador',
    'Administrador'
  );
  saveStore(store);

  return res.json({ success: true, accessLogs: store.accessLogs });
});

// Vite / Static setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frota NRE Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
