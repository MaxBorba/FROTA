import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from './config';
import { Vehicle, DriverTripEntry, AccessLogEntry, ActiveSessionInfo } from '../types';
import { INITIAL_VEHICLES, INITIAL_RECENT_TRIPS } from '../data/initialData';
import { OperationType, handleFirestoreError } from './errorHandler';

const MASTER_KEY = '192026';

/**
 * Seeds initial vehicles and recent trips to Firestore if the database is brand new.
 */
export async function seedFirestoreIfEmpty(): Promise<void> {
  const path = 'vehicles';
  try {
    const snap = await getDocs(collection(db, path));
    if (snap.empty) {
      console.log('[Firebase Firestore] Banco vazio detectado. Inicializando veículos e histórico...');
      const batch = writeBatch(db);

      // Seed vehicles
      INITIAL_VEHICLES.forEach((v) => {
        const ref = doc(db, 'vehicles', v.id);
        batch.set(ref, {
          ...v,
          updatedAt: new Date().toISOString(),
        });
      });

      // Seed initial trips
      INITIAL_RECENT_TRIPS.forEach((t) => {
        const ref = doc(db, 'trips', t.id);
        batch.set(ref, {
          ...t,
          createdAt: new Date().toISOString(),
          createdBy: 'Sistema',
        });
      });

      await batch.commit();
      console.log('[Firebase Firestore] Veículos e dados iniciais gravados com sucesso.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
  }
}

/**
 * Real-time listener for fleet vehicles.
 */
export function subscribeVehicles(
  onData: (vehicles: Vehicle[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'vehicles';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Vehicle[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Vehicle);
      });
      // Sort vehicles consistently by ID or name
      list.sort((a, b) => a.id.localeCompare(b.id));
      onData(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
    }
  );
}

/**
 * Real-time listener for Driver Trip records (Permanent history).
 */
export function subscribeTrips(
  onData: (trips: DriverTripEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'trips';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: DriverTripEntry[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as DriverTripEntry);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
    }
  );
}

/**
 * Real-time listener for access logs.
 */
export function subscribeAccessLogs(
  onData: (logs: AccessLogEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'accessLogs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AccessLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as AccessLogEntry);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
    }
  );
}

/**
 * Real-time listener for active checkouts (vehicles currently out).
 */
export function subscribeActiveCheckouts(
  onData: (checkouts: ActiveSessionInfo[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'activeCheckouts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: ActiveSessionInfo[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as ActiveSessionInfo);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
    }
  );
}

/**
 * Saves departure record atomically in Firestore:
 * 1. Writes trip to /trips/{id}
 * 2. Updates vehicle status to UNAVAILABLE in /vehicles/{id}
 * 3. Registers active checkout in /activeCheckouts/{id}
 */
