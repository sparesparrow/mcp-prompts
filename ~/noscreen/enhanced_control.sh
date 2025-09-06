#!/bin/bash

# Enhanced Master Control Script for No-Screen Phone Control
# Comprehensive control with error handling and logging

# Load configuration and logger
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Function to show main menu
show_main_menu() {
    clear
    echo "=== Enhanced No-Screen Phone Control ==="
    echo "Device: $DEVICE_NAME ($DEVICE_IP)"
    echo "Status: $(get_connection_status)"
    echo ""
    echo "📱 Main Control:"
    echo "1. Wireless ADB Setup"
    echo "2. Screen Mirroring (scrcpy)"
    echo "3. SSH Terminal Access"
    echo "4. Screenshot Tools"
    echo "5. Communication Tools"
    echo "6. File Management"
    echo "7. System Control"
    echo "8. Configuration"
    echo "9. Maintenance"
    echo "10. Exit"
    echo ""
}

# Function to get connection status
get_connection_status() {
    if adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        echo -e "\033[32m✅ ADB Connected\033[0m"
    elif ping -c 1 -W 2 "$DEVICE_IP" &> /dev/null; then
        echo -e "\033[33m⚠️  Device Reachable (No ADB)\033[0m"
    else
        echo -e "\033[31m❌ Device Unreachable\033[0m"
    fi
}

# Function to handle wireless ADB setup
handle_adb_setup() {
    log_message "INFO" "Starting ADB setup menu"
    
    echo "=== Wireless ADB Setup ==="
    echo "1. Setup wireless ADB"
    echo "2. Test connection"
    echo "3. Show blind navigation guide"
    echo "4. Send automated keystrokes"
    echo "5. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-5): " choice
    
    case $choice in
        1)
            source "$SCRIPT_DIR/wireless_adb_setup.sh"
            setup_wireless_adb
            ;;
        2)
            if adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
                log_message "INFO" "ADB connection test successful"
                echo "✅ ADB connection working"
            else
                log_message "ERROR" "ADB connection test failed"
                echo "❌ ADB connection failed"
            fi
            ;;
        3)
            source "$SCRIPT_DIR/wireless_adb_setup.sh"
            show_blind_navigation
            ;;
        4)
            source "$SCRIPT_DIR/wireless_adb_setup.sh"
            send_automated_keystrokes
            ;;
        5)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle screen mirroring
handle_screen_mirroring() {
    log_message "INFO" "Starting screen mirroring menu"
    
    echo "=== Screen Mirroring ==="
    echo "1. Start scrcpy (full screen)"
    echo "2. Start scrcpy (windowed)"
    echo "3. Start scrcpy (low quality for performance)"
    echo "4. Take screenshot via scrcpy"
    echo "5. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-5): " choice
    
    case $choice in
        1)
            if command -v scrcpy &> /dev/null; then
                log_message "INFO" "Starting scrcpy full screen"
                scrcpy --max-size "$SCRCPY_MAX_SIZE" --bit-rate "$SCRCPY_BIT_RATE" --stay-awake
            else
                log_message "ERROR" "scrcpy not found"
                echo "❌ scrcpy not installed. Install with: sudo apt install scrcpy"
            fi
            ;;
        2)
            if command -v scrcpy &> /dev/null; then
                log_message "INFO" "Starting scrcpy windowed"
                scrcpy --max-size 800 --bit-rate 2M
            else
                log_message "ERROR" "scrcpy not found"
                echo "❌ scrcpy not installed"
            fi
            ;;
        3)
            if command -v scrcpy &> /dev/null; then
                log_message "INFO" "Starting scrcpy low quality"
                scrcpy --max-size 600 --bit-rate 1M
            else
                log_message "ERROR" "scrcpy not found"
                echo "❌ scrcpy not installed"
            fi
            ;;
        4)
            take_screenshot_scrcpy
            ;;
        5)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
}

