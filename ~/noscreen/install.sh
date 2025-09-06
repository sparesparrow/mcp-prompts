#!/bin/bash

# Installation script for No-Screen Phone Control System
# Sets up all components and dependencies

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status="$1"
    local message="$2"
    case $status in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_status "ERROR" "This script should not be run as root"
        exit 1
    fi
}

# Function to check system requirements
check_system_requirements() {
    print_status "INFO" "Checking system requirements..."
    
    # Check if running on Linux
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        print_status "ERROR" "This script is designed for Linux systems"
        exit 1
    fi
    
    # Check if running on a supported distribution
    if command -v apt-get &> /dev/null; then
        PACKAGE_MANAGER="apt"
    elif command -v dnf &> /dev/null; then
        PACKAGE_MANAGER="dnf"
    elif command -v yum &> /dev/null; then
        PACKAGE_MANAGER="yum"
    else
        print_status "ERROR" "Unsupported package manager"
        exit 1
    fi
    
    print_status "SUCCESS" "System requirements check passed"
}

# Function to install dependencies
install_dependencies() {
    print_status "INFO" "Installing dependencies..."
    
    case $PACKAGE_MANAGER in
        "apt")
            sudo apt update
            sudo apt install -y adb scrcpy curl ssh-client kdeconnect
            ;;
        "dnf")
            sudo dnf install -y android-tools scrcpy curl openssh-clients kdeconnect
            ;;
        "yum")
            sudo yum install -y android-tools scrcpy curl openssh-clients kdeconnect
            ;;
    esac
    
    print_status "SUCCESS" "Dependencies installed"
}