export async function saveDepartureFirestore(
  tripEntry: DriverTripEntry,
  vehicleUpdate: Partial<Vehicle> & { id: string },
  activeCheckout?: ActiveSessionInfo
): Promise<void> {
  const path = 'trips';
  try {
    const batch = writeBatch(db);

    // 1. Permanent trip record
    const tripRef = doc(db, 'trips', tripEntry.id);
    batch.set(tripRef, {
      ...tripEntry,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || tripEntry.driver,
    });

    // 2. Vehicle update
    const vehicleRef = doc(db, 'vehicles', vehicleUpdate.id);
    batch.set(vehicleRef, {
      ...vehicleUpdate,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // 3. Active Checkout
    if (activeCheckout) {
      const checkoutRef = doc(db, 'activeCheckouts', tripEntry.id);
      batch.set(checkoutRef, activeCheckout);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, auth.currentUser);
  }
}

/**
 * Saves arrival record atomically in Firestore:
 * 1. Writes arrival trip to /trips/{id}
 * 2. Updates vehicle status to AVAILABLE and records new odometer in /vehicles/{id}
 * 3. Clears active checkouts for this vehicle
 */
export async function saveArrivalFirestore(
  tripEntry: DriverTripEntry,
  vehicleUpdate: Partial<Vehicle> & { id: string }
): Promise<void> {
  const path = 'trips';
  try {
    const batch = writeBatch(db);

    // 1. Permanent trip record
    const tripRef = doc(db, 'trips', tripEntry.id);
    batch.set(tripRef, {
      ...tripEntry,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || tripEntry.driver,
    });

    // 2. Vehicle update
    const vehicleRef = doc(db, 'vehicles', vehicleUpdate.id);
    batch.set(vehicleRef, {
      ...vehicleUpdate,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await batch.commit();

    // 3. Clean up active checkouts for this vehicle
    try {
      const checkoutSnap = await getDocs(collection(db, 'activeCheckouts'));
      checkoutSnap.forEach(async (docItem) => {
        const data = docItem.data();
        if (data.vehicle === tripEntry.vehicle) {
          await deleteDoc(doc(db, 'activeCheckouts', docItem.id));
        }
      });
    } catch (err) {
      console.warn('Could not clean active checkout:', err);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, auth.currentUser);
  }
}

/**
 * Saves refuel record atomically in Firestore:
 * 1. Writes refuel trip to /trips/{id}
 * 2. Updates vehicle fuel level in /vehicles/{id}
 */
export async function saveRefuelFirestore(
  tripEntry: DriverTripEntry,
  vehicleUpdate: Partial<Vehicle> & { id: string }
): Promise<void> {
  const path = 'trips';
  try {
    const batch = writeBatch(db);

    // 1. Permanent trip record
    const tripRef = doc(db, 'trips', tripEntry.id);
    batch.set(tripRef, {
      ...tripEntry,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || tripEntry.driver,
    });

    // 2. Vehicle update
    const vehicleRef = doc(db, 'vehicles', vehicleUpdate.id);
    batch.set(vehicleRef, {
      ...vehicleUpdate,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path, auth.currentUser);
  }
}

/**
 * Diretriz Oficial de Persistência Permanente:
 * Exclusão permitida EXCLUSIVAMENTE mediante autenticação com a Chave Mestre 192026.
 * Cria tombstone em /tombstones/{tripId} para que todos os outros aparelhos conectados
 * apaguem o registro instantaneamente via Firestore onSnapshot em tempo real.
 */
export async function deleteTripFirestore(tripId: string, masterKey?: string): Promise<boolean> {
  if (masterKey !== MASTER_KEY) {
    console.warn('[Diretriz Oficial de Persistência Permanente] Exclusão no Firestore bloqueada: Chave Mestre 192026 necessária.');
    return false;
  }
  const path = `trips/${tripId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'trips', tripId));
    // Save tombstone in Firestore so all other open devices purge it immediately
    const tombRef = doc(db, 'tombstones', tripId);
    batch.set(tombRef, {
      tripId,
      deletedAt: new Date().toISOString(),
      deletedBy: auth.currentUser?.email || 'Administrador (Chave Mestre)',
    });
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, auth.currentUser);
    return false;
  }
}

/**
 * Diretriz Oficial: Correção de dados de viagem permitida EXCLUSIVAMENTE mediante autenticação com a Chave Mestre 192026.
 */
export async function updateTripFirestore(
  tripId: string,
  updates: Partial<DriverTripEntry>,
  masterKey?: string
): Promise<boolean> {
  if (masterKey !== MASTER_KEY) {
    console.warn('[Diretriz Oficial] Correção no Firestore bloqueada: Chave Mestre 192026 necessária.');
    return false;
  }
  const path = `trips/${tripId}`;
  try {
    const tripRef = doc(db, 'trips', tripId);
    await updateDoc(tripRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Administrador (Chave Mestre)',
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, auth.currentUser);
    return false;
  }
}

/**
 * Real-time listener for tombstones (admin-deleted trips) across all open devices.
 */
export function subscribeTombstones(
  onData: (tombstoneIds: string[]) => void,
  onError?: (err: any) => void
): () => void {
  const path = 'tombstones';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: string[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.id);
      });
      onData(list);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.GET, path, auth.currentUser);
    }
  );
}

/**
 * Diretriz Oficial de Persistência Permanente:
 * Limpeza geral de registros permitida EXCLUSIVAMENTE mediante autenticação com a Chave Mestre 192026.
 */
export async function clearAllTripsFirestore(masterKey?: string): Promise<boolean> {
  if (masterKey !== MASTER_KEY) {
    console.warn('[Diretriz Oficial de Persistência Permanente] Limpeza total no Firestore bloqueada: Chave Mestre 192026 necessária.');
    return false;
  }
  const path = 'trips';
  try {
    const snapshot = await getDocs(collection(db, path));
    const batch = writeBatch(db);
    snapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
      const tombRef = doc(db, 'tombstones', docSnap.id);
      batch.set(tombRef, {
        tripId: docSnap.id,
        deletedAt: new Date().toISOString(),
        deletedBy: 'Administrador (Chave Mestre)',
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path, auth.currentUser);
    return false;
  }
}

/**
 * Records an access log in Firestore.
 */
export async function logAccessFirestore(log: AccessLogEntry): Promise<void> {
  const path = 'accessLogs';
  try {
    const logRef = doc(db, 'accessLogs', log.id);
    await setDoc(logRef, {
      ...log,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Falha ao registrar log no Firestore:', err);
  }
}

/**
 * Updates a vehicle document in Firestore.
 */
export async function updateVehicleFirestore(vehicleId: string, updates: Partial<Vehicle>): Promise<void> {
  const path = `vehicles/${vehicleId}`;
  try {
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    await updateDoc(vehicleRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path, auth.currentUser);
  }
}
