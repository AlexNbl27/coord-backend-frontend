import http from 'node:http';

const PORT = Number(process.env.PORT || 8090);
const DELAY_MS = Number(process.env.SMS_DELAY_MS || 1100);

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/sms') {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sent: true, delayMs: DELAY_MS }));
    }, DELAY_MS);
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK' }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[sms-gateway] Listening on :${PORT} (simulated delay ${DELAY_MS}ms)`);
});
