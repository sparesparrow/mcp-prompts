// android-device-simulator.ts
// Simulated Android device for development and testing
// Provides realistic clipboard and sensor data for MCP integration

import { EventEmitter } from 'events';
import pino from 'pino';
import {
  ClipboardItem,
  ClipboardContentType,
  DeviceInfo,
  AndroidSensorData,
  LocationData,
  BatteryStats,
  NetworkStats,
  NotificationData
} from '@sparesparrow/mcp-fbs';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

export interface AndroidDeviceConfig {
  deviceId: string;
  deviceName: string;
  androidVersion: string;
  simulateClipboard: boolean;
  simulateSensors: boolean;
  simulateLocation: boolean;
  clipboardUpdateInterval: number;
  sensorUpdateInterval: number;
  locationUpdateInterval: number;
}

export class AndroidDeviceSimulator extends EventEmitter {
  private config: AndroidDeviceConfig;
  private clipboardItems: ClipboardItem[] = [];
  private deviceInfo: DeviceInfo;
  private batteryStats: BatteryStats;
  private networkStats: NetworkStats;
  private locationData: LocationData;
  private isRunning: boolean = false;

  // Simulation timers
  private clipboardTimer?: NodeJS.Timeout;
  private sensorTimer?: NodeJS.Timeout;
  private locationTimer?: NodeJS.Timeout;
  private batteryTimer?: NodeJS.Timeout;

  constructor(config: AndroidDeviceConfig) {
    super();
    this.config = config;

    // Initialize device info
    this.deviceInfo = {
      deviceId: config.deviceId,
      manufacturer: 'Google',
      model: config.deviceName,
      androidVersion: config.androidVersion,
      apiLevel: this.getApiLevel(config.androidVersion),
      screenDensity: 2.0,
      screenSizeX: 1080,
      screenSizeY: 2400,
      totalMemoryMb: 8192,
      availableMemoryMb: 6144,
      batteryLevel: 85,
      isCharging: false,
      networkType: 'wifi',
      timestamp: this.createTimestamp()
    };

    // Initialize battery stats
    this.batteryStats = {
      level: 85,
      scale: 100,
      temperature: 25,
      voltage: 4300,
      status: 'discharging',
      plugged: 'none',
      health: 'good',
      technology: 'Li-ion',
      timestamp: this.createTimestamp(),
      deviceId: config.deviceId
    };

    // Initialize network stats
    this.networkStats = {
      bytesTx: 0,
      bytesRx: 0,
      packetsTx: 0,
      packetsRx: 0,
      networkType: 'wifi',
      ssid: 'HomeNetwork',
      signalStrength: -45,
      mobileNetworkType: undefined,
      carrierName: undefined,
      timestamp: this.createTimestamp(),
      deviceId: config.deviceId
    };

    // Initialize location data
    this.locationData = {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 10,
      accuracy: 5.0,
      speed: 0,
      bearing: 0,
      provider: 'gps',
      timestamp: this.createTimestamp(),
      deviceId: config.deviceId
    };

    // Initialize with some sample clipboard items
    this.initializeSampleClipboard();
  }

  /**
   * Start the device simulation
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info(`Starting Android device simulation: ${this.config.deviceId}`);

    this.isRunning = true;

    // Start simulation timers
    if (this.config.simulateClipboard) {
      this.startClipboardSimulation();
    }

    if (this.config.simulateSensors) {
      this.startSensorSimulation();
    }

    if (this.config.simulateLocation) {
      this.startLocationSimulation();
    }

    this.startBatterySimulation();

    this.emit('started', this.deviceInfo);
  }

  /**
   * Stop the device simulation
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info(`Stopping Android device simulation: ${this.config.deviceId}`);

    this.isRunning = false;

    // Clear all timers
    if (this.clipboardTimer) {
      clearInterval(this.clipboardTimer);
      this.clipboardTimer = undefined;
    }

    if (this.sensorTimer) {
      clearInterval(this.sensorTimer);
      this.sensorTimer = undefined;
    }

    if (this.locationTimer) {
      clearInterval(this.locationTimer);
      this.locationTimer = undefined;
    }

    if (this.batteryTimer) {
      clearInterval(this.batteryTimer);
      this.batteryTimer = undefined;
    }

    this.emit('stopped', this.deviceInfo);
  }

  /**
   * Get current clipboard items
   */
  getClipboardItems(): ClipboardItem[] {
    return [...this.clipboardItems];
  }

