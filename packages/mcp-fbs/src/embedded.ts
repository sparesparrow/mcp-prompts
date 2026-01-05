// embedded.ts
// TypeScript interfaces and builders for embedded systems FlatBuffers schemas
// Provides type-safe access to ESP32 telemetry and Android integration data

import { flatbuffers } from 'flatbuffers';
import { Timestamp, UUID, KeyValue } from './types.js';

// ============================================================================
// ESP32 Telemetry Types
// ============================================================================

export interface SensorReading {
  sensorId: string;
  timestamp: Timestamp;
  value: number;
  unit: string;
  confidence: number;
  metadata: KeyValue[];
}

export interface BPMData {
  bpm: number;
  confidence: number;
  rawSamples: Int16Array;
  qualityScore: number;
  timestamp: Timestamp;
  sensorMetadata: KeyValue[];
}

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: Timestamp;
  scale: string;
  resolution: number;
}

export interface EnvironmentalData {
  temperature?: number;
  humidity?: number;
  pressure?: number;
  altitude?: number;
  gasResistance?: number;
  iaqScore?: number;
  timestamp: Timestamp;
}

export interface MemoryStats {
  heapFree: number;
  heapTotal: number;
  heapMinFree?: number;
  psramFree?: number;
  psramTotal?: number;
  largestFreeBlock?: number;
  timestamp: Timestamp;
}

export interface WiFiStats {
  connected: boolean;
  ssid?: string;
  bssid?: string;
  rssi?: number;
  channel?: number;
  ipAddress?: string;
  gateway?: string;
  subnetMask?: string;
  dnsServer?: string;
  txBytes?: number;
  rxBytes?: number;
  timestamp: Timestamp;
}

export interface TaskInfo {
  name: string;
  state: string;
  priority: number;
  stackHighWaterMark?: number;
  runtimeCounter?: number;
  coreId?: number;
  timestamp: Timestamp;
}

export interface PowerStats {
  voltage?: number;
  current?: number;
  chargeLevel?: number;
  isCharging?: boolean;
  temperature?: number;
  cycles?: number;
  timestamp: Timestamp;
}

export interface PerformanceStats {
  cpuUsageCore0?: number;
  cpuUsageCore1?: number;
  freeHeapDropRate?: number;
  wifiReconnectCount?: number;
  taskSwitches?: number;
  interruptCount?: number;
  timestamp: Timestamp;
}

// ============================================================================
// Android Integration Types
// ============================================================================

export enum ClipboardContentType {
  TEXT = 0,
  HTML = 1,
  URI = 2,
  INTENT = 3,
  IMAGE = 4,
  FILE = 5,
  MULTIPLE = 6
}

export interface ClipboardItem {
  id: UUID;
  deviceId: string;
  timestamp: Timestamp;
  contentType: ClipboardContentType;
  mimeType?: string;
  content: string;
  label?: string;
  sourceApp?: string;
  sizeBytes?: number;
  expiresAt?: Timestamp;
  metadata: KeyValue[];
}

export interface ClipboardSync {
  syncId: UUID;
  deviceId: string;
  timestamp: Timestamp;
  items: ClipboardItem[];
  operation: string;
  lastSyncTimestamp?: Timestamp;
  compressionUsed: boolean;
}

export interface DeviceInfo {
  deviceId: string;
  manufacturer?: string;
  model?: string;
  androidVersion?: string;
  apiLevel?: number;
  screenDensity?: number;
  screenSizeX?: number;
  screenSizeY?: number;
  totalMemoryMb?: number;
  availableMemoryMb?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  networkType?: string;
  timestamp: Timestamp;
}

export interface AndroidSensorData {
  sensorType: string;
  sensorName?: string;
  timestamp: Timestamp;
  values: Float32Array;
  accuracy?: number;
  deviceId: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  bearing?: number;
  provider?: string;
  timestamp: Timestamp;
  deviceId: string;
}

export interface AppInfo {
  packageName: string;
  appName?: string;
  versionName?: string;
  versionCode?: number;
  isSystemApp?: boolean;
  isEnabled?: boolean;
  installTime?: Timestamp;
  lastUpdateTime?: Timestamp;
  permissions: string[];
  deviceId: string;
}

export interface BatteryStats {
  level: number;
  scale?: number;
  temperature?: number;
  voltage?: number;
  status?: string;
  plugged?: string;
  health?: string;
  technology?: string;
  timestamp: Timestamp;
  deviceId: string;
}

export interface NetworkStats {
  bytesTx?: number;
  bytesRx?: number;
  packetsTx?: number;
  packetsRx?: number;
  networkType?: string;
  ssid?: string;
  signalStrength?: number;
  mobileNetworkType?: string;
  carrierName?: string;
  timestamp: Timestamp;
  deviceId: string;
}

export interface NotificationData {
  id: string;
  packageName: string;
  title?: string;
  text?: string;
  timestamp: Timestamp;
  priority?: number;
  category?: string;
  isOngoing?: boolean;
  deviceId: string;
}

