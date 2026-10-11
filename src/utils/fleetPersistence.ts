import { Vehicle, DriverTripEntry, AccessLogEntry } from '../types';
import { INITIAL_VEHICLES, INITIAL_RECENT_TRIPS } from '../data/initialData';

const STORAGE_KEYS = {
  VEHICLES: 'nre_fleet_vehicles_v2',
  TRIPS: 'nre_fleet_driver_trips_v2',
  ACCESS_LOGS: 'nre_fleet_access_logs_v2',
  DELETED_TRIP_IDS: 'nre_fleet_deleted_trip_ids_v2',
  LAST_SYNC: 'nre_fleet_last_sync_timestamp',
};

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

const MASTER_KEY = '192026';

/**
 * Loads deleted trip IDs (tombstones) so trips deleted by Admin with Master Key are never revived.
 */
export function getPersistedDeletedTripIds(): Set<string> {
  if (!isClient()) return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_TRIP_IDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch (err) {
    console.warn('Failed reading deleted trip IDs from localStorage:', err);
  }
  return new Set();
}

/**
 * Saves deleted trip IDs to localStorage.
 */
export function savePersistedDeletedTripIds(ids: Set<string> | string[]): void {
  if (!isClient()) return;
  try {
    const array = Array.isArray(ids) ? ids : Array.from(ids);
    localStorage.setItem(STORAGE_KEYS.DELETED_TRIP_IDS, JSON.stringify(array));
  } catch (err) {
    console.warn('Failed saving deleted trip IDs to localStorage:', err);
  }
}

/**
 * Diretriz Oficial de Persistência Permanente:
 * Exclusão de registro permitida EXCLUSIVAMENTE mediante autenticação com a Chave Mestre 192026.
 */
export function markTripAsDeleted(tripId: string, masterKey?: string): boolean {
  if (!isClient() || !tripId) return false;
  if (masterKey !== MASTER_KEY) {
    console.warn('[Diretriz Oficial de Persistência Permanente] Exclusão rejeitada: Chave Mestre 192026 necessária.');
    return false;
  }
  const deletedSet = getPersistedDeletedTripIds();
  deletedSet.add(tripId);
  savePersistedDeletedTripIds(deletedSet);

  // Also remove from stored trips immediately
  const trips = getPersistedTrips();
  const filtered = trips.filter(t => t.id !== tripId);
  savePersistedTrips(filtered);
  return true;
}

/**
 * Diretriz Oficial de Persistência Permanente:
 * Limpeza geral de registros permitida EXCLUSIVAMENTE mediante autenticação com a Chave Mestre 192026.
 */
export function clearPersistedHistory(masterKey?: string): boolean {
  if (!isClient()) return false;
  if (masterKey !== MASTER_KEY) {
    console.warn('[Diretriz Oficial de Persistência Permanente] Limpeza de histórico rejeitada: Chave Mestre 192026 necessária.');
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify([]));
    return true;
  } catch (err) {
    console.warn('Failed clearing trips from localStorage:', err);
    return false;
  }
}

/**
 * Retrieves persisted trips from localStorage, excluding tombstones.
 */
export function getPersistedTrips(): DriverTripEntry[] {
  if (!isClient()) return INITIAL_RECENT_TRIPS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedSet = getPersistedDeletedTripIds();
        return parsed.filter(t => !deletedSet.has(t.id));
      }
    }
  } catch (err) {
    console.warn('Failed loading trips from localStorage:', err);
  }
  return INITIAL_RECENT_TRIPS;
}

/**
 * Persists trips into localStorage without artificial limits.
 */
export function savePersistedTrips(trips: DriverTripEntry[]): void {
  if (!isClient() || !Array.isArray(trips)) return;
  try {
    const deletedSet = getPersistedDeletedTripIds();
    // Strip large base64 image payloads so localStorage stays under browser quota and never drops records
    const cleanTrips = trips
      .filter(t => !deletedSet.has(t.id))
      .map(t => {
        const hasBase64 = t.receiptImage && typeof t.receiptImage === 'string' && t.receiptImage.startsWith('data:');
        return {
          ...t,
          receiptImage: hasBase64 ? (t.photoUrl || '') : t.receiptImage,
        };
      });
    localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(cleanTrips));
  } catch (err) {
    console.warn('Failed saving trips to localStorage:', err);
  }
}

