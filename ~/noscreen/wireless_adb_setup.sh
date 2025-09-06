#!/bin/bash

# Wireless ADB and scrcpy Setup Script
# Enhanced with error handling and logging

# Load configuration and logger
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Function to setup wireless ADB
setup_wireless_adb() {
    log_message "INFO" "Starting wireless ADB setup for $DEVICE_NAME"
    
    # Check dependencies
    if ! check_dependencies "adb" "ping"; then
        log_error_and_exit "Required dependencies not found"
    fi
    
    # Check device reachability
    if ! check_device_reachability "$DEVICE_IP"; then
        log_message "ERROR" "Device $DEVICE_IP is not reachable"
        log_message "INFO" "Please ensure your phone is connected to the same network"
        return 1
    fi
    
    # Kill existing ADB processes
    log_message "INFO" "Stopping existing ADB processes"
    pkill -f adb 2>/dev/null
    sleep 2
    
    # Start ADB server
    log_message "INFO" "Starting ADB server"
    if ! adb start-server; then
        log_error_and_exit "Failed to start ADB server"
    fi
    
    # Try to connect
    log_message "INFO" "Attempting to connect to $DEVICE_IP:$ADB_PORT"
    if ! adb connect "$DEVICE_IP:$ADB_PORT"; then
        log_message "ERROR" "Failed to connect to device"
        log_message "INFO" "Please ensure wireless debugging is enabled on your phone"
        return 1
    fi
    
    # Wait for connection
    sleep 3
    
    # Check connection
    log_message "INFO" "Checking ADB connection"
    local devices_output=$(adb devices)
    log_message "DEBUG" "ADB devices output: $devices_output"
    
    if echo "$devices_output" | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        log_message "INFO" "Successfully connected to device"
        return 0
    else
        log_message "ERROR" "Device not properly connected"
        return 1
    fi
}

# Function to test scrcpy connection
test_scrcpy() {
    log_message "INFO" "Testing scrcpy connection"
    
    if ! command -v scrcpy &> /dev/null; then
        log_message "WARN" "scrcpy not found. Install with: sudo apt install scrcpy"
        return 1
    fi
    
    # Check if device is connected via ADB
    if ! adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        log_message "ERROR" "Device not connected via ADB"
        return 1
    fi
    
    log_message "INFO" "Starting scrcpy test (press Ctrl+C to stop)"
    log_message "INFO" "scrcpy parameters: --max-size $SCRCPY_MAX_SIZE --bit-rate $SCRCPY_BIT_RATE"
    
    if [ "$SCRCPY_STAY_AWAKE" = "true" ]; then
        scrcpy --max-size "$SCRCPY_MAX_SIZE" --bit-rate "$SCRCPY_BIT_RATE" --stay-awake
    else
        scrcpy --max-size "$SCRCPY_MAX_SIZE" --bit-rate "$SCRCPY_BIT_RATE"
    fi
}

# Function to setup SSH access
setup_ssh_access() {
    log_message "INFO" "Setting up SSH access"
    
    # Check if SSH key exists
    if [ ! -f "$SSH_KEY_PATH" ]; then
        log_message "INFO" "Generating SSH key pair"
        ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "noscreen-control"
    fi
    
    # Try to copy SSH key to device
    log_message "INFO" "Attempting to copy SSH key to device"
    if ssh-copy-id -p "$SSH_PORT" "$SSH_USERNAME@$DEVICE_IP"; then
        log_message "INFO" "SSH key copied successfully"
    else
        log_message "WARN" "Failed to copy SSH key automatically"
        log_message "INFO" "You may need to copy it manually or use password authentication"
    fi
}

# Function to provide blind navigation instructions
show_blind_navigation() {
    echo "=== Blind Navigation Instructions ==="
    echo ""
    echo "Since you have a keyboard connected, you can navigate to enable ADB:"
    echo ""
    echo "1. Press Windows key (or Home) to go to home screen"
    echo "2. Press Tab to navigate to app drawer/search"
    echo "3. Type 'settings' and press Enter"
    echo "4. Use arrow keys to navigate to 'About phone'"
    echo "5. Press Enter, then navigate to 'Build number'"
    echo "6. Press Enter 7 times to enable Developer options"
    echo "7. Go back to Settings > System > Developer options"
    echo "8. Enable 'USB debugging' and 'Wireless debugging'"
    echo "9. Note the IP address and port shown"
    echo ""
    echo "Common keyboard shortcuts:"
    echo "- Windows key: Home screen"
    echo "- Alt+Tab: Switch apps"
    echo "- Tab: Navigate between elements"
    echo "- Arrow keys: Move selection"
    echo "- Enter: Select/activate"
    echo "- Escape: Go back"
    echo "- Ctrl+W: Close app"
    echo ""
}

# Function to send automated keystrokes
send_automated_keystrokes() {
    log_message "INFO" "Sending automated keystrokes for ADB setup"
    
    # Check if device is connected
    if ! adb devices | grep -q "$DEVICE_IP:$ADB_PORT.*device"; then
        log_message "ERROR" "Device not connected via ADB"
        return 1
    fi
    
    # Navigate to Settings
    log_message "INFO" "Navigating to Settings"
    adb shell input keyevent KEYCODE_HOME
    sleep 1
    adb shell input text "settings"
    sleep 1
    adb shell input keyevent KEYCODE_ENTER
    sleep 2
    
    # Navigate to About phone
    log_message "INFO" "Navigating to About phone"
    for i in {1..5}; do
        adb shell input keyevent KEYCODE_DPAD_DOWN
        sleep 0.5
    done
    adb shell input keyevent KEYCODE_ENTER
    sleep 1
    
    # Navigate to Build number
    log_message "INFO" "Navigating to Build number"
    for i in {1..3}; do
        adb shell input keyevent KEYCODE_DPAD_DOWN
        sleep 0.5
    done
    adb shell input keyevent KEYCODE_ENTER
    sleep 1
    
    # Press Enter 7 times to enable Developer options
    log_message "INFO" "Enabling Developer options"
    for i in {1..7}; do
        adb shell input keyevent KEYCODE_ENTER
        sleep 0.5
    done
    
    log_message "INFO" "Automated keystrokes completed"
    log_message "INFO" "Please manually enable USB debugging and Wireless debugging"
}

# Main function
main() {
    log_message "INFO" "=== Wireless ADB Setup for $DEVICE_NAME ==="
    
    # Show current configuration
    show_config
    
    echo ""
    echo "Choose an option:"
    echo "1. Setup wireless ADB"
    echo "2. Test scrcpy connection"
    echo "3. Setup SSH access"
    echo "4. Show blind navigation instructions"
    echo "5. Send automated keystrokes"
    echo "6. Full setup (all steps)"
    echo "7. Exit"
    echo ""
    
    read -p "Choose an option (1-7): " choice
    
    case $choice in
        1)
            setup_wireless_adb
            ;;
        2)
            test_scrcpy
            ;;
        3)
            setup_ssh_access
            ;;
        4)
            show_blind_navigation
            ;;
        5)
            send_automated_keystrokes
            ;;
        6)
            log_message "INFO" "Running full setup"
            setup_wireless_adb && test_scrcpy && setup_ssh_access
            ;;
        7)
            log_message "INFO" "Exiting"
            exit 0
            ;;
        *)
            log_message "ERROR" "Invalid option"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
