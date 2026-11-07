import React, { useState, useEffect, useRef } from 'react';
import { Vehicle, DriverTripEntry, FuelLevel, AppNotification, NotificationSettings, AccessLogEntry } from './types';
import { INITIAL_VEHICLES, INITIAL_RECENT_TRIPS } from './data/initialData';
import { HeaderBanner } from './components/HeaderBanner';
import { HomeView } from './components/HomeView';
import { DepartureForm } from './components/DepartureForm';
import { ArrivalForm } from './components/ArrivalForm';
import { RefuelForm } from './components/RefuelForm';
import { VehicleStatusView } from './components/VehicleStatusView';
import { DriverTripsView } from './components/DriverTripsView';
import { GasStationsView } from './components/GasStationsView';
import { SheetsSyncModal } from './components/SheetsSyncModal';
import { AdminModal } from './components/AdminModal';
import { NotificationToastContainer } from './components/NotificationToastContainer';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { NavigationTabs, AppView } from './components/NavigationTabs';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { PWAInstallModal } from './components/PWAInstallModal';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  getReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  playNotificationSound,
  triggerBrowserPushNotification,
  checkOverdueTrips,
} from './utils/notificationService';
import {
  getPersistedTrips,
  savePersistedTrips,
  getPersistedVehicles,
  savePersistedVehicles,
  getPersistedAccessLogs,
  savePersistedAccessLogs,
  getPersistedDeletedTripIds,
  savePersistedDeletedTripIds,
  saveDeviceLocalAudit,
  isWithinSixMonths,
  markTripAsDeleted,
  clearPersistedHistory,
  mergeTrips,
  mergeVehicles,
} from './utils/fleetPersistence';
import {
  seedFirestoreIfEmpty,
  subscribeVehicles,
  subscribeTrips,
  subscribeTombstones,
  subscribeAccessLogs,
  saveDepartureFirestore,
  saveArrivalFirestore,
  saveRefuelFirestore,
  updateTripFirestore,
  deleteTripFirestore,
  clearAllTripsFirestore,
  updateVehicleFirestore,
} from './firebase/firestoreService';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('nre_admin_auth') === 'true';
    } catch {
      return false;
    }
  });

  // Dual-layer persistence: initialize immediately from client storage to prevent data loss on cold starts
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getPersistedVehicles());
  const [recentTrips, setRecentTrips] = useState<DriverTripEntry[]>(() => getPersistedTrips());
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>(() => getPersistedAccessLogs());
  const [spreadsheetId, setSpreadsheetId] = useState<string>('1hN8y59EoyQWwcUmLegqsOfjXGiwEI4z4g5xzavIABYE');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // PWA & Offline connectivity hooks
  const { isOnline, wasOffline } = useOnlineStatus();
  const {
    isInstalled,
    canPromptDirectly,
    isIOS,
    isAndroid,
    isWindows,
    isInstallModalOpen,
    setIsInstallModalOpen,
    promptInstall,
  } = usePWAInstall();

  // Sync state to local storage whenever modified
  useEffect(() => {
    savePersistedVehicles(vehicles);
  }, [vehicles]);

  useEffect(() => {
    savePersistedTrips(recentTrips);
  }, [recentTrips]);

  useEffect(() => {
    savePersistedAccessLogs(accessLogs);
  }, [accessLogs]);

  // Notification states
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadNotificationIds());
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() =>
    loadNotificationSettings()
  );
  const [toastNotifications, setToastNotifications] = useState<AppNotification[]>([]);

  const previousNotifIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNotifsRef = useRef<boolean>(false);

  // Trigger alert sound & push for incoming new notification
  const triggerNotificationAlert = (notif: AppNotification) => {
    if (notificationSettings.soundEnabled) {
      playNotificationSound(notif.urgent);
    }
    if (notificationSettings.browserPushEnabled) {
      triggerBrowserPushNotification(notif.title, notif.message, notif.urgent);
    }
    // Show toast
    setToastNotifications(prev => {
      if (prev.some(t => t.id === notif.id)) return prev;
      return [notif, ...prev.slice(0, 3)];
    });
  };

  // Fetch and intelligently merge fleet data without ever dropping saved user entries
  const fetchFleetData = async () => {
    try {
      const res = await fetch('/api/fleet');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          // Merge tombstones of admin deleted trips
          const serverDeletedIds = new Set<string>(json.deletedTripIds || []);
          const localDeletedIds = getPersistedDeletedTripIds();
          const allDeletedIds = new Set([...serverDeletedIds, ...localDeletedIds]);
          savePersistedDeletedTripIds(allDeletedIds);

          // Merge server trips with local storage trips (never drop recorded trips)
          const localTrips = getPersistedTrips();
          const serverTrips = Array.isArray(json.data.driverTrips) ? json.data.driverTrips : [];
          const mergedTrips = mergeTrips(localTrips, serverTrips, allDeletedIds);

          // Merge vehicles (preserve calibrated odometer if server restarted)
          const localVehicles = getPersistedVehicles();
          const serverVehicles = Array.isArray(json.data.vehicles) ? json.data.vehicles : [];
          const mergedVehicles = mergeVehicles(localVehicles, serverVehicles);

          setVehicles(mergedVehicles);
          setRecentTrips(mergedTrips);

          if (json.data.spreadsheetId) setSpreadsheetId(json.data.spreadsheetId);
          if (json.data.webhookUrl !== undefined) setWebhookUrl(json.data.webhookUrl);
          
          if (Array.isArray(json.data.accessLogs)) {
            const localLogs = getPersistedAccessLogs();
            const logMap = new Map<string, AccessLogEntry>();
            [...json.data.accessLogs, ...localLogs].forEach(l => {
              if (l && l.id) logMap.set(l.id, l);
            });
            const mergedLogs = Array.from(logMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setAccessLogs(mergedLogs);
          }

          // If the server restarted or is missing trips that the client has stored, push missing trips to server
          const serverTripIdSet = new Set(serverTrips.map((t: DriverTripEntry) => t.id));
          const tripsMissingOnServer = mergedTrips.filter(t => !serverTripIdSet.has(t.id));
          
          if (tripsMissingOnServer.length > 0) {
            fetch('/api/fleet/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trips: tripsMissingOnServer,
                vehicles: mergedVehicles,
                deletedTripIds: Array.from(allDeletedIds),
              }),
            }).catch(() => {});
          }

          if (Array.isArray(json.data.notifications)) {
            const serverNotifs: AppNotification[] = json.data.notifications;
            setNotifications(serverNotifs);

            if (hasInitializedNotifsRef.current) {
              // Find new notifications not seen before
              serverNotifs.forEach(notif => {
                if (!previousNotifIdsRef.current.has(notif.id)) {
                  triggerNotificationAlert(notif);
                }
              });
            } else {
              hasInitializedNotifsRef.current = true;
            }

            previousNotifIdsRef.current = new Set(serverNotifs.map(n => n.id));
          }
        }
      }
    } catch (err) {
      console.warn('Backend API offline or loading fallback:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial Firestore seed & real-time listeners for live synchronization
  useEffect(() => {
    seedFirestoreIfEmpty().catch((err) => {
      console.warn('Initial Firestore seeding:', err);
    });

    const unsubVehicles = subscribeVehicles((firestoreVehicles) => {
      if (firestoreVehicles && firestoreVehicles.length > 0) {
        setVehicles(firestoreVehicles);
        savePersistedVehicles(firestoreVehicles);
      }
    });

    const unsubTrips = subscribeTrips((firestoreTrips) => {
      if (firestoreTrips) {
        const deletedSet = getPersistedDeletedTripIds();
        const cleanTrips = firestoreTrips.filter(
          t => !deletedSet.has(t.id) && isWithinSixMonths(t.timestamp, t.date)
        );
        setRecentTrips(cleanTrips);
        savePersistedTrips(cleanTrips);
      }
    });

    const unsubTombstones = subscribeTombstones((tombstones) => {
      if (tombstones && tombstones.length > 0) {
        const localDeleted = getPersistedDeletedTripIds();
        tombstones.forEach(id => localDeleted.add(id));
        savePersistedDeletedTripIds(localDeleted);
        setRecentTrips(prev => {
          const clean = prev.filter(t => !localDeleted.has(t.id));
          savePersistedTrips(clean);
          return clean;
        });
      }
    });

    const unsubLogs = subscribeAccessLogs((firestoreLogs) => {
      if (firestoreLogs && firestoreLogs.length > 0) {
        setAccessLogs(firestoreLogs);
        savePersistedAccessLogs(firestoreLogs);
      }
    });

    return () => {
      unsubVehicles();
      unsubTrips();
      unsubTombstones();
      unsubLogs();
    };
  }, []);

  // Initial load and periodic polling every 2 seconds for real-time multi-user synchronization
  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(() => {
      fetchFleetData();
    }, 2000);
    return () => clearInterval(interval);
  }, [notificationSettings]);

  // Periodic deadline / return reminder check (every 15 seconds)
  useEffect(() => {
    const checkDeadlines = () => {
      if (!notificationSettings.enabled || !notificationSettings.returnReminders) return;
      const overdueAlerts = checkOverdueTrips(vehicles, recentTrips, notificationSettings);
      if (overdueAlerts.length > 0) {
        overdueAlerts.forEach(alertNotif => {
          setNotifications(prev => {
            if (prev.some(n => n.id === alertNotif.id)) return prev;
            return [alertNotif, ...prev];
          });
          triggerNotificationAlert(alertNotif);
        });
      }
    };

    checkDeadlines();
    const deadlineInterval = setInterval(checkDeadlines, 15000);
    return () => clearInterval(deadlineInterval);
  }, [vehicles, recentTrips, notificationSettings]);

  // Submit Departure (Registrar Saída)
  const handleDepartureSubmit = async (data: {
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
  }) => {
    const tripId = 'dep_' + Date.now();
    const newEntry: DriverTripEntry = {
      id: tripId,
      type: 'SAÍDA',
      vehicle: data.vehicle,
      date: data.date,
      time: data.time,
      km: data.km,
      driver: data.driver,
      passengers: data.passengers,
      visitCity: data.visitCity,
      visitLocation: data.visitLocation,
      visitReason: data.visitReason,
      details: `${data.visitCity} (${data.visitLocation}): ${data.visitReason}`,
      timestamp: Date.now(),
    };

    // Save copy to local device audit storage for driver conference
    saveDeviceLocalAudit(newEntry);

    const targetVehicle = vehicles.find(v => v.name.trim() === data.vehicle.trim());
    const vehicleId = targetVehicle ? targetVehicle.id : data.vehicle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const vehicleUpdate = {
      id: vehicleId,
      name: data.vehicle,
      status: 'UNAVAILABLE' as const,
      odometer: data.km,
      lastDriver: data.driver,
      lastDestination: `${data.visitCity} - ${data.visitLocation}`,
      lastDeparture: `${data.date} - ${data.time}`,
      lastReason: data.visitReason,
    };

    // 1. Write atomically to Cloud Firestore
    saveDepartureFirestore(newEntry, vehicleUpdate, {
      vehicle: data.vehicle,
      driver: data.driver,
      km: data.km,
      date: data.date,
      time: data.time,
      timestamp: Date.now(),
    }).catch(err => console.warn('Firestore departure write fallback:', err));

    // 2. Local state and mirrored server persistence
    try {
      const res = await fetch('/api/fleet/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) {
          setVehicles(json.updatedVehicles);
          savePersistedVehicles(json.updatedVehicles);
        }
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        if (json.notifications) setNotifications(json.notifications);
        if (json.accessLogs) {
          setAccessLogs(json.accessLogs);
          savePersistedAccessLogs(json.accessLogs);
        }
      }
    } catch (err) {
      const updatedV = vehicles.map(v => {
        if (v.name.trim() === data.vehicle.trim()) {
          return {
            ...v,
            status: 'UNAVAILABLE' as const,
            odometer: data.km,
            lastDriver: data.driver,
            lastDestination: `${data.visitCity} - ${data.visitLocation}`,
          };
        }
        return v;
      });
      setVehicles(updatedV);
      savePersistedVehicles(updatedV);

      const updatedTrips = [newEntry, ...recentTrips];
      setRecentTrips(updatedTrips);
      savePersistedTrips(updatedTrips);
    }
  };

  // Submit Arrival (Registrar Chegada)
  const handleArrivalSubmit = async (data: {
    vehicle: string;
    date: string;
    time: string;
    km: number;
    fuelLevel: FuelLevel;
    driver?: string;
    receiptImage?: string | null;
  }) => {
    const tripId = 'arr_' + Date.now();
    const newEntry: DriverTripEntry = {
      id: tripId,
      type: 'CHEGADA',
      vehicle: data.vehicle,
      date: data.date,
      time: data.time,
      km: data.km,
      fuelLevel: data.fuelLevel,
      driver: data.driver || 'Motorista',
      details: `Chegada NRE - Combustível: ${data.fuelLevel}`,
      timestamp: Date.now(),
    };

    // Save copy to local device audit storage for driver conference
    saveDeviceLocalAudit(newEntry);

    const targetVehicle = vehicles.find(v => v.name.trim() === data.vehicle.trim());
    const vehicleId = targetVehicle ? targetVehicle.id : data.vehicle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const vehicleUpdate = {
      id: vehicleId,
      name: data.vehicle,
      status: 'AVAILABLE' as const,
      odometer: data.km,
      fuelLevel: data.fuelLevel,
      lastArrival: `${data.date} - ${data.time}`,
      lastDriver: data.driver || targetVehicle?.lastDriver,
    };

    // 1. Write atomically to Cloud Firestore
    saveArrivalFirestore(newEntry, vehicleUpdate)
      .catch(err => console.warn('Firestore arrival write fallback:', err));

    // 2. Local state and mirrored server persistence
    try {
      const res = await fetch('/api/fleet/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) {
          setVehicles(json.updatedVehicles);
          savePersistedVehicles(json.updatedVehicles);
        }
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        if (json.notifications) setNotifications(json.notifications);
        if (json.accessLogs) {
          setAccessLogs(json.accessLogs);
          savePersistedAccessLogs(json.accessLogs);
        }
      }
    } catch (err) {
      const updatedV = vehicles.map(v => {
        if (v.name.trim() === data.vehicle.trim()) {
          return {
            ...v,
            status: 'AVAILABLE' as const,
            odometer: data.km,
            fuelLevel: data.fuelLevel,
            lastArrival: `${data.date} - ${data.time}`,
            lastDriver: data.driver || v.lastDriver,
          };
        }
        return v;
      });
      setVehicles(updatedV);
      savePersistedVehicles(updatedV);

      const updatedTrips = [newEntry, ...recentTrips];
      setRecentTrips(updatedTrips);
      savePersistedTrips(updatedTrips);
    }
  };

  // Submit Refuel (Registrar Abastecimento)
  const handleRefuelSubmit = async (data: {
    vehicle: string;
    date: string;
    time: string;
    liters: number;
    receiptImage: string | null;
    techName: string;
  }) => {
    const tripId = 'ref_' + Date.now();
    const newEntry: DriverTripEntry = {
      id: tripId,
      type: 'ABASTECIMENTO',
      vehicle: data.vehicle,
      date: data.date,
      time: data.time,
      fuelLevel: `${data.liters} Litros`,
      liters: data.liters,
      receiptImage: data.receiptImage,
      driver: data.techName,
      details: `Abastecimento de ${data.liters}L por ${data.techName}`,
      timestamp: Date.now(),
    };

    // Save copy to local device audit storage for driver conference
    saveDeviceLocalAudit(newEntry);

    const targetVehicle = vehicles.find(v => v.name.trim() === data.vehicle.trim());
    const vehicleId = targetVehicle ? targetVehicle.id : data.vehicle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const vehicleUpdate = {
      id: vehicleId,
      name: data.vehicle,
      fuelLevel: 'Cheio',
    };

    // 1. Write atomically to Cloud Firestore
    saveRefuelFirestore(newEntry, vehicleUpdate)
      .catch(err => console.warn('Firestore refuel write fallback:', err));

    // 2. Local state and mirrored server persistence
    try {
      const res = await fetch('/api/fleet/refuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) {
          setVehicles(json.updatedVehicles);
          savePersistedVehicles(json.updatedVehicles);
        }
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        if (json.notifications) setNotifications(json.notifications);
        if (json.accessLogs) {
          setAccessLogs(json.accessLogs);
          savePersistedAccessLogs(json.accessLogs);
        }
      }
    } catch (err) {
      const updatedV = vehicles.map(v => {
        if (v.name.trim() === data.vehicle.trim()) {
          return { ...v, fuelLevel: 'Cheio' };
        }
        return v;
      });
      setVehicles(updatedV);
      savePersistedVehicles(updatedV);

      const updatedTrips = [newEntry, ...recentTrips];
      setRecentTrips(updatedTrips);
      savePersistedTrips(updatedTrips);
    }
  };

  // Save Google Sheets webhook config
  const handleSaveSheetsConfig = async (config: { webhookUrl: string; spreadsheetId: string }) => {
    setSpreadsheetId(config.spreadsheetId);
    setWebhookUrl(config.webhookUrl);

    try {
      await fetch('/api/fleet/config-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.warn('Offline mode: updated config locally.');
    }
  };

  // Admin Action Handlers (Master Key: 192026)
  const ADMIN_MASTER_KEY = '192026';

  const handleUpdateVehicleAdmin = async (data: {
    vehicleName: string;
    status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE';
    odometer?: number;
    fuelLevel?: FuelLevel;
    lastDriver?: string;
    maintenanceReason?: string;
  }): Promise<boolean> => {
    const targetVehicle = vehicles.find(v => v.name.trim() === data.vehicleName.trim());
    if (targetVehicle) {
      updateVehicleFirestore(targetVehicle.id, {
        status: data.status,
        ...(data.odometer !== undefined ? { odometer: data.odometer } : {}),
        ...(data.fuelLevel ? { fuelLevel: data.fuelLevel } : {}),
        ...(data.lastDriver ? { lastDriver: data.lastDriver } : {}),
        ...(data.maintenanceReason ? { maintenanceReason: data.maintenanceReason } : {}),
      }).catch(err => console.warn('Firestore update vehicle error:', err));
    }
    try {
      const res = await fetch('/api/fleet/admin/update-vehicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY, ...data }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) setVehicles(json.updatedVehicles);
        return true;
      }
    } catch (err) {
      console.error('Error updating vehicle as admin:', err);
    }
    // Local fallback
    setVehicles(prev =>
      prev.map(v => {
        if (v.name.trim() === data.vehicleName.trim()) {
          return {
            ...v,
            status: data.status,
            odometer: data.odometer !== undefined ? data.odometer : v.odometer,
            fuelLevel: data.fuelLevel || v.fuelLevel,
            lastDriver: data.lastDriver !== undefined ? data.lastDriver : v.lastDriver,
            maintenanceReason: data.maintenanceReason !== undefined ? data.maintenanceReason : v.maintenanceReason,
          };
        }
        return v;
      })
    );
    return true;
  };

  const handleToggleMaintenanceAdmin = async (
    vehicleName: string,
    isMaintenance: boolean,
    maintenanceReason?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/toggle-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterKey: ADMIN_MASTER_KEY,
          vehicleName,
          isMaintenance,
          maintenanceReason,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) setVehicles(json.updatedVehicles);
        if (json.notifications) setNotifications(json.notifications);
        return true;
      }
    } catch (err) {
      console.error('Error toggling vehicle maintenance:', err);
    }

    // Local fallback
    setVehicles(prev =>
      prev.map(v => {
        if (v.name.trim() === vehicleName.trim()) {
          return {
            ...v,
            status: isMaintenance ? 'MAINTENANCE' : 'AVAILABLE',
            maintenanceReason: isMaintenance ? (maintenanceReason || 'Em manutenção preventiva') : undefined,
            maintenanceDate: isMaintenance ? new Date().toLocaleDateString('pt-BR') : undefined,
          };
        }
        return v;
      })
    );
    return true;
  };

  const handleReleaseAllAdmin = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/release-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) setVehicles(json.updatedVehicles);
        if (json.notifications) setNotifications(json.notifications);
        return true;
      }
    } catch (err) {
      console.error('Error releasing all vehicles:', err);
    }
    setVehicles(prev => prev.map(v => ({ ...v, status: 'AVAILABLE' })));
    return true;
  };

  const handleDeleteTripAdmin = async (tripId: string, masterKey?: string): Promise<boolean> => {
    const key = masterKey || ADMIN_MASTER_KEY;
    if (key !== ADMIN_MASTER_KEY) {
      console.warn('[Diretriz Oficial de Persistência Permanente] Exclusão rejeitada: Chave Mestre 192026 necessária.');
      return false;
    }
    // Delete from Cloud Firestore
    deleteTripFirestore(tripId, key).catch(err => console.warn('Firestore delete error:', err));
    markTripAsDeleted(tripId, key);
    try {
      const res = await fetch('/api/fleet/admin/delete-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: key, tripId }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        if (json.updatedVehicles) {
          setVehicles(json.updatedVehicles);
          savePersistedVehicles(json.updatedVehicles);
        }
        return true;
      }
    } catch (err) {
      console.error('Error deleting trip:', err);
    }
    return true;
  };

  const handleUpdateTripAdmin = async (
    tripId: string,
    updates: Partial<DriverTripEntry>,
    masterKey?: string
  ): Promise<boolean> => {
    const key = masterKey || ADMIN_MASTER_KEY;
    if (key !== ADMIN_MASTER_KEY) {
      console.warn('[Diretriz Oficial de Persistência Permanente] Correção rejeitada: Chave Mestre 192026 necessária.');
      return false;
    }

    // 1. Update in Cloud Firestore
    updateTripFirestore(tripId, updates, key).catch(err => console.warn('Firestore update error:', err));

    // 2. Update locally immediately
    setRecentTrips(prev => {
      const updated = prev.map(t => (t.id === tripId ? { ...t, ...updates } : t));
      savePersistedTrips(updated);
      return updated;
    });

    // 3. Update backend server
    try {
      const res = await fetch('/api/fleet/admin/update-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: key, tripId, updates }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        return true;
      }
    } catch (err) {
      console.error('Error updating trip:', err);
    }
    return true;
  };

  const handleClearAllHistoryAdmin = async (masterKey?: string): Promise<boolean> => {
    const key = masterKey || ADMIN_MASTER_KEY;
    if (key !== ADMIN_MASTER_KEY) {
      console.warn('[Diretriz Oficial de Persistência Permanente] Limpeza geral rejeitada: Chave Mestre 192026 necessária.');
      return false;
    }
    // Clear in Cloud Firestore
    clearAllTripsFirestore(key).catch(err => console.warn('Firestore clear error:', err));
    clearPersistedHistory(key);
    try {
      const res = await fetch('/api/fleet/admin/clear-all-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: key }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.recentTrips) {
          setRecentTrips(json.recentTrips);
          savePersistedTrips(json.recentTrips);
        }
        if (json.updatedVehicles) {
          setVehicles(json.updatedVehicles);
          savePersistedVehicles(json.updatedVehicles);
        }
        return true;
      }
    } catch (err) {
      console.error('Error clearing all history:', err);
    }
    return true;
  };

  const handleBatchMaintenanceAdmin = async (
    vehicleNames: string[],
    action: 'MAINTENANCE' | 'AVAILABLE',
    maintenanceReason?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/batch-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterKey: ADMIN_MASTER_KEY,
          vehicleNames,
          action,
          maintenanceReason,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) setVehicles(json.updatedVehicles);
        if (json.notifications) setNotifications(json.notifications);
        return true;
      }
    } catch (err) {
      console.error('Error executing batch maintenance:', err);
    }
    return false;
  };

  const handleResetOdometersAdmin = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/reset-odometers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.updatedVehicles) setVehicles(json.updatedVehicles);
        return true;
      }
    } catch (err) {
      console.error('Error resetting odometers:', err);
    }
    setVehicles(prev => prev.map(v => ({ ...v, odometer: 0 })));
    return true;
  };

  const handleClearAccessLogsAdmin = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/clear-access-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY }),
      });
      if (res.ok) {
        setAccessLogs([]);
        return true;
      }
    } catch (err) {
      console.error('Error clearing access logs:', err);
    }
    setAccessLogs([]);
    return true;
  };

  // Broadcast notification from Admin
  const handleBroadcastNotificationAdmin = async (data: {
    title: string;
    message: string;
    urgent?: boolean;
    type?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/broadcast-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY, ...data }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.notifications) setNotifications(json.notifications);
        return true;
      }
    } catch (err) {
      console.error('Error broadcasting notification:', err);
    }
    return false;
  };

  // Clear all notifications
  const handleClearAllNotificationsAdmin = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/fleet/admin/clear-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterKey: ADMIN_MASTER_KEY }),
      });
      if (res.ok) {
        setNotifications([]);
        setReadIds([]);
        return true;
      }
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
    setNotifications([]);
    return true;
  };

  // Notification UI helpers
  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    setReadIds(prev => new Set([...prev, id]));
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead(notifications.map(n => n.id));
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleTriggerTest = () => {
    const testNotif: AppNotification = {
      id: 'test_' + Date.now(),
      title: '🔔 Teste de Notificação da Frota',
      message: 'O sistema de som e alertas push do NRE Maringá está funcionando perfeitamente em seu dispositivo!',
      type: 'BROADCAST',
      timestamp: Date.now(),
      urgent: false,
    };
    setNotifications(prev => [testNotif, ...prev]);
    triggerNotificationAlert(testNotif);
  };

  const handleUpdateSettings = (newSettings: NotificationSettings) => {
    setNotificationSettings(newSettings);
    saveNotificationSettings(newSettings);
  };

  const handleDismissToast = (id: string) => {
    setToastNotifications(prev => prev.filter(t => t.id !== id));
    handleMarkAsRead(id);
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  // Trigger CSV export
  const handleExportCsv = () => {
    window.open('/api/fleet/export-csv', '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased selection:bg-[#27a3df] selection:text-white">
      {/* Toast Notification Container */}
      <NotificationToastContainer
        toasts={toastNotifications}
        onDismiss={handleDismissToast}
        onOpenCenter={() => setIsNotificationModalOpen(true)}
      />

      {/* Top Banner Header */}
      <HeaderBanner
        onOpenSheetsModal={() => setIsSheetsModalOpen(true)}
        onOpenAdminModal={() => setCurrentView('admin')}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        unreadCount={unreadCount}
        isOnline={isOnline}
        isInstalled={isInstalled}
      />

      {/* Offline Status & Cloud Sync Banner */}
      <OfflineStatusIndicator
        isOnline={isOnline}
        wasOffline={wasOffline}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isInstalled={isInstalled}
      />

      {/* Navigation Tabs Bar (Abas de Navegação Sempre Visíveis) */}
      <NavigationTabs
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        isAdminAuthenticated={isAdminAuthenticated}
      />

      {/* Main View Router */}
      <main className="container mx-auto">
        {currentView === 'home' && (
          <HomeView
            onSelectAction={(action) => setCurrentView(action)}
            onOpenAdminModal={() => setCurrentView('admin')}
            recentTrips={recentTrips}
            vehicles={vehicles}
            onDeleteTrip={handleDeleteTripAdmin}
            isAdminAuthenticated={isAdminAuthenticated}
          />
        )}

        {currentView === 'checkout' && (
          <DepartureForm
            vehicles={vehicles}
            onBack={() => setCurrentView('home')}
            onSubmit={handleDepartureSubmit}
          />
        )}

        {currentView === 'checkin' && (
          <ArrivalForm
            vehicles={vehicles}
            recentTrips={recentTrips}
            onBack={() => setCurrentView('home')}
            onSubmit={handleArrivalSubmit}
          />
        )}

        {currentView === 'refuel' && (
          <RefuelForm
            vehicles={vehicles}
            recentTrips={recentTrips}
            onBack={() => setCurrentView('home')}
            onSubmit={handleRefuelSubmit}
          />
        )}

        {currentView === 'postos' && (
          <GasStationsView
            onBack={() => setCurrentView('home')}
            onSelectRefuel={() => setCurrentView('refuel')}
          />
        )}

        {currentView === 'status' && (
          <VehicleStatusView
            vehicles={vehicles}
            onBack={() => setCurrentView('home')}
          />
        )}

        {currentView === 'trips' && (
          <DriverTripsView
            recentTrips={recentTrips}
            onBack={() => setCurrentView('home')}
            onDeleteTrip={handleDeleteTripAdmin}
            isAdminAuthenticated={isAdminAuthenticated}
          />
        )}

        {currentView === 'admin' && (
          <AdminModal
            isOpen={true}
            embedded={true}
            isAuthenticated={isAdminAuthenticated}
            onAuthenticate={setIsAdminAuthenticated}
            onClose={() => setCurrentView('home')}
            vehicles={vehicles}
            recentTrips={recentTrips}
            accessLogs={accessLogs}
            onUpdateVehicle={handleUpdateVehicleAdmin}
            onToggleMaintenance={handleToggleMaintenanceAdmin}
            onBatchMaintenance={handleBatchMaintenanceAdmin}
            onReleaseAllVehicles={handleReleaseAllAdmin}
            onResetOdometers={handleResetOdometersAdmin}
            onDeleteTrip={handleDeleteTripAdmin}
            onUpdateTrip={handleUpdateTripAdmin}
            onClearAllHistory={handleClearAllHistoryAdmin}
            onClearAccessLogs={handleClearAccessLogsAdmin}
            onBroadcastNotification={handleBroadcastNotificationAdmin}
          />
        )}
      </main>

      {/* Google Sheets Modal */}
      <SheetsSyncModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        spreadsheetId={spreadsheetId}
        webhookUrl={webhookUrl}
        onSaveConfig={handleSaveSheetsConfig}
        onExportCsv={handleExportCsv}
      />

      {/* Admin Panel Modal (Popup mode) */}
      <AdminModal
        isOpen={isAdminModalOpen}
        embedded={false}
        isAuthenticated={isAdminAuthenticated}
        onAuthenticate={setIsAdminAuthenticated}
        onClose={() => setIsAdminModalOpen(false)}
        vehicles={vehicles}
        recentTrips={recentTrips}
        accessLogs={accessLogs}
        onUpdateVehicle={handleUpdateVehicleAdmin}
        onToggleMaintenance={handleToggleMaintenanceAdmin}
        onBatchMaintenance={handleBatchMaintenanceAdmin}
        onReleaseAllVehicles={handleReleaseAllAdmin}
        onResetOdometers={handleResetOdometersAdmin}
        onDeleteTrip={handleDeleteTripAdmin}
        onUpdateTrip={handleUpdateTripAdmin}
        onClearAllHistory={handleClearAllHistoryAdmin}
        onClearAccessLogs={handleClearAccessLogsAdmin}
        onBroadcastNotification={handleBroadcastNotificationAdmin}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={notifications}
        readIds={readIds}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onClearAllNotifications={handleClearAllNotificationsAdmin}
        onTriggerTestNotification={handleTriggerTest}
        settings={notificationSettings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* PWA Install & Offline Protection Modal */}
      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        canPromptDirectly={canPromptDirectly}
        onPromptInstall={promptInstall}
        isIOS={isIOS}
        isAndroid={isAndroid}
        isWindows={isWindows}
        isInstalled={isInstalled}
      />
    </div>
  );
}