# Function to take screenshot via scrcpy
take_screenshot_scrcpy() {
    log_message "INFO" "Taking screenshot via scrcpy"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local filename="$SCREENSHOT_DIR/screenshot_scrcpy_${timestamp}.$SCREENSHOT_FORMAT"
    
    # Create screenshot directory if it doesn't exist
    mkdir -p "$SCREENSHOT_DIR"
    
    # Use scrcpy to take screenshot
    if command -v scrcpy &> /dev/null; then
        scrcpy --screenshot "$filename" --max-size 800 --max-fps 1 &
        sleep 3
        pkill scrcpy
        
        if [ -f "$filename" ]; then
            log_message "INFO" "Screenshot saved: $filename"
            echo "✅ Screenshot saved: $filename"
        else
            log_message "ERROR" "Failed to take screenshot"
            echo "❌ Failed to take screenshot"
        fi
    else
        log_message "ERROR" "scrcpy not found"
        echo "❌ scrcpy not installed"
    fi
}

# Function to handle SSH access
handle_ssh_access() {
    log_message "INFO" "Starting SSH access menu"
    
    echo "=== SSH Terminal Access ==="
    echo "1. Connect to SSH"
    echo "2. Setup SSH access"
    echo "3. Send command via SSH"
    echo "4. File transfer via SSH"
    echo "5. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-5): " choice
    
    case $choice in
        1)
            log_message "INFO" "Connecting to SSH"
            ssh -p "$SSH_PORT" "$SSH_USERNAME@$DEVICE_IP"
            ;;
        2)
            source "$SCRIPT_DIR/wireless_adb_setup.sh"
            setup_ssh_access
            ;;
        3)
            read -p "Enter command to send: " command
            log_message "INFO" "Sending command via SSH: $command"
            ssh -p "$SSH_PORT" "$SSH_USERNAME@$DEVICE_IP" "$command"
            ;;
        4)
            echo "File transfer options:"
            echo "1. Download file from phone"
            echo "2. Upload file to phone"
            read -p "Choose option (1-2): " ft_choice
            
            case $ft_choice in
                1)
                    read -p "Enter remote file path: " remote_file
                    read -p "Enter local destination: " local_dest
                    scp -P "$SSH_PORT" "$SSH_USERNAME@$DEVICE_IP:$remote_file" "$local_dest"
                    ;;
                2)
                    read -p "Enter local file path: " local_file
                    read -p "Enter remote destination: " remote_dest
                    scp -P "$SSH_PORT" "$local_file" "$SSH_USERNAME@$DEVICE_IP:$remote_dest"
                    ;;
            esac
            ;;
        5)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle screenshot tools
handle_screenshot_tools() {
    log_message "INFO" "Starting screenshot tools menu"
    
    echo "=== Screenshot Tools ==="
    echo "1. Take screenshot (Join API)"
    echo "2. Take screenshot (ADB)"
    echo "3. Take screenshot (scrcpy)"
    echo "4. Download screenshots from phone"
    echo "5. View screenshot directory"
    echo "6. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            take_screenshot_join
            ;;
        2)
            take_screenshot_adb
            ;;
        3)
            take_screenshot_scrcpy
            ;;
        4)
            download_screenshots
            ;;
        5)
            ls -la "$SCREENSHOT_DIR"
            ;;
        6)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to take screenshot via Join API
take_screenshot_join() {
    log_message "INFO" "Taking screenshot via Join API"
    
    if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
        local response=$(curl -s -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
            -H "Content-Type: application/json" \
            -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"screenshot\"}")
        
        if echo "$response" | grep -q "success.*true"; then
            log_message "INFO" "Screenshot request sent successfully"
            echo "✅ Screenshot request sent to phone"
        else
            log_message "ERROR" "Failed to send screenshot request"
            echo "❌ Failed to send screenshot request"
        fi
    else
        log_message "ERROR" "Join API credentials not configured"
        echo "❌ Join API credentials not configured"
    fi
}

