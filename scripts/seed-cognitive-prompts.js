#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Cognitive architecture constants
const PromptLayer = {
  Unknown: 0,
  Perceptual: 1,
  Episodic: 2,
  Semantic: 3,
  Procedural: 4,
  MetaCognitive: 5,
  Transfer: 6,
  Evaluative: 7
};

const Domain = {
  General: 0,
  SoftwareDevelopment: 1,
  MedicalAnalysis: 2,
  FinancialModeling: 3,
  CreativeProduction: 4,
  Infrastructure: 5,
  DataScience: 6,
  Security: 7
};

// Helper function to get layer name from value
function getLayerName(layerValue) {
  for (const [key, value] of Object.entries(PromptLayer)) {
    if (value === layerValue) {
      return key.toLowerCase();
    }
  }
  return 'unknown';
}

// Utility function to write prompt to appropriate directory
function writePrompt(prompt) {
  const layerName = getLayerName(prompt.layer);
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
    arguments: prompt.arguments || [],
    tags: prompt.tags,
    isTemplate: prompt.isTemplate || false,
    metadata: {
      layer: prompt.layer,
      domain: prompt.domain,
      abstractionLevel: prompt.abstractionLevel || 1,
      ...prompt.metadata
    }
  };

  fs.writeFileSync(filePath, JSON.stringify(jsonPrompt, null, 2));
  console.log(`Created prompt: ${filePath}`);
}

