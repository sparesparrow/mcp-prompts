# MCP Embedded Coordinator

Unified coordinator for embedded systems providing high-level orchestration of ESP32 and Android devices through MCP tools.

## Overview

The Embedded Coordinator provides:
- **Device Discovery**: Automatic detection and registration of embedded devices
- **Cross-Device Coordination**: Orchestrated workflows spanning multiple devices
- **Data Aggregation**: Unified telemetry and clipboard data access
- **Health Monitoring**: System-wide health checks and anomaly detection
- **Cognitive Integration**: Pattern analysis and predictive behavior modeling

## Features

### Device Coordination
- **Unified Device Registry**: ESP32 and Android devices in single interface
- **Automatic Discovery**: Device detection and capability assessment
- **Status Monitoring**: Real-time health and connectivity monitoring
- **Capability Mapping**: Device feature and limitation tracking

### Data Orchestration
- **Telemetry Aggregation**: Cross-device sensor data collection and analysis
- **Clipboard Synchronization**: Unified clipboard management across devices
- **Historical Analysis**: Time-series data analysis and pattern detection
- **Data Backup**: Coordinated backup of device data and configurations

### Cognitive Workflows
- **Cross-Device Workflows**: Multi-device orchestrated operations
- **Pattern Recognition**: Usage pattern analysis across device ecosystem
- **Predictive Modeling**: Behavior prediction based on historical data
- **Anomaly Detection**: Automated detection of unusual device behavior

### Safety and Reliability
- **Emergency Shutdown**: Coordinated emergency stop for all devices
- **Health Monitoring**: Continuous system health assessment
- **Fault Tolerance**: Graceful handling of device failures
- **Recovery Procedures**: Automated recovery from failure conditions

## MCP Tools

### Device Management
- `discover_embedded_devices` - Discover and list all embedded devices
- `get_embedded_device_status` - Get overview of device status and health

### Data Operations
- `sync_clipboard_across_devices` - Synchronize clipboard across devices
- `aggregate_embedded_telemetry` - Aggregate sensor data from multiple devices

### Workflow Orchestration
- `execute_cross_device_workflow` - Execute coordinated multi-device workflows
- `monitor_embedded_health` - Monitor health of all embedded devices

### Cognitive Analysis
- `analyze_embedded_patterns` - Analyze usage patterns across devices
- `predict_embedded_behavior` - Predict device behavior based on patterns

### Safety Operations
- `emergency_embedded_shutdown` - Emergency shutdown of all devices
- `backup_embedded_data` - Backup data from all embedded devices

## Installation

```bash
# From the monorepo root
pnpm install
cd packages/mcp-embedded-coordinator
pnpm build
```

## Configuration

### Environment Variables

```bash
# Bridge service URLs
ESP32_BRIDGE_URL=http://localhost:3001      # ESP32 bridge service URL
ANDROID_BRIDGE_URL=http://localhost:3002    # Android bridge service URL

# Simulation settings
ENABLE_SIMULATION=true                      # Enable device simulation for development
MAX_HISTORY_SIZE=10000                     # Maximum telemetry history size

# Service settings
LOG_LEVEL=info                             # Logging verbosity
MODE=mcp                                   # Run mode (mcp only)
```

### MCP Configuration

```json
{
  "mcpServers": {
    "mcp-embedded-coordinator": {
      "command": "node",
      "args": ["/path/to/mcp-embedded-coordinator/dist/embedded-coordinator.js"],
      "env": {
        "ESP32_BRIDGE_URL": "http://esp32-bridge:3001",
        "ANDROID_BRIDGE_URL": "http://android-bridge:3002",
        "ENABLE_SIMULATION": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Usage

### Device Discovery

```bash
# Discover all devices
discover_embedded_devices

# Discover specific device types
discover_embedded_devices --device_types '["esp32"]'

# Include offline devices
discover_embedded_devices --include_offline true
```

### Status Monitoring

```bash
# Get overall device status
get_embedded_device_status

# Monitor device health
monitor_embedded_health

# Monitor with telemetry analysis
monitor_embedded_health --include_telemetry true
```

### Data Operations

```bash
# Sync clipboard across all devices
sync_clipboard_across_devices

# Sync specific content
sync_clipboard_across_devices --content "Hello from coordinator"

# Aggregate telemetry data
aggregate_embedded_telemetry --sensor_types '["temperature", "bpm"]'

# Aggregate from specific devices
aggregate_embedded_telemetry --device_ids '["esp32-001", "android-001"]'
```

### Workflow Execution

```bash
# Execute cross-device workflow
execute_cross_device_workflow \
  --workflow_name "health_monitoring" \
  --devices '["esp32-001", "android-001"]'

# Execute with parameters
execute_cross_device_workflow \
  --workflow_name "data_collection" \
  --devices '["esp32-001"]' \
  --parameters '{"interval_ms": 5000}'
```

### Pattern Analysis

```bash
# Analyze usage patterns
analyze_embedded_patterns --pattern_type usage

# Analyze telemetry patterns
analyze_embedded_patterns --pattern_type telemetry --time_range '{"start": 1703123456789}'

# Predict device behavior
predict_embedded_behavior \
  --device_id "esp32-001" \
  --prediction_type battery \
  --timeframe_minutes 60
```

### Safety Operations

```bash
# Emergency shutdown
emergency_embedded_shutdown --reason "System maintenance"

# Force shutdown
emergency_embedded_shutdown --reason "Critical failure" --force true

# Backup all data
backup_embedded_data

# Selective backup
backup_embedded_data --include_clipboard false
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ESP32 Bridge  │    │  Coordinator     │    │ Android Bridge  │
│                 │    │                  │    │                 │
│ • Telemetry     │◄──►│ • Device Mgmt    │◄──►│ • Clipboard     │
│ • Control       │    │ • Data Agg       │    │ • Sensors       │
│ • Serial        │    │ • Workflows      │    │ • Device Ctrl   │
└─────────────────┘    │ • Health Mon     │    └─────────────────┘
                       │ • Pattern Anal   │
ESP32 Devices          │ • Prediction     │    Android Devices
                       └──────────────────┘
                              ▲
                              │
                              ▼
                       ┌─────────────────┐
                       │ mcp-prompts     │
                       │                 │
                       │ • Cognitive     │
                       │ • Learning      │
                       │ • Patterns      │
                       └─────────────────┘
```

## Integration with Cognitive Architecture

The coordinator integrates with the cognitive architecture by:

1. **Device State Awareness**: Understanding device capabilities and status
2. **Pattern Learning**: Recognizing usage patterns across device ecosystem
3. **Predictive Coordination**: Anticipating device needs and coordinating responses
4. **Workflow Optimization**: Learning and improving multi-device workflows
5. **Anomaly Response**: Coordinated response to device anomalies

### Cognitive Layers Integration

- **Perceptual**: Device discovery and capability assessment
- **Episodic**: Cross-device interaction history and patterns
- **Semantic**: Device ecosystem knowledge and relationships
- **Procedural**: Multi-device workflow execution and optimization
- **Meta-Cognitive**: Coordination strategy selection and adaptation
- **Transfer**: Pattern application across similar device configurations
- **Evaluative**: Coordination effectiveness assessment and improvement

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
- `@sparesparrow/mcp-esp32-bridge` - ESP32 device bridge
- `@sparesparrow/mcp-android-bridge` - Android device bridge
- `@modelcontextprotocol/sdk` - MCP protocol

## License

Apache-2.0