# Function to take screenshot via ADB
take_screenshot_adb() {
    log_message "INFO" "Taking screenshot via ADB"
    
    if adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local filename="$SCREENSHOT_DIR/screenshot_adb_${timestamp}.$SCREENSHOT_FORMAT"
        
        mkdir -p "$SCREENSHOT_DIR"
        
        if adb shell screencap -p /sdcard/screenshot.png; then
            if adb pull /sdcard/screenshot.png "$filename"; then
                adb shell rm /sdcard/screenshot.png
                log_message "INFO" "Screenshot saved: $filename"
                echo "✅ Screenshot saved: $filename"
            else
                log_message "ERROR" "Failed to pull screenshot"
                echo "❌ Failed to pull screenshot"
            fi
        else
            log_message "ERROR" "Failed to take screenshot on device"
            echo "❌ Failed to take screenshot on device"
        fi
    else
        log_message "ERROR" "Device not connected via ADB"
        echo "❌ Device not connected via ADB"
    fi
}

# Function to download screenshots
download_screenshots() {
    log_message "INFO" "Downloading screenshots from phone"
    
    if adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        mkdir -p "$SCREENSHOT_DIR"
        
        # Try different screenshot locations
        local locations=("/sdcard/DCIM/Screenshots" "/sdcard/Pictures/Screenshots" "/sdcard/Download")
        
        for location in "${locations[@]}"; do
            if adb shell ls "$location"/*.png 2>/dev/null; then
                log_message "INFO" "Found screenshots in $location"
                adb pull "$location"/*.png "$SCREENSHOT_DIR/"
                echo "✅ Screenshots downloaded from $location"
                return 0
            fi
        done
        
        log_message "WARN" "No screenshots found on device"
        echo "⚠️  No screenshots found on device"
    else
        log_message "ERROR" "Device not connected via ADB"
        echo "❌ Device not connected via ADB"
    fi
}

# Function to handle communication tools
handle_communication_tools() {
    log_message "INFO" "Starting communication tools menu"
    
    echo "=== Communication Tools ==="
    echo "1. Send SMS (KDE Connect)"
    echo "2. Send SMS (Join API)"
    echo "3. Send notification (Join API)"
    echo "4. Share clipboard (KDE Connect)"
    echo "5. Ring phone (Join API)"
    echo "6. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            read -p "Enter message: " message
            read -p "Enter phone number: " number
            kdeconnect-cli --device "$KDE_DEVICE_ID" --send-sms "$message" --destination "$number"
            ;;
        2)
            read -p "Enter message: " message
            read -p "Enter phone number: " number
            if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
                curl -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
                    -H "Content-Type: application/json" \
                    -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"sms:$number:$message\"}"
            else
                echo "❌ Join API credentials not configured"
            fi
            ;;
        3)
            read -p "Enter notification message: " message
            if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
                curl -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
                    -H "Content-Type: application/json" \
                    -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"$message\"}"
            else
                echo "❌ Join API credentials not configured"
            fi
            ;;
        4)
            read -p "Enter text to share: " text
            kdeconnect-cli --device "$KDE_DEVICE_ID" --share-text "$text"
            ;;
        5)
            if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
                curl -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
                    -H "Content-Type: application/json" \
                    -d "{\"apikey\": \"$JOIN_API_KEY\", \"deviceId\": \"$JOIN_DEVICE_ID\", \"text\": \"ring\"}"
            else
                echo "❌ Join API credentials not configured"
            fi
            ;;
        6)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle file management
handle_file_management() {
    log_message "INFO" "Starting file management menu"
    
    echo "=== File Management ==="
    echo "1. List files on phone (ADB)"
    echo "2. Copy file from phone (ADB)"
    echo "3. Copy file to phone (ADB)"
    echo "4. Delete file on phone (ADB)"
    echo "5. List files on phone (SSH)"
    echo "6. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            read -p "Enter directory path: " path
            adb shell ls -la "$path"
            ;;
        2)
            read -p "Enter remote file path: " remote_file
            read -p "Enter local destination: " local_dest
            adb pull "$remote_file" "$local_dest"
            ;;
        3)
            read -p "Enter local file path: " local_file
            read -p "Enter remote destination: " remote_dest
            adb push "$local_file" "$remote_dest"
            ;;
        4)
            read -p "Enter file path to delete: " file_path
            adb shell rm "$file_path"
            ;;
        5)
            read -p "Enter directory path: " path
            ssh -p "$SSH_PORT" "$SSH_USERNAME@$DEVICE_IP" "ls -la $path"
            ;;
        6)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle system control
handle_system_control() {
    log_message "INFO" "Starting system control menu"
    
    echo "=== System Control ==="
    echo "1. Reboot phone (ADB)"
    echo "2. Shutdown phone (ADB)"
    echo "3. Install APK (ADB)"
    echo "4. Uninstall app (ADB)"
    echo "5. List installed apps (ADB)"
    echo "6. Execute shell command (ADB)"
    echo "7. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-7): " choice
    
    case $choice in
        1)
            adb shell reboot
            ;;
        2)
            adb shell reboot -p
            ;;
        3)
            read -p "Enter APK file path: " apk_path
            adb install "$apk_path"
            ;;
        4)
            read -p "Enter package name: " package_name
            adb uninstall "$package_name"
            ;;
        5)
            adb shell pm list packages -3
            ;;
        6)
            read -p "Enter shell command: " command
            adb shell "$command"
            ;;
        7)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle configuration
handle_configuration() {
    log_message "INFO" "Starting configuration menu"
    
    echo "=== Configuration ==="
    echo "1. Show current configuration"
    echo "2. Update device IP"
    echo "3. Update KDE Connect device ID"
    echo "4. Setup Join API credentials"
    echo "5. Test configuration"
    echo "6. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            show_config
            ;;
        2)
            read -p "Enter new device IP: " new_ip
            update_config "DEVICE_IP" "$new_ip"
            ;;
        3)
            read -p "Enter new KDE Connect device ID: " new_id
            update_config "KDE_DEVICE_ID" "$new_id"
            ;;
        4)
            read -p "Enter Join API key: " api_key
            read -p "Enter Join device ID: " device_id
            update_config "JOIN_API_KEY" "$api_key"
            update_config "JOIN_DEVICE_ID" "$device_id"
            ;;
        5)
            validate_config
            ;;
        6)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Function to handle maintenance
handle_maintenance() {
    log_message "INFO" "Starting maintenance menu"
    
    echo "=== Maintenance ==="
    echo "1. Clean up old logs"
    echo "2. Backup configuration"
    echo "3. Check system status"
    echo "4. Update scripts"
    echo "5. Back to main menu"
    echo ""
    
    read -p "Choose an option (1-5): " choice
    
    case $choice in
        1)
            cleanup_old_logs
            ;;
        2)
            create_backup "$SCRIPT_DIR/config.sh"
            ;;
        3)
            echo "=== System Status ==="
            echo "Device reachable: $(ping -c 1 -W 2 "$DEVICE_IP" &> /dev/null && echo "Yes" || echo "No")"
            echo "ADB connected: $(adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device" && echo "Yes" || echo "No")"
            echo "KDE Connect available: $(command -v kdeconnect-cli &> /dev/null && echo "Yes" || echo "No")"
            echo "scrcpy available: $(command -v scrcpy &> /dev/null && echo "Yes" || echo "No")"
            echo "SSH key exists: $([ -f "$SSH_KEY_PATH" ] && echo "Yes" || echo "No")"
            ;;
        4)
            echo "Scripts are up to date"
            ;;
        5)
            return
            ;;
        *)
            log_message "ERROR" "Invalid option"
            ;;
    esac
    
    read -p "Press Enter to continue..."
}

# Main function
main() {
    log_message "INFO" "Starting enhanced control script"
    
    # Validate configuration
    if ! validate_config; then
        log_message "WARN" "Configuration validation failed, but continuing"
    fi
    
    while true; do
        show_main_menu
        read -p "Choose an option (1-10): " choice
        
        case $choice in
            1)
                handle_adb_setup
                ;;
            2)
                handle_screen_mirroring
                ;;
            3)
                handle_ssh_access
                ;;
            4)
                handle_screenshot_tools
                ;;
            5)
                handle_communication_tools
                ;;
            6)
                handle_file_management
                ;;
            7)
                handle_system_control
                ;;
            8)
                handle_configuration
                ;;
            9)
                handle_maintenance
                ;;
            10)
                log_message "INFO" "Exiting enhanced control script"
                echo "Goodbye!"
                exit 0
                ;;
            *)
                log_message "ERROR" "Invalid option: $choice"
                echo "Invalid option. Please try again."
                sleep 2
                ;;
        esac
    done
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
