# Migration Guide: Orchestrator V3 → V4

**Date**: 2026-01-10
**Version**: 1.0
**Status**: Complete

---

## Overview

The Orchestrator V4 represents a significant architectural evolution from V3:

- **V3**: File-based configuration with hardcoded agent definitions
- **V4**: API-first architecture with dynamic configuration and real-time monitoring

This guide helps you migrate from V3 to V4 smoothly.

---

## Key Changes

### Architecture

| Aspect | V3 | V4 | Impact |
|--------|----|----|--------|
| **Configuration** | JSON files in project | REST API endpoints | More flexible, centralized |
| **Execution** | Direct Claude CLI | HTTP API calls | Better monitoring & control |
| **Status Tracking** | None | Real-time polling | See progress as it happens |
| **Reports** | Single format | Multiple formats | Choose best format for use case |
| **Error Handling** | Basic | Comprehensive | Better diagnostics |

### Behavioral Changes

#### 1. Configuration Loading

**V3**: Configuration loaded from local JSON files
```bash
IMPROVED_AGENTS="${IMPROVED_AGENTS:-${SCRIPT_DIR}/improved-agents.json}"
PROJECT_AGENTS="${PROJECT_AGENTS:-${SCRIPT_DIR}/PROJECT-agents-v3.json}"

# Manual file path management
```

**V4**: Configuration retrieved from API
```bash
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# Configuration profiles override defaults
load_profile "$PROFILE"  # Loads environment-specific config
```

**Migration Impact**:
- ✅ No need to maintain local JSON files
- ✅ Centralized configuration management
- ⚠️ Requires API server to be running

---

#### 2. Project Type Detection

**V3**: Hardcoded detection logic
```bash
detect_project_type() {
    if [[ -f "$path/CMakeLists.txt" ]]; then echo "cpp"
    elif [[ -f "$path/platformio.ini" ]]; then echo "embedded"
    # ... more hardcoded checks
}
```

**V4**: Dynamic API-based detection
```bash
detect_project_type() {
    local payload=$(jq -n --arg projectPath "$projectPath" '{projectPath: $projectPath}')
    curl -s -X POST "$API_BASE_URL/v1/orchestrate/detect-project-type" \
        -H "Content-Type: application/json" -d "$payload"
}
```

**Migration Impact**:
- ✅ Detection logic can be updated server-side without script changes
- ✅ More sophisticated detection algorithms supported
- ✅ Confidence scoring included
- ⚠️ Detection results format changed (now includes confidence, evidence, languages, frameworks)

---

#### 3. Execution Model

**V3**: Fire-and-forget with Claude CLI
```bash
echo "$COMPLETE_PROMPT" | claude \
    --model "$MAIN_MODEL" \
    --agents "$SUBAGENT_DEFS" \
    --append-system-prompt "$MAIN_SYSTEM_PROMPT" \
    --print \
    --output-format json
```

**V4**: Async with polling
```bash
# Start execution
orchestration=$(start_orchestration "$PROJECT_PATH" "$MODE")
execution_id=$(echo "$orchestration" | jq -r '.executionId')

# Poll for completion
wait_for_completion "$execution_id" "$MAX_WAIT_TIME"

# Get report
get_report "$execution_id" "$REPORT_FORMAT"
```

**Migration Impact**:
- ✅ Real-time visibility into execution progress
- ✅ Can abort if needed (by not waiting)
- ✅ Better timeout control
- ⚠️ Execution is no longer synchronous

---

#### 4. Report Handling

**V3**: Output sent directly to stdout
```bash
echo "$COMPLETE_PROMPT" | claude ... --print
# Output goes to terminal, possibly piped to file
```

**V4**: Explicit format selection and file management
```bash
# Get report in desired format
get_report "$execution_id" "$REPORT_FORMAT"

# Automatically saved to output directory
save_report "$execution_id" "$REPORT_FORMAT" "$OUTPUT_DIR"
```

**Migration Impact**:
- ✅ Multiple format support (JSON, Markdown, HTML)
- ✅ Automatic file organization
- ✅ Better integration with downstream tools
- ⚠️ Report retrieval is separate from execution