export interface SystemEvent {
  eventType: string;
  timestamp: Timestamp;
  details: KeyValue[];
  deviceId: string;
}

// ============================================================================
// Common Embedded Types
// ============================================================================

export enum DeviceType {
  ESP32 = 0,
  ESP8266 = 1,
  RASPBERRY_PI = 2,
  ARDUINO = 3,
  ANDROID_PHONE = 4,
  ANDROID_TABLET = 5,
  IOS_PHONE = 6,
  IOS_TABLET = 7,
  GENERIC_EMBEDDED = 8,
  GENERIC_MOBILE = 9
}

export interface DeviceCapabilities {
  hasWifi: boolean;
  hasBluetooth: boolean;
  hasGps: boolean;
  hasAccelerometer: boolean;
  hasGyroscope: boolean;
  hasMagnetometer: boolean;
  hasTemperature: boolean;
  hasHumidity: boolean;
  hasPressure: boolean;
  hasLightSensor: boolean;
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasSpeaker: boolean;
  hasDisplay: boolean;
  hasBattery: boolean;
  supportsOta: boolean;
  supportsEncryption: boolean;
  maxMessageSize: number;
}

export interface DeviceProfile {
  deviceId: string;
  deviceType: DeviceType;
  firmwareVersion: string;
  hardwareVersion?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  capabilities: DeviceCapabilities;
  registrationTimestamp: Timestamp;
  lastSeen?: Timestamp;
  status: string;
  metadata: KeyValue[];
}

export interface TelemetryReading {
  sensorId: string;
  sensorType: string;
  timestamp: Timestamp;
  value: any; // Union type handled by implementation
  unit?: string;
  confidence: number;
  accuracy?: number;
  rawData?: Uint8Array;
  metadata: KeyValue[];
}

export interface TelemetryBatch {
  deviceId: string;
  batchId: UUID;
  startTimestamp: Timestamp;
  endTimestamp: Timestamp;
  readings: TelemetryReading[];
  compressionUsed: boolean;
  compressionMethod?: string;
  batchMetadata: KeyValue[];
}

// ============================================================================
// Builder Classes for Creating FlatBuffers
// ============================================================================

export class ESP32TelemetryBuilder {
  private builder: flatbuffers.Builder;

  constructor() {
    this.builder = new flatbuffers.Builder(1024);
  }

  createSensorReading(reading: SensorReading): number {
    // Implementation would create FlatBuffer for SensorReading
    // This is a placeholder - actual implementation would use generated code
    return 0;
  }

  createBPMData(bpmData: BPMData): number {
    // Implementation would create FlatBuffer for BPMData
    return 0;
  }

  finish(): Uint8Array {
    this.builder.finish();
    return this.builder.asUint8Array();
  }
}

export class AndroidIntegrationBuilder {
  private builder: flatbuffers.Builder;

  constructor() {
    this.builder = new flatbuffers.Builder(1024);
  }

  createClipboardItem(item: ClipboardItem): number {
    // Implementation would create FlatBuffer for ClipboardItem
    return 0;
  }

  createDeviceInfo(info: DeviceInfo): number {
    // Implementation would create FlatBuffer for DeviceInfo
    return 0;
  }

  finish(): Uint8Array {
    this.builder.finish();
    return this.builder.asUint8Array();
  }
}

export class EmbeddedCommonBuilder {
  private builder: flatbuffers.Builder;

  constructor() {
    this.builder = new flatbuffers.Builder(1024);
  }

  createDeviceProfile(profile: DeviceProfile): number {
    // Implementation would create FlatBuffer for DeviceProfile
    return 0;
  }

  createTelemetryReading(reading: TelemetryReading): number {
    // Implementation would create FlatBuffer for TelemetryReading
    return 0;
  }

  finish(): Uint8Array {
    this.builder.finish();
    return this.builder.asUint8Array();
  }
}

// ============================================================================
// Parser Classes for Reading FlatBuffers
// ============================================================================

export class ESP32TelemetryParser {
  static parseSensorReading(buffer: Uint8Array): SensorReading | null {
    // Implementation would parse FlatBuffer into SensorReading
    // This is a placeholder - actual implementation would use generated code
    return null;
  }

  static parseBPMData(buffer: Uint8Array): BPMData | null {
    // Implementation would parse FlatBuffer into BPMData
    return null;
  }
}

export class AndroidIntegrationParser {
  static parseClipboardItem(buffer: Uint8Array): ClipboardItem | null {
    // Implementation would parse FlatBuffer into ClipboardItem
    return null;
  }

  static parseDeviceInfo(buffer: Uint8Array): DeviceInfo | null {
    // Implementation would parse FlatBuffer into DeviceInfo
    return null;
  }
}

export class EmbeddedCommonParser {
  static parseDeviceProfile(buffer: Uint8Array): DeviceProfile | null {
    // Implementation would parse FlatBuffer into DeviceProfile
    return null;
  }

  static parseTelemetryReading(buffer: Uint8Array): TelemetryReading | null {
    // Implementation would parse FlatBuffer into TelemetryReading
    return null;
  }
}