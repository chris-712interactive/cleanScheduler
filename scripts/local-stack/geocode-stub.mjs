/**
 * Loopback stand-in for the US Census geocoder.
 * "outage" in the address returns 503. "nomatch" returns an empty match list.
 * Anything else returns one fixed point. Geocodio is not implemented.
 */
import http from 'node:http';

const port = Number(process.env.GEOCODE_STUB_PORT ?? 5499);
const host = '127.0.0.1';

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);
  const address = (url.searchParams.get('address') ?? '').toLowerCase();
  if (address.includes('outage')) {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'stub outage' }));
    return;
  }
  if (address.includes('nomatch')) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ result: { addressMatches: [] } }));
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(
    JSON.stringify({
      result: {
        addressMatches: [
          {
            coordinates: { x: -82.55, y: 35.6 },
            tigerLine: { side: 'L' },
            addressComponents: { fromAddress: '100', toAddress: '100' },
          },
        ],
      },
    }),
  );
});

server.listen(port, host, () => {
  console.log(`geocode stub listening on http://${host}:${port}`);
});