// Seed development tooling knowledge
function seedDevelopmentToolingKnowledge() {
  console.log('Seeding development tooling cognitive prompts...');

  // Layer 1: Perceptual Prompts
  writePrompt({
    name: 'detect-project-context',
    description: 'Analyze project structure to determine type, language, and context',
    content: `Analyze this project to determine its type and context:

Project files: {{files}}
Root directory contents: {{root_contents}}

Determine:
1. Project type (web service, CLI tool, library, embedded, etc.)
2. Primary programming language(s)
3. Build system/configuration files present
4. Whether it has tests, CI/CD, documentation
5. Performance/safety criticality indicators

Provide a structured assessment of the project context.`,
    arguments: [
      { name: 'files', description: 'List of key project files', required: true },
      { name: 'root_contents', description: 'Contents of root directory', required: true }
    ],
    layer: PromptLayer.Perceptual,
    domain: Domain.SoftwareDevelopment,
    tags: ['project-analysis', 'context-detection', 'language-detection'],
    abstractionLevel: 2,
    isTemplate: true
  });

  writePrompt({
    name: 'identify-analysis-goals',
    description: 'Determine the appropriate analysis goals based on project context and symptoms',
    content: `Given the project context and reported symptoms, identify the most appropriate analysis goals:

Project Context: {{project_context}}
Symptoms/Issues: {{symptoms}}
Time Available: {{time_constraint}}
Risk Level: {{risk_level}}

Determine whether this is:
- Bug finding and fixing
- Performance optimization
- Security audit
- Code quality improvement
- Refactoring needs
- Documentation gaps

Prioritize goals based on risk level and time constraints.`,
    arguments: [
      { name: 'project_context', description: 'Project type and characteristics', required: true },
      { name: 'symptoms', description: 'Issues or symptoms reported', required: true },
      { name: 'time_constraint', description: 'Available time for analysis', required: false },
      { name: 'risk_level', description: 'Criticality of the project', required: false }
    ],
    layer: PromptLayer.Perceptual,
    domain: Domain.SoftwareDevelopment,
    tags: ['goal-identification', 'prioritization', 'risk-assessment'],
    abstractionLevel: 3,
    isTemplate: true
  });

  // Layer 3: Semantic Knowledge
  writePrompt({
    name: 'static-analysis-tools-knowledge',
    description: 'Knowledge about static analysis tools and their capabilities',
    content: `# Static Analysis Tools Knowledge Base

## C/C++ Tools
- **cppcheck**: General-purpose static analysis, memory leaks, null pointer dereferences
- **clang-tidy**: LLVM-based, coding standards, modernize checks
- **gcc/g++ -Wall -Wextra**: Compiler warnings for potential issues
- **pvs-studio**: Advanced static analysis, MISRA compliance
- **infer**: Facebook's static analyzer for memory and concurrency

## Python Tools
- **pylint**: Style and error checking
- **flake8**: PEP 8 style guide enforcement
- **mypy**: Static type checking
- **bandit**: Security vulnerability scanning

## JavaScript/TypeScript
- **eslint**: Configurable linting rules
- **typescript**: Type checking and compilation
- **prettier**: Code formatting

## Best Practices
1. Run multiple tools with different focuses
2. Use tool-specific configuration files
3. Integrate into CI/CD pipelines
4. Review false positives manually
5. Address high-confidence warnings first`,
    layer: PromptLayer.Semantic,
    domain: Domain.SoftwareDevelopment,
    tags: ['static-analysis', 'tools', 'best-practices', 'languages'],
    abstractionLevel: 4
  });

  writePrompt({
    name: 'memory-management-principles',
    description: 'Core principles of memory management across different programming paradigms',
    content: `# Memory Management Principles

## RAII (Resource Acquisition Is Initialization) - C++
- Resources tied to object lifetime
- Automatic cleanup in destructors
- Smart pointers (unique_ptr, shared_ptr)
- Exception safety guarantees

## Garbage Collection - Java, Python, Go
- Automatic memory reclamation
- Reference counting vs mark-and-sweep
- GC pauses and performance impact
- Memory leaks through reference cycles

## Manual Memory Management - C, Assembly
- Explicit allocation/deallocation
- Ownership semantics
- Buffer overflow prevention
- Memory alignment requirements

## Common Patterns
- **Ownership transfer**: clear responsibility passing
- **Borrowing**: temporary access without ownership
- **Reference counting**: shared ownership tracking
- **Arena allocation**: bulk allocation/deallocation

## Detection Techniques
- Valgrind (C/C++): comprehensive memory checking
- AddressSanitizer: fast compile-time instrumentation
- Heap profiling: allocation pattern analysis`,
    layer: PromptLayer.Semantic,
    domain: Domain.SoftwareDevelopment,
    tags: ['memory-management', 'raii', 'garbage-collection', 'ownership'],
    abstractionLevel: 5
  });

  // Layer 4: Procedural Workflows
  writePrompt({
    name: 'cpp-static-analysis-workflow',
    description: 'Systematic workflow for C++ static analysis',
    content: `# C++ Static Analysis Workflow

## Phase 1: Compiler Warnings (5-10 minutes)
\`\`\`bash
# Enable all warnings
g++ -Wall -Wextra -Wpedantic -Wshadow -Wconversion \\
    -fsanitize=address -fsanitize=undefined \\
    -o build/app src/*.cpp

# Or with CMake
cmake -DCMAKE_CXX_FLAGS="-Wall -Wextra -Wpedantic" ..
make
\`\`\`

## Phase 2: cppcheck (10-15 minutes)
\`\`\`bash
cppcheck --enable=all --std=c++17 --language=c++ \\
         --suppress=missingIncludeSystem \\
         --inline-suppr --xml --xml-version=2 \\
         src/ 2> cppcheck_results.xml
\`\`\`

## Phase 3: clang-tidy (15-30 minutes)
\`\`\`bash
# Generate compile_commands.json first
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..

clang-tidy -p build/compile_commands.json \\
           -checks='*' \\
           -header-filter='.*' \\
           src/*.cpp > clang_tidy_results.txt
\`\`\`

## Phase 4: Manual Review (30-60 minutes)
1. Review high-severity warnings first
2. Check for false positives
3. Look for patterns indicating deeper issues
4. Validate fixes don't introduce new problems

## Common Issue Patterns
- **Uninitialized variables**: Memory corruption source
- **Null pointer dereferences**: Runtime crashes
- **Resource leaks**: Memory/performance degradation
- **Buffer overflows**: Security vulnerabilities`,
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['cpp', 'static-analysis', 'workflow', 'cppcheck', 'clang-tidy'],
    abstractionLevel: 2,
    isTemplate: true
  });

  writePrompt({
    name: 'performance-regression-diagnosis',
    description: 'Systematic approach to diagnosing performance regressions',
    content: `# Performance Regression Diagnosis Workflow

## Step 1: Establish Baseline (5 minutes)
- Identify when performance was acceptable
- Document expected vs actual performance metrics
- Confirm regression is reproducible

## Step 2: Profiling (15-30 minutes)
\`\`\`bash
# CPU profiling
perf record -g ./application
perf report

# Memory profiling
valgrind --tool=massif ./application
ms_print massif.out.*

# Call graph analysis
gprof ./application gmon.out > analysis.txt
\`\`\`

## Step 3: Binary Search in Version History (30-60 minutes)
- Use git bisect to find introducing commit
- Test performance at each step
- Identify the specific code change

## Step 4: Code Analysis (30-90 minutes)
- Review the problematic commit
- Analyze algorithm complexity changes
- Check for memory leaks or bloat
- Look for lock contention or I/O issues

## Step 5: Microbenchmarking (15-30 minutes)
\`\`\`cpp
// Example microbenchmark
#include <benchmark/benchmark.h>

static void BM_ProblematicFunction(benchmark::State& state) {
  for (auto _ : state) {
    // Code under test
    problematic_function();
  }
}
BENCHMARK(BM_ProblematicFunction);
\`\`\`

## Common Causes
- **Algorithm degradation**: O(n) → O(n²)
- **Memory leaks**: Growing heap usage
- **Lock contention**: Thread synchronization overhead
- **I/O bottlenecks**: Disk/network latency
- **Cache misses**: Memory access pattern issues`,
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['performance', 'profiling', 'regression', 'diagnosis', 'optimization'],
    abstractionLevel: 3,
    isTemplate: true
  });

  // Layer 5: Meta-Cognitive
  writePrompt({
    name: 'select-debugging-strategy',
    description: 'Choose appropriate debugging strategy based on context and constraints',
    content: `Given the debugging scenario, select the most appropriate strategy:

Problem Context: {{problem_description}}
Available Tools: {{available_tools}}
Time Constraints: {{time_available}}
System Access: {{system_access_level}}
Risk of Change: {{change_risk}}

## Strategy Options

### Scientific Method (Hypothesis-Driven)
- **When**: Complex problems, good understanding of system
- **Pros**: Systematic, educational, prevents flailing
- **Cons**: Time-intensive for simple problems
- **Tools**: Logging, breakpoints, controlled experiments

### Pattern Matching (Experience-Based)
- **When**: Seen similar problems before, time pressure
- **Pros**: Fast resolution for known issues
- **Cons**: May miss novel aspects
- **Tools**: Code search, log analysis, symptom correlation

### Binary Search (Divide and Conquer)
- **When**: Linear code paths, reproducible issues
- **Pros**: Efficient for large codebases
- **Cons**: Requires reproducible test case
- **Tools**: Git bisect, conditional breakpoints

### Exploratory (Trial and Error)
- **When**: Unknown territory, learning opportunity
- **Pros**: Discovers unexpected insights
- **Cons**: Unpredictable time, may not converge
- **Tools**: Interactive debuggers, print statements

### External Perspective (Rubber Duck/Peer Review)
- **When**: Stuck, need fresh viewpoint
- **Pros**: Often reveals obvious issues
- **Cons**: Requires explanation effort
- **Tools**: Documentation, code review, pair debugging

**Recommended Strategy**: [Select based on context]
**Reasoning**: [Explain choice]
**Fallback Strategy**: [If primary doesn't work]`,
    arguments: [
      { name: 'problem_description', description: 'Description of the debugging problem', required: true },
      { name: 'available_tools', description: 'Debugging tools available', required: true },
      { name: 'time_available', description: 'Time available for debugging', required: true },
      { name: 'system_access_level', description: 'Level of system access (full, limited, remote)', required: true },
      { name: 'change_risk', description: 'Risk of making changes during debugging', required: true }
    ],
    layer: PromptLayer.MetaCognitive,
    domain: Domain.SoftwareDevelopment,
    tags: ['debugging', 'strategy-selection', 'meta-cognition', 'problem-solving'],
    abstractionLevel: 4,
    isTemplate: true
  });

  // Layer 6: Transfer (Cross-Domain)
  writePrompt({
    name: 'two-phase-analysis-pattern',
    description: 'Universal two-phase analysis pattern applicable across domains',
    content: `# Two-Phase Analysis Pattern

## Abstract Structure
**Phase 1: Exploratory** - Broad, fast-coverage assessment
**Phase 2: Focused** - Deep analysis of identified areas

## Software Development Instance
### Phase 1: Fast Static Analysis (5-15 minutes)
- Run basic linters (eslint, compiler warnings)
- Quick grep for common anti-patterns
- Surface-level code review

### Phase 2: Deep Analysis (30-120 minutes)
- Run heavy static analysis (cppcheck, valgrind)
- Detailed code review of flagged areas
- Performance profiling of suspected bottlenecks

## Medical Diagnosis Instance
### Phase 1: Initial Assessment (5-15 minutes)
- Vital signs, basic physical exam
- Patient history review
- Symptom correlation with common conditions

### Phase 2: Specialized Testing (30-120 minutes)
- Targeted lab work based on initial findings
- Specialist consultations
- Advanced imaging for suspected issues

## Quality Assurance Instance
### Phase 1: Broad Coverage Testing (15-60 minutes)
- Run full test suite
- Basic integration tests
- Automated security scans

### Phase 2: Targeted Investigation (60-240 minutes)
- Deep debugging of failing tests
- Performance analysis of slow components
- Security audit of vulnerable areas

## Key Principles
1. **Efficiency**: Fast initial pass identifies focus areas
2. **Resource Allocation**: Intensive analysis only where needed
3. **Risk Management**: Address high-risk areas first
4. **Iterative Refinement**: Phase 1 informs Phase 2 scope

## When to Apply
- Analysis is expensive or time-consuming
- Issues are sparse rather than ubiquitous
- High-confidence screening methods exist
- Resource constraints require prioritization`,
    layer: PromptLayer.Transfer,
    domain: Domain.General,
    tags: ['analysis-pattern', 'cross-domain', 'efficiency', 'prioritization'],
    abstractionLevel: 8
  });

  console.log('Development tooling knowledge seeded successfully!');
}