# Function to create directory structure
create_directory_structure() {
    print_status "INFO" "Creating directory structure..."
    
    local dirs=(
        "$HOME/noscreen"
        "$HOME/noscreen/logs"
        "$HOME/noscreen/screenshots"
        "$HOME/noscreen/backups"
        "$HOME/noscreen/config"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        print_status "INFO" "Created directory: $dir"
    done
    
    print_status "SUCCESS" "Directory structure created"
}

# Function to set up SSH keys
setup_ssh_keys() {
    print_status "INFO" "Setting up SSH keys..."
    
    local ssh_dir="$HOME/.ssh"
    local key_path="$ssh_dir/id_ed25519"
    
    mkdir -p "$ssh_dir"
    chmod 700 "$ssh_dir"
    
    if [ ! -f "$key_path" ]; then
        print_status "INFO" "Generating SSH key pair..."
        ssh-keygen -t ed25519 -f "$key_path" -N "" -C "noscreen-control"
        print_status "SUCCESS" "SSH key pair generated"
    else
        print_status "INFO" "SSH key pair already exists"
    fi
    
    chmod 600 "$key_path"
    chmod 644 "$key_path.pub"
}

# Function to make scripts executable
make_scripts_executable() {
    print_status "INFO" "Making scripts executable..."
    
    local script_dir="$HOME/noscreen"
    
    if [ -d "$script_dir" ]; then
        find "$script_dir" -name "*.sh" -exec chmod +x {} \;
        print_status "SUCCESS" "Scripts made executable"
    else
        print_status "ERROR" "Script directory not found"
        exit 1
    fi
}

# Function to create desktop shortcut
create_desktop_shortcut() {
    print_status "INFO" "Creating desktop shortcut..."
    
    local desktop_file="$HOME/Desktop/noscreen-control.desktop"
    local script_path="$HOME/noscreen/enhanced_control.sh"
    
    cat > "$desktop_file" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=No-Screen Phone Control
Comment=Control Android phone without screen
Exec=bash $script_path
Icon=phone
Terminal=true
Categories=Utility;System;
EOF
    
    chmod +x "$desktop_file"
    print_status "SUCCESS" "Desktop shortcut created"
}

# Function to create systemd user service (optional)
create_systemd_service() {
    print_status "INFO" "Creating systemd user service..."
    
    local systemd_dir="$HOME/.config/systemd/user"
    local service_file="$systemd_dir/noscreen-monitor.service"
    
    mkdir -p "$systemd_dir"
    
    cat > "$service_file" << EOF
[Unit]
Description=No-Screen Phone Control Monitor
After=network.target

[Service]
Type=simple
ExecStart=$HOME/noscreen/enhanced_control.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
    
    print_status "SUCCESS" "Systemd service created (optional - enable with: systemctl --user enable noscreen-monitor)"
}

# Function to create bash completion
create_bash_completion() {
    print_status "INFO" "Creating bash completion..."
    
    local completion_dir="$HOME/.local/share/bash-completion/completions"
    local completion_file="$completion_dir/noscreen"
    
    mkdir -p "$completion_dir"
    
    cat > "$completion_file" << 'EOF'
_noscreen_completion() {
    local cur=${COMP_WORDS[COMP_CWORD]}
    local commands="enhanced_control wireless_adb_setup install config logger"
    
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
}

complete -F _noscreen_completion noscreen
EOF
    
    print_status "SUCCESS" "Bash completion created"
}

# Function to create alias
create_alias() {
    print_status "INFO" "Creating bash alias..."
    
    local bashrc="$HOME/.bashrc"
    local alias_line="alias noscreen='$HOME/noscreen/enhanced_control.sh'"
    
    if ! grep -q "$alias_line" "$bashrc"; then
        echo "" >> "$bashrc"
        echo "# No-Screen Phone Control" >> "$bashrc"
        echo "$alias_line" >> "$bashrc"
        print_status "SUCCESS" "Bash alias created"
    else
        print_status "INFO" "Bash alias already exists"
    fi
}

# Function to run initial setup
run_initial_setup() {
    print_status "INFO" "Running initial setup..."
    
    local script_dir="$HOME/noscreen"
    
    # Load configuration to create default config
    if [ -f "$script_dir/config.sh" ]; then
        source "$script_dir/config.sh"
        print_status "SUCCESS" "Configuration initialized"
    else
        print_status "ERROR" "Configuration script not found"
        exit 1
    fi
}

# Function to show post-installation instructions
show_post_installation_instructions() {
    echo ""
    echo "=========================================="
    echo "🎉 Installation Complete!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Configure your device:"
    echo "   - Run: noscreen"
    echo "   - Go to Configuration menu"
    echo "   - Set your device IP and credentials"
    echo ""
    echo "2. Enable wireless debugging on your phone:"
    echo "   - Go to Settings > About phone"
    echo "   - Tap Build number 7 times"
    echo "   - Go to Developer options"
    echo "   - Enable USB debugging and Wireless debugging"
    echo ""
    echo "3. Install required apps on your phone:"
    echo "   - KDE Connect (from F-Droid or Play Store)"
    echo "   - Join (for Join API features)"
    echo "   - Termux (for SSH access)"
    echo ""
    echo "4. Quick start:"
    echo "   - Run: noscreen"
    echo "   - Or double-click the desktop shortcut"
    echo ""
    echo "5. Documentation:"
    echo "   - Read: $HOME/noscreen/README.md"
    echo "   - Logs: $HOME/noscreen/logs/"
    echo ""
    echo "=========================================="
}

# Function to perform cleanup
cleanup() {
    print_status "INFO" "Cleaning up installation files..."
    # Remove any temporary files if needed
    print_status "SUCCESS" "Cleanup completed"
}

# Main installation function
main() {
    echo "=========================================="
    echo "🚀 No-Screen Phone Control Installation"
    echo "=========================================="
    echo ""
    
    # Check if already installed
    if [ -d "$HOME/noscreen" ] && [ -f "$HOME/noscreen/enhanced_control.sh" ]; then
        print_status "WARN" "No-Screen Phone Control appears to be already installed"
        read -p "Do you want to reinstall? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "INFO" "Installation cancelled"
            exit 0
        fi
    fi
    
    # Run installation steps
    check_root
    check_system_requirements
    install_dependencies
    create_directory_structure
    setup_ssh_keys
    make_scripts_executable
    create_desktop_shortcut
    create_systemd_service
    create_bash_completion
    create_alias
    run_initial_setup
    cleanup
    
    show_post_installation_instructions
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
