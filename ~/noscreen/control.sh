#!/bin/bash

# Master Control Script for No-Screen Phone Control
# Easy access to all phone control tools

cd ~/noscreen

echo "=== No-Screen Phone Control Master Menu ==="
echo ""
echo "📱 Main Control:"
echo "1. no_screen_control.sh - Complete control menu"
echo "2. phone_control.sh - Phone control options"
echo "3. start_apps.sh - Launch apps (Telegram, etc.)"
echo ""
echo "📸 Screenshots:"
echo "4. take_screenshot.sh - Take screenshots"
echo "5. pull_screenshot.sh - Download screenshots"
echo "6. read_notifications.sh - Read notifications"
echo ""
echo "💬 Communication:"
echo "7. send_sms.sh - Send SMS via KDE Connect"
echo "8. send_sms_join.sh - Send SMS via Join API"
echo "9. send_command.sh - Send commands via Join API"
echo ""
echo "🔧 SSH Access:"
echo "10. setup_ssh.sh - Setup SSH to Termux"
echo "11. connect_ssh.sh - Connect to phone via SSH"
echo ""
echo "📋 Quick Actions:"
echo "12. Take screenshot now (Join API)"
echo "13. Start Telegram now (Join API)"
echo "14. Send test SMS"
echo "15. Setup environment variables"
echo "16. View README"
echo "17. Exit"
echo ""

read -p "Choose an option (1-17): " choice

case $choice in
    1)
        ./no_screen_control.sh
        ;;
    2)
        ./phone_control.sh
        ;;
    3)
        ./start_apps.sh
        ;;
    4)
        ./take_screenshot.sh
        ;;
    5)
        ./pull_screenshot.sh
        ;;
    6)
        ./read_notifications.sh
        ;;
    7)
        ./send_sms.sh
        ;;
    8)
        ./send_sms_join.sh
        ;;
    9)
        ./send_command.sh
        ;;
    10)
        ./setup_ssh.sh
        ;;
    11)
        ./connect_ssh.sh
        ;;
    12)
        echo "Taking screenshot via Join API..."
        if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
            response=$(curl -s -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
                -H "Content-Type: application/json" \
                -d "{
                    \"apikey\": \"$JOIN_API_KEY\",
                    \"deviceId\": \"$JOIN_DEVICE_ID\",
                    \"text\": \"screenshot\"
                }")
            echo "✅ Screenshot request sent!"
            echo "Response: $response"
        else
            echo "❌ Join API credentials not set"
            echo "Run option 15 to setup environment variables"
        fi
        ;;
    13)
        echo "Starting Telegram via Join API..."
        if [ -n "$JOIN_API_KEY" ] && [ -n "$JOIN_DEVICE_ID" ]; then
            response=$(curl -s -X POST "https://joinjoaomgcd.appspot.com/_ah/api/messaging/v1/sendPush" \
                -H "Content-Type: application/json" \
                -d "{
                    \"apikey\": \"$JOIN_API_KEY\",
                    \"deviceId\": \"$JOIN_DEVICE_ID\",
                    \"text\": \"app:org.telegram.messenger\"
                }")
            echo "✅ Telegram launch request sent!"
            echo "Response: $response"
        fi
        ;;
    14)
        echo "Sending test SMS..."
        ./send_sms.sh "Test message from PC" "+1234567890"
        ;;
    15)
        echo "=== Environment Variables Setup ==="
        echo "Enter your Join API credentials:"
        read -p "JOIN_API_KEY: " api_key
        read -p "JOIN_DEVICE_ID: " device_id
        
        echo "export JOIN_API_KEY=\"$api_key\"" >> ~/.bashrc
        echo "export JOIN_DEVICE_ID=\"$device_id\"" >> ~/.bashrc
        
        export JOIN_API_KEY="$api_key"
        export JOIN_DEVICE_ID="$device_id"
        
        echo "✅ Environment variables set!"
        ;;
    16)
        cat README.md
        ;;
    17)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option"
        ;;
esac

echo ""
echo "Press Enter to return to main menu..."
read
./control.sh
