import http from 'node:http';

const checks = [
  ['valhalla', 'http://valhalla:8002/status'],
  ['vroom', 'http://vroom:3000/health'],
];

const server = http.createServer(async (_req, res) => {
  const failed = [];
  for (const [name, url] of checks) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (!response.ok) failed.push(name);
    } catch {
      failed.push(name);
    }
  }
  const ok = failed.length === 0;
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok, failed }));
});

server.listen(8080);
