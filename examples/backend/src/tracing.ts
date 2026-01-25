/**
 * OpenTelemetry tracing setup for auth-example backend
 * This file must be loaded BEFORE the application starts
 *
 * Usage: node --import ./dist/tracing.js ./dist/server.js
 * Or with tsx: tsx --import ./src/tracing.ts ./src/server.ts
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] || 'auth-example-backend',
  [ATTR_SERVICE_VERSION]: '0.0.1',
  'deployment.environment': process.env['NODE_ENV'] || 'development',
});

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),
  logRecordProcessor: new SimpleLogRecordProcessor(
    new OTLPLogExporter({
      url: `${otlpEndpoint}/v1/logs`,
    })
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable fs instrumentation to reduce noise
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Enable pino instrumentation for log correlation
      '@opentelemetry/instrumentation-pino': { enabled: true },
    }),
  ],
});

sdk.start();

console.log(`[tracing] OpenTelemetry initialized, exporting to ${otlpEndpoint}`);

// Graceful shutdown
const shutdown = () => {
  sdk.shutdown()
    .then(() => console.log('[tracing] OpenTelemetry shut down'))
    .catch((error) => console.error('[tracing] Error shutting down', error))
    .finally(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
