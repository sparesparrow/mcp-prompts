// esp32-serial-reader.ts
// Serial communication handler for ESP32 devices
// Reads telemetry data and sends commands via serial port

import { SerialPort, ReadlineParser } from 'serialport';
import pino from 'pino';
import { EventEmitter } from 'events';
import {
  TelemetryMessage,
  ESP32TelemetryParser,
  ESP32TelemetryBuilder,
  SensorReading,
  BPMData,
  MemoryStats,
  WiFiStats
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

export interface ESP32Config {
  port: string;
  baudRate: number;
  deviceId: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  messageTimeout: number;
}

export interface SerialMessage {
  type: 'telemetry' | 'response' | 'error' | 'status';
  deviceId: string;
  timestamp: Date;
  data: any;
  raw?: string;
}

export class ESP32SerialReader extends EventEmitter {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private config: ESP32Config;
  private connected: boolean = false;
  private reconnectTimer?: NodeJS.Timeout;
  private messageBuffer: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  constructor(config: ESP32Config) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  /**
   * Connect to the ESP32 serial port
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      logger.info(`Connecting to ESP32 on ${this.config.port} at ${this.config.baudRate} baud`);

      this.port = new SerialPort({
        path: this.config.port,
        baudRate: this.config.baudRate,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        autoOpen: false
      });

      this.parser = new ReadlineParser({ delimiter: '\n' });

      return new Promise((resolve, reject) => {
        if (!this.port) return reject(new Error('Serial port not initialized'));

        this.port.open((error) => {
          if (error) {
            logger.error('Failed to open serial port:', error);
            reject(error);
            return;
          }

          this.port!.pipe(this.parser!);
          this.connected = true;
          logger.info('ESP32 serial connection established');

          // Send initial handshake
          this.sendHandshake();

          resolve();
        });
      });

    } catch (error) {
      logger.error('ESP32 serial connection failed:', error);
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
      throw error;
    }
  }

  /**
   * Disconnect from the ESP32
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.port && this.connected) {
      return new Promise((resolve) => {
        this.port!.close((error) => {
          this.connected = false;
          this.port = null;
          this.parser = null;

          if (error) {
            logger.warn('Error closing serial port:', error);
          } else {
            logger.info('ESP32 serial connection closed');
          }

          resolve();
        });
      });
    }
  }

  /**
   * Check if connected to ESP32
   */
  isConnected(): boolean {
    return this.connected && this.port !== null && this.port.isOpen;
  }

  /**
   * Send a command to the ESP32
   */
  async sendCommand(command: string, parameters: Record<string, any> = {}): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to ESP32');
    }

    const messageId = this.generateMessageId();
    const commandMessage = {
      id: messageId,
      type: 'command',
      command,
      parameters,
      timestamp: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.messageBuffer.delete(messageId);
        reject(new Error(`Command timeout: ${command}`));
      }, this.config.messageTimeout);

      // Store promise handlers
      this.messageBuffer.set(messageId, { resolve, reject, timeout });

      // Send command
      const message = JSON.stringify(commandMessage) + '\n';
      this.port!.write(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.messageBuffer.delete(messageId);
          reject(error);
        } else {
          logger.debug(`Sent command to ESP32: ${command}`, parameters);
        }
      });
    });
  }

  /**
   * Request telemetry data from ESP32
   */
  async requestTelemetry(sensorTypes?: string[]): Promise<TelemetryMessage[]> {
    const response = await this.sendCommand('get_telemetry', { sensors: sensorTypes });
    return this.parseTelemetryResponse(response);
  }

  /**
   * Send configuration to ESP32
   */
  async sendConfiguration(config: Record<string, any>): Promise<any> {
    return await this.sendCommand('set_config', config);
  }

  /**
   * Reset the ESP32 device
   */
  async resetDevice(): Promise<any> {
    return await this.sendCommand('reset');
  }

  /**
   * Calibrate ESP32 sensors
   */
  async calibrateSensors(sensorIds?: string[]): Promise<any> {
    return await this.sendCommand('calibrate', { sensors: sensorIds });
  }

  /**
   * Get ESP32 system status
   */
  async getSystemStatus(): Promise<any> {
    return await this.sendCommand('get_status');
  }

  private setupEventHandlers(): void {
    // Handle incoming data
    this.on('data', (message: SerialMessage) => {
      this.handleIncomingMessage(message);
    });

    // Handle connection events
    this.on('connected', () => {
      logger.info('ESP32 connection established');
      this.connected = true;
    });

    this.on('disconnected', () => {
      logger.warn('ESP32 connection lost');
      this.connected = false;
      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.on('error', (error) => {
      logger.error('ESP32 serial error:', error);
    });
  }

  private handleIncomingMessage(message: SerialMessage): void {
    logger.debug('Received message from ESP32:', message.type);

    switch (message.type) {
      case 'telemetry':
        this.handleTelemetryMessage(message);
        break;
      case 'response':
        this.handleCommandResponse(message);
        break;
      case 'error':
        this.handleErrorMessage(message);
        break;
      case 'status':
        this.handleStatusMessage(message);
        break;
      default:
        logger.warn('Unknown message type:', message.type);
    }
  }

  private handleTelemetryMessage(message: SerialMessage): void {
    try {
      const telemetry = this.parseTelemetryData(message.data);

      // Emit telemetry event for MCP server
      this.emit('telemetry', {
        deviceId: this.config.deviceId,
        telemetry,
        timestamp: message.timestamp
      });

      logger.debug(`Processed telemetry: ${telemetry.length} readings`);
    } catch (error) {
      logger.error('Failed to parse telemetry:', error);
    }
  }

  private handleCommandResponse(message: SerialMessage): void {
    const pending = this.messageBuffer.get(message.data.id);
    if (pending) {
      this.messageBuffer.delete(message.data.id);
      clearTimeout(pending.timeout);
      pending.resolve(message.data.result);
    }
  }

  private handleErrorMessage(message: SerialMessage): void {
    logger.error('ESP32 error:', message.data);

    // Check if this is a response to a pending command
    if (message.data.id) {
      const pending = this.messageBuffer.get(message.data.id);
      if (pending) {
        this.messageBuffer.delete(message.data.id);
        clearTimeout(pending.timeout);
        pending.reject(new Error(message.data.message || 'ESP32 error'));
      }
    }

    this.emit('error', message.data);
  }

  private handleStatusMessage(message: SerialMessage): void {
    logger.debug('ESP32 status:', message.data);
    this.emit('status', message.data);
  }

  private parseTelemetryData(data: any): TelemetryMessage[] {
    // ESP32 sends telemetry as JSON objects
    // Convert to FlatBuffers TelemetryMessage format
    const messages: TelemetryMessage[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        const message = this.convertToTelemetryMessage(item);
        if (message) messages.push(message);
      }
    } else {
      const message = this.convertToTelemetryMessage(data);
      if (message) messages.push(message);
    }

    return messages;
  }

  private convertToTelemetryMessage(data: any): TelemetryMessage | null {
    try {
      // Convert ESP32 JSON format to TelemetryMessage
      // This would use the FlatBuffers builder in a real implementation
      const builder = new ESP32TelemetryBuilder();

      // Create appropriate telemetry type based on sensor type
      let telemetryData: any = null;

      switch (data.sensor_type) {
        case 'bpm':
          telemetryData = {
            bpm: data.bpm,
            confidence: data.confidence || 1.0,
            rawSamples: new Int16Array(data.raw_samples || []),
            qualityScore: data.quality_score || 0.0,
            timestamp: { seconds: Math.floor(data.timestamp / 1000), nanoseconds: (data.timestamp % 1000) * 1000000 },
            sensorMetadata: []
          };
          break;

        case 'temperature':
        case 'humidity':
        case 'pressure':
          // Generic sensor reading
          telemetryData = {
            sensorId: data.sensor_id || data.sensor_type,
            timestamp: { seconds: Math.floor(data.timestamp / 1000), nanoseconds: (data.timestamp % 1000) * 1000000 },
            value: data.value,
            unit: data.unit,
            confidence: data.confidence || 1.0,
            metadata: []
          };
          break;

        case 'memory':
          telemetryData = {
            heapFree: data.heap_free,
            heapTotal: data.heap_total,
            heapMinFree: data.heap_min_free,
            timestamp: { seconds: Math.floor(data.timestamp / 1000), nanoseconds: (data.timestamp % 1000) * 1000000 }
          };
          break;

        case 'wifi':
          telemetryData = {
            connected: data.connected,
            ssid: data.ssid,
            rssi: data.rssi,
            ipAddress: data.ip_address,
            timestamp: { seconds: Math.floor(data.timestamp / 1000), nanoseconds: (data.timestamp % 1000) * 1000000 }
          };
          break;

        default:
          // Generic sensor reading for unknown types
          telemetryData = {
            sensorId: data.sensor_id || data.sensor_type,
            timestamp: { seconds: Math.floor(data.timestamp / 1000), nanoseconds: (data.timestamp % 1000) * 1000000 },
            value: data.value,
            unit: data.unit,
            confidence: data.confidence || 1.0,
            metadata: []
          };
      }

      // In a real implementation, this would build the FlatBuffer
      // For now, return a mock TelemetryMessage
      return {
        deviceId: this.config.deviceId,
        firmwareVersion: '1.0.0',
        messageId: { bytes: new Uint8Array(16) }, // Mock UUID
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        sequenceNumber: 1,
        payloadType: data.sensor_type,
        payload: telemetryData,
        crc32: 0
      };

    } catch (error) {
      logger.error('Failed to convert telemetry data:', error);
      return null;
    }
  }

  private parseTelemetryResponse(response: any): TelemetryMessage[] {
    // Parse command response containing telemetry data
    if (response && response.telemetry) {
      return this.parseTelemetryData(response.telemetry);
    }
    return [];
  }

  private sendHandshake(): void {
    if (this.isConnected()) {
      const handshake = {
        type: 'handshake',
        device_id: this.config.deviceId,
        timestamp: new Date().toISOString()
      };

      const message = JSON.stringify(handshake) + '\n';
      this.port!.write(message);
      logger.debug('Sent handshake to ESP32');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    logger.info(`Scheduling ESP32 reconnect in ${this.config.reconnectInterval}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnect failed:', error);
        this.scheduleReconnect(); // Try again
      }
    }, this.config.reconnectInterval);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.disconnect();

    // Clear any pending message timeouts
    for (const [id, pending] of this.messageBuffer) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.messageBuffer.clear();
  }
}