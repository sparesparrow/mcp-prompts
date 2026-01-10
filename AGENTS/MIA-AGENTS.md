# AGENTS.md - MIA Project Agent Guide

This document provides guidance for AI coding agents analyzing and working on the MIA project.

## Project Overview

MIA is a comprehensive IoT system with 6 major components across multiple platforms:

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Services                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Backend API (Python FastAPI)                    │   │
│  │  - Coordinates all device communication          │   │
│  │  - Aggregates sensor data                        │   │
│  │  - Manages authentication and authorization      │   │
│  └──────────────────────────────────────────────────┘   │
│    ↑                          ↑                    ↑      │
└────┼──────────────────────────┼────────────────────┼─────┘
     │                          │                    │
  WiFi/REST              WiFi/REST              WiFi/WebSocket
     │                          │                    │
┌────▼────┐  ┌──────────────────▼──────┐  ┌─────────▼──────────┐
│ Raspberry│  │   Web Dashboard        │  │   Android App      │
│   Pi     │  │   (React)              │  │   (Kotlin)         │
│ (Python) │  │ - Real-time charts     │  │ - Device control   │
│ - Gateway│  │ - Device management    │  │ - Monitoring       │
│ - Relay  │  │ - Alerts & logging     │  │ - Offline-first    │
└────┬────┘  └──────────────────┬──────┘  └────────┬──────────┘
     │                          │                  │
  UART/I2C                      │                 BLE
     │                          │                  │
┌────▼──────────────────────────┴──────────────────▼────┐
│              ESP32 Microcontroller                     │
│  - Sensor reading (temperature, humidity, etc)        │
│  - Real-time data processing                         │
│  - FreeRTOS task scheduling                          │
│  - Power management                                   │
└───────────────────────────────────────────────────────┘
```

## Component Details

### 1. ESP32 Firmware (Embedded C++)
- **Location**: `./esp32/` or `./embedded/`
- **Framework**: PlatformIO
- **Key**: FreeRTOS tasks, UART/I2C communication, low-power operation
- **Entry Points**: `main()` in platformio.ini configured source
- **Build**: `pio build` (PlatformIO)
- **Test**: Device-in-the-loop testing, serial logging analysis

### 2. Raspberry Pi (Python)
- **Location**: `./raspi/` or `./pi/`
- **Language**: Python, Bash scripts
- **Role**: Edge device gateway and relay coordinator
- **Key**: GPIO control, process management, data relay to cloud
- **Entry Points**: Main service runner script
- **Build**: Poetry/pip install
- **Test**: `pytest` for Python modules

### 3. Android Application (Kotlin)
- **Location**: `./android/` or `./mobile/`
- **Framework**: Android Architecture Components, Jetpack
- **Key**: BLE connectivity, offline-first, Room database
- **Build**: Gradle build system
- **Test**: `./gradlew test` for unit tests, Espresso for UI tests

### 4. Backend API (Python FastAPI)
- **Location**: `./server/` or `./backend/`
- **Framework**: FastAPI, SQLAlchemy
- **Key**: REST endpoints, WebSocket for real-time, async processing
- **Database**: PostgreSQL or MongoDB (check docker-compose)
- **Build**: `pip install -r requirements.txt`
- **Test**: `pytest` for unit/integration tests
- **APIs**:
  - `POST /api/v1/devices/{device_id}/data` - Receive sensor data
  - `GET /api/v1/devices` - List all devices
  - `POST /api/v1/commands/{device_id}` - Send commands to device
  - WebSocket: `/ws/dashboard` - Real-time updates

### 5. Web Frontend (React)
- **Location**: `./web/` or `./frontend/`
- **Framework**: React with TypeScript
- **Key**: Real-time chart visualization, device dashboard
- **Build**: `npm run build` or `pnpm build`
- **Test**: `npm test` (Jest/Vitest)
- **Development**: `npm run dev` (Vite)

### 6. Infrastructure (Docker)
- **Location**: `./docker/` or `./infra/`
- **Files**: `docker-compose.yml`, `.env.example`
- **Services**:
  - `backend`: Python FastAPI service on port 8000
  - `db`: PostgreSQL on port 5432
  - `redis`: Cache and message broker
  - `web`: React frontend on port 3000
  - `mqtt`: Message broker (optional, check docker-compose)

## Critical Data Flows

### Sensor Data Pipeline
```
ESP32 reads sensor → UART/I2C to Pi → Pi relays to Backend REST
→ Backend stores in DB → Backend publishes to WebSocket
→ Web UI updates chart AND Android receives push notification
```

### Command Flow
```
Web UI or Android sends command REST → Backend validates
→ Backend publishes to Pi via Redis/MQTT → Pi sends to ESP32 via UART
→ ESP32 executes → sends confirmation back up the chain
```

## Build Instructions

### Setup Development Environment
```bash
# Clone and navigate
cd ~/projects/mia

# For each component:
# ESP32
cd esp32
pio install_libraries
pio build
pio upload  # Requires USB connection to board

# Raspberry Pi (if local)
cd ../raspi
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Backend
cd ../server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Web Frontend
cd ../web
npm install  # or pnpm install
npm run dev

