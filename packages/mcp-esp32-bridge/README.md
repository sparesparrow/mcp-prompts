# MCP ESP32 Bridge

A bridge service that connects ESP32 embedded devices to the MCP cognitive platform, enabling telemetry data access and device control through MCP tools.

## Overview

The ESP32 Bridge provides:
- **Serial Communication**: Bidirectional communication with ESP32 devices
- **Telemetry Streaming**: Real-time sensor data collection and processing
- **Device Control**: Remote configuration and command execution
- **MCP Integration**: Access ESP32 data through MCP tools
- **Cognitive Enhancement**: Pattern analysis and anomaly detection

## Features

### Telemetry Support
- **Sensor Data**: BPM, temperature, accelerometer, environmental sensors
- **System Monitoring**: Memory, WiFi, task statistics, power consumption
- **Real-time Streaming**: Continuous data collection with buffering
- **Historical Analysis**: Time-series data storage and retrieval

### Device Control
- **Configuration**: Runtime parameter adjustment
- **Calibration**: Sensor calibration commands
- **Reset**: Soft and hard reset capabilities
- **OTA Updates**: Firmware update coordination

### MCP Tools
- `get_esp32_telemetry` - Retrieve current sensor data
- `get_esp32_status` - System status and health information
- `get_telemetry_history` - Historical data analysis
- `configure_esp32` - Device configuration
- `calibrate_esp32_sensors` - Sensor calibration
- `reset_esp32` - Device reset
- `analyze_telemetry_patterns` - Cognitive pattern analysis
- `get_embedded_context` - Device state context

## Installation

```bash
# From the monorepo root
pnpm install
cd packages/mcp-esp32-bridge
pnpm build
```

## ESP32 Firmware Requirements

The ESP32 device must run firmware that:
- Communicates via JSON over serial (115200 baud)
- Supports telemetry commands (`get_telemetry`, `set_config`, etc.)
- Provides structured sensor data
- Handles device control commands

### Sample ESP32 Communication Protocol

```json
// Telemetry data sent by ESP32
{
  "type": "telemetry",
  "data": [
    {
      "sensor_type": "bpm",
      "bpm": 72,
      "confidence": 0.95,
      "raw_samples": [1024, 1025, 1023],
      "timestamp": 1703123456789
    },
    {
      "sensor_type": "temperature",
      "value": 25.3,
      "unit": "°C",
      "timestamp": 1703123456789
    }
  ]
}

// Commands sent to ESP32
{
  "id": "cmd_123",
  "type": "command",
  "command": "get_telemetry",
  "parameters": { "sensors": ["bpm", "temperature"] },
  "timestamp": "2023-12-20T10:30:56.789Z"
}

// Responses from ESP32
{
  "id": "cmd_123",
  "type": "response",
  "result": { "status": "success", "data": [...] }
}
```

## Configuration

### Environment Variables

```bash
# Serial port configuration
ESP32_SERIAL_PORT=/dev/ttyUSB0          # Serial device path
ESP32_BAUD_RATE=115200                  # Communication speed
ESP32_DEVICE_ID=esp32-001               # Unique device identifier

# Connection settings
ESP32_AUTO_RECONNECT=true               # Auto-reconnect on failure
ESP32_RECONNECT_INTERVAL=5000           # Reconnect attempt interval (ms)
ESP32_MESSAGE_TIMEOUT=5000              # Command timeout (ms)

# Service settings
LOG_LEVEL=info                          # Logging verbosity
MODE=mcp                                # Run mode (mcp or http)
```

### MCP Configuration

```json
{
  "mcpServers": {
    "mcp-esp32-bridge": {
      "command": "node",
      "args": ["/path/to/mcp-esp32-bridge/dist/esp32-bridge.js"],
      "env": {
        "ESP32_SERIAL_PORT": "/dev/ttyUSB0",
        "ESP32_DEVICE_ID": "esp32-livingroom",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage

### Starting the Bridge

```bash
# MCP mode (recommended)
pnpm start:mcp

# Development mode
pnpm dev
```

### Accessing Telemetry

```bash
# Get current telemetry
get_esp32_telemetry

# Get specific sensor data
get_esp32_telemetry --sensor_types '["bpm", "temperature"]'

# Get historical data
get_telemetry_history --sensor_type bpm --limit 50

# Analyze patterns
analyze_telemetry_patterns --sensor_type bpm --analysis_type anomaly
```

### Device Control

```bash
# Configure device
configure_esp32 --config '{"telemetry_interval_ms": 2000}'

# Calibrate sensors
calibrate_esp32_sensors --sensor_ids '["bpm"]'

# Reset device
reset_esp32 --hard_reset false
```

## Architecture

```
ESP32 Device <---Serial---> ESP32 Bridge <---MCP---> Claude/Clients
    |                           |
    | BPM, Temp, Accel         | FlatBuffers
    | WiFi, Memory, Tasks      | Processing
    | Telemetry Data           | Cognitive Analysis
    |                           |
    └--- Commands              └--- MCP Tools
        Configuration              get_telemetry
        Calibration                analyze_patterns
        Reset                      device_control
```

## Cognitive Integration

The bridge integrates with the cognitive architecture by:

1. **Data Collection**: Streaming telemetry into cognitive memory
2. **Pattern Recognition**: Identifying anomalies and trends
3. **Context Awareness**: Understanding device state and environment
4. **Learning**: Improving analysis based on successful patterns

### Integration Points

- **Perceptual Layer**: Device state recognition
- **Episodic Memory**: Telemetry pattern storage
- **Semantic Knowledge**: Sensor data interpretation
- **Procedural Workflows**: Automated analysis sequences

## Troubleshooting

### Serial Connection Issues

```bash
# Check available serial ports
ls /dev/tty*

# Verify permissions
ls -la /dev/ttyUSB0

# Add user to dialout group
sudo usermod -a -G dialout $USER
```

### ESP32 Communication

```bash
# Monitor serial communication
screen /dev/ttyUSB0 115200

# Test basic connectivity
echo '{"type":"handshake"}' > /dev/ttyUSB0
```

### MCP Tool Issues

```bash
# Check MCP server status
claude mcp list

# Test tool availability
claude mcp get mcp-esp32-bridge
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Dependencies

- `@sparesparrow/mcp-prompts` - Cognitive prompt management
- `@sparesparrow/mcp-fbs` - FlatBuffers schemas
- `serialport` - Serial communication
- `@modelcontextprotocol/sdk` - MCP protocol

## License

Apache-2.0