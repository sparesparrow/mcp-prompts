/**
 * Docker Health Check Integration Test
 *
 * This test verifies that the health check endpoint is working correctly
 * when the MCP-Prompts server is running in a Docker container.
 *
 * To run only this test:
 * TEST_DOCKER_HEALTH=true npm test -- tests/integration/docker-health-check.test.ts
 */

import { jest } from '@jest/globals';

describe('Docker Health Check', () => {
  // Skip tests if not in Docker environment or explicitly enabled
  const runTests = process.env.TEST_DOCKER_HEALTH === 'true';

  // Set longer timeout for these tests
  jest.setTimeout(10000);

  const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3003/health';

  // Helper function to fetch health status with improved error handling
  /**
   *
   */
  async function fetchHealthStatus(): Promise<{ status: number; data: any }> {
    try {
      const response = await fetch(HEALTH_CHECK_URL, {
        headers: { Accept: 'application/json' },
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const data = await response.json();

      return {
        data,
        status: response.status,
      };
    } catch (error: any) {
      console.error(`Error fetching health status from ${HEALTH_CHECK_URL}:`, error.message);
      return {
        data: { error: error.message || 'Unknown error', success: false },
        status: 500,
      };
    }
  }

  it('health check endpoint should return 200 status', async () => {
    if (!runTests) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });

  it('health check endpoint should include storage status', async () => {
    if (!runTests) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('storage');
    expect(data.storage).toHaveProperty('connected');
    expect(data.storage.connected).toBe(true);
  });

  it('health check endpoint should include version information', async () => {
    if (!runTests) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('version');
    expect(data.version).toBeTruthy();
  });

  it('health check should report server uptime', async () => {
    if (!runTests) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('uptime');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThan(0);
  });
});
