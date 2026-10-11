export type FuelLevel = 'Cheio' | '3/4' | 'Meio tanque' | '1/4';

export type VehicleStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE';

export interface Vehicle {
  id: string;
  name: string; // e.g. "COBALT PYF2F11"
  model: string;
  plate: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'MAINTENANCE'; // Disponível (verde) | Em Uso (laranja/vermelho) | Manutenção (âmbar/alerta)
  lastArrival?: string | null; // e.g. "11/08/2026 - 14:30"
  fuelLevel: FuelLevel | string;
  odometer: number;
  lastDriver?: string;
  lastDestination?: string;
  lastDeparture?: string;
  lastReason?: string;
  maintenanceReason?: string;
  maintenanceDate?: string;
}

export interface DepartureRecord {
  id: string;
  vehicle: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM
  km: number;
  driver: string;
  passengers: string;
  visitCity: string;
  visitLocation: string;
  visitReason: string;
  timestamp: number;
}

export interface ArrivalRecord {
  id: string;
  vehicle: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM
  km: number;
  fuelLevel: FuelLevel;
  driver?: string;
  timestamp: number;
}

export interface RefuelRecord {
  id: string;
  vehicle: string;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM
  liters: number;
  receiptImage: string | null; // base64 or URL
  techName: string;
  driver?: string;
  timestamp: number;
}

export interface DriverTripEntry {
  id: string;
  type: 'SAÍDA' | 'CHEGADA' | 'ABASTECIMENTO';
  vehicle: string;
  date: string;
  time: string;
  km?: number | string;
  driver: string;
  passengers?: string;
  visitCity?: string;
  visitLocation?: string;
  visitReason?: string;
  fuelLevel?: string;
  liters?: number | string;
  receiptImage?: string | null;
  details?: string;
  platform?: string;
  device?: string;
  ip?: string;
  photoUrl?: string;
  driveUrl?: string;
  timestamp: number;
}

export interface ActiveSessionInfo {
  vehicle: string;
  driver: string;
  km: number;
  date: string;
  time: string;
  ip?: string;
  device?: string;
  timestamp: number;
}

export interface AccessLogEntry {
  id: string;
  timestamp: number;
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  ip: string;
  userAgent: string;
  device: string; // e.g. "Android (Chrome)", "iPhone (Safari)", "Windows", etc.
  action: string; // e.g. "Acesso ao Aplicativo", "Visualizou Frota", "Registro de Saída", "Registro de Chegada", "Abastecimento", "Login Admin", "Histórico"
  details?: string;
  driverName?: string;
  sessionDuration?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'RETURN_REMINDER' | 'MAINTENANCE_ALERT' | 'STATUS_CHANGE' | 'BROADCAST' | 'FUEL_ALERT' | 'INFO';
  timestamp: number;
  read?: boolean;
  vehicleName?: string;
  driver?: string;
  urgent?: boolean;
}

export interface NotificationSettings {
  browserPushEnabled: boolean;
  soundEnabled: boolean;
  returnReminderEnabled: boolean;
  returnReminderTime: string; // e.g. "17:30"
  maxTripHoursAlert: number; // e.g. 4 (notify if vehicle out for > 4h)
  maintenanceAlertsEnabled: boolean;
  yardReturnAlertsEnabled: boolean;
  lowFuelAlertsEnabled: boolean;
}

export interface FleetState {
  vehicles: Vehicle[];
  departures: DepartureRecord[];
  arrivals: ArrivalRecord[];
  refuels: RefuelRecord[];
  driverTrips: DriverTripEntry[];
  notifications?: AppNotification[];
  accessLogs?: AccessLogEntry[];
  spreadsheetId: string;
  webhookUrl?: string;
}

