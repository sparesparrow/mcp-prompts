/**
 * Release Script Test
 *
 * This test verifies that the release script is working correctly.
 * It uses child_process to execute the script with mock arguments
 * and validates the output.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Convert import.meta.url to a path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('Release Script', () => {
  const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/release.sh');
  // Skip the test if the file doesn't exist
  const runTest = fs.existsSync(SCRIPT_PATH);
  // Helper function to execute the script with arguments
  function executeScript(args) {
    try {
      return execSync(`${SCRIPT_PATH} ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, SKIP_GIT_CHECKS: 'true' },
      });
    } catch (error) {
      return error.stdout || error.message || String(error);
    }
  }
  it('should be executable', () => {
    if (!runTest) {
      console.log('Skipping release script test. Script not found at:', SCRIPT_PATH);
      return;
    }
    // Check if the script has execute permissions
    const stats = fs.statSync(SCRIPT_PATH);
    const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
    expect(isExecutable).toBe(true);
  });
  it('should display help message when run with --help', () => {
    if (!runTest) {
      console.log('Skipping release script test. Script not found at:', SCRIPT_PATH);
      return;
    }
    const output = executeScript('--help');
    expect(output).toContain('Usage: ./release.sh [OPTIONS]');
    expect(output).toContain('Release a new version of MCP-Prompts');
    expect(output).toContain('--version');
    expect(output).toContain('--publish');
    expect(output).toContain('--docker');
  });
  it('should validate version type', () => {
    if (!runTest) {
      console.log('Skipping release script test. Script not found at:', SCRIPT_PATH);
      return;
    }
    const output = executeScript('--version invalid');
    expect(output).toContain('Invalid version type: invalid');
    expect(output).toContain('Must be one of: patch, minor, major');
  });
  // Note: We can't effectively test the actual version bump and publish
  // functionality without mocking npm and git commands, which is beyond
  // the scope of this test. We're mainly testing the script's validation
  // and help functionality.
});
