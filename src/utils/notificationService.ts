import { AppNotification, NotificationSettings, Vehicle, DriverTripEntry } from '../types';

const SETTINGS_KEY = 'frota_nre_notification_settings_v1';
const READ_NOTIFS_KEY = 'frota_nre_read_notifications_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  browserPushEnabled: true,
  soundEnabled: true,
  returnReminderEnabled: true,
  returnReminderTime: '17:30',
  maxTripHoursAlert: 4,
  maintenanceAlertsEnabled: true,
  yardReturnAlertsEnabled: true,
  lowFuelAlertsEnabled: true,
};

// Load saved user settings
export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error loading notification settings:', err);
  }
  return DEFAULT_NOTIFICATION_SETTINGS;
}

// Save user settings
export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving notification settings:', err);
  }
}

// Get set of read notification IDs
export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_NOTIFS_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch (err) {
    console.error('Error loading read notifications:', err);
  }
  return new Set();
}

// Mark single notification as read
export function markNotificationAsRead(id: string): void {
  try {
    const current = getReadNotificationIds();
    current.add(id);
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.error('Error saving read notification:', err);
  }
}

// Mark multiple notifications as read
export function markAllNotificationsAsRead(ids: string[]): void {
  try {
    const current = getReadNotificationIds();
    ids.forEach(id => current.add(id));
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.error('Error saving read notifications:', err);
  }
}

// Clear all read notification records
export function clearAllReadNotificationIds(): void {
  try {
    localStorage.removeItem(READ_NOTIFS_KEY);
  } catch (err) {
    console.error('Error clearing read notifications:', err);
  }
}

// Play pleasant synthesized chime with Web Audio API
let audioCtx: AudioContext | null = null;

export function playNotificationSound(urgent?: boolean): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;

    if (urgent) {
      // Urgent double tone chime
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.26);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.15); // A5
      gain2.gain.setValueAtTime(0, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0.28, now + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.52);
    } else {
      // Standard pleasant bell chime
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0, now + 0.12);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.6);
    }
  } catch (e) {
    console.warn('Notification audio suppressed or unavailable:', e);
  }
}

// Request Browser Web Notification Permission
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Show Native Browser Push Notification
export function triggerBrowserPushNotification(title: string, body: string, urgent?: boolean): boolean {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notif = new Notification(title, {
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: 'frota-nre-' + Date.now(),
      requireInteraction: !!urgent,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('Native notification failed:', err);
    return false;
  }
}

// Evaluate fleet return reminders and overdue checks
export function checkOverdueTrips(
  vehicles: Vehicle[],
  recentTrips: DriverTripEntry[],
  settings: NotificationSettings
): AppNotification[] {
  if (!settings.returnReminderEnabled) return [];

  const alerts: AppNotification[] = [];
  const now = new Date();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentMinutesOfDay = currentHours * 60 + currentMinutes;

  // Parse configured return hour (e.g. "17:30")
  const [targetH, targetM] = (settings.returnReminderTime || '17:30').split(':').map(Number);
  const targetMinutesOfDay = (targetH || 17) * 60 + (targetM || 30);

  // Check end of day deadline
  const inUseVehicles = vehicles.filter(v => v.status === 'UNAVAILABLE');

  if (inUseVehicles.length > 0 && currentMinutesOfDay >= targetMinutesOfDay && currentMinutesOfDay <= targetMinutesOfDay + 60) {
    alerts.push({
      id: `deadline_${now.toISOString().slice(0, 10)}_${settings.returnReminderTime}`,
      title: '⏰ Horário de Devolução da Frota',
      message: `Atenção: Horário limite (${settings.returnReminderTime}) atingido. Há ${inUseVehicles.length} veículo(s) em trânsito com pendência de retorno ao pátio do NRE.`,
      type: 'RETURN_REMINDER',
      timestamp: Date.now(),
      urgent: true,
    });
  }

  // Check for individual trips exceeding maxTripHoursAlert (e.g. 4 hours)
  const maxHours = settings.maxTripHoursAlert || 4;
  const maxMs = maxHours * 60 * 60 * 1000;

  inUseVehicles.forEach(veh => {
    // Find most recent departure trip for this vehicle
    const departure = recentTrips.find(t => t.vehicle === veh.name && t.type === 'SAÍDA');
    if (departure && departure.timestamp) {
      const elapsed = Date.now() - departure.timestamp;
      if (elapsed > maxMs) {
        const elapsedHours = Math.floor(elapsed / (1000 * 60 * 60));
        alerts.push({
          id: `trip_overdue_${veh.name}_${departure.timestamp}`,
          title: `⏳ Veículo em Uso Há Mais de ${maxHours}h`,
          message: `O veículo ${veh.name} (Motorista: ${departure.driver || 'Condutor'}) está em trânsito há mais de ${elapsedHours} horas.`,
          type: 'RETURN_REMINDER',
          vehicleName: veh.name,
          driver: departure.driver,
          timestamp: Date.now(),
          urgent: false,
        });
      }
    }
  });

  return alerts;
}