  /**
   * Add a clipboard item
   */
  addClipboardItem(content: string, contentType: ClipboardContentType = ClipboardContentType.TEXT): void {
    const item: ClipboardItem = {
      id: this.generateUUID(),
      deviceId: this.config.deviceId,
      timestamp: this.createTimestamp(),
      contentType,
      content,
      label: `Item ${this.clipboardItems.length + 1}`,
      sourceApp: 'TestApp',
      sizeBytes: content.length,
      metadata: []
    };

    this.clipboardItems.unshift(item); // Add to beginning

    // Keep only last 50 items
    if (this.clipboardItems.length > 50) {
      this.clipboardItems = this.clipboardItems.slice(0, 50);
    }

    logger.debug(`Added clipboard item: ${content.substring(0, 50)}...`);
    this.emit('clipboard-changed', item);
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  /**
   * Get battery statistics
   */
  getBatteryStats(): BatteryStats {
    return { ...this.batteryStats };
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): NetworkStats {
    return { ...this.networkStats };
  }

  /**
   * Get location data
   */
  getLocationData(): LocationData {
    return { ...this.locationData };
  }

  /**
   * Simulate taking a screenshot (returns mock image data)
   */
  async takeScreenshot(): Promise<string> {
    // Simulate screenshot delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return base64-encoded mock image data
    const mockImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jzyr5AAAAABJRU5ErkJggg==', 'base64');
    return mockImageData.toString('base64');
  }

  /**
   * Simulate playing a sound
   */
  async playSound(soundType: string = 'notification'): Promise<void> {
    logger.info(`Playing sound: ${soundType}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * Simulate showing a toast message
   */
  async showToast(message: string): Promise<void> {
    logger.info(`Showing toast: ${message}`);
    this.emit('toast-shown', { message, timestamp: new Date() });
  }

  /**
   * Simulate launching an app
   */
  async launchApp(packageName: string): Promise<void> {
    logger.info(`Launching app: ${packageName}`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private startClipboardSimulation(): void {
    this.clipboardTimer = setInterval(() => {
      // Randomly add clipboard items
      if (Math.random() < 0.3) { // 30% chance every interval
        const sampleTexts = [
          'Hello from Android!',
          'This is a test clipboard item',
          'Random text content',
          'Code snippet: console.log("Hello World");',
          'Shopping list: milk, bread, eggs',
          'Meeting notes from standup',
          'Important: Update dependencies',
          'TODO: Fix the bug in component X'
        ];

        const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
        this.addClipboardItem(randomText);
      }
    }, this.config.clipboardUpdateInterval);
  }

  private startSensorSimulation(): void {
    this.sensorTimer = setInterval(() => {
      // Simulate accelerometer data
      const accelData: AndroidSensorData = {
        sensorType: 'accelerometer',
        sensorName: 'Accelerometer',
        timestamp: this.createTimestamp(),
        values: [
          (Math.random() - 0.5) * 2, // X: -1 to 1
          (Math.random() - 0.5) * 2, // Y: -1 to 1
          9.8 + (Math.random() - 0.5) * 0.2 // Z: around 9.8 m/s²
        ],
        accuracy: 3, // High accuracy
        deviceId: this.config.deviceId
      };

      this.emit('sensor-data', accelData);

      // Occasionally simulate other sensors
      if (Math.random() < 0.2) {
        const lightData: AndroidSensorData = {
          sensorType: 'light',
          sensorName: 'Light Sensor',
          timestamp: this.createTimestamp(),
          values: [Math.random() * 1000], // 0-1000 lux
          accuracy: 3,
          deviceId: this.config.deviceId
        };

        this.emit('sensor-data', lightData);
      }
    }, this.config.sensorUpdateInterval);
  }

  private startLocationSimulation(): void {
    this.locationTimer = setInterval(() => {
      // Simulate small location changes (walking around)
      this.locationData.latitude += (Math.random() - 0.5) * 0.001;
      this.locationData.longitude += (Math.random() - 0.5) * 0.001;
      this.locationData.accuracy = 3 + Math.random() * 2;
      this.locationData.timestamp = this.createTimestamp();

      this.emit('location-changed', { ...this.locationData });
    }, this.config.locationUpdateInterval);
  }

  private startBatterySimulation(): void {
    this.batteryTimer = setInterval(() => {
      // Slowly drain battery
      this.batteryStats.level = Math.max(0, this.batteryStats.level - 0.1);
      this.batteryStats.temperature += (Math.random() - 0.5) * 0.5;
      this.batteryStats.timestamp = this.createTimestamp();

      // Simulate charging occasionally
      if (Math.random() < 0.05 && this.batteryStats.level < 20) {
        this.batteryStats.isCharging = true;
        this.batteryStats.status = 'charging';
        this.batteryStats.plugged = 'ac';
      }

      // Stop charging when full
      if (this.batteryStats.isCharging && this.batteryStats.level >= 95) {
        this.batteryStats.isCharging = false;
        this.batteryStats.status = 'full';
        this.batteryStats.plugged = 'none';
      }

      // Update device info battery level
      this.deviceInfo.batteryLevel = Math.round(this.batteryStats.level);
      this.deviceInfo.isCharging = this.batteryStats.isCharging;

      this.emit('battery-changed', { ...this.batteryStats });
    }, 10000); // Update every 10 seconds
  }

  private initializeSampleClipboard(): void {
    const sampleItems = [
      'Welcome to Android clipboard sync!',
      'This is a sample clipboard item',
      'You can copy text, images, and more',
      'Cross-device synchronization enabled',
      'Real-time clipboard sharing'
    ];

    sampleItems.forEach((text, index) => {
      setTimeout(() => {
        this.addClipboardItem(text);
      }, index * 1000); // Stagger initial items
    });
  }

  private getApiLevel(androidVersion: string): number {
    // Simple mapping of Android versions to API levels
    const versionMap: { [key: string]: number } = {
      '8.0': 26,
      '8.1': 27,
      '9.0': 28,
      '10.0': 29,
      '11.0': 30,
      '12.0': 31,
      '12.1': 32,
      '13.0': 33,
      '14.0': 34
    };

    return versionMap[androidVersion] || 30; // Default to Android 11
  }

  private createTimestamp() {
    const now = Date.now();
    return {
      seconds: Math.floor(now / 1000),
      nanoseconds: (now % 1000) * 1000000
    };
  }

  private generateUUID(): { bytes: Uint8Array } {
    // Simple UUID generation for simulation
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return { bytes };
  }
}