---

## Migration Steps

### Step 1: Verify API Server is Running

V4 requires the mcp-prompts API server to be running.

```bash
# Start the API server
cd /path/to/mcp-prompts
PROMPTS_DIR=./data/prompts npx tsx src/http/server-with-agents.ts

# Verify it's running
curl http://localhost:3000/health
# Should return: {"status":"healthy",...}
```

**Troubleshooting**:
- If server won't start, check Node.js version (requires 18+)
- If port 3000 is in use, set `API_BASE_URL=http://localhost:3001`
- Check logs in console for startup errors

---

### Step 2: Update Script References

Replace references to `claude-orchestrate-v3.sh` with `claude-orchestrate-v4.sh`:

```bash
# V3
./AGENTS/claude-orchestrate-v3.sh /path/to/project analyze

# V4
./scripts/claude-orchestrate-v4.sh /path/to/project analyze
```

---

### Step 3: Adjust Command-Line Arguments

Some arguments have changed:

**Arguments that work the same**:
- `PROJECT_PATH` (first positional argument) ✅
- `MODE` (second positional argument) ✅

**New optional arguments**:
```bash
--api-url URL              # Custom API URL (default: http://localhost:3000)
--format FORMAT            # Report format: json|markdown|html
--output-dir DIR           # Where to save reports
--profile PROFILE          # Configuration profile
--dry-run                  # Preview without execution
--no-wait                  # Start but don't wait for completion
--poll-interval SECS       # How often to check status
--max-wait SECS            # Maximum time to wait
--verbose                  # Debug output
```

**Removed arguments**:
- Direct file path arguments for config files (now API-based)
- Custom agent definitions (now in API)
- Output format flags (now simplified to `--format`)

---

### Step 4: Update Environment Variables

V4 uses different environment variables:

**New Environment Variables**:
```bash
API_BASE_URL              # API server URL (default: http://localhost:3000)
POLL_INTERVAL             # Polling interval in seconds (default: 2)
MAX_WAIT_TIME             # Maximum wait time (default: 300)
REPORT_FORMAT             # Default report format (default: markdown)
OUTPUT_DIR                # Default output directory
WAIT_FOR_COMPLETION       # Wait for completion flag (default: true)
```

**Removed Environment Variables**:
```bash
IMPROVED_AGENTS           # No longer needed
PROJECT_AGENTS            # No longer needed
```

**Update Example**:
```bash
# V3
export IMPROVED_AGENTS="./agents.json"
export PROJECT_AGENTS="./project-agents.json"
./AGENTS/claude-orchestrate-v3.sh /path/to/project

# V4
export API_BASE_URL="http://localhost:3000"
export REPORT_FORMAT="markdown"
./scripts/claude-orchestrate-v4.sh /path/to/project
```

---

### Step 5: Update CI/CD Pipelines

If you use the orchestrator in CI/CD, update your pipeline:

**V3 Pipeline**:
```yaml
- name: Analyze with Orchestrator V3
  run: |
    ./AGENTS/claude-orchestrate-v3.sh $PROJECT_PATH analyze > analysis.txt
    # Analysis happens synchronously
```

**V4 Pipeline**:
```yaml
- name: Start orchestration
  run: |
    EXEC_ID=$(./scripts/claude-orchestrate-v4.sh $PROJECT_PATH analyze --no-wait)
    echo "EXEC_ID=$EXEC_ID" >> $GITHUB_ENV

- name: Wait for completion
  run: |
    # Or use existing workflow job dependencies
    ./scripts/claude-orchestrate-v4.sh $PROJECT_PATH analyze --api-url $API_URL

- name: Retrieve report
  run: |
    curl http://localhost:3000/v1/orchestrate/$EXEC_ID/report?format=json > analysis.json
```

---

### Step 6: Handle Output Format Changes

**V3 Output**:
```json
{
  "subagent_results": [...],
  "analysis": {...},
  "recommendations": [...]
}
```

