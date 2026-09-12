import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { URL } from 'node:url';

/**
 * Author: Raushan Raj
 * Business Use: Serves the generated business dashboard over localhost HTTP so filters, downloads and browser actions execute in a normal web context.
 * How to use: `npm run report:serve`; set REPORT_PORT or NOTIFY_REPORT_DIR when needed.
 * Benefit: Avoids file/email preview security restrictions that can disable JavaScript and make interactive controls appear static.
 */
const root = path.resolve(process.env.NOTIFY_REPORT_DIR ?? ProjectPaths.latestBusinessReport());
const requestedPort = Number(process.env.REPORT_PORT ?? 4173);
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`Missing ${path.join(root, 'index.html')}. Run tests/report:dashboard first.`);

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.resolve(root, `.${requested}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { response.writeHead(404); response.end('Not found'); return; }
  response.setHeader('Content-Type', mime(filePath));
  response.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(response);
});

server.listen(requestedPort, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : requestedPort;
  console.log(`Interactive business dashboard: http://127.0.0.1:${port}`);
  console.log(`Serving: ${root}`);
  console.log('Press Ctrl+C to stop.');
});

function mime(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.csv':'text/csv; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.zip':'application/zip', '.txt':'text/plain; charset=utf-8' } as Record<string,string>)[ext] ?? 'application/octet-stream';
}
