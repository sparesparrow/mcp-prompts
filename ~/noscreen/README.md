# No-Screen Phone Control System

A comprehensive, robust system for controlling an Android phone without a functional screen. Enhanced with error handling, logging, and multiple control methods.

## 🎯 Purpose
These tools help you control your phone when the screen is broken or unavailable, using various methods that don't require ADB confirmation. The system is designed for emergency situations and provides multiple fallback options.

## 🚀 Quick Start

### 1. Installation
```bash
# Clone or download the scripts to ~/noscreen/
cd ~/noscreen
chmod +x install.sh
./install.sh
```

### 2. Configuration
```bash
# Run the main control script
noscreen
# Or
~/noscreen/enhanced_control.sh
```

### 3. Setup your device
- Enable Developer Options on your phone
- Enable USB debugging and Wireless debugging
- Install KDE Connect, Join, and Termux on your phone

## 📱 Available Tools

### Core Scripts
- `enhanced_control.sh` - **Main control interface** with comprehensive menu
- `wireless_adb_setup.sh` - Wireless ADB setup with blind navigation
- `config.sh` - Centralized configuration management
- `logger.sh` - Robust logging system
- `install.sh` - Complete installation script

### Utility Scripts
- `control.sh` - Legacy control script (deprecated)
- `README.md` - This documentation

## 🔧 Enhanced Features

### ✅ Robust Error Handling
- Comprehensive error checking and recovery
- Graceful failure handling
- Detailed error messages and logging
- Automatic retry mechanisms

### ✅ Advanced Logging System
- Timestamped log entries
- Color-coded console output
- Log rotation (10MB limit)
- Debug mode support
- Log cleanup automation

### ✅ Configuration Management
- Centralized configuration file
- Environment variable validation
- Automatic configuration backup
- Runtime configuration updates

### ✅ Multiple Control Methods
- **KDE Connect**: SMS, file sharing, clipboard, notifications
- **Join API**: Screenshots, notifications, app launching, commands
- **SSH to Termux**: Command-line control
- **Wireless ADB**: Full system access
- **scrcpy**: Screen mirroring and control
- **Bluetooth keyboard/mouse**: Blind navigation

### ✅ Automated Setup
- Dependency checking and installation
- SSH key generation and setup
- Desktop shortcut creation
- Systemd service creation
- Bash completion and aliases

## 🎮 Usage Examples

### Take Screenshot
```bash
# Via Join API (saves to phone gallery)
noscreen
# Select: Screenshot Tools > Take screenshot (Join API)

# Via ADB (saves to PC)
noscreen
# Select: Screenshot Tools > Take screenshot (ADB)

# Via scrcpy (direct capture)
noscreen
# Select: Screenshot Tools > Take screenshot (scrcpy)
```

### Start Apps
```bash
# Start Telegram
noscreen
# Select: Screen Mirroring > Start scrcpy

# Or use Join API
curl -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"app:org.telegram.messenger\"}"
```

### SSH Access
```bash
# Connect to phone via SSH
noscreen
# Select: SSH Terminal Access > Connect to SSH

# Or directly
ssh -p 8022 u0_a123@192.168.200.84
```

### File Management
```bash
# Download screenshots
noscreen
# Select: Screenshot Tools > Download screenshots from phone

# Or via ADB
adb pull /sdcard/DCIM/Screenshots/*.png ~/noscreen/screenshots/
```

## 🔍 Troubleshooting

### Common Issues

#### Device Not Reachable
```bash
# Check network connectivity
ping 192.168.200.84

# Check device IP
noscreen
# Select: Configuration > Show current configuration
```

#### ADB Connection Issues
```bash
# Restart ADB server
adb kill-server && adb start-server

# Check device connection
adb devices

# Enable wireless debugging on phone
noscreen
# Select: Wireless ADB Setup > Show blind navigation guide
```

#### KDE Connect Issues
```bash
# Check if device is paired
kdeconnect-cli --list-devices

# Test connection
kdeconnect-cli --device YOUR_DEVICE_ID --ping
```

#### Join API Issues
```bash
# Verify credentials
noscreen
# Select: Configuration > Setup Join API credentials

# Test API
curl -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
  -H "Content-Type: application/json" \
  -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"test\"}"
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
noscreen

# View logs
tail -f ~/noscreen/logs/noscreen_$(date +%Y%m%d).log
```

## 📁 File Structure
```
~/noscreen/
├── enhanced_control.sh      # Main control interface
├── wireless_adb_setup.sh    # ADB setup and blind navigation
├── config.sh               # Configuration management
├── logger.sh               # Logging system
├── install.sh              # Installation script
├── control.sh              # Legacy control script
├── README.md               # This documentation
├── logs/                   # Log files
│   └── noscreen_YYYYMMDD.log
├── screenshots/            # Screenshot storage
├── backups/                # Configuration backups
└── config/                 # Additional configuration
```

## 🔐 Security Features

### SSH Security
- Ed25519 key generation
- Key-based authentication
- Secure file permissions
- Connection encryption

### Configuration Security
- Environment variable validation
- Secure credential storage
- Backup and recovery
- Access control

### Network Security
- Connection validation
- Timeout handling
- Error recovery
- Secure protocols

## 📋 Prerequisites

### PC Requirements
- Linux system (Ubuntu, Fedora, etc.)
- Internet connection
- USB port (for initial setup)

### Phone Requirements
- Android device with broken screen
- WiFi connectivity
- USB debugging capability
- Bluetooth keyboard/mouse (optional but recommended)

### Required Apps on Phone
1. **KDE Connect** - For basic control and file sharing
2. **Join** - For advanced API control
3. **Termux** - For SSH access and command-line control

## 🛠️ Maintenance

### Regular Maintenance
```bash
# Clean up old logs
noscreen
# Select: Maintenance > Clean up old logs

# Backup configuration
noscreen
# Select: Maintenance > Backup configuration

# Check system status
noscreen
# Select: Maintenance > Check system status
```

### Updates
```bash
# Update dependencies
sudo apt update && sudo apt upgrade

# Update scripts (if available)
# Check for updates in the repository
```

## 🆘 Emergency Procedures

### If Scripts Stop Working
1. Check logs: `tail -f ~/noscreen/logs/noscreen_*.log`
2. Restart services: `adb kill-server && adb start-server`
3. Check network: `ping 192.168.200.84`
4. Verify configuration: `noscreen` > Configuration > Show current configuration

### If Phone Becomes Unresponsive
1. Use hardware buttons: Power + Volume Down
2. Try wireless ADB: `adb connect 192.168.200.84:5555`
3. Use SSH if available: `ssh -p 8022 user@192.168.200.84`
4. Use Join API for emergency commands

## 📞 Support

### Getting Help
1. Check the logs: `~/noscreen/logs/`
2. Run debug mode: `DEBUG=true noscreen`
3. Check system status: `noscreen` > Maintenance > Check system status
4. Review this README for troubleshooting steps

### Emergency Contacts
- Device manufacturer support
- Local repair services
- Online Android communities

## 🔄 Version History

### v2.0 (Current)
- Enhanced error handling and logging
- Centralized configuration management
- Automated installation script
- Improved SSH setup
- Better documentation

### v1.0 (Previous)
- Basic control scripts
- Simple configuration
- Manual setup required

## 📄 License

This project is provided as-is for emergency use. Use at your own risk and ensure you have backups of important data.

## ⚠️ Disclaimer

These tools are designed for emergency situations when your phone screen is broken. Use responsibly and ensure you have proper authorization to control the device. The authors are not responsible for any data loss or device damage.

---

**Remember**: Always have backups of important data before attempting any phone control operations!