# Docker (full stack)
cd ../docker
docker-compose up -d
```

### Build Commands by Component
- **ESP32**: `cd esp32 && pio build`
- **Pi service**: `cd raspi && python -m service.main`
- **Backend**: `cd server && uvicorn app.main:app --reload`
- **Web**: `cd web && npm run dev`
- **All (Docker)**: `docker-compose up`

## Testing Instructions

### ESP32 Testing
- Requires device or simulator
- Check `esp32/test/` for unit tests
- Serial output validation: Monitor logs via `pio device monitor`

### Python Testing (Pi + Backend)
```bash
# From raspi or server directory
pytest -v
pytest -v --cov=.  # With coverage
pytest -v -k "sensor"  # Specific test pattern
```

### Android Testing
```bash
cd android
./gradlew test  # Unit tests
./gradlew connectedAndroidTest  # Instrumentation tests
```

### Web Frontend Testing
```bash
cd web
npm test  # Run Jest
npm run test:watch  # Watch mode
npm run test:coverage  # Coverage report
```

### Full Integration Testing
```bash
# Start services
docker-compose up -d

# Run integration tests (if present)
pytest tests/integration/  # Check for integration test folder

# Manual testing
# 1. Open http://localhost:3000 (web dashboard)
# 2. Check device status and send test command
# 3. Monitor backend logs: docker-compose logs backend
# 4. Verify ESP32 receives command via serial monitor
```

## Code Conventions

### Python
- **Style**: PEP 8 (enforced by Black/flake8)
- **Type Hints**: Use type hints in function signatures
- **Async**: Use async/await for I/O operations in FastAPI
- **Testing**: pytest framework, fixtures in conftest.py
- **Tools**: Black for formatting, flake8 for linting, mypy for type checking

### C++ (ESP32)
- **Standard**: C++17 or Arduino style (check platformio.ini)
- **Memory**: Use smart pointers, avoid raw allocation
- **Tasks**: Name FreeRTOS tasks clearly, document priorities
- **Communication**: UART at known baud rate (usually 115200)
- **Libraries**: Check platformio.ini for included libraries

### Kotlin/Android
- **Architecture**: MVVM pattern
- **Repository**: Use repository pattern for data access
- **Database**: Room ORM for local persistence
- **Networking**: Retrofit for HTTP, OkHttp for interceptors
- **DI**: Hilt for dependency injection
- **Coroutines**: Use coroutine scopes for async work

### JavaScript/React
- **Style**: ESLint and Prettier configured
- **TypeScript**: Full TS coverage required
- **Testing**: Jest/Vitest with React Testing Library
- **State**: Redux Toolkit or Context API
- **Components**: Functional components with hooks

## Git Conventions

### Branch Naming
- Feature: `feature/description`
- Bugfix: `bugfix/description`
- Hotfix: `hotfix/description`
- Release: `release/v1.2.3`

### Commit Messages
Format: `[component] description`
- `[esp32] Add DHT11 sensor reading`
- `[backend] Fix device authentication bug`
- `[web] Update dashboard layout`
- `[docker] Add environment variable support`

### PR Requirements
- Title: `[component] Short description`
- Description: What changed and why
- Testing: What testing was done
- Component: Which parts are affected

## Configuration Files

### Environment Setup
- `.env.example`: Template for environment variables
- `docker-compose.yml`: Service definitions
- `platformio.ini`: ESP32 build configuration
- `pyproject.toml` or `requirements.txt`: Python dependencies
- `package.json`: Node.js dependencies
- `build.gradle`: Android build configuration

### Key Environment Variables
- `DATABASE_URL`: PostgreSQL connection (required for backend)
- `REDIS_URL`: Redis connection (optional, for caching)
- `MQTT_BROKER`: MQTT broker address (if using MQTT)
- `API_KEY_SECRET`: JWT secret for API authentication
- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)

## Documentation

### Architecture Documentation
- README.md in root: Quick start and overview
- This file (AGENTS.md): Agent-focused development guide
- Component READMEs: Specific to each subdirectory
- API docs: Usually available at `http://localhost:8000/docs` (Swagger UI)

### Diagrams
- Architecture diagrams in `/docs` (check if present)
- Component dependency diagrams
- Data flow diagrams

## Security Considerations

1. **Device Authentication**: All device API calls should authenticate
2. **Command Validation**: Backend must validate commands before forwarding
3. **Data Encryption**: Sensitive data (credentials, commands) should be encrypted in transit
4. **Secrets Management**: Never commit `.env` files or API keys
5. **Input Validation**: Validate all inputs (sensor data, commands) before processing

## Performance Considerations

1. **ESP32**: Limited RAM (~520KB usable), optimize data structures
2. **Real-time Updates**: WebSocket latency target < 1 second
3. **Database Queries**: Sensor data storage can grow quickly, plan retention
4. **Bandwidth**: Pi ↔ Backend communication should be efficient (compress data)
5. **Power**: Edge devices should minimize battery drain

## Troubleshooting for Agents

### ESP32 not responding
- Check UART baud rate matches platformio.ini
- Verify Pi → ESP32 wiring (TX/RX, GND)
- Check Pi serial port permissions

### Backend API errors
- Check database connection in `docker-compose logs db`
- Verify all environment variables are set
- Check for port conflicts (port 8000)

### Web dashboard not updating
- Check WebSocket connection in browser dev tools
- Verify backend is running: `curl http://localhost:8000/health`
- Check Redis connection if using pub/sub

### Android can't connect to backend
- Verify network connectivity
- Check if running on emulator with special localhost setup (`10.0.2.2:8000`)
- Verify API endpoint is correct in app configuration

## Recommended Reading Order for Agents

1. This file (AGENTS.md) for overview
2. Root README.md for quick start
3. Component-specific README in subdirectories
4. Source code in order: utils → models → services → controllers
5. Tests to understand expected behavior
6. Docker-compose.yml to understand service interaction

## Contact & Issues

When agents encounter issues or need clarification:
- Check README files in subdirectories
- Look for CONTRIBUTING.md guidelines
- Review recent git history for patterns
- Check for GitHub issues or project documentation
