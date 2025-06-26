/**
 * Docker Health Check Integration Test
 *
 * This test verifies that the health check endpoint is working correctly
 * when the MCP-Prompts server is running in a Docker container.
 *
 * Note: This test requires the Docker container to be running at localhost:3003.
 * If you're running this test outside of Docker, make sure the server is started
 * with HTTP_SERVER=true and PORT=3003.
 */

describe('Docker Health Check Integration', () => {
  const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL || 'http://localhost:3003/health';

  // Skip the test if we're not in the right environment
  const runTest = process.env.TEST_DOCKER_HEALTH === 'true';

  // Helper function to fetch health status
  /**
   *
   */
  async function fetchHealthStatus() {
    try {
      const response = await fetch(HEALTH_CHECK_URL);
      return {
        data: await response.json(),
        status: response.status,
      };
    } catch (error: any) {
      console.error('Error fetching health status:', error);
      return {
        data: { error: error.message || 'Unknown error' },
        status: 500,
      };
    }
  }

  it('health check endpoint should return 200 status', async () => {
    if (!runTest) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });

  it('health check endpoint should include storage status', async () => {
    if (!runTest) {
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
    if (!runTest) {
      console.log('Skipping Docker health check test. Set TEST_DOCKER_HEALTH=true to run it.');
      return;
    }

    const { status, data } = await fetchHealthStatus();

    expect(status).toBe(200);
    expect(data).toHaveProperty('version');
    expect(data.version).toBeTruthy();
  });
});
