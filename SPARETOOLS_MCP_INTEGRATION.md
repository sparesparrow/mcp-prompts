# SpareTools MCP Servers Integration

This document describes the integration of SpareTools MCP servers with the mcp-prompts system, providing AI-assisted workflows for embedded systems development.

## Overview

The SpareTools MCP servers provide comprehensive tooling for:
- **ESP32 Development**: Serial monitoring and device interaction
- **Android Development**: APK building, deployment, and testing
- **Package Management**: Conan packaging and Cloudsmith distribution
- **Repository Maintenance**: Git repository analysis and cleanup

## Available Prompts

### Individual Server Prompts

#### `sparetools-esp32-monitor`
**Purpose**: ESP32 device monitoring and serial communication
**Tools**: 8 ESP32-specific monitoring and debugging tools
**Usage**: Hardware debugging, firmware development, device testing

#### `sparetools-android-dev`
**Purpose**: Complete Android development workflow
**Tools**: 7 Android development and deployment tools
**Usage**: Mobile app development, testing, deployment

#### `sparetools-conan-cloudsmith`
**Purpose**: C++ package management and distribution
**Tools**: 9 Conan and Cloudsmith package management tools
**Usage**: Package creation, dependency management, distribution

#### `sparetools-repo-cleanup`
**Purpose**: Repository health analysis and maintenance
**Tools**: 4 Git repository analysis and cleanup tools
**Usage**: Repository optimization, cleanup recommendations

### Integrated Workflow Prompt

#### `sparetools-full-workflow`
**Purpose**: Complete development lifecycle from hardware to cloud
**Tools**: All 28 SpareTools MCP tools across 4 servers
**Usage**: Full-stack embedded systems development

## MCP Server Configuration

To use these prompts, configure the following MCP servers in your Cursor MCP settings:

```json
{
  "mcpServers": {
    "sparetools-esp32": {
      "command": "sparetools-mcp-esp32",
      "env": {
        "ESP32_LOG_LEVEL": "INFO"
      }
    },
    "sparetools-android": {
      "command": "sparetools-mcp-android",
      "env": {
        "ANDROID_LOG_LEVEL": "INFO"
      }
    },
    "sparetools-conan": {
      "command": "sparetools-mcp-conan",
      "env": {
        "CLOUDSMITH_API_KEY": "${CLOUDSMITH_API_KEY}",
        "CLOUDSMITH_ORG": "${CLOUDSMITH_ORG}"
      }
    },
    "sparetools-repo": {
      "command": "sparetools-mcp-repo"
    }
  }
}
```

## Installation

Install the SpareTools MCP servers package:

```bash
# Via Conan
conan install sparetools-mcp-servers/1.0.0@sparesparrow/stable

# Via SpareTools monorepo
conan install sparetools-monorepo/1.0.0@sparesparrow/stable
```

## Usage Examples

### ESP32 Firmware Development

```bash
# Activate ESP32 monitoring prompt
/esp32-monitor

# Then use natural language commands:
"Start monitoring my ESP32 device on /dev/ttyUSB0"
"Check the status of the monitoring session"
"Stop the serial monitor"
```

### Android App Development

```bash
# Activate Android development prompt
/android-dev

# Development workflow commands:
"Check what Android devices are connected"
"Build a debug APK for my android-app project"
"Deploy the APK to the first connected device"
"Run unit tests on the Android project"
```

### Package Management

```bash
# Activate Conan/Cloudsmith prompt
/conan-cloudsmith

# Package lifecycle commands:
"Validate my conanfile.py configuration"
"Create a Conan package from the conanfile"
"Set up a Cloudsmith remote repository"
"Upload the package to Cloudsmith"
```

### Repository Maintenance

```bash
# Activate repository cleanup prompt
/repo-cleanup

# Repository analysis commands:
"Scan my repository for cleanup opportunities"
"Find all files larger than 50MB"
"Check the current Git status"
"Analyze repository disk usage"
```

### Full Development Workflow

```bash
# Activate complete workflow prompt
/full-workflow

# Comprehensive development commands:
"Start ESP32 monitoring and show me the device output"
"Build and deploy my Android app to test the integration"
"Create and publish my Conan package to Cloudsmith"
"Analyze the repository and suggest cleanup actions"
```

## Tool Categories and Capabilities

### ESP32 Serial Monitor (8 tools)
- Device detection and port scanning
- Serial communication monitoring
- Session management and logging
- Real-time command sending

### Android Development (7 tools)
- Device management and detection
- APK building with Gradle
- App deployment and installation
- Testing framework integration
- Log monitoring and debugging
- Data management and cleanup

### Conan & Cloudsmith (9 tools)
- Conanfile validation and analysis
- Package creation and building
- Remote repository management
- Package uploading and distribution
- Dependency resolution and installation
- Package information and searching

### Repository Cleanup (4 tools)
- Comprehensive repository scanning
- Large file detection and analysis
- Git status monitoring
- Disk usage analysis and reporting

## Integration Benefits

### For Developers
- **Streamlined Workflow**: Single interface for hardware, mobile, and packaging tasks
- **AI Assistance**: Intelligent prompts guide tool usage and best practices
- **Error Prevention**: Validation and safety checks built into all operations
- **Time Savings**: Automated workflows reduce manual command execution

### For Teams
- **Standardized Processes**: Consistent development workflows across team members
- **Knowledge Sharing**: Prompts capture and share development best practices
- **Quality Assurance**: Automated validation and testing integration
- **Documentation**: Self-documenting workflows through prompt usage

## Advanced Usage

### Custom Workflows

Combine multiple prompts for specialized workflows:

```bash
# IoT Device Development
/esp32-monitor
/android-dev

# Commands for IoT device with companion app:
"Monitor ESP32 serial output while building Android app"
"Deploy Android app and check ESP32 communication"
```

### CI/CD Integration

Use prompts in automated pipelines:

```bash
# Automated package publishing
/conan-cloudsmith
"Validate and create package, then upload to Cloudsmith"
```

### Repository Health Monitoring

```bash
# Regular maintenance
/repo-cleanup
"Scan repository and generate cleanup report"
```

## Troubleshooting

### MCP Server Not Available
- Ensure SpareTools MCP servers package is installed
- Check MCP server configuration in Cursor settings
- Verify environment variables are set correctly

### Tool Execution Errors
- Check device connections (ESP32, Android)
- Verify file paths and permissions
- Ensure required dependencies are installed

### Prompt Not Found
- Update mcp-prompts package to latest version
- Restart Cursor to refresh prompt cache
- Check prompt availability with `/list-prompts`

## Contributing

To contribute new SpareTools MCP prompts:

1. Add prompt JSON file to `data/prompts/public/`
2. Update `data/prompts/index.json` with new prompt data
3. Test prompt functionality with MCP servers
4. Submit pull request with documentation

## Related Resources

- [SpareTools MCP Servers Documentation](https://sparetools.readthedocs.io/)
- [MCP Prompts Usage Guide](https://github.com/sparesparrow/mcp-prompts)
- [Conan Package Manager](https://conan.io/)
- [Cloudsmith Package Registry](https://cloudsmith.io/)

---

*This integration provides AI-powered assistance for the complete embedded systems development lifecycle using SpareTools MCP servers.*