**V4 Output** (structured):
```json
{
  "executionId": "exec_...",
  "projectType": "cpp_backend",
  "mode": "analyze",
  "status": "completed",
  "phaseResults": [...],
  "synthesis": {
    "summary": "...",
    "recommendations": [...],
    "metrics": {...}
  }
}
```

**Update downstream processing**:
- Adjust JSON parsers to expect new structure
- Use `synthesis.recommendations` instead of top-level `recommendations`
- Include `executionId` in logs for tracking

---

## Configuration Profile Migration

V4 introduces configuration profiles. Migrate your settings:

### Default Profile (`default.env`)

Use this for most projects:
```bash
API_BASE_URL="http://localhost:3000"
POLL_INTERVAL=2
MAX_WAIT_TIME=300
REPORT_FORMAT="markdown"
```

### Embedded Systems Profile (`embedded.env`)

For ESP32/Arduino projects:
```bash
API_BASE_URL="http://localhost:3000"
POLL_INTERVAL=3
MAX_WAIT_TIME=600        # 10 minutes for complex analysis
REPORT_FORMAT="json"
```

### CI/CD Profile (`ci.env`)

For pipeline integration:
```bash
API_BASE_URL="http://localhost:3000"
POLL_INTERVAL=5
MAX_WAIT_TIME=1200       # 20 minutes for CI
REPORT_FORMAT="json"
```

### Create Custom Profile

To create a custom profile matching your V3 setup:

1. Create `scripts/profiles/custom.env`
2. Set your environment variables
3. Use it: `./scripts/claude-orchestrate-v4.sh . --profile custom`

```bash
# Example: scripts/profiles/custom.env
API_BASE_URL="http://api.example.com:3000"
POLL_INTERVAL=5
MAX_WAIT_TIME=600
REPORT_FORMAT="html"
OUTPUT_DIR="./reports"
VERBOSE="true"
```

---

## Common Migration Scenarios

### Scenario 1: Local Development

**V3**:
```bash
./AGENTS/claude-orchestrate-v3.sh /path/to/project analyze
```

**V4**:
```bash
# Terminal 1: Start API server
cd packages/mcp-prompts
PROMPTS_DIR=./data/prompts npx tsx src/http/server-with-agents.ts

# Terminal 2: Run orchestrator
./scripts/claude-orchestrate-v4.sh /path/to/project analyze

# Or use dev profile with verbose output
./scripts/claude-orchestrate-v4.sh /path/to/project analyze --profile dev
```

---

### Scenario 2: GitHub Actions CI

**V3**:
```yaml
- name: Analyze project
  run: ./AGENTS/claude-orchestrate-v3.sh . analyze > report.txt
```

**V4**:
```yaml
- name: Start API server
  run: |
    cd packages/mcp-prompts
    npx tsx src/http/server-with-agents.ts &
    sleep 5

- name: Analyze with V4
  run: |
    ./scripts/claude-orchestrate-v4.sh . analyze \
      --profile ci \
      --format json \
      --output-dir ./reports

- name: Upload reports
  uses: actions/upload-artifact@v3
  with:
    name: analysis-reports
    path: reports/
```

---

### Scenario 3: Automated Cron Job

**V3**:
```bash
# Crontab
0 2 * * * cd /path/to/project && /path/to/orchestrate-v3.sh . analyze > /tmp/analysis.txt 2>&1
```

**V4**:
```bash
# Crontab - start async and check later
0 2 * * * cd /path/to/project && /path/to/orchestrate-v4.sh . analyze --no-wait --profile ci > /tmp/exec-id.txt

# Separate job to retrieve results
30 2 * * * curl http://localhost:3000/v1/orchestrate/$(cat /tmp/exec-id.txt)/report?format=markdown > /tmp/analysis.md
```

---

### Scenario 4: Multiple Project Analysis

**V3**:
```bash
for project in /path/to/projects/*; do
    ./AGENTS/claude-orchestrate-v3.sh "$project" analyze
done
```

