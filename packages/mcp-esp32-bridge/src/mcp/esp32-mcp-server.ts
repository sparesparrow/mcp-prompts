// esp32-mcp-server.ts
// MCP server for ESP32 bridge providing telemetry access and device control

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { ESP32SerialReader, ESP32Config } from '../serial/esp32-serial-reader.js';
import { McpPromptsClient } from '@sparesparrow/mcp-prompts';
import {
  TelemetryMessage,
  DeviceProfile,
  ESP32TelemetryParser,
  DeviceType,
  DeviceCapabilities
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

export class ESP32MCPServer {
  private server: Server;
  private serialReader: ESP32SerialReader;
  private mcpClient: McpPromptsClient;
  private deviceProfile: DeviceProfile | null = null;
  private telemetryHistory: TelemetryMessage[] = [];
  private maxHistorySize = 1000;

  constructor(config: ESP32Config) {
    this.serialReader = new ESP32SerialReader(config);
    this.mcpClient = new McpPromptsClient();

    this.server = new Server(
      {
        name: 'mcp-esp32-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupSerialEventHandlers();
    this.setupToolHandlers();
    this.setupRequestHandlers();
  }

  /**
   * Start the MCP server and connect to ESP32
   */
  async start(): Promise<void> {
    logger.info('Starting ESP32 MCP Bridge server...');

    try {
      // Connect to ESP32
      await this.serialReader.connect();

      // Initialize device profile
      await this.initializeDeviceProfile();

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('ESP32 MCP Bridge server started successfully');

    } catch (error) {
      logger.error('Failed to start ESP32 MCP Bridge server:', error);
      throw error;
    }
  }

  /**
   * Stop the server and disconnect
   */
  async stop(): Promise<void> {
    logger.info('Stopping ESP32 MCP Bridge server...');

    await this.serialReader.cleanup();
    await this.server.close();

    logger.info('ESP32 MCP Bridge server stopped');
  }

  private setupSerialEventHandlers(): void {
    // Handle telemetry data from ESP32
    this.serialReader.on('telemetry', (data: { deviceId: string; telemetry: TelemetryMessage[]; timestamp: Date }) => {
      this.handleTelemetryData(data.telemetry);
    });

    // Handle status updates
    this.serialReader.on('status', (status: any) => {
      logger.debug('ESP32 status update:', status);
      // Could emit status updates to MCP clients
    });

    // Handle errors
    this.serialReader.on('error', (error: any) => {
      logger.error('ESP32 error:', error);
      // Could emit error notifications
    });
  }

  private setupToolHandlers(): void {
    // Register ESP32-specific MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Telemetry Access Tools
          {
            name: 'get_esp32_telemetry',
            description: 'Get current telemetry data from ESP32 device',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific sensor types to retrieve (optional)',
                  required: false
                },
                since_timestamp: {
                  type: 'number',
                  description: 'Get telemetry since this timestamp (Unix epoch ms)',
                  required: false
                }
              }
            }
          },
          {
            name: 'get_esp32_status',
            description: 'Get current status and system information from ESP32',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_telemetry_history',
            description: 'Get historical telemetry data from ESP32',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_type: {
                  type: 'string',
                  description: 'Filter by sensor type',
                  required: false
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of readings to return',
                  default: 100,
                  required: false
                },
                start_time: {
                  type: 'number',
                  description: 'Start time for historical data (Unix epoch ms)',
                  required: false
                },
                end_time: {
                  type: 'number',
                  description: 'End time for historical data (Unix epoch ms)',
                  required: false
                }
              }
            }
          },

          // Device Control Tools
          {
            name: 'configure_esp32',
            description: 'Send configuration to ESP32 device',
            inputSchema: {
              type: 'object',
              properties: {
                config: {
                  type: 'object',
                  description: 'Configuration object to send to ESP32',
                  required: true
                }
              }
            }
          },
          {
            name: 'calibrate_esp32_sensors',
            description: 'Calibrate ESP32 sensors',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific sensors to calibrate (optional - calibrates all if empty)',
                  required: false
                }
              }
            }
          },
          {
            name: 'reset_esp32',
            description: 'Reset the ESP32 device',
            inputSchema: {
              type: 'object',
              properties: {
                hard_reset: {
                  type: 'boolean',
                  description: 'Perform hard reset instead of soft reset',
                  default: false,
                  required: false
                }
              }
            }
          },

          // Cognitive Integration Tools
          {
            name: 'analyze_telemetry_patterns',
            description: 'Analyze telemetry patterns using cognitive prompts',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_type: {
                  type: 'string',
                  description: 'Sensor type to analyze',
                  required: true
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
                analysis_type: {
                  type: 'string',
                  description: 'Type of analysis (anomaly, trend, correlation)',
                  default: 'anomaly',
                  required: false
                }
              }
            }
          },
          {
            name: 'get_embedded_context',
            description: 'Get contextual information about embedded device state',
            inputSchema: {
              type: 'object',
              properties: {
                include_history: {
                  type: 'boolean',
                  description: 'Include historical context',
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
          case 'get_esp32_telemetry':
            return await this.handleGetTelemetry(args);
          case 'get_esp32_status':
            return await this.handleGetStatus(args);
          case 'get_telemetry_history':
            return await this.handleGetTelemetryHistory(args);
          case 'configure_esp32':
            return await this.handleConfigureESP32(args);
          case 'calibrate_esp32_sensors':
            return await this.handleCalibrateSensors(args);
          case 'reset_esp32':
            return await this.handleResetESP32(args);
          case 'analyze_telemetry_patterns':
            return await this.handleAnalyzeTelemetryPatterns(args);
          case 'get_embedded_context':
            return await this.handleGetEmbeddedContext(args);
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

  private async handleGetTelemetry(args: any) {
    try {
      const telemetry = await this.serialReader.requestTelemetry(args.sensor_types);

      if (telemetry.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No telemetry data available from ESP32'
            }
          ]
        };
      }

      // Format telemetry for display
      const formattedTelemetry = telemetry.map(t => {
        const payloadType = t.payloadType;
        const payload = t.payload;

        let description = `${payloadType}: `;
        switch (payloadType) {
          case 'bpm':
            description += `${payload.bpm} BPM (confidence: ${(payload.confidence * 100).toFixed(1)}%)`;
            break;
          case 'temperature':
            description += `${payload.value} ${payload.unit}`;
            break;
          case 'memory':
            description += `Free: ${payload.heapFree} bytes, Total: ${payload.heapTotal} bytes`;
            break;
          case 'wifi':
            description += `Connected: ${payload.connected}, RSSI: ${payload.rssi || 'N/A'} dBm`;
            break;
          default:
            description += JSON.stringify(payload);
        }

        return description;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `ESP32 Telemetry Data:\n${formattedTelemetry}`
          }
        ]
      };

    } catch (error) {
      logger.error('Failed to get telemetry:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Failed to retrieve telemetry: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetStatus(args: any) {
    try {
      const status = await this.serialReader.getSystemStatus();

      const statusText = `
ESP32 System Status:
- Connected: ${this.serialReader.isConnected()}
- Device Profile: ${this.deviceProfile ? 'Available' : 'Not available'}
- Telemetry History: ${this.telemetryHistory.length} readings
- Firmware: ${status.firmware_version || 'Unknown'}
- Uptime: ${status.uptime || 'Unknown'}
- Free Heap: ${status.free_heap || 'Unknown'} bytes
      `.trim();

      return {
        content: [
          {
            type: 'text',
            text: statusText
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get status: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetTelemetryHistory(args: any) {
    let filteredHistory = [...this.telemetryHistory];

    // Apply filters
    if (args.sensor_type) {
      filteredHistory = filteredHistory.filter(t => t.payloadType === args.sensor_type);
    }

    if (args.start_time) {
      const startTime = new Date(args.start_time);
      filteredHistory = filteredHistory.filter(t =>
        new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000)) >= startTime
      );
    }

    if (args.end_time) {
      const endTime = new Date(args.end_time);
      filteredHistory = filteredHistory.filter(t =>
        new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000)) <= endTime
      );
    }

    // Apply limit
    const limit = args.limit || 100;
    filteredHistory = filteredHistory.slice(-limit);

    if (filteredHistory.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No telemetry history available matching the criteria'
          }
        ]
      };
    }

    const historyText = filteredHistory.map((t, i) => {
      const timestamp = new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000));
      return `${i + 1}. ${timestamp.toISOString()} - ${t.payloadType}: ${JSON.stringify(t.payload)}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Telemetry History (${filteredHistory.length} readings):\n${historyText}`
        }
      ]
    };
  }

  private async handleConfigureESP32(args: any) {
    try {
      const result = await this.serialReader.sendConfiguration(args.config);

      return {
        content: [
          {
            type: 'text',
            text: `ESP32 configuration updated successfully: ${JSON.stringify(result)}`
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to configure ESP32: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleCalibrateSensors(args: any) {
    try {
      const result = await this.serialReader.calibrateSensors(args.sensor_ids);

      return {
        content: [
          {
            type: 'text',
            text: `ESP32 sensor calibration completed: ${JSON.stringify(result)}`
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to calibrate sensors: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleResetESP32(args: any) {
    try {
      const result = await this.serialReader.resetDevice();

      return {
        content: [
          {
            type: 'text',
            text: `ESP32 ${args.hard_reset ? 'hard' : 'soft'} reset completed: ${JSON.stringify(result)}`
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to reset ESP32: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleAnalyzeTelemetryPatterns(args: any) {
    try {
      // Get telemetry data for analysis
      const history = this.getFilteredTelemetryHistory(args.sensor_type, args.time_range);

      if (history.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No telemetry data available for analysis'
            }
          ]
        };
      }

      // Query for analysis prompts from mcp-prompts
      const analysisPrompt = await this.mcpClient.getPrompt(`${args.analysis_type}-analysis-pattern`);

      let analysisResult = `Pattern analysis for ${args.sensor_type}:\n`;
      analysisResult += `- Data points: ${history.length}\n`;
      analysisResult += `- Time range: ${args.time_range ? `${new Date(args.time_range.start).toISOString()} to ${new Date(args.time_range.end).toISOString()}` : 'All available'}\n`;

      if (analysisPrompt) {
        analysisResult += `- Analysis method: ${analysisPrompt.name}\n`;
        analysisResult += `- Using cognitive prompt: ${analysisPrompt.description}\n`;
      }

      // Perform basic pattern analysis
      const patterns = this.analyzePatterns(history, args.analysis_type);

      analysisResult += `\nPattern Analysis Results:\n${patterns}`;

      return {
        content: [
          {
            type: 'text',
            text: analysisResult
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to analyze telemetry patterns: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetEmbeddedContext(args: any) {
    const context = {
      device: this.deviceProfile,
      connection: {
        connected: this.serialReader.isConnected(),
        telemetry_count: this.telemetryHistory.length,
        last_telemetry: this.telemetryHistory.length > 0 ?
          new Date((this.telemetryHistory[this.telemetryHistory.length - 1].timestamp.seconds * 1000)) :
          null
      },
      capabilities: this.deviceProfile?.capabilities,
      recent_sensors: this.getRecentSensorTypes()
    };

    return {
      content: [
        {
          type: 'text',
          text: `Embedded Device Context:\n${JSON.stringify(context, null, 2)}`
        }
      ]
    };
  }

  private async initializeDeviceProfile(): Promise<void> {
    try {
      // Query ESP32 for device information
      const deviceInfo = await this.serialReader.getSystemStatus();

      this.deviceProfile = {
        deviceId: this.serialReader['config'].deviceId,
        deviceType: DeviceType.ESP32,
        firmwareVersion: deviceInfo.firmware_version || '1.0.0',
        hardwareVersion: deviceInfo.hardware_version,
        manufacturer: 'Espressif',
        model: 'ESP32',
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
      };

      logger.info('Device profile initialized:', this.deviceProfile);

    } catch (error) {
      logger.warn('Failed to initialize device profile:', error);
      // Create basic profile
      this.deviceProfile = {
        deviceId: this.serialReader['config'].deviceId,
        deviceType: DeviceType.ESP32,
        firmwareVersion: 'unknown',
        capabilities: {
          hasWifi: true,
          hasBluetooth: true,
          hasTemperature: false,
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
          supportsOta: false,
          supportsEncryption: false,
          maxMessageSize: 1024
        },
        registrationTimestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        status: 'online'
      };
    }
  }

  private handleTelemetryData(telemetry: TelemetryMessage[]): void {
    // Store telemetry in history
    this.telemetryHistory.push(...telemetry);

    // Maintain history size limit
    if (this.telemetryHistory.length > this.maxHistorySize) {
      this.telemetryHistory = this.telemetryHistory.slice(-this.maxHistorySize);
    }

    logger.debug(`Stored ${telemetry.length} telemetry readings, total history: ${this.telemetryHistory.length}`);
  }

  private getFilteredTelemetryHistory(sensorType?: string, timeRange?: { start: number; end: number }): TelemetryMessage[] {
    let filtered = [...this.telemetryHistory];

    if (sensorType) {
      filtered = filtered.filter(t => t.payloadType === sensorType);
    }

    if (timeRange) {
      const startTime = new Date(timeRange.start);
      const endTime = new Date(timeRange.end);
      filtered = filtered.filter(t => {
        const timestamp = new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000));
        return timestamp >= startTime && timestamp <= endTime;
      });
    }

    return filtered;
  }

  private analyzePatterns(telemetry: TelemetryMessage[], analysisType: string): string {
    // Basic pattern analysis implementation
    const values: number[] = [];
    const timestamps: Date[] = [];

    for (const t of telemetry) {
      if (t.payload && typeof t.payload.value === 'number') {
        values.push(t.payload.value);
        timestamps.push(new Date((t.timestamp.seconds * 1000) + (t.timestamp.nanoseconds / 1000000)));
      }
    }

    if (values.length === 0) {
      return 'No numeric values found for analysis';
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    let analysis = '';
    switch (analysisType) {
      case 'anomaly':
        const anomalies = values.filter(v => Math.abs(v - avg) > 2 * stdDev);
        analysis = `Anomaly Detection:\n- Average: ${avg.toFixed(2)}\n- Standard Deviation: ${stdDev.toFixed(2)}\n- Anomalies detected: ${anomalies.length}\n- Anomaly values: ${anomalies.slice(0, 5).join(', ')}`;
        break;

      case 'trend':
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const trend = secondAvg - firstAvg;
        analysis = `Trend Analysis:\n- Average: ${avg.toFixed(2)}\n- Trend: ${trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable'} (${trend.toFixed(2)})\n- Range: ${min.toFixed(2)} - ${max.toFixed(2)}`;
        break;

      default:
        analysis = `Basic Statistics:\n- Count: ${values.length}\n- Average: ${avg.toFixed(2)}\n- Min: ${min.toFixed(2)}\n- Max: ${max.toFixed(2)}\n- Std Dev: ${stdDev.toFixed(2)}`;
    }

    return analysis;
  }

  private getRecentSensorTypes(): string[] {
    const recent = this.telemetryHistory.slice(-20); // Last 20 readings
    const sensorTypes = [...new Set(recent.map(t => t.payloadType))];
    return sensorTypes;
  }
}