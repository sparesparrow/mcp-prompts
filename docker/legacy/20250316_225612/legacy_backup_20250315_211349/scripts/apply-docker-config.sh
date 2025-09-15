#!/bin/bash

# Script to apply Docker daemon configuration to prevent network subnet depletion

set -e

# Check if running with sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "This script must be run with sudo privileges."
    echo "Usage: sudo $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DAEMON_CONFIG="${CONFIG_DIR}/daemon-config.json"
DOCKER_CONFIG_DIR="/etc/docker"

# Check if daemon config exists
if [ ! -f "${DAEMON_CONFIG}" ]; then
    echo "Error: Docker daemon configuration file not found at ${DAEMON_CONFIG}"
    exit 1
fi

# Create Docker config directory if it doesn't exist
mkdir -p "${DOCKER_CONFIG_DIR}"

# Copy the daemon configuration
echo "Copying Docker daemon configuration to ${DOCKER_CONFIG_DIR}/daemon.json"
cp "${DAEMON_CONFIG}" "${DOCKER_CONFIG_DIR}/daemon.json"
chmod 644 "${DOCKER_CONFIG_DIR}/daemon.json"

# Restart Docker service
echo "Restarting Docker service..."
systemctl restart docker

# Wait for Docker to become available
echo "Waiting for Docker to restart..."
for i in {1..30}; do
    if docker info > /dev/null 2>&1; then
        echo "Docker service is running"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 30 ]; then
        echo "Error: Docker did not restart properly. Check logs with 'journalctl -u docker.service'"
        exit 1
    fi
done

echo "Docker daemon configuration applied successfully"
echo "New network pools:"
docker info | grep "Default Address Pool"

echo "You can now run your Docker Compose commands" 