import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, collectSource, calendar } from './lib/firms.js';
import { dashboard } from './lib/dashboard.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
await mkdir(dataDir, { recursive: true });
const stateFile = path.join(dataDir, 'firms.json');
async function load(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw new Error('No se pudo leer el almacenamiento; restaurar respaldo antes de continuar.'); }
}
let state = await load(stateFile, { schema: 1, products: {} });
if (state.schema !== 1 || !state.products) throw new Error('Formato de almacenamiento no compatible');
const history = await load(path.join(root, 'cuyo-history.json'), null);
let running = false;
async function refresh() {
  if (running) return;
  running = true;
  try {
    for (const source of SOURCES) {
      const product = await collectSource(state.products[source], source, process.env.FIRMS_MAP_KEY);
      const next = { ...state, products: { ...state.products, [source]: product } };
      await writeFile(stateFile + '.tmp', JSON.stringify(next));
      await rename(stateFile + '.tmp', stateFile);
      state = next;
      console.log(`${source}: ${product.error ? 'sin actualización' : 'actualizado'} (${product.records.length} registros conservados)`);
    }
  } catch { console.error('No se pudo persistir la actualización; se conserva el último estado guardado.'); }
  finally { running = false; }
}
if (process.argv.includes('--collect')) {
  await refresh();
  if (SOURCES.some(s => !state.products[s]?.lastSuccess || state.products[s]?.error)) process.exitCode = 1;
} else {
  const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/script.js': ['script.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/datos_cuyo_resumen.json': ['datos_cuyo_resumen.json', 'application/json'] };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/dashboard') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(dashboard(state, history)));
      }
      if (url.pathname === '/api/calendar') {
        const year = Number(url.searchParams.get('year')), month = Number(url.searchParams.get('month'));
        const source = url.searchParams.get('source') || 'MODIS_NRT';
        if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12 || !SOURCES.includes(source)) {
          res.writeHead(400); return res.end('Parámetros inválidos');
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify(calendar(state, history, source, year, month)));
      }
      if (url.pathname === '/healthz') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, collecting: running })); }
      const asset = assets[url.pathname];
      if (!asset) { res.writeHead(404); return res.end('No encontrado'); }
      res.setHeader('Content-Type', asset[1] + '; charset=utf-8');
      res.end(await readFile(path.join(root, asset[0])));
    } catch { res.writeHead(500); res.end('Error interno'); }
  });
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log(`Sitio local: http://localhost:${process.env.PORT || 3000}`));
  void refresh();
  const timer = setInterval(refresh, 3600000);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close(); });
}