// Seed embedded systems prompts
function seedEmbeddedSystemsPrompts() {
  console.log('Seeding embedded systems cognitive prompts...');

  // Layer 1: Perceptual for Embedded
  writePrompt({
    name: 'detect-embedded-project-context',
    description: 'Analyze embedded project structure and requirements',
    content: `Analyze this embedded project to understand its characteristics:

Hardware: {{hardware_platform}}
Code Structure: {{code_files}}
Build System: {{build_config}}
Communication: {{interfaces}}

Identify:
1. Microcontroller/processor architecture (ARM, ESP32, AVR, etc.)
2. Real-time requirements and constraints
3. Memory limitations (RAM, flash)
4. Peripheral usage (GPIO, ADC, UART, I2C, SPI)
5. Power consumption requirements
6. Safety/security criticality

Assess whether this is:
- Bare-metal embedded system
- RTOS-based (FreeRTOS, Zephyr, etc.)
- IoT device with network connectivity
- Safety-critical system (automotive, medical, industrial)`,
    arguments: [
      { name: 'hardware_platform', description: 'Target hardware platform', required: true },
      { name: 'code_files', description: 'Key source files', required: true },
      { name: 'build_config', description: 'Build system and configuration', required: true },
      { name: 'interfaces', description: 'Communication interfaces used', required: true }
    ],
    layer: PromptLayer.Perceptual,
    domain: Domain.SoftwareDevelopment,
    tags: ['embedded', 'hardware', 'real-time', 'microcontroller'],
    abstractionLevel: 2,
    isTemplate: true
  });

  // Layer 3: Semantic for Embedded
  writePrompt({
    name: 'esp32-architecture-knowledge',
    description: 'ESP32 microcontroller architecture and constraints knowledge',
    content: `# ESP32 Architecture Knowledge

## Core Architecture
- **Dual-core Xtensa LX6**: 240MHz clock, asymmetric cores
- **Memory**: 520KB SRAM, external SPI flash up to 16MB
- **WiFi**: 802.11 b/g/n, soft-AP mode
- **Bluetooth**: Classic + BLE 4.2

## Memory Constraints
- **IRAM**: 128KB instruction RAM (faster, limited)
- **DRAM**: 320KB data RAM
- **Flash**: External SPI, slower access
- **Heap**: ~300KB available, fragmented

## Real-Time Considerations
- **FreeRTOS**: Preemptive multitasking
- **Task Priorities**: 0-24 (higher = more priority)
- **Stack Size**: Default 4KB, monitor usage
- **Interrupt Handling**: IRAM-only functions

## Power Management
- **Light Sleep**: CPU off, RAM retained (~0.8mA)
- **Deep Sleep**: Full state retention (~10µA)
- **Modem Sleep**: WiFi/BT power cycling
- **Active**: ~80mA (depending on usage)

## Common Pitfalls
- **Stack Overflow**: Monitor with uxTaskGetStackHighWaterMark
- **Heap Fragmentation**: Use heap_caps_malloc with MALLOC_CAP_INTERNAL
- **WiFi Interrupt Latency**: Keep critical code short
- **Flash Wear**: Minimize writes to flash sectors

## Development Tools
- **ESP-IDF**: Official framework
- **Arduino Core**: Simplified development
- **OpenOCD/JTAG**: Hardware debugging
- **esp32-monitor**: Serial debugging`,
    layer: PromptLayer.Semantic,
    domain: Domain.SoftwareDevelopment,
    tags: ['esp32', 'embedded', 'architecture', 'constraints', 'real-time'],
    abstractionLevel: 3
  });

  writePrompt({
    name: 'embedded-memory-constrained-analysis',
    description: 'Memory analysis for resource-constrained embedded systems',
    content: `Analyze {{code}} for memory constraints in embedded context:

Hardware Context: {{hardware_specs}}
Memory Limits: {{memory_constraints}}
Real-time Requirements: {{rt_requirements}}

## Memory Analysis Checklist

### 1. Stack Usage Analysis
- **Default Task Stack**: ESP32 FreeRTOS default 4KB
- **Interrupt Stack**: Additional overhead for ISRs
- **Local Variables**: Large arrays/structs on stack
- **Function Call Depth**: Recursion and deep call chains

### 2. Heap Memory Assessment
- **Dynamic Allocation**: malloc/new usage patterns
- **Memory Leaks**: Unfreed allocations in loops
- **Fragmentation**: Frequent alloc/free cycles
- **Peak Usage**: Maximum concurrent allocations

### 3. Static Memory Usage
- **Global Variables**: .data and .bss sections
- **String Literals**: Read-only data section
- **Initialized Data**: Flash-to-RAM copying
- **Code Size**: Instruction memory requirements

### 4. Real-Time Memory Access
- **IRAM Placement**: Interrupt handlers and time-critical code
- **DRAM Access**: Slower but larger capacity
- **Cache Considerations**: ESP32 cache mapping
- **DMA Buffers**: Peripheral data transfer buffers

### 5. Power-Aware Memory
- **Retention During Sleep**: RTC memory preservation
- **Fast Boot**: Minimize initialization time
- **Memory Power Gating**: When not in use

## Recommendations
[Based on analysis, provide specific recommendations]`,
    arguments: [
      { name: 'code', description: 'Code to analyze', required: true },
      { name: 'hardware_specs', description: 'Target hardware specifications', required: true },
      { name: 'memory_constraints', description: 'Memory limitations', required: true },
      { name: 'rt_requirements', description: 'Real-time requirements', required: true }
    ],
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['embedded', 'memory', 'real-time', 'esp32', 'analysis'],
    abstractionLevel: 2,
    isTemplate: true
  });

  console.log('Embedded systems prompts seeded successfully!');
}

