# Development Intelligence Orchestrator - Phase 1 Demo

## Installation

Upload the `dev-intelligence-orchestrator.skill` file to Claude to install this skill.

## Quick Start Examples

### Example 1: Your ESP32 FlatBuffers Build Error

**What you say to Claude:**
```
I'm getting build errors in my ESP32 project. Here's the output:

[paste your PlatformIO error log]
```

**What Claude does:**
1. Detects it's a PlatformIO/ESP32 project
2. Parses the compilation errors
3. Identifies FlatBuffers schema mismatch
4. Provides specific fix commands:
```bash
cd ~/projects/embedded-systems/esp32-bpm-detector
flatc --cpp --gen-mutable --gen-object-api --scoped-enums \
  schemas/BpmRequests.fbs schemas/BpmCommon.fbs -o include/
pio run --target clean
pio run --target upload --environment esp32s3
```

**Actual test result from your error:**
```json
{
  "diagnosis": {
    "flatbuffers_issue": {
      "detected": true,
      "confidence": 0.95,
      "description": "FlatBuffers schema mismatch detected",
      "likely_cause": "Generated code out of sync with schema definitions"
    }
  },
  "recommendations": [
    {
      "priority": "high",
      "title": "Regenerate FlatBuffers Code",
      "commands": ["flatc --cpp --gen-mutable ..."]
    }
  ],
  "severity": "moderate"
}
```

### Example 2: Analyze sparetools for Security Issues

**What you say:**
```
Check my OpenSSL wrapper in sparetools for security vulnerabilities
```

**What Claude does:**
```bash
# Runs cppcheck with security focus
analyze_code(
  project="sparetools",
  target="src/ssl_wrapper.cpp",
  focus="security"
)
```

**Returns:**
- Buffer overflow risks
- Memory leak potential
- Insecure API usage
- Concrete fix suggestions

### Example 3: Run Tests with Coverage

**What you say:**
```
Run all Python tests in sparetools and show me what's not covered
```

**What Claude does:**
```bash
# Detects pytest, runs with coverage
run_tests(
  project="sparetools",
  coverage=true
)
```

**Returns:**
- Pass/fail counts
- Failed test details
- Coverage percentage
- Untested code paths

### Example 4: Analyze Memory Issues in Embedded Code

**What you say:**
```
My ESP32 FFT processing might have memory leaks. Can you check?
```

**What Claude does:**
```bash
analyze_code(
  project="esp32",
  target="src/bpm_detector.cpp",
  focus="memory"
)
```

**Returns:**
- Memory leak detection
- Buffer overflow checks
- Stack usage analysis
- Heap allocation patterns

## Phase 1 Capabilities

✅ **Code Analysis**
- C++ (cppcheck): security, performance, memory
- Python (pylint): style, errors, quality
- Kotlin (ktlint): Android best practices

✅ **Test Execution**
- pytest (Python) with coverage
- GoogleTest (C++)
- PlatformIO embedded tests

✅ **Build Debugging**
- Intelligent error parsing
- Root cause diagnosis
- Specific fix recommendations
- Framework-aware solutions

## What's Coming in Future Phases

⏳ **Phase 2** (Week 2): MCP-Prompts Integration
- Query past similar errors before analyzing
- Use historical knowledge for better diagnostics
- See what worked in similar situations

⏳ **Phase 3** (Week 3): Learning Capture
- Save successful resolutions automatically
- Build knowledge base from your work
- Track which knowledge gets reused

⏳ **Phase 4** (Week 4): Cross-Project Intelligence
- Recognize patterns across projects
- Transfer C++ patterns to embedded
- Suggest proactive improvements

## Tool Requirements

The skill will attempt to use these tools if available:
- **C++**: cppcheck, clang-tidy, flatc
- **Python**: pylint, mypy, pytest
- **Kotlin**: ktlint, detekt
- **Build**: conan, platformio (pio), gradle

Missing tools will gracefully degrade - the skill will still provide value with whatever's available.

## Tips for Best Results

1. **Be Specific**: "Analyze this file" works better than "check my code"
2. **Provide Context**: Mention the project name for better tool selection
3. **Paste Full Errors**: More context = better diagnosis
4. **Iterate**: analyze → fix → test → verify

## Example Full Workflow

```
User: "My ESP32 won't compile. Here's the error: [paste]"

Claude: [Uses debug_build_failure]
- Identifies FlatBuffers schema issue
- Shows exact regeneration commands
- Explains why this happened

User: "Ok fixed that. Now check for memory issues in the BPM detector"

Claude: [Uses analyze_code with focus="memory"]
- Finds potential buffer overflow in FFT processing
- Shows vulnerable code location
- Suggests safe alternative with bounds checking

User: "Applied the fix. Run the tests to make sure it works"

Claude: [Uses run_tests]
- Executes PlatformIO tests on device
- Shows all tests passing
- Confirms fix didn't break functionality
```

## Getting Help

If you're unsure what the skill can do, just ask:
- "What can you analyze in my ESP32 project?"
- "Show me what tests you can run"
- "How do I use this skill for security audits?"

The skill will explain its capabilities for your specific project type.

## Feedback for Phase 2 Planning

As you use Phase 1, let me know:
- Which analyses are most valuable?
- What takes too long?
- What knowledge should be captured?
- Which workflows to automate?

This will shape how learning capabilities are added in Phase 2-4!
