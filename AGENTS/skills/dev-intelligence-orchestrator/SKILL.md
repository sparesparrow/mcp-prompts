# dev-intelligence-orchestrator Skill

## Overview

The `dev-intelligence-orchestrator` skill provides intelligent development tool orchestration with **self-improving learning capabilities** through mcp-prompts integration.

## Features

### Core Capabilities
- **Project Type Detection**: Automatically identifies languages, frameworks, and project nature
- **Intelligent Build Error Analysis**: Parses and diagnoses compilation errors with pattern recognition
- **Static Code Analysis**: C++ (cppcheck) and Python (pylint) analysis with learned configurations
- **Test Execution**: Framework-aware test running with pytest, PlatformIO, and more
- **Self-Improving Learning**: Captures successful configurations and reuses them automatically

### Learning Loop

Every tool execution follows this pattern:

1. **BEFORE**: Query mcp-prompts for learned configurations
2. **DURING**: Use learned config if available, fallback to defaults
3. **AFTER**: Capture successful configurations for future use
4. **NEXT**: Automatically use learned configurations

## Scripts

### Core Scripts

#### `detect_project_type.sh`
Detects project characteristics:
- Languages (C++, Python, Kotlin, Java)
- Frameworks (PlatformIO, CMake, Conan, Gradle)
- Test frameworks (pytest, gtest, JUnit)
- Project nature (embedded, Android, desktop)
- FlatBuffers usage

**Usage:**
```bash
./detect_project_type.sh [directory]
```

#### `parse_build_errors.py`
Intelligent build error analysis with learning:
- Parses compilation, linking, dependency, and schema errors
- Generates diagnosis and recommendations
- Learns from similar error patterns
- Captures novel error patterns for future reference

**Usage:**
```bash
python3 parse_build_errors.py <log_file> <project_type> [build_system]
```

#### `analyze_cpp.sh`
C++ static analysis with cppcheck + learning:
- Queries for learned cppcheck configurations
- Uses learned flags when available
- Captures successful configurations
- Updates confidence based on success rate

**Usage:**
```bash
./analyze_cpp.sh <target> <focus> <project_root>
# focus: security|performance|memory|general
```

#### `analyze_python.sh`
Python static analysis with pylint + learning:
- Queries for learned pylint configurations
- Applies learned options
- Captures successful configurations
- Tracks success metrics

**Usage:**
```bash
./analyze_python.sh <target> <focus> <project_root>
# focus: security|performance|style|general
```

#### `run_tests.sh`
Test execution with framework detection + learning:
- Auto-detects test framework (pytest, PlatformIO, gtest, Gradle)
- Queries for learned test configurations
- Captures successful test patterns
- Supports coverage reporting

**Usage:**
```bash
./run_tests.sh <project_root> <test_path> <coverage>
```

### Supporting Scripts

#### `mcp_query.sh`
HTTP API wrapper for mcp-prompts:
- Health checks
- List/search prompts
- Get specific prompts
- Create/update prompts
- Graceful degradation when server unavailable

**Usage:**
```bash
./mcp_query.sh <operation> [args...]
# operations: health|list|get|search|create|update|apply
```

#### `seed-tool-config-prompts.js`
Creates initial seed prompts for tool configurations:
- cppcheck configurations (embedded, desktop)
- pylint configurations (general, security)
- pytest configurations
- Ready for learning system validation

**Usage:**
```bash
node seed-tool-config-prompts.js
```

## Learning Behavior

### First Execution (No Knowledge)
```
🔍 Checking for accumulated knowledge...
ℹ No accumulated knowledge yet, using defaults (will capture learnings)
🔧 Running tool...
💡 Capturing successful configuration...
✓ Configuration captured for future use
```

### Subsequent Executions (With Knowledge)
```
🔍 Checking for accumulated knowledge...
✓ Found 1 relevant knowledge item(s)
✓ Using learned configuration from: <prompt_id>
🔧 Running tool...
✓ Validating learned configuration...
✓ Configuration validated (success_count: 2, confidence: medium)
```

### Confidence Levels
- **low**: 1 successful use
- **medium**: 2-3 successful uses
- **high**: 4+ successful uses

## Configuration

### Prerequisites
- mcp-prompts server running (optional, graceful degradation if unavailable)
- Analysis tools installed: pylint, cppcheck, pytest (as needed)
- jq for JSON parsing

### Environment Variables
- `MCP_PROMPTS_URL`: mcp-prompts server URL (default: http://localhost:3000)
- `PROJECT_ROOT`: Project root directory (default: current directory)

### Server Setup
```bash
# Start mcp-prompts server with file storage
MODE=http STORAGE_TYPE=file PROMPTS_DIR=./data pnpm start:http
```

## Integration with mcp-prompts

### Prompt Structure
Tool configurations are stored as prompts with this structure:

```json
{
  "name": "cppcheck-config-embedded-esp32-memory-20251231",
  "description": "Successful cppcheck configuration for embedded-esp32 memory analysis",
  "template": {
    "project_type": "embedded-esp32",
    "focus": "memory",
    "cppcheck_flags": ["--enable=warning,performance", "--std=c++11"],
    "success_count": 3,
    "confidence": "medium",
    "last_used": "2025-12-31T18:00:00Z"
  },
  "category": "tool-config",
  "tags": ["cpp", "cppcheck", "memory", "embedded-esp32", "validated"]
}
```

### Learning Domains
- **Tool Configurations**: cppcheck, pylint, pytest settings
- **Error Patterns**: Build error diagnosis and fixes
- **Project Patterns**: Project-specific optimizations
- **Workflow Patterns**: Successful development workflows

## Usage Examples

### Analyze C++ Code
```bash
# First run - captures learning
./analyze_cpp.sh src/main.cpp memory .

# Second run - uses learned config
./analyze_cpp.sh src/main.cpp memory .
```

### Analyze Python Code
```bash
# Security-focused analysis
./analyze_python.sh src/auth.py security .

# General analysis
./analyze_python.sh src/utils.py general .
```

### Parse Build Errors
```bash
# Analyze build log
python3 parse_build_errors.py build.log esp32 platformio

# Will learn from similar error patterns
```

### Run Tests
```bash
# Run with coverage
./run_tests.sh . tests/ true

# Run specific test
./run_tests.sh . tests/test_auth.py false
```

## Graceful Degradation

All scripts handle mcp-prompts unavailability gracefully:
- If server not running: Uses defaults, warns user
- If query fails: Uses defaults, continues execution
- Learning is **optional**, not required for tool execution

## Success Criteria

The skill is successful when:
1. ✅ Claude reports learning status on every execution
2. ✅ Second analysis is faster/better than first due to learned configuration
3. ✅ User sees knowledge accumulating through visible capture messages
4. ✅ Confidence increases as more patterns are validated
5. ✅ Cross-project knowledge sharing works

## Files Included

- `detect_project_type.sh` - Project detection
- `parse_build_errors.py` - Build error analysis with learning
- `analyze_cpp.sh` - C++ analysis with learning
- `analyze_python.sh` - Python analysis with learning
- `run_tests.sh` - Test execution with learning
- `mcp_query.sh` - mcp-prompts API wrapper
- `seed-tool-config-prompts.js` - Seed prompt generator
- `SKILL.md` - This documentation

## Version

**Version**: 2.0.0 (with Learning Loop)  
**Last Updated**: 2025-12-31  
**Status**: Production Ready
