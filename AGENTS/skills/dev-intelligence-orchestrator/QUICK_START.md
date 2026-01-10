# Quick Start Guide

## Using the Skill Scripts

### Quick Reference Paths

**Claude Desktop:**
```bash
SKILL_DIR="/home/sparrow/.local/share/claude-skills/dev-intelligence-orchestrator/scripts"
```

**Cursor:**
```bash
SKILL_DIR="/home/sparrow/.cursor/skills/dev-intelligence-orchestrator/scripts"
```

### Common Usage Examples

#### 1. Detect Project Type
```bash
$SKILL_DIR/detect_project_type.sh /path/to/project
```

#### 2. Analyze C++ Code
```bash
# First run - captures learning
$SKILL_DIR/analyze_cpp.sh src/main.cpp memory .

# Second run - uses learned config
$SKILL_DIR/analyze_cpp.sh src/main.cpp memory .
```

#### 3. Analyze Python Code
```bash
$SKILL_DIR/analyze_python.sh src/utils.py general .
```

#### 4. Parse Build Errors
```bash
$SKILL_DIR/parse_build_errors.py build.log esp32 platformio
```

#### 5. Run Tests
```bash
$SKILL_DIR/run_tests.sh . tests/ true
```

### Integration with Claude/Cursor

The scripts can be called directly from Claude or Cursor:

```
Use the dev-intelligence-orchestrator skill to analyze the code in src/main.cpp
```

The AI will automatically use the appropriate script from the deployed location.

### Learning Loop Status

The scripts will automatically:
- 🔍 Query mcp-prompts for learned configurations
- ✓ Use learned configs when available
- 💡 Capture successful configurations
- 📈 Increase confidence with validation

### Prerequisites

- mcp-prompts server running (optional, graceful degradation)
- Analysis tools: pylint, cppcheck, pytest (as needed)
- jq for JSON parsing