/**
 * Retrieves persisted vehicles from localStorage.
 */
export function getPersistedVehicles(): Vehicle[] {
  if (!isClient()) return INITIAL_VEHICLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VEHICLES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed loading vehicles from localStorage:', err);
  }
  return INITIAL_VEHICLES;
}

/**
 * Persists vehicles into localStorage.
 */
export function savePersistedVehicles(vehicles: Vehicle[]): void {
  if (!isClient() || !Array.isArray(vehicles) || vehicles.length === 0) return;
  try {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
  } catch (err) {
    console.warn('Failed saving vehicles to localStorage:', err);
  }
}

/**
 * Retrieves persisted access logs from localStorage.
 */
export function getPersistedAccessLogs(): AccessLogEntry[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCESS_LOGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed loading access logs from localStorage:', err);
  }
  return [];
}

/**
 * Persists access logs into localStorage permanently.
 */
export function savePersistedAccessLogs(logs: AccessLogEntry[]): void {
  if (!isClient() || !Array.isArray(logs)) return;
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.warn('Failed saving access logs to localStorage:', err);
  }
}

/**
 * Merges local trips with server trips without dropping any recorded entry,
 * strictly filtering out entries that were deleted by the administrator.
 */
export function mergeTrips(
  localTrips: DriverTripEntry[],
  serverTrips: DriverTripEntry[],
  deletedIds: Set<string>
): DriverTripEntry[] {
  const map = new Map<string, DriverTripEntry>();

  // Add all local trips not deleted
  for (const trip of localTrips) {
    if (trip && trip.id && !deletedIds.has(trip.id)) {
      map.set(trip.id, trip);
    }
  }

  // Add/overlay server trips not deleted
  for (const trip of serverTrips) {
    if (trip && trip.id && !deletedIds.has(trip.id)) {
      map.set(trip.id, trip);
    }
  }

  const merged = Array.from(map.values());

  // Sort descending by timestamp or date/time
  merged.sort((a, b) => {
    const tsA = a.timestamp || 0;
    const tsB = b.timestamp || 0;
    if (tsA !== tsB) return tsB - tsA;
    return (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time);
  });

  return merged;
}

/**
 * Merges vehicle status and odometer readings, ensuring that calibrated odometers
 * (values > 0) are never accidentally overwritten back to 0.
 */
export function mergeVehicles(localVehicles: Vehicle[], serverVehicles: Vehicle[]): Vehicle[] {
  if (!serverVehicles || serverVehicles.length === 0) return localVehicles;
  if (!localVehicles || localVehicles.length === 0) return serverVehicles;

  const localMap = new Map<string, Vehicle>();
  for (const v of localVehicles) {
    localMap.set(v.name.trim().toUpperCase(), v);
  }

  return serverVehicles.map(serverV => {
    const localV = localMap.get(serverV.name.trim().toUpperCase());
    if (!localV) return serverV;

    // Preserve calibrated odometer if local has reading and server is 0
    const finalOdometer =
      serverV.odometer && serverV.odometer > 0
        ? serverV.odometer
        : localV.odometer && localV.odometer > 0
        ? localV.odometer
        : 0;

    return {
      ...serverV,
      odometer: finalOdometer,
      lastDriver: serverV.lastDriver || localV.lastDriver,
      lastDestination: serverV.lastDestination || localV.lastDestination,
      lastDeparture: serverV.lastDeparture || localV.lastDeparture,
      lastArrival: serverV.lastArrival || localV.lastArrival,
      maintenanceReason: serverV.maintenanceReason || localV.maintenanceReason,
      maintenanceDate: serverV.maintenanceDate || localV.maintenanceDate,
      fuelLevel: serverV.fuelLevel || localV.fuelLevel || 'Cheio',
    };
  });
}
