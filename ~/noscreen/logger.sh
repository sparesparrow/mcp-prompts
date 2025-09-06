#!/bin/bash

# Logger utility for no-screen phone control scripts
# Provides consistent logging across all scripts

LOG_DIR="$HOME/noscreen/logs"
LOG_FILE="$LOG_DIR/noscreen_$(date +%Y%m%d).log"
MAX_LOG_SIZE=10485760  # 10MB

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to initialize logging
init_logger() {
    # Rotate log if it's too large
    if [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
    fi
    
    # Create log file if it doesn't exist
    touch "$LOG_FILE"
}

# Function to log messages with timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Also echo to console with color coding
    case $level in
        "INFO")
            echo -e "\033[32m[INFO]\033[0m $message"
            ;;
        "WARN")
            echo -e "\033[33m[WARN]\033[0m $message"
            ;;
        "ERROR")
            echo -e "\033[31m[ERROR]\033[0m $message"
            ;;
        "DEBUG")
            if [ "$DEBUG" = "true" ]; then
                echo -e "\033[36m[DEBUG]\033[0m $message"
            fi
            ;;
        *)
            echo "[$level] $message"
            ;;
    esac
}

# Function to log errors and exit
log_error_and_exit() {
    local message="$1"
    local exit_code="${2:-1}"
    log_message "ERROR" "$message"
    exit $exit_code
}

# Function to check dependencies
check_dependencies() {
    local deps=("$@")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_message "ERROR" "Missing dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    return 0
}

# Function to check network connectivity
check_network() {
    if ! ping -c 1 -W 3 8.8.8.8 &> /dev/null; then
        log_message "WARN" "No internet connectivity detected"
        return 1
    fi
    return 0
}

# Function to check if device is reachable
check_device_reachability() {
    local device_ip="$1"
    if ! ping -c 1 -W 3 "$device_ip" &> /dev/null; then
        log_message "WARN" "Device $device_ip is not reachable"
        return 1
    fi
    return 0
}

# Function to validate environment variables
validate_env_vars() {
    local required_vars=("$@")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_message "ERROR" "Missing environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    return 0
}

# Function to create backup
create_backup() {
    local source="$1"
    local backup_dir="$HOME/noscreen/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "$backup_dir"
    
    if [ -f "$source" ]; then
        cp "$source" "$backup_dir/$(basename "$source").$timestamp"
        log_message "INFO" "Backup created: $backup_dir/$(basename "$source").$timestamp"
    fi
}

# Function to cleanup old logs
cleanup_old_logs() {
    local days_to_keep=7
    find "$LOG_DIR" -name "*.log*" -mtime +$days_to_keep -delete 2>/dev/null
    log_message "INFO" "Cleaned up logs older than $days_to_keep days"
}

# Initialize logger when sourced
init_logger
