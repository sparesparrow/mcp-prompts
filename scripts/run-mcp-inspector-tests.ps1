# MCP Inspector Integration Test Runner (PowerShell)
# 
# This script runs the MCP Inspector integration tests for the MCP-Prompts server.
# It sets up the necessary environment variables and runs the tests.

param(
    [switch]$Verbose,
    [string]$TestPattern = "mcp-inspector.integration.test"
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "This script must be run from the project root directory"
    exit 1
}

Write-Status "Starting MCP Inspector integration tests..."

# Set environment variables for testing
$env:TEST_MCP_INSPECTOR = "true"
$env:NODE_ENV = "test"

# Check if npx is available
try {
    $null = Get-Command npx -ErrorAction Stop
} catch {
    Write-Error "npx is not installed or not in PATH"
    exit 1
}

# Check if @modelcontextprotocol/inspector is available
try {
    $null = npx @modelcontextprotocol/inspector --help 2>$null
} catch {
    Write-Warning "@modelcontextprotocol/inspector not found, installing..."
    npm install -g @modelcontextprotocol/inspector
}

# Run the tests
Write-Status "Running MCP Inspector integration tests..."

$testArgs = @(
    "test",
    "--",
    "--testPathPattern=$TestPattern"
)

if ($Verbose) {
    $testArgs += "--verbose"
}

try {
    npm @testArgs
    if ($LASTEXITCODE -eq 0) {
        Write-Success "MCP Inspector integration tests passed!"
    } else {
        Write-Error "MCP Inspector integration tests failed!"
        exit 1
    }
} catch {
    Write-Error "Failed to run tests: $_"
    exit 1
}

Write-Status "MCP Inspector integration tests completed successfully!" 