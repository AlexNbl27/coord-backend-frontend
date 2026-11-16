import { test, expect } from '@playwright/test';

const JAEGER_API = process.env.JAEGER_URL || 'http://127.0.0.1:16686';

test('une recherche produit une trace front puis back', async ({ page, request }) => {
  let capturedTraceId = '';

  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      const tp = req.headers()['traceparent'];
      if (tp) {
        const parts = tp.split('-');
        if (parts.length === 4) {
          capturedTraceId = parts[1];
        }
      }
    }
  });

  await page.goto('/movies');
  await page.waitForLoadState('networkidle');

  expect(capturedTraceId).toMatch(/^[0-9a-f]{32}$/);

  // Attendre l'export BatchSpanProcessor du navigateur (~5s) vers le collecteur puis Jaeger
  await expect
    .poll(
      async () => {
        const resp = await request.get(`${JAEGER_API}/api/traces/${capturedTraceId}`);
        if (!resp.ok()) return { hasWeb: false, hasApi: false, hasChild: false };
        const json = await resp.json();
        const trace = json.data?.[0];
        if (!trace) return { hasWeb: false, hasApi: false, hasChild: false };

        const processes = trace.processes || {};
        const spans = trace.spans || [];
        const webSpans = spans.filter(
          (s: any) => processes[s.processID]?.serviceName === 'cineslot-web'
        );
        const apiSpans = spans.filter(
          (s: any) => processes[s.processID]?.serviceName === 'cineslot-api'
        );

        const webSpanIds = new Set(webSpans.map((s: any) => s.spanID));
        const hasChild = apiSpans.some((s: any) =>
          (s.references || []).some(
            (ref: any) => ref.refType === 'CHILD_OF' && webSpanIds.has(ref.spanID)
          )
        );

        return {
          hasWeb: webSpans.length > 0,
          hasApi: apiSpans.length > 0,
          hasChild,
        };
      },
      { timeout: 15000, intervals: [1000] }
    )
    .toEqual({ hasWeb: true, hasApi: true, hasChild: true });
});
