#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Embedded systems cognitive prompts
const embeddedPrompts = [
  // Layer 1: Perceptual - Device and Context Recognition
  {
    name: 'detect-embedded-device-capabilities',
    description: 'Analyze embedded device capabilities and recommend appropriate tools',
    content: `# Embedded Device Capability Analysis

When working with embedded devices, first assess the device capabilities:

## ESP32 Device Assessment
**Check these capabilities:**
- WiFi connectivity available
- Bluetooth support (Classic + BLE)
- Available sensors (BPM, temperature, accelerometer)
- Memory constraints (heap, PSRAM)
- Real-time requirements
- Power management features

## Android Device Assessment
**Check these capabilities:**
- Android API level and version
- Available sensors (GPS, accelerometer, light)
- Battery monitoring
- Network connectivity (WiFi, mobile)
- Clipboard access
- App installation permissions

## Recommended Analysis Approach

Based on device capabilities, use these tools:

### For ESP32 Devices:
\`\`\`
get_esp32_telemetry --sensor_types '["bpm", "temperature"]'
analyze_telemetry_patterns --sensor_type bpm --analysis_type anomaly
\`\`\`

### For Android Devices:
\`\`\`
get_android_clipboard --include_history true
analyze_android_clipboard_patterns --pattern_type content
\`\`\`

### For Cross-Device Coordination:
\`\`\`
discover_embedded_devices
sync_clipboard_across_devices --content "Coordinated message"
execute_cross_device_workflow --workflow_name "health_check"
\`\`\`
`,
    layer: 1, // Perceptual
    domain: 7, // Security (embedded systems often have security implications)
    tags: ['embedded', 'device-capabilities', 'assessment', 'esp32', 'android'],
    abstractionLevel: 2,
    isTemplate: false
  },

  // Layer 3: Semantic - Embedded Systems Knowledge
  {
    name: 'embedded-systems-constraints-knowledge',
    description: 'Core knowledge about embedded systems constraints and best practices',
    content: `# Embedded Systems Constraints and Best Practices

## Memory Management
**Key Principles:**
- **Limited RAM**: ESP32 has ~320KB available heap
- **No garbage collection**: Manual memory management required
- **Stack overflow prevention**: Monitor task stack usage
- **PSRAM consideration**: External RAM for large buffers

**Best Practices:**
- Use static allocation where possible
- Implement memory pools for frequent allocations
- Monitor heap usage with \`uxTaskGetStackHighWaterMark\`
- Avoid large stack variables in tasks

## Power Management
**ESP32 Power Modes:**
- **Active**: ~80mA (full operation)
- **Light Sleep**: ~0.8mA (RAM retention)
- **Deep Sleep**: ~10µA (full state loss)
- **Hibernation**: ~2.5µA (RTC memory only)

**Android Power Management:**
- **Doze Mode**: Background restrictions after screen off
- **App Standby**: Restrictions for unused apps
- **Battery Optimization**: System power saving features

## Real-Time Considerations
**Timing Requirements:**
- **Interrupt Latency**: Minimize ISR execution time
- **Task Priorities**: Proper FreeRTOS task prioritization
- **Watchdog Timers**: Prevent system hangs
- **Critical Sections**: Minimize interrupt disabling

## Communication Protocols
**ESP32 Communication:**
- **WiFi**: TCP/UDP sockets, HTTP/MQTT
- **Bluetooth**: GATT server/client, serial emulation
- **Serial**: UART for debugging and device control

**Android Communication:**
- **WebSocket**: Real-time bidirectional communication
- **REST APIs**: HTTP-based device control
- **Clipboard Sync**: Cross-device content sharing

## Security Considerations
**Embedded Security:**
- **Physical Access**: Device protection requirements
- **Firmware Updates**: Secure OTA mechanisms
- **Data Encryption**: Sensitive data protection
- **Network Security**: WiFi and Bluetooth security

**Android Security:**
- **Permissions**: Runtime permission handling
- **App Sandboxing**: Isolated execution environment
- **Data Encryption**: Device-level encryption
- **API Security**: Authentication and authorization
`,
    layer: 3, // Semantic
    domain: 7, // Security
    tags: ['embedded', 'constraints', 'memory', 'power', 'real-time', 'security'],
    abstractionLevel: 4,
    isTemplate: false
  },

  // Layer 4: Procedural - Embedded Development Workflows
  {
    name: 'esp32-debugging-workflow',
    description: 'Systematic debugging workflow for ESP32 embedded systems',
    content: `# ESP32 Debugging Workflow

## Phase 1: Initial Assessment (5 minutes)
**Gather system information:**
\`\`\`
get_esp32_status
get_esp32_telemetry
\`\`\`

**Check for obvious issues:**
- Memory usage (heap exhaustion?)
- WiFi connectivity (network problems?)
- Power stability (brownout detection?)

## Phase 2: Serial Logging Analysis (10 minutes)
**Enable debug logging:**
- Set log level to DEBUG in ESP32 firmware
- Monitor serial output for error messages
- Look for exception traces or assertion failures

**Common serial indicators:**
- \`Guru Meditation Error\`: CPU exception
- \`rst cause\`: Reset cause (power, watchdog, etc.)
- \`Heap exhausted\`: Memory allocation failure

## Phase 3: Peripheral Debugging (15 minutes)
**Test individual components:**
\`\`\`
# Test sensor readings
get_esp32_telemetry --sensor_types '["bpm"]'

# Check WiFi status
get_esp32_status

# Test FreeRTOS tasks
# (Monitor task stack usage in serial logs)
\`\`\`

## Phase 4: Logic Analysis (20 minutes)
**Use debugging tools:**
- **GDB/OpenOCD**: Hardware debugging with breakpoints
- **ESP-IDF Monitor**: Real-time log monitoring
- **JTAG Debugging**: Full system state inspection

**Key debugging commands:**
\`\`\`gdb
# Break on function
break my_function

# Print variable
print my_variable

# Continue execution
continue

# Step through code
step
\`\`\`

## Phase 5: Performance Analysis (15 minutes)
**Profile system performance:**
- Monitor task execution times
- Check interrupt latency
- Analyze memory fragmentation
- Measure power consumption

## Phase 6: Firmware Updates (10 minutes)
**If software bug suspected:**
- Prepare minimal test firmware
- Flash and test incrementally
- Use git bisect for regression identification

## Common ESP32 Issues

### Memory Problems
**Symptoms:** Random crashes, heap exhaustion
**Solutions:**
- Increase heap size in ESP-IDF config
- Use PSRAM for large buffers
- Implement memory pools
- Monitor with \`heap_caps_get_free_size\`

### WiFi Issues
**Symptoms:** Connection drops, slow responses
**Solutions:**
- Check antenna placement
- Adjust WiFi power settings
- Implement reconnection logic
- Monitor signal strength

### Power Problems
**Symptoms:** Random resets, brownout detection
**Solutions:**
- Check power supply stability
- Add decoupling capacitors
- Implement power monitoring
- Use appropriate power modes

### Task Management Issues
**Symptoms:** System hangs, missed deadlines
**Solutions:**
- Review FreeRTOS task priorities
- Check stack sizes with \`uxTaskGetStackHighWaterMark\`
- Implement watchdog timers
- Profile task execution times
`,
    layer: 4, // Procedural
    domain: 7, // Security (embedded systems safety)
    tags: ['esp32', 'debugging', 'workflow', 'troubleshooting', 'embedded'],
    abstractionLevel: 2,
    isTemplate: false
  },

  {
    name: 'android-clipboard-analysis-workflow',
    description: 'Workflow for analyzing Android clipboard usage patterns',
    content: `# Android Clipboard Analysis Workflow

## Phase 1: Data Collection (5 minutes)
**Gather clipboard data:**
\`\`\`
get_android_clipboard --include_history true --limit 100
get_android_context --include_history true
\`\`\`

**Initial assessment:**
- Volume of clipboard activity
- Content types (text, URLs, code snippets)
- Usage patterns (time of day, frequency)
- Source applications

## Phase 2: Content Analysis (10 minutes)
**Analyze clipboard content:**
\`\`\`
analyze_android_clipboard_patterns --pattern_type content
\`\`\`

**Look for patterns:**
- **Code snippets**: Development activity indicators
- **URLs**: Research or reference material
- **Contact information**: Communication patterns
- **Notes/Reminders**: Task management patterns

## Phase 3: Temporal Analysis (10 minutes)
**Analyze usage timing:**
\`\`\`
analyze_android_clipboard_patterns --pattern_type timing
\`\`\`

**Identify patterns:**
- **Work hours**: Professional activity
- **Evening hours**: Personal/research activity
- **Weekend patterns**: Different usage characteristics
- **Peak usage times**: Productivity indicators

## Phase 4: Source Application Analysis (10 minutes)
**Analyze application usage:**
- **Browser**: Research and information gathering
- **Development tools**: Coding activity
- **Communication apps**: Information sharing
- **Note-taking apps**: Knowledge capture

## Phase 5: Cross-Device Analysis (10 minutes)
**Compare with other devices:**
\`\`\`
sync_clipboard_across_devices
discover_embedded_devices
aggregate_embedded_telemetry
\`\`\`

**Look for synchronization:**
- Content flow between devices
- Usage pattern consistency
- Device preference patterns

## Phase 6: Cognitive Insights (10 minutes)
**Generate insights:**
- **Productivity patterns**: When and how information is captured
- **Knowledge management**: How information flows between systems
- **Workflow optimization**: Opportunities for automation
- **Security considerations**: Sensitive information handling

## Analysis Applications

### Productivity Optimization
- **Peak productivity times**: Schedule demanding tasks
- **Information flow patterns**: Optimize knowledge management
- **Tool usage patterns**: Identify most effective workflows

### Security Monitoring
- **Sensitive data detection**: Monitor for PII or credentials
- **Unusual access patterns**: Detect potential security issues
- **Cross-device sync**: Ensure secure data transmission

### Workflow Automation
- **Repetitive tasks**: Identify automation opportunities
- **Information handoffs**: Streamline cross-system workflows
- **Notification patterns**: Optimize alert systems

### Research and Development
- **Information gathering patterns**: Understand research workflows
- **Code snippet analysis**: Identify development methodologies
- **Reference material usage**: Track learning and reference patterns

## Implementation Recommendations

### Short-term (1-2 weeks)
1. **Monitor current patterns**: Establish baseline usage
2. **Identify quick wins**: Simple automation opportunities
3. **Security review**: Audit clipboard content handling

### Medium-term (1-3 months)
1. **Workflow optimization**: Streamline identified patterns
2. **Cross-device integration**: Improve device synchronization
3. **Automation implementation**: Deploy identified automations

### Long-term (3-6 months)
1. **Advanced analytics**: ML-based pattern recognition
2. **Predictive automation**: Anticipate user needs
3. **System integration**: Seamless cross-platform workflows
`,
    layer: 4, // Procedural
    domain: 6, // Data Science (pattern analysis)
    tags: ['android', 'clipboard', 'analysis', 'workflow', 'patterns', 'productivity'],
    abstractionLevel: 3,
    isTemplate: false
  },

  // Layer 5: Meta-Cognitive - Strategy Selection
  {
    name: 'embedded-debugging-strategy-selection',
    description: 'Meta-cognitive strategy selection for embedded systems debugging',
    content: `# Embedded Debugging Strategy Selection

## Context Assessment
**Evaluate the debugging scenario:**
- **Device type**: ESP32, Android, or other embedded system?
- **Access level**: Full hardware access, remote only, or simulated?
- **Time constraints**: Immediate fix needed or thorough analysis possible?
- **Risk level**: Production system or development environment?
- **Symptom severity**: System down, degraded performance, or minor issue?

## Strategy Options

### Scientific Debugging (Hypothesis-Driven)
**When to use:**
- Complex interactions between components
- Good understanding of system architecture
- Time available for systematic investigation
- Root cause analysis required

**ESP32 Application:**
\`\`\`
# 1. Form hypothesis
# "WiFi disconnection caused by power supply noise"

# 2. Design test
# Monitor voltage levels during disconnection events

# 3. Execute test
get_esp32_telemetry --sensor_types '["wifi_signal", "voltage"]'

# 4. Analyze results
analyze_telemetry_patterns --sensor_type voltage --analysis_type correlation
\`\`\`

### Pattern Matching (Experience-Based)
**When to use:**
- Seen similar issues before
- Time pressure for quick resolution
- Familiar system or component
- Standard troubleshooting steps exist

**Android Application:**
\`\`\`
# Recognize pattern: "App crashes when clipboard accessed"
# Apply known solution: Check permissions

get_android_device_info
# Verify: android.permission.READ_CLIPBOARD granted
\`\`\`

### Binary Search (Divide and Conquer)
**When to use:**
- Issue can be isolated to specific code paths
- Reproducible test case available
- Large codebase with clear boundaries
- Version control available for bisecting

**Cross-Device Application:**
\`\`\`
# Use git bisect to find problematic commit
# Test on both ESP32 and Android devices
# Isolate platform-specific vs universal issues

git_analyze_history --file "src/shared_lib.c"
execute_cross_device_workflow --workflow_name "bisect_test"
\`\`\`

### Exploratory Debugging (Trial and Error)
**When to use:**
- Unknown system behavior
- Learning opportunity
- No clear hypothesis
- Time available for investigation

**Embedded System Application:**
\`\`\`
# Try different approaches systematically
# Document each attempt and result

analyze_embedded_patterns --pattern_type telemetry
monitor_embedded_health --include_telemetry true
predict_embedded_behavior --device_id "esp32-001" --prediction_type usage
\`\`\`

### External Perspective (Documentation/Colleague Review)
**When to use:**
- Stuck on problem
- Fresh viewpoint needed
- Complex system interactions
- Knowledge transfer opportunity

**Implementation:**
\`\`\`
# Document current findings
# Share with team member
# Review system architecture together
# Consider alternative explanations

get_embedded_context --include_history true
# Share context with colleague for review
\`\`\`

## Decision Framework

### Quick Assessment Questions
1. **How critical is the issue?**
   - System down → Scientific or Pattern Matching
   - Minor issue → Exploratory or Documentation

2. **How much time is available?**
   - Immediate fix needed → Pattern Matching
   - Thorough analysis possible → Scientific or Binary Search

3. **How familiar am I with the system?**
   - Very familiar → Pattern Matching
   - Learning system → Exploratory or External

4. **How reproducible is the issue?**
   - Always reproducible → Binary Search
   - Intermittent → Scientific or Exploratory

### Strategy Selection Matrix

| Context | Time Available | Familiarity | Reproducibility | Recommended Strategy |
|---------|---------------|-------------|----------------|---------------------|
| Critical | Limited | High | Any | Pattern Matching |
| Critical | Limited | Low | Any | External Perspective |
| Critical | Available | Any | High | Binary Search |
| Critical | Available | Any | Low | Scientific |
| Minor | Any | High | Any | Pattern Matching |
| Minor | Any | Low | Any | Exploratory |

## Execution Guidelines

### Strategy Switching
**When to change strategies:**
- Current approach not yielding results after 30 minutes
- New information invalidates current hypothesis
- Better approach becomes apparent
- External constraints change (time pressure increases)

### Documentation Requirements
**Always document:**
- Initial strategy selection rationale
- Key findings from each approach
- Why strategy was changed (if applicable)
- Final resolution and lessons learned

### Learning Opportunities
**Capture for future use:**
- Successful debugging approaches
- Common failure patterns
- Tool effectiveness in different scenarios
- Strategy effectiveness metrics

## Tool Selection Guide

### ESP32-Specific Tools
- **Serial Monitor**: Real-time logging and status
- **GDB/OpenOCD**: Hardware debugging
- **ESP-IDF Monitor**: Enhanced logging
- **JTAG Debugger**: Full system inspection

### Android-Specific Tools
- **ADB**: Device communication and control
- **Logcat**: System and application logging
- **Android Studio Profiler**: Performance analysis
- **Device Monitor**: System resource monitoring

### Cross-Platform Tools
- **MCP Coordinator**: Unified device management
- **Cognitive Prompts**: Pattern recognition and analysis
- **Workflow Orchestration**: Multi-device coordination
- **Telemetry Aggregation**: Cross-device data analysis

## Success Metrics

### Effectiveness Measures
- **Time to resolution**: How quickly issue was identified and fixed
- **Accuracy**: Correctness of root cause identification
- **Learning value**: Insights gained for future debugging
- **System impact**: Minimal disruption during debugging process

### Continuous Improvement
- **Strategy effectiveness tracking**: Which strategies work best
- **Tool effectiveness analysis**: Which tools provide most value
- **Pattern database building**: Accumulation of debugging knowledge
- **Process optimization**: Refinement of debugging workflows
`,
    layer: 5, // Meta-Cognitive
    domain: 1, // Software Development
    tags: ['embedded', 'debugging', 'strategy', 'meta-cognition', 'methodology'],
    abstractionLevel: 4,
    isTemplate: false
  },

  // Layer 6: Transfer - Cross-Domain Application
  {
    name: 'embedded-to-software-debugging-analogy',
    description: 'Applying embedded systems debugging patterns to general software development',
    content: `# Embedded-to-Software Debugging Analogies

## Core Principle
**Embedded systems constraints teach general software debugging skills:**
- **Resource limitations** → Efficient problem-solving
- **Physical/hardware interaction** → System-level thinking
- **Real-time requirements** → Performance awareness
- **Failure consequences** → Risk assessment

## Analogy Framework

### Memory Management → Resource Management
**Embedded Perspective:**
- Limited RAM requires careful allocation
- Memory leaks cause system crashes
- Stack overflow prevention critical
- Manual memory management mandatory

**Software Development Application:**
\`\`\`
# Memory leak detection in applications
# Similar to embedded heap monitoring
valgrind --tool=memcheck ./application
# Look for "definitely lost" and "possibly lost" bytes

# CPU usage monitoring
# Similar to embedded task profiling
perf stat ./application
# Monitor context switches, cache misses, branch mispredictions
\`\`\`

### Power Management → Performance Optimization
**Embedded Perspective:**
- Different power modes (Active, Sleep, Deep Sleep)
- Battery life optimization
- Power consumption monitoring
- Trade-offs between performance and efficiency

**Software Development Application:**
\`\`\`
# Performance profiling
# Similar to power consumption analysis
perf record -g ./application
perf report
# Identify CPU-intensive functions

# Memory usage optimization
# Similar to battery optimization
heaptrack ./application
# Find memory allocation hotspots
\`\`\`

### Interrupt Handling → Asynchronous Programming
**Embedded Perspective:**
- Interrupt Service Routines (ISRs)
- Critical sections and atomic operations
- Interrupt priority levels
- Race condition prevention

**Software Development Application:**
\`\`\`
# Race condition detection
# Similar to interrupt race prevention
helgrind ./application
# Find data races and lock ordering violations

# Deadlock prevention
# Similar to interrupt deadlock avoidance
gdb --batch --ex "thread apply all bt" ./application
# Analyze thread states during deadlocks
\`\`\`

### Hardware Abstraction → API Design
**Embedded Perspective:**
- Hardware register access
- Peripheral driver development
- Hardware abstraction layers (HAL)
- Board support packages (BSP)

**Software Development Application:**
\`\`\`
# API stability analysis
# Similar to hardware interface stability
abidiff libold.so libnew.so
# Detect ABI changes that break compatibility

# Dependency management
# Similar to hardware peripheral management
ldd ./application
# Check dynamic library dependencies
\`\`\`

### Firmware Updates → Deployment Strategies
**Embedded Perspective:**
- Over-The-Air (OTA) updates
- Firmware rollback capability
- Update failure recovery
- Incremental update strategies

**Software Development Application:**
\`\`\`
# Blue-green deployment
# Similar to OTA update strategies
kubectl rollout status deployment/my-app
# Monitor deployment progress and rollback if needed

# Feature flags
# Similar to incremental firmware updates
# Enable/disable features without full redeployment
\`\`\`

## Transferable Skills

### 1. Systematic Problem Isolation
**Embedded Approach:**
- Hardware vs software issue differentiation
- Peripheral-by-peripheral testing
- Minimal reproduction case creation
- Signal integrity analysis

**Software Application:**
\`\`\`
# Binary search through codebase
git bisect start
git bisect bad HEAD
git bisect good v1.0
# Find commit that introduced bug

# Minimal reproduction case
# Similar to minimal embedded test case
curl -X POST /api/test \\
  -H "Content-Type: application/json" \\
  -d '{"minimal": "test case"}'
\`\`\`

### 2. Resource-Aware Thinking
**Embedded Approach:**
- Memory footprint analysis
- CPU cycle counting
- Power consumption monitoring
- I/O bandwidth optimization

**Software Application:**
\`\`\`
# Performance benchmarking
# Similar to embedded resource monitoring
wrk -t12 -c400 -d30s http://localhost:8080/api
# Load testing with resource monitoring

# Memory profiling
# Similar to embedded heap analysis
go tool pprof http://localhost:8080/debug/pprof/heap
# Analyze memory allocation patterns
\`\`\`

### 3. Failure Mode Analysis
**Embedded Approach:**
- Single-point failure identification
- Redundancy requirement assessment
- Failure propagation analysis
- Recovery mechanism design

**Software Application:**
\`\`\`
# Chaos engineering
# Similar to embedded failure mode analysis
# Introduce failures to test system resilience
kubectl delete pod --random
# Test system recovery capabilities

# Circuit breaker pattern
# Similar to embedded watchdog timers
# Prevent cascade failures
\`\`\`

### 4. Cross-System Debugging
**Embedded Approach:**
- Hardware-software interaction debugging
- Multi-core synchronization issues
- Network protocol analysis
- Timing-dependent bug identification

**Software Application:**
\`\`\`
# Distributed system debugging
# Similar to multi-core embedded debugging
kubectl logs -f deployment/app --all-containers
# Monitor logs across all service instances

# Network analysis
# Similar to embedded protocol debugging
tcpdump -i eth0 port 80
# Analyze network traffic patterns
\`\`\`

## Implementation Strategy

### Phase 1: Skill Mapping (1-2 weeks)
1. **Identify embedded skills** relevant to software development
2. **Document analogies** between embedded and software domains
3. **Create transfer guides** for specific techniques
4. **Build example mappings** for common scenarios

### Phase 2: Practice Application (2-4 weeks)
1. **Select target projects** for analogy application
2. **Apply embedded techniques** to software problems
3. **Measure effectiveness** of transferred approaches
4. **Refine analogies** based on practical experience

### Phase 3: Integration (1-2 months)
1. **Incorporate lessons** into development workflows
2. **Create automated tools** based on embedded techniques
3. **Train team members** on transferable skills
4. **Establish best practices** for cross-domain problem-solving

### Phase 4: Advanced Application (Ongoing)
1. **Explore complex analogies** between domains
2. **Develop hybrid approaches** combining multiple domains
3. **Create specialized tools** for advanced scenarios
4. **Contribute back** to embedded community with software insights

## Success Metrics

### Skill Transfer Effectiveness
- **Problem resolution time**: Faster debugging with transferred techniques
- **Solution quality**: More robust solutions from cross-domain thinking
- **Innovation**: Novel approaches from domain analogies
- **Knowledge sharing**: Team adoption of transferred skills

### Process Improvements
- **Debugging methodology**: More systematic problem-solving approaches
- **Tool adoption**: Increased use of advanced debugging tools
- **Documentation**: Better knowledge capture and sharing
- **Training**: Improved skill development processes

## Recommended Resources

### Embedded-to-Software Learning Path
1. **"Making Embedded Systems" by Elecia White** - System-level thinking
2. **"Programming Embedded Systems" by Michael Barr** - Resource-aware development
3. **"Test Driven Development for Embedded C" by James Grenning** - Systematic testing
4. **"Clean Code" by Robert Martin** - Applied to embedded constraints

### Tool Transfer Guides
- **GDB → General-purpose debuggers** (LLDB, Visual Studio Debugger)
- **JTAG → Hardware-assisted debugging** (Intel VT-x, AMD-V)
- **RTOS analysis → Concurrent programming** (ThreadSanitizer, Helgrind)
- **OTA updates → Deployment automation** (Kubernetes, Docker Swarm)

### Community Resources
- **Embedded.fm podcast** - Embedded system discussions
- **EEVblog forum** - Hardware-software interaction insights
- **Reddit r/embedded** - Real-world embedded problem-solving
- **Stack Overflow embedded tags** - Practical debugging techniques
`,
    layer: 6, // Transfer
    domain: 1, // Software Development
    tags: ['embedded', 'software', 'debugging', 'analogy', 'transfer-learning', 'methodology'],
    abstractionLevel: 6,
    isTemplate: false
  },

  // Layer 7: Evaluative - Quality Assessment
  {
    name: 'embedded-system-quality-assessment',
    description: 'Comprehensive quality assessment framework for embedded systems',
    content: `# Embedded System Quality Assessment Framework

## Assessment Dimensions

### 1. Functional Correctness (40% weight)
**Requirements Verification:**
- Does the system perform all required functions?
- Are all edge cases handled correctly?
- Is data integrity maintained across power cycles?

**Testing Coverage:**
\`\`\`
# Unit test coverage
gcovr --html-details coverage.html
# Target: >90% coverage for critical functions

# Integration testing
# Test hardware-software interactions
get_esp32_telemetry --sensor_types '["all"]'
# Verify sensor data accuracy and consistency
\`\`\`

### 2. Performance & Efficiency (25% weight)
**Resource Utilization:**
- **Memory**: Heap usage, stack depth, fragmentation
- **CPU**: Task execution time, interrupt latency
- **Power**: Current draw, battery life, sleep modes
- **Storage**: Flash wear, data retention

**Performance Benchmarks:**
\`\`\`
# Memory usage assessment
get_esp32_status
# Check: heap_free > 25% of heap_total

# CPU performance monitoring
analyze_telemetry_patterns --sensor_type cpu_usage --analysis_type trend
# Verify: CPU usage < 80% under normal load
\`\`\`

### 3. Reliability & Robustness (20% weight)
**Error Handling:**
- Graceful degradation under failure conditions
- Recovery mechanisms for transient failures
- Watchdog timer effectiveness

**Stress Testing:**
\`\`\`
# Power cycling tests
# Simulate brownout conditions
emergency_embedded_shutdown --reason "Testing"
# Verify clean shutdown and restart

# Network interruption tests
# Test WiFi reconnection robustness
analyze_embedded_patterns --pattern_type telemetry --time_range '{"start": "1 hour ago"}'
\`\`\`

### 4. Security & Safety (10% weight)
**Security Measures:**
- Secure boot verification
- Encrypted communication channels
- Access control mechanisms
- Firmware update security

**Safety Considerations:**
- Fail-safe operation modes
- Critical function redundancy
- Emergency stop capabilities

### 5. Maintainability & Documentation (5% weight)
**Code Quality:**
- Code readability and structure
- Comment completeness
- Version control practices

**Documentation:**
- API documentation completeness
- Hardware schematics accuracy
- Troubleshooting guide adequacy

## Assessment Methodology

### Phase 1: Automated Analysis (30 minutes)
**Run automated checks:**
\`\`\`
# Code quality metrics
cppcheck --enable=all --xml src/
# Check for: memory leaks, null pointer dereference, bounds errors

# Static analysis
clang-tidy src/*.cpp --checks='*' > static_analysis.txt
# Review: warning count, error severity

# Memory analysis
valgrind --tool=memcheck ./firmware
# Check for: memory leaks, invalid accesses
\`\`\`

### Phase 2: Dynamic Testing (2-4 hours)
**Runtime verification:**
\`\`\`
# Functional testing
run_tests --framework gtest --directory tests/
# Verify: all tests pass, coverage >90%

# Performance testing
analyze_embedded_patterns --pattern_type telemetry
# Check: performance within specifications

# Stress testing
monitor_embedded_health --include_telemetry true
# Verify: system stability under load
\`\`\`

### Phase 3: Manual Review (1-2 hours)
**Expert evaluation:**
- Code review for best practices
- Architecture assessment
- Security vulnerability analysis
- Documentation review

### Phase 4: Integration Testing (2-4 hours)
**System-level validation:**
\`\`\`
# Hardware-software integration
execute_cross_device_workflow --workflow_name "integration_test"
# Verify: all components work together

# Environmental testing
# Test under various conditions (temperature, humidity, EMI)
analyze_telemetry_patterns --analysis_type anomaly
\`\`\`

## Quality Scoring System

### Score Ranges
- **90-100**: Excellent - Ready for production
- **80-89**: Good - Minor issues to address
- **70-79**: Satisfactory - Requires improvement
- **60-69**: Poor - Significant rework needed
- **0-59**: Critical - Not ready for deployment

### Dimension Weighting
\`\`\`
Total_Score = (
  Functional_Correctness * 0.40 +
  Performance_Efficiency * 0.25 +
  Reliability_Robustness * 0.20 +
  Security_Safety * 0.10 +
  Maintainability_Docs * 0.05
)
\`\`\`

### Critical Thresholds
- **Functional Correctness**: Must score ≥80 (critical functions work)
- **Performance**: Must score ≥70 (meets performance requirements)
- **Reliability**: Must score ≥75 (acceptable failure rate)
- **Security**: Must score ≥85 (no critical vulnerabilities)
- **Maintainability**: Must score ≥60 (code is maintainable)

## Automated Quality Gates

### Pre-commit Hooks
\`\`\`bash
#!/bin/bash
# pre-commit hook for quality checks

# Run static analysis
cppcheck --enable=all --error-exitcode=1 src/
if [ $? -ne 0 ]; then
  echo "Static analysis failed!"
  exit 1
fi

# Run unit tests
make test
if [ $? -ne 0 ]; then
  echo "Unit tests failed!"
  exit 1
fi

# Check code formatting
clang-format --dry-run --Werror src/*.cpp
if [ $? -ne 0 ]; then
  echo "Code formatting issues!"
  exit 1
fi
\`\`\`

### CI/CD Pipeline Checks
\`\`\`yaml
# .github/workflows/quality.yml
name: Quality Assurance
on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Static Analysis
      run: cppcheck --enable=all --xml src/
    - name: Unit Tests
      run: make test
    - name: Memory Checks
      run: valgrind --tool=memcheck --error-exitcode=1 ./firmware
    - name: Performance Tests
      run: ./performance_tests.sh
\`\`\`

## Continuous Quality Improvement

### Metrics Tracking
**Monitor over time:**
- Code quality metrics (complexity, duplication, coverage)
- Performance benchmarks
- Failure rates and types
- Development velocity vs quality trade-offs

### Process Improvements
**Regular activities:**
- **Weekly code reviews** focusing on quality aspects
- **Monthly architecture reviews** for design quality
- **Quarterly tool updates** for latest analysis capabilities
- **Annual methodology reviews** for process improvements

### Team Training
**Quality awareness:**
- **Code quality workshops** on best practices
- **Security training** for embedded-specific threats
- **Performance optimization** techniques
- **Testing methodology** improvements

## Quality Assurance Checklist

### Pre-release Verification
- [ ] All automated tests pass
- [ ] Static analysis clean (≤5 warnings)
- [ ] Memory leak check passed
- [ ] Performance benchmarks met
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Integration tests passed
- [ ] Field testing completed (if applicable)

### Release Readiness Criteria
- [ ] Quality score ≥85 overall
- [ ] No critical or high-severity issues
- [ ] Performance requirements met
- [ ] Security review completed
- [ ] Rollback plan documented
- [ ] Support team trained

### Post-release Monitoring
- [ ] Error tracking system configured
- [ ] Performance monitoring active
- [ ] User feedback collection enabled
- [ ] Update mechanism tested
- [ ] Support procedures documented

## Tool Integration

### Quality Dashboard
**Real-time monitoring:**
\`\`\`
# Quality metrics dashboard
get_embedded_device_status
monitor_embedded_health
analyze_embedded_patterns --pattern_type usage
# Display: quality scores, trends, alerts
\`\`\`

### Automated Reporting
**Regular quality reports:**
- Daily: Test results and static analysis
- Weekly: Performance trends and code metrics
- Monthly: Comprehensive quality assessment
- Quarterly: Process improvement recommendations

### Integration with Development Workflow
**Quality gates in development:**
- **Feature branches**: Basic quality checks
- **Pull requests**: Full quality assessment
- **Main branch**: Comprehensive validation
- **Release branches**: Final quality verification

## Success Metrics

### Quality Improvement Goals
- **Defect density**: <0.5 defects per 1000 lines of code
- **Mean time to detection**: <1 day for critical issues
- **Test coverage**: >90% for critical functionality
- **Performance regression**: <5% degradation allowed
- **Security vulnerabilities**: Zero critical or high-severity

### Business Impact
- **Reduced field failures**: <1% return rate
- **Faster time-to-market**: 20% reduction through quality automation
- **Lower support costs**: 30% reduction through proactive quality
- **Increased customer satisfaction**: >95% satisfaction rating
`,
    layer: 7, // Evaluative
    domain: 7, // Security (quality assurance in safety-critical systems)
    tags: ['embedded', 'quality', 'assessment', 'testing', 'reliability', 'security'],
    abstractionLevel: 5,
    isTemplate: false
  }
];

// Utility function to write prompt to appropriate directory
function writePrompt(prompt) {
  const layerName = ['unknown', 'perceptual', 'episodic', 'semantic', 'procedural', 'meta', 'transfer', 'evaluative'][prompt.layer];
  const dirPath = path.join(__dirname, '..', 'data', 'prompts', 'cognitive', layerName);

  // Ensure directory exists
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const fileName = `${prompt.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`;
  const filePath = path.join(dirPath, fileName);

  // Convert to JSON format expected by mcp-prompts
  const jsonPrompt = {
    name: prompt.name,
    description: prompt.description,
    content: prompt.content,
    arguments: [],
    tags: prompt.tags,
    isTemplate: prompt.isTemplate || false,
    metadata: {
      layer: prompt.layer,
      domain: prompt.domain,
      abstractionLevel: prompt.abstractionLevel || 1
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(jsonPrompt, null, 2));
  console.log(`Created embedded prompt: ${filePath}`);
}

// Create all embedded prompts
console.log('Creating embedded systems cognitive prompts...');
embeddedPrompts.forEach(writePrompt);
console.log('Embedded cognitive prompts seeded successfully!');