**V4**:
```bash
# Start all analyses without waiting
for project in /path/to/projects/*; do
    ./scripts/claude-orchestrate-v4.sh "$project" analyze --no-wait
done

# Or use script loops with custom handling
for project in /path/to/projects/*; do
    ./scripts/claude-orchestrate-v4.sh "$project" analyze \
        --format json \
        --output-dir "./reports/$(basename $project)"
done
```

---

## Troubleshooting Migration Issues

### Issue 1: "API server not reachable"

**Cause**: API server not running or wrong URL

**Solution**:
```bash
# Start API server
cd packages/mcp-prompts
PROMPTS_DIR=./data/prompts npx tsx src/http/server-with-agents.ts

# Verify it's running
curl http://localhost:3000/health
```

---

### Issue 2: "Unknown mode" error

**Cause**: Invalid orchestration mode

**Solution**: V4 supports the same 5 modes as V3
```bash
# Valid modes (same as V3)
./scripts/claude-orchestrate-v4.sh . analyze     # ✅
./scripts/claude-orchestrate-v4.sh . review      # ✅
./scripts/claude-orchestrate-v4.sh . refactor    # ✅
./scripts/claude-orchestrate-v4.sh . test        # ✅
./scripts/claude-orchestrate-v4.sh . document    # ✅
```

---

### Issue 3: Report format not found

**Cause**: Output directory doesn't exist or report not available yet

**Solution**:
```bash
# Create output directory
mkdir -p ./orchestration-reports

# Specify custom output directory
./scripts/claude-orchestrate-v4.sh . analyze --output-dir ./my-reports

# Verify execution completed
curl http://localhost:3000/v1/orchestrate/exec_id_here
```

---

### Issue 4: Timeout during execution

**Cause**: Analysis taking longer than expected

**Solution**:
```bash
# Increase wait time
./scripts/claude-orchestrate-v4.sh . analyze --max-wait 600

# Or use embedded profile (10 min timeout)
./scripts/claude-orchestrate-v4.sh . analyze --profile embedded

# Or start without waiting
./scripts/claude-orchestrate-v4.sh . analyze --no-wait
```

---

## Rollback Plan

If you need to revert to V3:

1. **V3 script is still available**:
   ```bash
   ./AGENTS/claude-orchestrate-v3.sh /path/to/project analyze
   ```

2. **Both can coexist**: You can use both V3 and V4 during transition

3. **Migration is non-destructive**: V3 files unchanged, V4 is separate

---

## Performance Comparison

### V3 Characteristics
- Direct execution
- No polling overhead
- Synchronous operation
- Hardcoded configuration

### V4 Characteristics
- API-based execution
- Configurable polling (default 2s intervals)
- Asynchronous with status tracking
- Dynamic configuration
- **Advantage**: Better visibility, flexibility, and error handling
- **Trade-off**: Slightly higher latency due to API overhead

**Benchmark**:
- V3: Direct execution, no overhead
- V4: Typical overhead <100ms per API call, 2-10 status polls

---

## Checklist for Successful Migration

- [ ] API server can be started and verified
- [ ] V4 script is executable: `chmod +x scripts/claude-orchestrate-v4.sh`
- [ ] Test with dry-run: `DRY_RUN=true ./scripts/claude-orchestrate-v4.sh .`
- [ ] Test project type detection: `./scripts/claude-orchestrate-v4.sh . --dry-run`
- [ ] Create custom profile if needed
- [ ] Update CI/CD pipelines if applicable
- [ ] Test with real project: `./scripts/claude-orchestrate-v4.sh /path/to/project analyze`
- [ ] Verify report format and location
- [ ] Update downstream processing for new output format
- [ ] Document changes for team

---

## Support & Questions

For issues during migration:

1. Check this guide's troubleshooting section
2. Run with `--verbose` for debug output
3. Check API server logs
4. Review [PHASE-5-COMPLETION.md](./PHASE-5-COMPLETION.md) for feature details
5. Check [OVERALL-PROGRESS.md](./OVERALL-PROGRESS.md) for system overview

---

**Migration Guide Complete**

Ready to move fully to V4? Follow the steps above and test thoroughly before deploying to production.
