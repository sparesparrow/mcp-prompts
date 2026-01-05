# MCP Android Bridge

A bridge service that connects Android devices to the MCP cognitive platform, enabling clipboard synchronization and device data access through MCP tools.

## Overview

The Android Bridge provides:
- **Clipboard Synchronization**: Real-time cross-device clipboard sharing
- **Device Data Access**: Battery, network, location, and sensor data
- **Device Control**: Screenshot, sound, notifications, and app launching
- **MCP Integration**: Access Android data through MCP tools
- **Cognitive Enhancement**: Pattern analysis and contextual awareness

## Features

### Clipboard Management
- **Real-time Sync**: Instant clipboard content sharing across devices
- **Content Types**: Text, HTML, URIs, images, and files
- **History Tracking**: Comprehensive clipboard usage history
- **Pattern Analysis**: Usage pattern recognition and insights

### Device Monitoring
- **Battery Status**: Level, charging state, temperature, health
- **Network Information**: WiFi, mobile data, signal strength, data usage
- **Location Data**: GPS coordinates, accuracy, speed, bearing
- **System Information**: Device specs, memory, Android version

### Sensor Integration
- **Accelerometer**: Motion detection and activity recognition
- **Light Sensor**: Ambient light level monitoring
- **Environmental Sensors**: Temperature, humidity, pressure
- **Custom Sensors**: Extensible sensor framework

### Device Control
- **Screenshot Capture**: Remote screenshot functionality
- **Audio Feedback**: Sound and vibration control
- **Toast Messages**: Non-intrusive notifications
- **App Launching**: Programmatic app starting

### MCP Tools
- `get_android_clipboard` - Retrieve clipboard content
- `set_android_clipboard` - Set clipboard content
- `sync_android_clipboard` - Cross-device clipboard sync
- `get_android_device_info` - Device specifications
- `get_android_battery_status` - Battery information
- `get_android_network_status` - Network status
- `get_android_location` - GPS location data
- `get_android_sensor_data` - Sensor readings
- `android_take_screenshot` - Capture screenshot
- `android_play_sound` - Audio feedback
- `android_show_toast` - Display messages
- `android_launch_app` - Launch applications
- `analyze_android_clipboard_patterns` - Pattern analysis
- `get_android_context` - Device state context

## Installation

```bash
# From the monorepo root
pnpm install
cd packages/mcp-android-bridge
pnpm build
```

## Device Simulation

The bridge includes a comprehensive Android device simulator for development and testing:

```bash
# Start MCP server with device simulation
pnpm start

# Development mode
pnpm dev
```

### Simulated Features
- **Dynamic Clipboard**: Random content generation and updates
- **Realistic Sensors**: Accelerometer, light sensor with realistic values
- **Battery Simulation**: Charging/discharging with temperature changes
- **Location Updates**: GPS movement simulation
- **Network Fluctuations**: Signal strength and data usage simulation

## Real Android Integration (Future)

For production Android device integration:

### Android App Requirements
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.READ_CLIPBOARD" />
<uses-permission android:name="android.permission.WRITE_CLIPBOARD" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.BODY_SENSORS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
```

### WebSocket Communication
```javascript
// Android app connects to bridge via WebSocket
const ws = new WebSocket('ws://bridge-server:8080/android');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleBridgeMessage(message);
};
```

## Configuration

### Environment Variables

```bash
# Device identification
ANDROID_DEVICE_ID=android-001                    # Unique device identifier
ANDROID_DEVICE_NAME=Pixel 7                      # Human-readable name
ANDROID_VERSION=13.0                             # Android OS version

# Simulation settings
ANDROID_SIMULATE_CLIPBOARD=true                  # Enable clipboard simulation
ANDROID_SIMULATE_SENSORS=true                    # Enable sensor simulation
ANDROID_SIMULATE_LOCATION=true                   # Enable location simulation

# Update intervals (milliseconds)
ANDROID_CLIPBOARD_INTERVAL=30000                 # Clipboard update frequency
ANDROID_SENSOR_INTERVAL=1000                     # Sensor reading frequency
ANDROID_LOCATION_INTERVAL=10000                  # Location update frequency

# Service settings
LOG_LEVEL=info                                   # Logging verbosity
MODE=mcp                                         # Run mode (mcp or websocket)
```

### MCP Configuration

```json
{
  "mcpServers": {
    "mcp-android-bridge": {
      "command": "node",
      "args": ["/path/to/mcp-android-bridge/dist/android-bridge.js"],
      "env": {
        "ANDROID_DEVICE_ID": "pixel-7-livingroom",
        "ANDROID_DEVICE_NAME": "Pixel 7",
        "ANDROID_VERSION": "13.0",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage

### Clipboard Operations

```bash
# Get current clipboard content
get_android_clipboard

# Get clipboard history
get_android_clipboard --include_history true --limit 20

# Set clipboard content
set_android_clipboard --content "Hello from MCP!"

# Sync clipboard across devices
sync_android_clipboard --target_devices '["laptop", "tablet"]'
```

### Device Information

```bash
# Get device specifications
get_android_device_info

# Get battery status
get_android_battery_status

# Get network information
get_android_network_status
```

### Sensor Data

```bash
# Get current location
get_android_location

# Get accelerometer data
get_android_sensor_data --sensor_type accelerometer

# Get sensor history
get_android_sensor_data --include_history true
```

### Device Control

```bash
# Take screenshot
android_take_screenshot

# Play notification sound
android_play_sound --sound_type notification

# Show toast message
android_show_toast --message "Hello from MCP!"

# Launch app
android_launch_app --package_name com.android.chrome
```

### Cognitive Analysis

```bash
# Analyze clipboard patterns
analyze_android_clipboard_patterns --pattern_type content

# Get device context
get_android_context --include_history true
```

## Architecture

```
Android Device/App <---WebSocket---> Android Bridge <---MCP---> Claude/Clients
       |                                      |
       | Clipboard, Sensors, Location         | FlatBuffers
       | Battery, Network, System             | Processing
       | Control Commands                     | Cognitive Analysis
       |                                      |
       └--- Real-time Data Streaming          └--- MCP Tools
```

## Cognitive Integration

The bridge integrates with the cognitive architecture by:

1. **Context Awareness**: Understanding device state and user behavior
2. **Pattern Recognition**: Identifying usage patterns and anomalies
3. **Predictive Actions**: Anticipating user needs based on context
4. **Learning**: Improving responses based on successful interactions

### Integration Points

- **Perceptual Layer**: Device state recognition and sensor data interpretation
- **Episodic Memory**: Clipboard usage and device interaction history
- **Semantic Knowledge**: Android ecosystem understanding and app behaviors
- **Procedural Workflows**: Automated device control sequences
- **Meta-Cognitive Layer**: Strategy selection for device interactions
- **Transfer Layer**: Cross-device pattern application
- **Evaluative Layer**: Interaction quality assessment and optimization

## Troubleshooting

### Simulation Issues

```bash
# Check simulation status
get_android_context

# Reset device simulation
# Restart the bridge service
```

### MCP Tool Issues

```bash
# Verify MCP server connection
claude mcp list

# Check tool availability
claude mcp get mcp-android-bridge
```

### Performance Tuning

```bash
# Adjust simulation intervals
export ANDROID_CLIPBOARD_INTERVAL=60000  # Less frequent updates
export ANDROID_SENSOR_INTERVAL=5000      # More frequent sensor reads

# Disable unnecessary simulations
export ANDROID_SIMULATE_LOCATION=false
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
- `ws` - WebSocket communication
- `@modelcontextprotocol/sdk` - MCP protocol

## License

Apache-2.0