#!/bin/bash

# Configuration file for no-screen phone control scripts
# Centralized configuration management

# Load logger
source "$(dirname "$0")/logger.sh"

# Device Configuration
DEVICE_IP="${DEVICE_IP:-192.168.200.84}"
DEVICE_NAME="${DEVICE_NAME:-moto g84 5G}"
ADB_PORT="${ADB_PORT:-5555}"
SSH_PORT="${SSH_PORT:-8022}"

# KDE Connect Configuration
KDE_DEVICE_ID="${KDE_DEVICE_ID:-eb7e3a07_6abd_4edf_8ccd_2d6b91ab3d6c}"

# Join API Configuration
JOIN_API_KEY="${JOIN_API_KEY}"
JOIN_DEVICE_ID="${JOIN_DEVICE_ID}"

# SSH Configuration
SSH_USERNAME="${SSH_USERNAME:-u0_a123}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"

# scrcpy Configuration
SCRCPY_MAX_SIZE="${SCRCPY_MAX_SIZE:-800}"
SCRCPY_BIT_RATE="${SCRCPY_BIT_RATE:-2M}"
SCRCPY_STAY_AWAKE="${SCRCPY_STAY_AWAKE:-true}"

# Screenshot Configuration
SCREENSHOT_DIR="${SCREENSHOT_DIR:-$HOME/noscreen/screenshots}"
SCREENSHOT_FORMAT="${SCREENSHOT_FORMAT:-png}"

# Notification Configuration
NOTIFICATION_TIMEOUT="${NOTIFICATION_TIMEOUT:-30}"

# Logging Configuration
DEBUG="${DEBUG:-false}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# Timeout Configuration
CONNECTION_TIMEOUT="${CONNECTION_TIMEOUT:-10}"
COMMAND_TIMEOUT="${COMMAND_TIMEOUT:-30}"

# Function to load configuration from file
load_config() {
    local config_file="$HOME/noscreen/config.conf"
    
    if [ -f "$config_file" ]; then
        log_message "DEBUG" "Loading configuration from $config_file"
        source "$config_file"
    else
        log_message "INFO" "No configuration file found, using defaults"
        create_default_config "$config_file"
    fi
}

# Function to create default configuration
create_default_config() {
    local config_file="$1"
    
    cat > "$config_file" << EOF
# No-Screen Phone Control Configuration
# Generated on $(date)

# Device Configuration
DEVICE_IP="$DEVICE_IP"
DEVICE_NAME="$DEVICE_NAME"
ADB_PORT="$ADB_PORT"
SSH_PORT="$SSH_PORT"

# KDE Connect Configuration
KDE_DEVICE_ID="$KDE_DEVICE_ID"

# Join API Configuration
# Set these values manually:
# JOIN_API_KEY="your_api_key_here"
# JOIN_DEVICE_ID="your_device_id_here"

# SSH Configuration
SSH_USERNAME="$SSH_USERNAME"
SSH_KEY_PATH="$SSH_KEY_PATH"

# scrcpy Configuration
SCRCPY_MAX_SIZE="$SCRCPY_MAX_SIZE"
SCRCPY_BIT_RATE="$SCRCPY_BIT_RATE"
SCRCPY_STAY_AWAKE="$SCRCPY_STAY_AWAKE"

# Screenshot Configuration
SCREENSHOT_DIR="$SCREENSHOT_DIR"
SCREENSHOT_FORMAT="$SCREENSHOT_FORMAT"

# Notification Configuration
NOTIFICATION_TIMEOUT="$NOTIFICATION_TIMEOUT"

# Logging Configuration
DEBUG="$DEBUG"
LOG_LEVEL="$LOG_LEVEL"

# Timeout Configuration
CONNECTION_TIMEOUT="$CONNECTION_TIMEOUT"
COMMAND_TIMEOUT="$COMMAND_TIMEOUT"
EOF
    
    log_message "INFO" "Default configuration created at $config_file"
}

# Function to validate configuration
validate_config() {
    local errors=()
    
    # Check required directories
    local required_dirs=("$SCREENSHOT_DIR" "$(dirname "$LOG_FILE")")
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_message "INFO" "Created directory: $dir"
        fi
    done
    
    # Check device reachability
    if ! check_device_reachability "$DEVICE_IP"; then
        errors+=("Device $DEVICE_IP is not reachable")
    fi
    
    # Check KDE Connect
    if ! command -v kdeconnect-cli &> /dev/null; then
        errors+=("KDE Connect CLI not found")
    fi
    
    # Check ADB
    if ! command -v adb &> /dev/null; then
        errors+=("ADB not found")
    fi
    
    # Check scrcpy
    if ! command -v scrcpy &> /dev/null; then
        log_message "WARN" "scrcpy not found - screen mirroring will not be available"
    fi
    
    # Report errors
    if [ ${#errors[@]} -gt 0 ]; then
        for error in "${errors[@]}"; do
            log_message "ERROR" "$error"
        done
        return 1
    fi
    
    return 0
}

# Function to update configuration
update_config() {
    local key="$1"
    local value="$2"
    local config_file="$HOME/noscreen/config.conf"
    
    if [ -f "$config_file" ]; then
        # Update the configuration file
        sed -i "s/^${key}=.*/${key}=\"${value}\"/" "$config_file"
        # Update the variable
        export "$key"="$value"
        log_message "INFO" "Updated configuration: $key=$value"
    else
        log_message "ERROR" "Configuration file not found"
        return 1
    fi
}

# Function to show current configuration
show_config() {
    echo "=== Current Configuration ==="
    echo "Device IP: $DEVICE_IP"
    echo "Device Name: $DEVICE_NAME"
    echo "ADB Port: $ADB_PORT"
    echo "SSH Port: $SSH_PORT"
    echo "KDE Device ID: $KDE_DEVICE_ID"
    echo "SSH Username: $SSH_USERNAME"
    echo "Screenshot Directory: $SCREENSHOT_DIR"
    echo "Debug Mode: $DEBUG"
    echo "Log Level: $LOG_LEVEL"
    echo ""
    
    if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
        echo "Join API: Configured"
    else
        echo "Join API: Not configured"
    fi
}

# Load configuration when sourced
load_config
