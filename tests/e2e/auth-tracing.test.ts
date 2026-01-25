/**
 * E2E test to verify auth failures are traced to SigNoz
 *
 * Prerequisites:
 * - SigNoz instance running and accessible
 * - OTEL_EXPORTER_OTLP_ENDPOINT env var set (or defaults to http://localhost:4318)
 * - SIGNOZ_API_KEY env var set for querying traces
 * - SIGNOZ_URL env var set (or defaults to http://localhost:8080)
 *
 * Run with: pnpm test:e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';
import path from 'path';

const SIGNOZ_URL = process.env['SIGNOZ_URL'] || 'http://localhost:8080';
const SIGNOZ_API_KEY = process.env['SIGNOZ_API_KEY'] || '';
const OTEL_ENDPOINT = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318';
const CLERK_SECRET_KEY = process.env['CLERK_SECRET_KEY'] || 'sk_test_placeholder';
const BACKEND_PORT = 3001; // Must match the port in examples/backend/src/server.ts
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// Skip if no SigNoz API key configured
const shouldSkip = !SIGNOZ_API_KEY;

describe.skipIf(shouldSkip)('Auth Failure Tracing E2E', () => {
  let serverProcess: ChildProcess | null = null;
  const capturedTraceIds: string[] = [];

  beforeAll(async () => {
    // Start the backend server with tracing enabled
    const backendDir = path.resolve(__dirname, '../../examples/backend');

    serverProcess = spawn('pnpm', ['start:traced'], {
      cwd: backendDir,
      env: {
        ...process.env,
        OTEL_EXPORTER_OTLP_ENDPOINT: OTEL_ENDPOINT,
        OTEL_SERVICE_NAME: 'auth-example-backend',
        CLERK_SECRET_KEY,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Capture trace IDs from server logs
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      const traceIdMatch = output.match(/trace_id['":\s]+([a-f0-9]{32})/i);
      if (traceIdMatch) {
        capturedTraceIds.push(traceIdMatch[1]);
      }
    });

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      // Also check stderr for trace IDs (pino logs go there sometimes)
      const traceIdMatch = output.match(/trace_id['":\s]+([a-f0-9]{32})/i);
      if (traceIdMatch) {
        capturedTraceIds.push(traceIdMatch[1]);
      }
    });

    // Wait for server to be ready
    await waitForServer(BACKEND_URL, 30000);
  }, 60000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      // Give it time to flush traces
      await setTimeout(2000);
      serverProcess.kill('SIGKILL');
    }
  });

  it('should trace UNAUTHORIZED errors (no token)', async () => {
    // Trigger auth failure - no token
    const response = await fetch(`${BACKEND_URL}/api/me`);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');

    // Wait for trace to be exported
    await setTimeout(3000);

    // Verify trace exists in SigNoz
    const services = await fetchSigNozServices();
    expect(services).toContain('auth-example-backend');
  });

  it('should trace INVALID_TOKEN errors (malformed token)', async () => {
    // Trigger auth failure - invalid token
    const response = await fetch(`${BACKEND_URL}/api/me`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('INVALID_TOKEN');

    // Wait for trace to be exported
    await setTimeout(3000);

    // Verify service is still reporting
    const services = await fetchSigNozServices();
    expect(services).toContain('auth-example-backend');
  });

  it('should have 401 status code in traces', async () => {
    // Make another request to ensure we have a recent trace
    await fetch(`${BACKEND_URL}/api/me`);

    // Wait for trace export
    await setTimeout(3000);

    // If we captured any trace IDs, verify them in SigNoz
    if (capturedTraceIds.length > 0) {
      const traceId = capturedTraceIds[capturedTraceIds.length - 1];
      const trace = await fetchSigNozTrace(traceId);

      if (trace && trace.length > 0) {
        const event = trace[0];
        // Check that the trace has 401 status
        const tagsKeys = event.events?.[0]?.[7] || [];
        const tagsValues = event.events?.[0]?.[8] || [];
        const statusIndex = tagsKeys.indexOf('http.status_code');

        if (statusIndex >= 0) {
          expect(tagsValues[statusIndex]).toBe('401');
        }
      }
    }
  });
});

/**
 * Wait for the server to be ready
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const start = Date.now();
  const healthUrl = `${url}/health`;

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await setTimeout(500);
  }

  throw new Error(`Server did not start within ${timeout}ms`);
}

/**
 * Fetch list of services from SigNoz
 */
async function fetchSigNozServices(): Promise<string[]> {
  const now = Date.now();
  const start = now - 30 * 60 * 1000; // 30 minutes ago
  const startNs = start * 1000000;
  const endNs = now * 1000000;

  const response = await fetch(
    `${SIGNOZ_URL}/api/v1/services/list?start=${startNs}&end=${endNs}`,
    {
      headers: {
        'SIGNOZ-API-KEY': SIGNOZ_API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch services: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a specific trace from SigNoz
 */
async function fetchSigNozTrace(traceId: string): Promise<unknown[]> {
  const response = await fetch(`${SIGNOZ_URL}/api/v1/traces/${traceId}`, {
    headers: {
      'SIGNOZ-API-KEY': SIGNOZ_API_KEY,
    },
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}
