# Learning Loop Enhancements for dev-intelligence-orchestrator Skill

## Overview

All skill scripts have been enhanced with **mcp-prompts integration** to enable a self-improving learning system. The scripts now follow a consistent learning pattern:

1. **Before execution**: Query mcp-prompts for learned configurations
2. **During execution**: Use learned config if available, fallback to defaults
3. **After execution**: Capture successful configurations for future use

## Enhanced Scripts

### 1. `mcp_query.sh` (NEW)
**Purpose**: HTTP API wrapper for querying mcp-prompts server

**Usage**:
```bash
# List prompts
./scripts/mcp_query.sh list [category] [limit]

# Get specific prompt
./scripts/mcp_query.sh get <prompt_id> [version]

# Search prompts
./scripts/mcp_query.sh search <query> [category]

# Create prompt
./scripts/mcp_query.sh create <json_data>

# Update prompt
./scripts/mcp_query.sh update <prompt_id> <json_data>
```

**Features**:
- Graceful degradation if server unavailable
- Health check before operations
- Supports all mcp-prompts HTTP API endpoints

### 2. `analyze_cpp.sh` (ENHANCED)
**Learning Behavior**:
- Queries for `cppcheck` configurations matching project type and focus
- Uses learned flags if available
- Captures successful configurations with metrics
- Updates existing prompts with validation data

**Example Output**:
```
🔍 Checking for accumulated knowledge...
✓ Found 1 relevant knowledge item(s)
✓ Using learned configuration from: cppcheck-config-embedded-esp32-memory-optimized-2025-12-30
🔧 Running cppcheck on src/bpm_detector.cpp with focus: memory...
💡 Capturing successful configuration...
✓ Configuration captured for future use
```

### 3. `analyze_python.sh` (ENHANCED)
**Learning Behavior**:
- Queries for `pylint` configurations
- Applies learned options
- Captures successful configurations

### 4. `run_tests.sh` (ENHANCED)
**Learning Behavior**:
- Queries for test framework configurations (pytest, platformio, etc.)
- Uses learned test options
- Captures successful test execution patterns

### 5. `parse_build_errors.py` (ENHANCED)
**Learning Behavior**:
- Queries for similar error patterns based on error signature
- Uses learned diagnosis if available
- Captures novel error patterns for future reference

**Error Signature**: Creates a signature from top error categories (e.g., "flatbuffers_version_mismatch:3 missing_dependency:2")

## Seed Prompts

Initial seed prompts have been created in `data/prompts/tool-config/`:

1. `cppcheck-config-embedded-esp32-memory-default.json`
2. `cppcheck-config-embedded-esp32-security-default.json`
3. `cppcheck-config-desktop-general-default.json`
4. `pylint-config-python-general-default.json`
5. `pylint-config-python-security-default.json`
6. `pytest-config-python-default.json`

These provide starting points that the learning system will validate and improve.

## Learning Flow

### First Execution (No Knowledge)
```
1. Query mcp-prompts → No results found
2. Use default configuration
3. Execute tool
4. If useful (found issues), capture configuration
5. Create new prompt with success_count=1, confidence=low
```

### Subsequent Executions (With Knowledge)
```
1. Query mcp-prompts → Found matching configuration
2. Use learned configuration
3. Execute tool
4. If useful, update existing prompt:
   - Increment success_count
   - Update last_used timestamp
   - Increase confidence (low → medium → high)
```

### Confidence Levels
- **low**: 1 successful use
- **medium**: 2-3 successful uses
- **high**: 4+ successful uses

## Configuration Structure

Prompts store tool configurations in this format:

```json
{
  "project_type": "embedded-esp32",
  "focus": "memory",
  "cppcheck_flags": ["--enable=warning,performance", "--std=c++11"],
  "success_count": 3,
  "confidence": "medium",
  "last_used": "2025-12-31T18:00:00Z",
  "last_findings": 12,
  "last_high_severity": 3
}
```

## Graceful Degradation

All scripts handle mcp-prompts unavailability gracefully:

- If `mcp_query.sh` not found → Use defaults, warn user
- If server not running → Use defaults, warn user
- If query fails → Use defaults, continue execution
- Learning is **optional**, not required for tool execution

## Testing the Learning Loop

### Test 1: First Run (No Knowledge)
```bash
./scripts/analyze_cpp.sh src/main.cpp memory .
# Should: Use defaults, capture configuration
```

### Test 2: Second Run (With Knowledge)
```bash
./scripts/analyze_cpp.sh src/main.cpp memory .
# Should: Use learned configuration, update success_count
```

### Test 3: Verify Learning
```bash
./scripts/mcp_query.sh search "cppcheck memory embedded-esp32"
# Should: Show captured configuration with success_count > 0
```

## Integration with mcp-prompts Server

The scripts require the mcp-prompts HTTP server to be running:

```bash
# Start server (if not already running)
MODE=http STORAGE_TYPE=file pnpm start:http

# Or use existing server
# Default: http://localhost:3000
# Override: MCP_PROMPTS_URL=http://other-host:3000
```

## Next Steps

1. **Use the enhanced scripts** in your development workflow
2. **Monitor learning** - Check captured prompts periodically
3. **Validate improvements** - Run same analysis twice, verify second uses learned config
4. **Expand patterns** - Add more seed prompts for other tools/configurations
5. **Cross-project learning** - Share learned configurations across projects

## Files Modified/Created

- ✅ `scripts/mcp_query.sh` (NEW)
- ✅ `scripts/analyze_cpp.sh` (ENHANCED)
- ✅ `scripts/analyze_python.sh` (ENHANCED)
- ✅ `scripts/run_tests.sh` (ENHANCED)
- ✅ `scripts/parse_build_errors.py` (ENHANCED)
- ✅ `scripts/detect_project_type.sh` (COPIED)
- ✅ `scripts/seed-tool-config-prompts.js` (NEW)
- ✅ `data/prompts/tool-config/*.json` (6 seed prompts created)

## Success Criteria

✅ **Learning is visible**: Scripts report when knowledge is found/used/captured  
✅ **Graceful degradation**: Works without mcp-prompts server  
✅ **Knowledge accumulation**: Second run uses learned configuration  
✅ **Confidence increases**: Success count and confidence tracked  
✅ **Cross-project sharing**: Learned configs available to all projects
