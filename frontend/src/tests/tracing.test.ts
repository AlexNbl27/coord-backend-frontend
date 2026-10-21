import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace';

const received: Array<{ url: string; headers: Headers }> = [];
const exporter = new InMemorySpanExporter();

vi.stubGlobal(
  'fetch',
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    const headers =
      input instanceof Request ? new Headers(input.headers) : new Headers(init?.headers);
    received.push({ url, headers });
    const res = new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    Object.defineProperty(res, 'url', { value: url.startsWith('http') ? url : `http://localhost:3000${url}` });
    return res;
  })
);

const { startTracing } = await import('../tracing');
startTracing({
  processor: new SimpleSpanProcessor({ exporter }),
});

describe('OpenTelemetry Frontend (CinéSlot)', () => {
  beforeEach(() => {
    received.length = 0;
    exporter.reset();
  });

  it('injects a sampled W3C traceparent header', async () => {
    const res = await fetch('/api/movies');
    await res.json();
    expect(received.length).toBe(1);
    const traceparent = received[0].headers.get('traceparent');
    expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    await vi.waitFor(() => {
      expect(exporter.getFinishedSpans().length).toBeGreaterThanOrEqual(1);
    });
  });

  it('records a client span matching the traceparent traceId', async () => {
    const res = await fetch('/api/slots');
    await res.json();
    const traceparent = received[0].headers.get('traceparent')!;
    const [, expectedTraceId] = traceparent.split('-');

    await vi.waitFor(() => {
      expect(
        exporter.getFinishedSpans().some((s) => s.spanContext().traceId === expectedTraceId)
      ).toBe(true);
    });
  });

  it('strips query string (?q=...) from url.full for GDPR compliance', async () => {
    const res = await fetch('/api/movies?q=sensitive-user-input');
    await res.json();
    await vi.waitFor(() => {
      expect(exporter.getFinishedSpans().length).toBeGreaterThanOrEqual(1);
    });
    const spans = exporter.getFinishedSpans();

    const urlFull = String(spans[0].attributes['url.full'] || '');
    expect(urlFull).not.toContain('sensitive-user-input');
    expect(urlFull).not.toContain('?');
  });
});
