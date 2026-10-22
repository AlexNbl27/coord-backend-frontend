import { context, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  StackContextManager,
  TraceIdRatioBasedSampler,
  TracerProvider,
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * Strips query parameters (?q=...) from `url.full` before spans leave the browser.
 */
class SanitizingSpanProcessor implements SpanProcessor {
  onStart(span: Span): void {
    const urlFull = span.attributes['url.full'];
    if (typeof urlFull === 'string' && urlFull.includes('?')) {
      span.setAttribute('url.full', urlFull.split('?')[0]);
    }
  }

  onEnd(_span: ReadableSpan): void {}

  async shutdown(): Promise<void> {}
  async forceFlush(): Promise<void> {}
}

let initialized = false;

export function startTracing(options?: { processor?: SpanProcessor }): void {
  if (initialized && !options?.processor) {
    return;
  }
  initialized = true;

  const exporter = new OTLPTraceExporter({
    url: `${globalThis.location?.origin || 'http://localhost:3001'}/otlp/v1/traces`,
  });

  const exportProcessor =
    options?.processor ?? new BatchSpanProcessor({ exporter });

  const provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'cineslot-web',
    }),
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(1),
    }),
    spanProcessors: [new SanitizingSpanProcessor(), exportProcessor],
  });

  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(new StackContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        ignoreUrls: [/\/otlp\//],
      }),
    ],
  });
}
