import { register } from 'node:module';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Register ESM loader hook for OpenTelemetry auto-instrumentation
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);

const otlpBaseUrl = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318').replace(/\/$/, '');

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'cineslot-api',
  traceExporter: new OTLPTraceExporter({
    url: `${otlpBaseUrl}/v1/traces`,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': { redactedQueryParamsServer: ['lat', 'lon'] },
    }),
  ],
});

sdk.start();
console.log(`[OpenTelemetry] Node SDK initialized (${process.env.OTEL_SERVICE_NAME || 'cineslot-api'} -> ${otlpBaseUrl}/v1/traces)`);

const shutdown = () => {
  sdk.shutdown().finally(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
