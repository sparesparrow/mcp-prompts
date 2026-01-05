// android-mcp-server.ts
// MCP server for Android device integration
// Provides clipboard sync and device data access through MCP tools

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pino from 'pino';
import { AndroidDeviceSimulator, AndroidDeviceConfig } from '../android/android-device-simulator.js';
import { McpPromptsClient } from '@sparesparrow/mcp-prompts';
import {
  ClipboardItem,
  ClipboardContentType,
  DeviceInfo,
  AndroidSensorData,
  LocationData,
  BatteryStats,
  NetworkStats,
  NotificationData,
  AndroidIntegrationParser,
  AndroidIntegrationBuilder
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

export class AndroidMCPServer {
  private server: Server;
  private deviceSimulator: AndroidDeviceSimulator;
  private mcpClient: McpPromptsClient;
  private clipboardHistory: ClipboardItem[] = [];
  private sensorDataHistory: AndroidSensorData[] = [];
  private maxHistorySize = 1000;

  constructor(config: AndroidDeviceConfig) {
    this.deviceSimulator = new AndroidDeviceSimulator(config);
    this.mcpClient = new McpPromptsClient();

    this.server = new Server(
      {
        name: 'mcp-android-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupDeviceEventHandlers();
    this.setupToolHandlers();
    this.setupRequestHandlers();
  }

  /**
   * Start the MCP server and device simulation
   */
  async start(): Promise<void> {
    logger.info('Starting Android MCP Bridge server...');

    try {
      // Start device simulation
      await this.deviceSimulator.start();

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('Android MCP Bridge server started successfully');

    } catch (error) {
      logger.error('Failed to start Android MCP Bridge server:', error);
      throw error;
    }
  }

  /**
   * Stop the server and device simulation
   */
  async stop(): Promise<void> {
    logger.info('Stopping Android MCP Bridge server...');

    await this.deviceSimulator.stop();
    await this.server.close();

    logger.info('Android MCP Bridge server stopped');
  }

  private setupDeviceEventHandlers(): void {
    // Handle clipboard changes
    this.deviceSimulator.on('clipboard-changed', (item: ClipboardItem) => {
      this.clipboardHistory.unshift(item);
      if (this.clipboardHistory.length > this.maxHistorySize) {
        this.clipboardHistory = this.clipboardHistory.slice(0, this.maxHistorySize);
      }
      logger.debug('Clipboard item added:', item.content.substring(0, 50));
    });

    // Handle sensor data
    this.deviceSimulator.on('sensor-data', (data: AndroidSensorData) => {
      this.sensorDataHistory.push(data);
      if (this.sensorDataHistory.length > this.maxHistorySize) {
        this.sensorDataHistory = this.sensorDataHistory.slice(-this.maxHistorySize);
      }
    });

    // Handle other device events
    this.deviceSimulator.on('location-changed', (location: LocationData) => {
      logger.debug('Location updated:', location);
    });

    this.deviceSimulator.on('battery-changed', (battery: BatteryStats) => {
      logger.debug('Battery status:', battery.level + '%');
    });
  }

  private setupToolHandlers(): void {
    // Register Android-specific MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Clipboard Tools
          {
            name: 'get_android_clipboard',
            description: 'Get current clipboard content from Android device',
            inputSchema: {
              type: 'object',
              properties: {
                include_history: {
                  type: 'boolean',
                  description: 'Include recent clipboard history',
                  default: false,
                  required: false
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of items to return',
                  default: 10,
                  required: false
                }
              }
            }
          },
          {
            name: 'set_android_clipboard',
            description: 'Set clipboard content on Android device',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Content to set on clipboard',
                  required: true
                },
                content_type: {
                  type: 'string',
                  description: 'Content type (text, html, uri)',
                  default: 'text',
                  required: false
                }
              }
            }
          },
          {
            name: 'sync_android_clipboard',
            description: 'Synchronize clipboard across devices',
            inputSchema: {
              type: 'object',
              properties: {
                target_devices: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target device IDs to sync with',
                  required: false
                },
                bidirectional: {
                  type: 'boolean',
                  description: 'Enable bidirectional sync',
                  default: true,
                  required: false
                }
              }
            }
          },

          // Device Information Tools
          {
            name: 'get_android_device_info',
            description: 'Get Android device information and capabilities',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_android_battery_status',
            description: 'Get Android device battery status',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_android_network_status',
            description: 'Get Android device network status',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },

          // Sensor and Location Tools
          {
            name: 'get_android_location',
            description: 'Get Android device location data',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_android_sensor_data',
            description: 'Get Android device sensor data',
            inputSchema: {
              type: 'object',
              properties: {
                sensor_type: {
                  type: 'string',
                  description: 'Sensor type to retrieve (accelerometer, light, etc.)',
                  required: false
                },
                include_history: {
                  type: 'boolean',
                  description: 'Include sensor data history',
                  default: false,
                  required: false
                }
              }
            }
          },

          // Device Control Tools
          {
            name: 'android_take_screenshot',
            description: 'Take a screenshot on Android device',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'android_play_sound',
            description: 'Play a sound on Android device',
            inputSchema: {
              type: 'object',
              properties: {
                sound_type: {
                  type: 'string',
                  description: 'Type of sound to play (notification, ringtone, etc.)',
                  default: 'notification',
                  required: false
                }
              }
            }
          },
          {
            name: 'android_show_toast',
            description: 'Show a toast message on Android device',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'Message to display',
                  required: true
                }
              }
            }
          },
          {
            name: 'android_launch_app',
            description: 'Launch an app on Android device',
            inputSchema: {
              type: 'object',
              properties: {
                package_name: {
                  type: 'string',
                  description: 'Package name of app to launch',
                  required: true
                }
              }
            }
          },

          // Cognitive Integration Tools
          {
            name: 'analyze_android_clipboard_patterns',
            description: 'Analyze clipboard usage patterns using cognitive prompts',
            inputSchema: {
              type: 'object',
              properties: {
                time_range: {
                  type: 'object',
                  description: 'Time range for analysis',
                  properties: {
                    start: { type: 'number' },
                    end: { type: 'number' }
                  },
                  required: false
                },
                pattern_type: {
                  type: 'string',
                  description: 'Type of pattern to analyze (content, timing, source)',
                  default: 'content',
                  required: false
                }
              }
            }
          },
          {
            name: 'get_android_context',
            description: 'Get contextual information about Android device state',
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
          case 'get_android_clipboard':
            return await this.handleGetClipboard(args);
          case 'set_android_clipboard':
            return await this.handleSetClipboard(args);
          case 'sync_android_clipboard':
            return await this.handleSyncClipboard(args);
          case 'get_android_device_info':
            return await this.handleGetDeviceInfo(args);
          case 'get_android_battery_status':
            return await this.handleGetBatteryStatus(args);
          case 'get_android_network_status':
            return await this.handleGetNetworkStatus(args);
          case 'get_android_location':
            return await this.handleGetLocation(args);
          case 'get_android_sensor_data':
            return await this.handleGetSensorData(args);
          case 'android_take_screenshot':
            return await this.handleTakeScreenshot(args);
          case 'android_play_sound':
            return await this.handlePlaySound(args);
          case 'android_show_toast':
            return await this.handleShowToast(args);
          case 'android_launch_app':
            return await this.handleLaunchApp(args);
          case 'analyze_android_clipboard_patterns':
            return await this.handleAnalyzeClipboardPatterns(args);
          case 'get_android_context':
            return await this.handleGetAndroidContext(args);
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

  private async handleGetClipboard(args: any) {
    const includeHistory = args.include_history || false;
    const limit = args.limit || 10;

    let items: ClipboardItem[];
    if (includeHistory) {
      items = this.clipboardHistory.slice(0, limit);
    } else {
      items = this.deviceSimulator.getClipboardItems().slice(0, limit);
    }

    if (items.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No clipboard content available'
          }
        ]
      };
    }

    const clipboardText = items.map((item, i) => {
      const timestamp = new Date((item.timestamp.seconds * 1000) + (item.timestamp.nanoseconds / 1000000));
      return `${i + 1}. [${timestamp.toLocaleString()}] ${item.content.substring(0, 100)}${item.content.length > 100 ? '...' : ''}`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Android Clipboard Content (${items.length} items):\n${clipboardText}`
        }
      ]
    };
  }

  private async handleSetClipboard(args: any) {
    const contentType = this.parseContentType(args.content_type || 'text');

    this.deviceSimulator.addClipboardItem(args.content, contentType);

    return {
      content: [
        {
          type: 'text',
          text: `Clipboard content set on Android device: ${args.content.substring(0, 50)}${args.content.length > 50 ? '...' : ''}`
        }
      ]
    };
  }

  private async handleSyncClipboard(args: any) {
    // In a real implementation, this would sync with other devices
    // For simulation, we just acknowledge the request
    const targetDevices = args.target_devices || ['all'];
    const bidirectional = args.bidirectional !== false;

    return {
      content: [
        {
          type: 'text',
          text: `Clipboard sync ${bidirectional ? 'bidirectional' : 'unidirectional'} with devices: ${targetDevices.join(', ')}`
        }
      ]
    };
  }

  private async handleGetDeviceInfo(args: any) {
    const deviceInfo = this.deviceSimulator.getDeviceInfo();

    const infoText = `
Android Device Information:
- Device ID: ${deviceInfo.deviceId}
- Manufacturer: ${deviceInfo.manufacturer}
- Model: ${deviceInfo.model}
- Android Version: ${deviceInfo.androidVersion} (API ${deviceInfo.apiLevel})
- Screen: ${deviceInfo.screenSizeX}x${deviceInfo.screenSizeY} (${deviceInfo.screenDensity}x density)
- Memory: ${deviceInfo.availableMemoryMb}MB / ${deviceInfo.totalMemoryMb}MB available
- Battery: ${deviceInfo.batteryLevel}% ${deviceInfo.isCharging ? '(Charging)' : '(Discharging)'}
- Network: ${deviceInfo.networkType}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: infoText
        }
      ]
    };
  }

  private async handleGetBatteryStatus(args: any) {
    const batteryStats = this.deviceSimulator.getBatteryStats();

    const batteryText = `
Battery Status:
- Level: ${batteryStats.level}%
- Status: ${batteryStats.status}
- Temperature: ${batteryStats.temperature}°C
- Voltage: ${batteryStats.voltage}mV
- Plugged: ${batteryStats.plugged}
- Health: ${batteryStats.health}
- Technology: ${batteryStats.technology}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: batteryText
        }
      ]
    };
  }

  private async handleGetNetworkStatus(args: any) {
    const networkStats = this.deviceSimulator.getNetworkStats();

    const networkText = `
Network Status:
- Type: ${networkStats.networkType}
- WiFi SSID: ${networkStats.ssid || 'N/A'}
- Signal Strength: ${networkStats.signalStrength || 'N/A'} dBm
- Mobile Network: ${networkStats.mobileNetworkType || 'N/A'}
- Carrier: ${networkStats.carrierName || 'N/A'}
- Data Usage: ↓${this.formatBytes(networkStats.bytesRx || 0)} ↑${this.formatBytes(networkStats.bytesTx || 0)}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: networkText
        }
      ]
    };
  }

  private async handleGetLocation(args: any) {
    const locationData = this.deviceSimulator.getLocationData();

    const locationText = `
Location Data:
- Latitude: ${locationData.latitude.toFixed(6)}
- Longitude: ${locationData.longitude.toFixed(6)}
- Altitude: ${locationData.altitude ? locationData.altitude.toFixed(1) + 'm' : 'N/A'}
- Accuracy: ${locationData.accuracy.toFixed(1)}m
- Speed: ${locationData.speed ? locationData.speed.toFixed(1) + 'm/s' : 'N/A'}
- Bearing: ${locationData.bearing ? locationData.bearing.toFixed(1) + '°' : 'N/A'}
- Provider: ${locationData.provider}
    `.trim();

    return {
      content: [
        {
          type: 'text',
          text: locationText
        }
      ]
    };
  }

  private async handleGetSensorData(args: any) {
    const sensorType = args.sensor_type;
    const includeHistory = args.include_history || false;

    let sensorData: AndroidSensorData[];
    if (includeHistory) {
      sensorData = sensorType
        ? this.sensorDataHistory.filter(s => s.sensorType === sensorType).slice(-20)
        : this.sensorDataHistory.slice(-20);
    } else {
      // Get latest reading for each sensor type
      const latestByType = new Map<string, AndroidSensorData>();
      for (const data of this.sensorDataHistory.slice().reverse()) {
        if (!latestByType.has(data.sensorType)) {
          latestByType.set(data.sensorType, data);
        }
      }
      sensorData = Array.from(latestByType.values());
      if (sensorType) {
        sensorData = sensorData.filter(s => s.sensorType === sensorType);
      }
    }

    if (sensorData.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No sensor data available${sensorType ? ` for type: ${sensorType}` : ''}`
          }
        ]
      };
    }

    const sensorText = sensorData.map((data, i) => {
      const timestamp = new Date((data.timestamp.seconds * 1000) + (data.timestamp.nanoseconds / 1000000));
      const values = data.values.map(v => v.toFixed(3)).join(', ');
      return `${i + 1}. ${data.sensorName} (${data.sensorType}): [${values}] (accuracy: ${data.accuracy})`;
    }).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Sensor Data (${sensorData.length} readings):\n${sensorText}`
        }
      ]
    };
  }

  private async handleTakeScreenshot(args: any) {
    const screenshotData = await this.deviceSimulator.takeScreenshot();

    return {
      content: [
        {
          type: 'text',
          text: `Screenshot taken successfully (${screenshotData.length} bytes of image data)`
        }
      ]
    };
  }

  private async handlePlaySound(args: any) {
    await this.deviceSimulator.playSound(args.sound_type);

    return {
      content: [
        {
          type: 'text',
          text: `Sound played: ${args.sound_type || 'notification'}`
        }
      ]
    };
  }

  private async handleShowToast(args: any) {
    await this.deviceSimulator.showToast(args.message);

    return {
      content: [
        {
          type: 'text',
          text: `Toast message shown: ${args.message}`
        }
      ]
    };
  }

  private async handleLaunchApp(args: any) {
    await this.deviceSimulator.launchApp(args.package_name);

    return {
      content: [
        {
          type: 'text',
          text: `App launched: ${args.package_name}`
        }
      ]
    };
  }

  private async handleAnalyzeClipboardPatterns(args: any) {
    const timeRange = args.time_range;
    const patternType = args.pattern_type || 'content';

    // Filter clipboard history by time range
    let filteredHistory = this.clipboardHistory;
    if (timeRange) {
      const startTime = new Date(timeRange.start);
      const endTime = new Date(timeRange.end);
      filteredHistory = this.clipboardHistory.filter(item => {
        const itemTime = new Date((item.timestamp.seconds * 1000) + (item.timestamp.nanoseconds / 1000000));
        return itemTime >= startTime && itemTime <= endTime;
      });
    }

    if (filteredHistory.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No clipboard data available for analysis in the specified time range'
          }
        ]
      };
    }

    // Perform pattern analysis
    const analysis = this.analyzeClipboardPatterns(filteredHistory, patternType);

    return {
      content: [
        {
          type: 'text',
          text: `Clipboard Pattern Analysis (${patternType}):\n${analysis}`
        }
      ]
    };
  }

  private async handleGetAndroidContext(args: any) {
    const includeHistory = args.include_history !== false;

    const context = {
      device: this.deviceSimulator.getDeviceInfo(),
      battery: this.deviceSimulator.getBatteryStats(),
      network: this.deviceSimulator.getNetworkStatus(),
      location: this.deviceSimulator.getLocationData(),
      clipboard: includeHistory ? {
        current: this.deviceSimulator.getClipboardItems().slice(0, 5),
        history_size: this.clipboardHistory.length
      } : undefined,
      sensors: {
        types: [...new Set(this.sensorDataHistory.map(s => s.sensorType))],
        latest_readings: this.getLatestSensorReadings()
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: `Android Device Context:\n${JSON.stringify(context, null, 2)}`
        }
      ]
    };
  }

  private parseContentType(contentType: string): ClipboardContentType {
    switch (contentType.toLowerCase()) {
      case 'html': return ClipboardContentType.HTML;
      case 'uri': return ClipboardContentType.URI;
      case 'intent': return ClipboardContentType.INTENT;
      case 'image': return ClipboardContentType.IMAGE;
      case 'file': return ClipboardContentType.FILE;
      case 'multiple': return ClipboardContentType.MULTIPLE;
      default: return ClipboardContentType.TEXT;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private analyzeClipboardPatterns(items: ClipboardItem[], patternType: string): string {
    switch (patternType) {
      case 'content':
        return this.analyzeContentPatterns(items);
      case 'timing':
        return this.analyzeTimingPatterns(items);
      case 'source':
        return this.analyzeSourcePatterns(items);
      default:
        return 'Unknown pattern type requested';
    }
  }

  private analyzeContentPatterns(items: ClipboardItem[]): string {
    const contentLengths = items.map(item => item.content.length);
    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length;

    const textItems = items.filter(item => item.contentType === ClipboardContentType.TEXT);
    const urlItems = items.filter(item => item.content.includes('http'));

    return `
Content Pattern Analysis:
- Total items: ${items.length}
- Average content length: ${avgLength.toFixed(0)} characters
- Text items: ${textItems.length} (${((textItems.length / items.length) * 100).toFixed(1)}%)
- URL items: ${urlItems.length} (${((urlItems.length / items.length) * 100).toFixed(1)}%)
- Most common words: ${this.findCommonWords(items).slice(0, 5).join(', ')}
    `.trim();
  }

  private analyzeTimingPatterns(items: ClipboardItem[]): string {
    if (items.length < 2) return 'Insufficient data for timing analysis';

    const intervals: number[] = [];
    for (let i = 1; i < items.length; i++) {
      const prevTime = (items[i - 1].timestamp.seconds * 1000) + (items[i - 1].timestamp.nanoseconds / 1000000);
      const currTime = (items[i].timestamp.seconds * 1000) + (items[i].timestamp.nanoseconds / 1000000);
      intervals.push(currTime - prevTime);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const minInterval = Math.min(...intervals);
    const maxInterval = Math.max(...intervals);

    return `
Timing Pattern Analysis:
- Average interval: ${(avgInterval / 1000).toFixed(1)}s
- Min interval: ${(minInterval / 1000).toFixed(1)}s
- Max interval: ${(maxInterval / 1000).toFixed(1)}s
- Most active hour: ${this.findMostActiveHour(items)}
    `.trim();
  }

  private analyzeSourcePatterns(items: ClipboardItem[]): string {
    const sourceCounts = new Map<string, number>();

    for (const item of items) {
      const source = item.sourceApp || 'Unknown';
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }

    const sortedSources = Array.from(sourceCounts.entries())
      .sort(([, a], [, b]) => b - a);

    return `
Source Pattern Analysis:
${sortedSources.map(([source, count]) => `- ${source}: ${count} items`).join('\n')}
    `.trim();
  }

  private findCommonWords(items: ClipboardItem[]): string[] {
    const wordCounts = new Map<string, number>();

    for (const item of items) {
      if (item.contentType === ClipboardContentType.TEXT) {
        const words = item.content.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3);

        for (const word of words) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    return Array.from(wordCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private findMostActiveHour(items: ClipboardItem[]): string {
    const hourCounts = new Array(24).fill(0);

    for (const item of items) {
      const date = new Date((item.timestamp.seconds * 1000) + (item.timestamp.nanoseconds / 1000000));
      hourCounts[date.getHours()]++;
    }

    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    return `${mostActiveHour}:00 - ${mostActiveHour + 1}:00`;
  }

  private getLatestSensorReadings(): { [sensorType: string]: AndroidSensorData } {
    const latestByType = new Map<string, AndroidSensorData>();

    for (const data of this.sensorDataHistory.slice().reverse()) {
      if (!latestByType.has(data.sensorType)) {
        latestByType.set(data.sensorType, data);
      }
    }

    const result: { [sensorType: string]: AndroidSensorData } = {};
    for (const [type, data] of latestByType) {
      result[type] = data;
    }

    return result;
  }
}