// Seed self-demonstrating MCP tool usage prompts
function seedMCPToolUsagePrompts() {
  console.log('Seeding self-demonstrating MCP tool usage prompts...');

  writePrompt({
    name: 'use-mcp-prompts-list',
    description: 'Demonstrates how to use the list_prompts MCP tool',
    content: `# Listing Available Prompts

To see all available prompts in the system:

<mcp-tool-call>
<tool>list_prompts</tool>
<args>{}</args>
</mcp-tool-call>

This returns all prompts available for use. You can also filter by category:

<mcp-tool-call>
<tool>list_prompts</tool>
<args>{"category": "cognitive"}</args>
</mcp-tool-call>

Or by tags:

<mcp-tool-call>
<tool>list_prompts</tool>
<args>{"tags": ["embedded", "debugging"]}</args>
</mcp-tool-call>

The response includes prompt metadata like name, description, tags, and whether it's a template requiring variables.`,
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['mcp-usage', 'self-documenting', 'meta', 'tool-demonstration'],
    abstractionLevel: 6,
    isTemplate: true
  });

  writePrompt({
    name: 'use-static-analysis-mcp',
    description: 'Demonstrates using MCP tools for static analysis workflows',
    content: `# Static Analysis with MCP Tools

## Running C++ Static Analysis

First, check what static analysis tools are available:

<mcp-tool-call>
<tool>list_tools</tool>
<args>{}</args>
</mcp-tool-call>

If cppcheck is available, run it on your project:

<mcp-tool-call>
<tool>run_cppcheck</tool>
<args>{"project_path": "./src", "enable_checks": ["all"], "std": "c++17"}</args>
</mcp-tool-call>

For clang-tidy analysis:

<mcp-tool-call>
<tool>run_clang_tidy</tool>
<args>{"source_files": ["src/main.cpp", "src/utils.cpp"], "checks": "*"}</args>
</mcp-tool-call>

## Interpreting Results

After running analysis, apply the results interpretation prompt:

<mcp-tool-call>
<tool>get_prompt</tool>
<args>{"name": "interpret-static-analysis-results"}</args>
</mcp-tool-call>

Then apply it with the analysis results:

<mcp-tool-call>
<tool>apply_template</tool>
<args>{"prompt_name": "interpret-static-analysis-results", "variables": {"analysis_output": "[paste cppcheck/clang-tidy output here]"} }</args>
</mcp-tool-call>

## Workflow Integration

For a complete static analysis workflow:

<mcp-tool-call>
<tool>get_prompt</tool>
<args>{"name": "cpp-static-analysis-workflow"}</args>
</mcp-tool-call>`,
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['mcp-usage', 'static-analysis', 'cpp', 'workflow', 'tool-demonstration'],
    abstractionLevel: 3,
    isTemplate: true
  });

  writePrompt({
    name: 'use-git-integration-mcp',
    description: 'Demonstrates using MCP tools for git-based development workflows',
    content: `# Git Integration with MCP Tools

## Analyzing Code Changes

Check what git-related tools are available:

<mcp-tool-call>
<tool>list_tools</tool>
<args>{}</args>
</mcp-tool-call>

Analyze changes in the current branch:

<mcp-tool-call>
<tool>git_analyze_changes</tool>
<args>{"since_commit": "HEAD~5", "include_stats": true}</args>
</mcp-tool-call>

Get detailed diff analysis:

<mcp-tool-call>
<tool>git_get_diff</tool>
<args>{"commit_range": "HEAD~1", "include_context": 3}</args>
</mcp-tool-call>

## Blame Analysis for Debugging

Find who last modified problematic code:

<mcp-tool-call>
<tool>git_blame</tool>
<args>{"file": "src/buggy_function.cpp", "line_range": "100-120"}</args>
</mcp-tool-call>

## Commit Quality Analysis

Review recent commit quality:

<mcp-tool-call>
<tool>git_analyze_commits</tool>
<args>{"branch": "main", "since_days": 7, "include_metrics": true}</args>
</mcp-tool-call>

## Integration with Static Analysis

Combine git and static analysis:

<mcp-tool-call>
<tool>analyze_changed_code</tool>
<args>{"since_commit": "origin/main", "tools": ["cppcheck", "clang-tidy"]}</args>
</mcp-tool-call>`,
    layer: PromptLayer.Procedural,
    domain: Domain.SoftwareDevelopment,
    tags: ['mcp-usage', 'git', 'version-control', 'code-analysis', 'tool-demonstration'],
    abstractionLevel: 4,
    isTemplate: true
  });

  console.log('MCP tool usage prompts seeded successfully!');
}

// Main seeding function
async function seedCognitiveKnowledge() {
  try {
    console.log('Starting cognitive knowledge seeding...');

    // Seed development tooling knowledge
    seedDevelopmentToolingKnowledge();

    // Seed embedded systems knowledge
    seedEmbeddedSystemsPrompts();

    // Seed MCP tool usage demonstrations
    seedMCPToolUsagePrompts();

    console.log('All cognitive knowledge seeded successfully!');
    console.log('\nCreated prompts in:');
    console.log('- data/prompts/cognitive/perception/');
    console.log('- data/prompts/cognitive/episodic/');
    console.log('- data/prompts/cognitive/semantic/');
    console.log('- data/prompts/cognitive/procedures/');
    console.log('- data/prompts/cognitive/meta/');
    console.log('- data/prompts/cognitive/transfer/');
    console.log('- data/prompts/cognitive/evaluation/');
    console.log('- data/prompts/mcp-tools/');

  } catch (error) {
    console.error('Error seeding cognitive knowledge:', error);
    process.exit(1);
  }
}

// Run the seeding
seedCognitiveKnowledge();