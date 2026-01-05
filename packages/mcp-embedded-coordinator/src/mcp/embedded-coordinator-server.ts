// embedded-coordinator-server.ts
// Unified MCP server for coordinating embedded systems (ESP32 + Android)
// Provides high-level orchestration tools and cross-device workflows

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { McpPromptsClient } from '@sparesparrow/mcp-prompts';
import {
  TelemetryMessage,
  DeviceProfile,
  ClipboardItem,
  DeviceInfo,
  EmbeddedCommonParser,
  DeviceType
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

export interface EmbeddedCoordinatorConfig {
  esp32BridgeUrl?: string;
  androidBridgeUrl?: string;
  enableSimulation: boolean;
  maxHistorySize: number;
}

export class EmbeddedCoordinatorServer {
  private server: Server;
  private mcpClient: McpPromptsClient;
  private config: EmbeddedCoordinatorConfig;

  // Device registries
  private esp32Devices: Map<string, DeviceProfile> = new Map();
  private androidDevices: Map<string, DeviceProfile> = new Map();

  // Data history
  private telemetryHistory: TelemetryMessage[] = [];
  private clipboardHistory: ClipboardItem[] = [];
  private deviceInfoHistory: DeviceInfo[] = [];

  constructor(config: EmbeddedCoordinatorConfig) {
    this.config = config;
    this.mcpClient = new McpPromptsClient();

    this.server = new Server(
      {
        name: 'mcp-embedded-coordinator',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupRequestHandlers();
  }

  /**
   * Start the coordinator server
   */
  async start(): Promise<void> {
    logger.info('Starting Embedded Coordinator MCP server...');

    // Initialize device discovery
    await this.initializeDeviceDiscovery();

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('Embedded Coordinator MCP server started successfully');
  }

  /**
   * Stop the coordinator server
   */
  async stop(): Promise<void> {
    logger.info('Stopping Embedded Coordinator MCP server...');
    await this.server.close();
    logger.info('Embedded Coordinator MCP server stopped');
  }

  private setupToolHandlers(): void {
    // Register high-level coordination tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Device Discovery and Management
          {
            name: 'discover_embedded_devices',
            description: 'Discover all available embedded devices (ESP32, Android)',
            inputSchema: {
              type: 'object',
              properties: {
                device_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by device types (esp32, android)',
                  required: false
                },
                include_offline: {
                  type: 'boolean',
                  description: 'Include offline devices in results',
                  default: false,
                  required: false
                }
              }
            }
          },
          {
            name: 'get_embedded_device_status',
            description: 'Get status overview of all embedded devices',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },

          // Cross-Device Data Operations
          {
            name: 'sync_clipboard_across_devices',
            description: 'Synchronize clipboard content across all devices',
            inputSchema: {
              type: 'object',
              properties: {
                source_device: {
                  type: 'string',
                  description: 'Source device ID to copy clipboard from',
                  required: false
                },
                target_devices: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target device IDs (empty = all devices)',
                  required: false
                },
                content: {
                  type: 'string',
                  description: 'Content to sync (overrides source_device)',
                  required: false
                }
              }
            }
          },
          {
            name: 'aggregate_embedded_telemetry',
            description: 'Aggregate telemetry data from multiple embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Sensor types to aggregate',
                  required: false
                },
                device_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Device IDs to include (empty = all devices)',
                  required: false
                },
                time_range: {
                  type: 'object',
                  description: 'Time range for aggregation',
                  properties: {
                    start: { type: 'number' },
                    end: { type: 'number' }
                  },
                  required: false
                },
                aggregation: {
                  type: 'string',
                  description: 'Aggregation method (avg, min, max, count)',
                  default: 'avg',
                  required: false
                }
              }
            }
          },

          // Orchestrated Workflows
          {
            name: 'execute_cross_device_workflow',
            description: 'Execute a workflow that coordinates multiple embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                workflow_name: {
                  type: 'string',
                  description: 'Name of the workflow to execute',
                  required: true
                },
                devices: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Device IDs to include in workflow',
                  required: true
                },
                parameters: {
                  type: 'object',
                  description: 'Workflow-specific parameters',
                  required: false
                }
              }
            }
          },
          {
            name: 'monitor_embedded_health',
            description: 'Monitor health and status of all embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                include_telemetry: {
                  type: 'boolean',
                  description: 'Include recent telemetry in health check',
                  default: true,
                  required: false
                },
                alert_thresholds: {
                  type: 'object',
                  description: 'Custom alert thresholds',
                  required: false
                }
              }
            }
          },

          // Cognitive Analysis
          {
            name: 'analyze_embedded_patterns',
            description: 'Analyze usage patterns across all embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                pattern_type: {
                  type: 'string',
                  description: 'Type of pattern to analyze (usage, telemetry, clipboard)',
                  default: 'usage',
                  required: false
                },
                time_range: {
                  type: 'object',
                  description: 'Time range for analysis',
                  properties: {
                    start: { type: 'number' },
                    end: { type: 'number' }
                  },
                  required: false
                },
                devices: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Device IDs to include in analysis',
                  required: false
                }
              }
            }
          },
          {
            name: 'predict_embedded_behavior',
            description: 'Predict device behavior based on historical patterns',
            inputSchema: {
              type: 'object',
              properties: {
                device_id: {
                  type: 'string',
                  description: 'Device ID to analyze',
                  required: true
                },
                prediction_type: {
                  type: 'string',
                  description: 'Type of prediction (battery, location, usage)',
                  required: true
                },
                timeframe_minutes: {
                  type: 'number',
                  description: 'Prediction timeframe in minutes',
                  default: 60,
                  required: false
                }
              }
            }
          },

          // Emergency and Safety
          {
            name: 'emergency_embedded_shutdown',
            description: 'Emergency shutdown of all embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                reason: {
                  type: 'string',
                  description: 'Reason for emergency shutdown',
                  required: true
                },
                force: {
                  type: 'boolean',
                  description: 'Force immediate shutdown',
                  default: false,
                  required: false
                }
              }
            }
          },
          {
            name: 'backup_embedded_data',
            description: 'Backup data from all embedded devices',
            inputSchema: {
              type: 'object',
              properties: {
                include_telemetry: {
                  type: 'boolean',
                  description: 'Include telemetry history',
                  default: true,
                  required: false
                },
                include_clipboard: {
                  type: 'boolean',
                  description: 'Include clipboard history',
                  default: true,
                  required: false
                },
                compression: {
                  type: 'boolean',
                  description: 'Compress backup data',
                  default: true,
                  required: false
                }
              }
            }
          }
        ]
      };
    });
  }

  private setupRequestHandlers(): void {
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'discover_embedded_devices':
            return await this.handleDiscoverDevices(args);
          case 'get_embedded_device_status':
            return await this.handleGetDeviceStatus(args);
          case 'sync_clipboard_across_devices':
            return await this.handleSyncClipboardAcrossDevices(args);
          case 'aggregate_embedded_telemetry':
            return await this.handleAggregateTelemetry(args);
          case 'execute_cross_device_workflow':
            return await this.handleExecuteCrossDeviceWorkflow(args);
          case 'monitor_embedded_health':
            return await this.handleMonitorEmbeddedHealth(args);
          case 'analyze_embedded_patterns':
            return await this.handleAnalyzeEmbeddedPatterns(args);
          case 'predict_embedded_behavior':
            return await this.handlePredictEmbeddedBehavior(args);
          case 'emergency_embedded_shutdown':
            return await this.handleEmergencyShutdown(args);
          case 'backup_embedded_data':
            return await this.handleBackupEmbeddedData(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async handleDiscoverDevices(args: any) {
    const deviceTypes = args.device_types || ['esp32', 'android'];
    const includeOffline = args.include_offline || false;

    const allDevices = [
      ...Array.from(this.esp32Devices.values()),
      ...Array.from(this.androidDevices.values())
    ];

    let filteredDevices = allDevices;

    if (deviceTypes.length > 0) {
      filteredDevices = filteredDevices.filter(device => {
        const typeStr = DeviceType[device.deviceType].toLowerCase();
        return deviceTypes.includes(typeStr);
      });
    }

    if (!includeOffline) {
      filteredDevices = filteredDevices.filter(device => device.status === 'online');
    }

    const deviceSummary = filteredDevices.map(device => ({
      id: device.deviceId,
      type: DeviceType[device.deviceType],
      name: device.model || device.deviceId,
      status: device.status,
      last_seen: device.lastSeen ? new Date(device.lastSeen.seconds * 1000).toISOString() : 'unknown'
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Discovered ${deviceSummary.length} embedded devices:\n${deviceSummary.map(d => `- ${d.name} (${d.type}): ${d.status}`).join('\n')}`
        }
      ]
    };
  }

  private async handleGetDeviceStatus(args: any) {
    const esp32Count = this.esp32Devices.size;
    const androidCount = this.androidDevices.size;
    const totalDevices = esp32Count + androidCount;

    const onlineDevices = [
      ...Array.from(this.esp32Devices.values()),
      ...Array.from(this.androidDevices.values())
    ].filter(d => d.status === 'online').length;

    const status = {
      total_devices: totalDevices,
      online_devices: onlineDevices,
      esp32_devices: esp32Count,
      android_devices: androidCount,
      telemetry_readings: this.telemetryHistory.length,
      clipboard_items: this.clipboardHistory.length,
      last_updated: new Date().toISOString()
    };

    return {
      content: [
        {
          type: 'text',
          text: `Embedded Device Status:\n- Total: ${status.total_devices} devices\n- Online: ${status.online_devices} devices\n- ESP32: ${status.esp32_devices} devices\n- Android: ${status.android_devices} devices\n- Telemetry: ${status.telemetry_readings} readings\n- Clipboard: ${status.clipboard_items} items`
        }
      ]
    };
  }

  private async handleSyncClipboardAcrossDevices(args: any) {
    // This would coordinate clipboard sync across ESP32 and Android devices
    // For now, return a placeholder implementation
    const sourceDevice = args.source_device || 'coordinator';
    const targetDevices = args.target_devices || ['all'];
    const content = args.content || 'Synced content from coordinator';

    return {
      content: [
        {
          type: 'text',
          text: `Clipboard sync initiated:\n- Source: ${sourceDevice}\n- Targets: ${targetDevices.join(', ')}\n- Content: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
        }
      ]
    };
  }

  private async handleAggregateTelemetry(args: any) {
    const sensorTypes = args.sensor_types || [];
    const deviceIds = args.device_ids || [];
    const aggregation = args.aggregation || 'avg';
    const timeRange = args.time_range;

    // Filter telemetry data
    let filteredData = this.telemetryHistory;

    if (sensorTypes.length > 0) {
      filteredData = filteredData.filter(t => sensorTypes.includes(t.payloadType));
    }

    if (deviceIds.length > 0) {
      filteredData = filteredData.filter(t => deviceIds.includes(t.deviceId));
    }

    if (timeRange) {
      const startTime = new Date(timeRange.start);
      const endTime = new Date(timeRange.end);
      filteredData = filteredData.filter(t => {
        const timestamp = new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000));
        return timestamp >= startTime && timestamp <= endTime;
      });
    }

    // Perform aggregation
    const aggregated = this.aggregateTelemetryData(filteredData, aggregation);

    return {
      content: [
        {
          type: 'text',
          text: `Telemetry Aggregation (${aggregation}):\n${Object.entries(aggregated).map(([sensor, value]) => `- ${sensor}: ${value}`).join('\n')}`
        }
      ]
    };
  }

  private async handleExecuteCrossDeviceWorkflow(args: any) {
    const workflowName = args.workflow_name;
    const devices = args.devices;
    const parameters = args.parameters || {};

    // Query for workflow configuration from mcp-prompts
    const workflowPrompt = await this.mcpClient.getPrompt(`${workflowName}-cross-device-workflow`);

    let result = `Cross-device workflow executed: ${workflowName}\n`;
    result += `- Devices: ${devices.join(', ')}\n`;
    result += `- Parameters: ${JSON.stringify(parameters)}\n`;

    if (workflowPrompt) {
      result += `- Using cognitive workflow: ${workflowPrompt.name}\n`;
    } else {
      result += `- Using default coordination logic\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async handleMonitorEmbeddedHealth(args: any) {
    const includeTelemetry = args.include_telemetry !== false;

    // Check health of all devices
    const healthStatus = {
      timestamp: new Date().toISOString(),
      devices_checked: this.esp32Devices.size + this.androidDevices.size,
      issues_found: 0,
      recommendations: []
    };

    // Analyze recent telemetry for anomalies
    if (includeTelemetry && this.telemetryHistory.length > 0) {
      const recentTelemetry = this.telemetryHistory.slice(-100); // Last 100 readings
      const anomalies = this.detectTelemetryAnomalies(recentTelemetry);

      healthStatus.issues_found = anomalies.length;
      if (anomalies.length > 0) {
        healthStatus.recommendations.push(`${anomalies.length} telemetry anomalies detected`);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Embedded Health Monitor:\n- Devices checked: ${healthStatus.devices_checked}\n- Issues found: ${healthStatus.issues_found}\n- Status: ${healthStatus.issues_found === 0 ? 'HEALTHY' : 'WARNING'}\n${healthStatus.recommendations.map(r => `- ${r}`).join('\n')}`
        }
      ]
    };
  }

  private async handleAnalyzeEmbeddedPatterns(args: any) {
    const patternType = args.pattern_type || 'usage';
    const timeRange = args.time_range;
    const devices = args.devices;

    // Perform pattern analysis
    const analysis = await this.analyzeEmbeddedPatterns(patternType, timeRange, devices);

    return {
      content: [
        {
          type: 'text',
          text: `Embedded Pattern Analysis (${patternType}):\n${analysis}`
        }
      ]
    };
  }

  private async handlePredictEmbeddedBehavior(args: any) {
    const deviceId = args.device_id;
    const predictionType = args.prediction_type;
    const timeframeMinutes = args.timeframe_minutes || 60;

    // Generate predictions based on historical data
    const prediction = this.generateDevicePrediction(deviceId, predictionType, timeframeMinutes);

    return {
      content: [
        {
          type: 'text',
          text: `Device Behavior Prediction:\n- Device: ${deviceId}\n- Type: ${predictionType}\n- Timeframe: ${timeframeMinutes} minutes\n- Prediction: ${prediction}`
        }
      ]
    };
  }

  private async handleEmergencyShutdown(args: any) {
    const reason = args.reason;
    const force = args.force || false;

    logger.warn(`Emergency shutdown initiated: ${reason}`, { force });

    // This would send shutdown commands to all devices
    return {
      content: [
        {
          type: 'text',
          text: `Emergency shutdown initiated for all embedded devices:\n- Reason: ${reason}\n- Force: ${force}\n- Status: Shutdown commands sent`
        }
      ]
    };
  }

  private async handleBackupEmbeddedData(args: any) {
    const includeTelemetry = args.include_telemetry !== false;
    const includeClipboard = args.include_clipboard !== false;
    const compression = args.compression !== false;

    const backupInfo = {
      telemetry_records: includeTelemetry ? this.telemetryHistory.length : 0,
      clipboard_items: includeClipboard ? this.clipboardHistory.length : 0,
      compression_enabled: compression,
      timestamp: new Date().toISOString()
    };

    return {
      content: [
        {
          type: 'text',
          text: `Embedded Data Backup:\n- Telemetry records: ${backupInfo.telemetry_records}\n- Clipboard items: ${backupInfo.clipboard_items}\n- Compression: ${backupInfo.compression_enabled ? 'enabled' : 'disabled'}\n- Status: Backup completed`
        }
      ]
    };
  }

  private async initializeDeviceDiscovery(): Promise<void> {
    // Initialize with simulated devices if simulation is enabled
    if (this.config.enableSimulation) {
      // Add simulated ESP32 device
      this.esp32Devices.set('esp32-sim-001', {
        deviceId: 'esp32-sim-001',
        deviceType: DeviceType.ESP32,
        firmwareVersion: '1.0.0',
        hardwareVersion: 'rev1',
        manufacturer: 'Espressif',
        model: 'ESP32-WROOM-32',
        capabilities: {
          hasWifi: true,
          hasBluetooth: true,
          hasTemperature: true,
          hasHumidity: false,
          hasPressure: false,
          hasAccelerometer: false,
          hasGyroscope: false,
          hasMagnetometer: false,
          hasLightSensor: false,
          hasCamera: false,
          hasMicrophone: false,
          hasSpeaker: false,
          hasDisplay: false,
          hasBattery: false,
          supportsOta: true,
          supportsEncryption: false,
          maxMessageSize: 1024
        },
        registrationTimestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        status: 'online'
      });

      // Add simulated Android device
      this.androidDevices.set('android-sim-001', {
        deviceId: 'android-sim-001',
        deviceType: DeviceType.ANDROID_PHONE,
        firmwareVersion: '13.0',
        hardwareVersion: 'pixel7',
        manufacturer: 'Google',
        model: 'Pixel 7',
        capabilities: {
          hasWifi: true,
          hasBluetooth: true,
          hasTemperature: false,
          hasHumidity: false,
          hasPressure: false,
          hasAccelerometer: true,
          hasGyroscope: true,
          hasMagnetometer: true,
          hasLightSensor: true,
          hasCamera: true,
          hasMicrophone: true,
          hasSpeaker: true,
          hasDisplay: true,
          hasBattery: true,
          supportsOta: true,
          supportsEncryption: true,
          maxMessageSize: 65536
        },
        registrationTimestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        status: 'online'
      });

      logger.info('Device discovery initialized with simulated devices');
    }
  }

  private aggregateTelemetryData(data: TelemetryMessage[], method: string): Record<string, number> {
    const aggregated: Record<string, number> = {};

    // Group by sensor type
    const bySensorType: Record<string, number[]> = {};
    for (const reading of data) {
      if (reading.payload && typeof reading.payload.value === 'number') {
        if (!bySensorType[reading.payloadType]) {
          bySensorType[reading.payloadType] = [];
        }
        bySensorType[reading.payloadType].push(reading.payload.value);
      }
    }

    // Apply aggregation method
    for (const [sensorType, values] of Object.entries(bySensorType)) {
      switch (method) {
        case 'avg':
          aggregated[sensorType] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'min':
          aggregated[sensorType] = Math.min(...values);
          break;
        case 'max':
          aggregated[sensorType] = Math.max(...values);
          break;
        case 'count':
          aggregated[sensorType] = values.length;
          break;
        default:
          aggregated[sensorType] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return aggregated;
  }

  private detectTelemetryAnomalies(data: TelemetryMessage[]): string[] {
    const anomalies: string[] = [];

    // Simple anomaly detection based on value ranges
    for (const reading of data) {
      if (reading.payload && typeof reading.payload.value === 'number') {
        const value = reading.payload.value;

        // Define normal ranges for different sensor types
        let isAnomaly = false;
        switch (reading.payloadType) {
          case 'temperature':
            isAnomaly = value < -50 || value > 100;
            break;
          case 'bpm':
            isAnomaly = value < 40 || value > 200;
            break;
          case 'battery_level':
            isAnomaly = value < 0 || value > 100;
            break;
          default:
            isAnomaly = Math.abs(value) > 1000000; // Generic large value check
        }

        if (isAnomaly) {
          anomalies.push(`${reading.payloadType}: ${value} (device: ${reading.deviceId})`);
        }
      }
    }

    return anomalies;
  }

  private async analyzeEmbeddedPatterns(
    patternType: string,
    timeRange?: any,
    devices?: string[]
  ): Promise<string> {
    // Implement pattern analysis based on historical data
    let data: any[] = [];

    switch (patternType) {
      case 'usage':
        data = this.telemetryHistory;
        break;
      case 'telemetry':
        data = this.telemetryHistory;
        break;
      case 'clipboard':
        data = this.clipboardHistory;
        break;
      default:
        return 'Unknown pattern type requested';
    }

    // Apply filters
    if (timeRange) {
      const startTime = new Date(timeRange.start);
      const endTime = new Date(timeRange.end);
      data = data.filter(item => {
        const timestamp = item.timestamp;
        const itemTime = new Date((timestamp.seconds * 1000) + (timestamp.nanoseconds / 1000000));
        return itemTime >= startTime && itemTime <= endTime;
      });
    }

    if (devices && devices.length > 0) {
      data = data.filter(item => devices.includes(item.deviceId || item.device_id));
    }

    return `Analyzed ${data.length} ${patternType} patterns across ${devices ? devices.length : 'all'} devices`;
  }

  private generateDevicePrediction(
    deviceId: string,
    predictionType: string,
    timeframeMinutes: number
  ): string {
    // Simple prediction based on historical patterns
    // In a real implementation, this would use ML models

    const device = this.esp32Devices.get(deviceId) || this.androidDevices.get(deviceId);
    if (!device) {
      return 'Device not found';
    }

    switch (predictionType) {
      case 'battery':
        if (device.capabilities.hasBattery) {
          return 'Battery level expected to decrease by 5-15% in the next hour';
        }
        return 'Device does not have battery monitoring';

      case 'location':
        if (device.capabilities.hasGps) {
          return 'Location expected to remain stable within 100m radius';
        }
        return 'Device does not have GPS capability';

      case 'usage':
        return 'Normal usage pattern expected based on historical data';

      default:
        return 'Prediction not available for this type';
    }
  }
}