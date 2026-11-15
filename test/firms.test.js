import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { collectSource, calendar, detections, merge } from '../lib/firms.js';
const header = 'latitude,longitude,acq_date,acq_time,satellite,instrument,version\n';
const row = '-33,-68,2026-11-15,416,Terra,MODIS,6.1NRT\n';
const now = new Date('2026-11-15T12:00:00Z');
test('reconsulta cinco días, normaliza hora y actualiza duplicados sin unir satélites', async () => {
  let url;
  const fetcher = async u => { url = u; return new Response(header + row + row); };
  const first = await collectSource(null, 'MODIS_NRT', 'test-secret', fetcher, now);
  const second = await collectSource(first, 'MODIS_NRT', 'test-secret', fetcher, now);
  assert.match(url, /\/5\/2026-11-11$/);
  assert.equal(second.records.length, 1);
  assert.equal(second.records[0].acq_time, '0416');
  assert.equal(Object.keys(second.queries).length, 5);
  const aqua = detections(header + row.replace('Terra', 'Aqua'), 'MODIS_NRT');
  assert.equal(merge(second.records, aqua).length, 2);
});
test('fallos HTTP, CSV malformado y falta de clave preservan últimos datos sin filtrar secretos', async () => {
  const old = await collectSource(null, 'MODIS_NRT', 'secret', async () => new Response(header + row), now);
  for (const fetcher of [async () => new Response('bad', { status: 503 }), async () => new Response('Invalid MAP_KEY secret'), async () => { throw Error('https://secret'); }]) {
    const next = await collectSource(old, 'MODIS_NRT', 'secret', fetcher, now);
    assert.deepEqual(next.records, old.records);
    assert.equal(next.lastSuccess, old.lastSuccess);
    assert.ok(next.error); assert.ok(!JSON.stringify(next).includes('secret'));
  }
  assert.ok((await collectSource(old, 'MODIS_NRT', '', null, now)).error);
});
test('CSV vacío válido no inventa cero ni cobertura; bisiestos e históricos permanecen explícitos', async () => {
  const product = await collectSource(null, 'MODIS_NRT', 'key', async () => new Response(header), now);
  const result = calendar({ products: { MODIS_NRT: product } }, null, 'MODIS_NRT', 2026, 11, now);
  assert.equal(result.present[14].count, null);
  assert.equal(result.present[14].status, 'no-records-coverage-unknown');
  assert.equal(result.present[15].status, 'future');
  assert.ok(result.average.every(d => d.count === null));
  assert.equal(calendar({ products: {} }, null, 'MODIS_NRT', 2024, 2, now).present.length, 29);
  assert.equal(calendar({ products: {} }, null, 'MODIS_NRT', 2024, 2, now).past.length, 28);
});
test('el polígono excluye detecciones externas también al leer datos persistidos antiguos', () => {
  const inside = detections(header + row, 'MODIS_NRT')[0];
  const outside = { ...inside, latitude: -28.3, longitude: -64.6 };
  const state = { products: { MODIS_NRT: { records: [inside, outside] } } };
  const result = calendar(state, null, 'MODIS_NRT', 2026, 11, now);
  assert.equal(result.present[14].count, 1);
});
test('servidor HTTP recupera datos persistidos, no expone archivos privados y valida parámetros', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'firms-test-'));
  const saved = await collectSource(null, 'MODIS_NRT', 'key', async () => new Response(header + row), now);
  await writeFile(path.join(dir, 'firms.json'), JSON.stringify({ schema: 1, products: { MODIS_NRT: saved } }));
  const child = spawn(process.execPath, ['server.js'], { env: { ...process.env, FIRMS_MAP_KEY: '', DATA_DIR: dir, PORT: '31987', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Startup timeout')), 10000);
      child.stdout.on('data', chunk => { if (chunk.toString().includes('Sitio local')) { clearTimeout(timer); resolve(); } });
      child.once('error', reject);
    });
    for (const route of ['/', '/script.js', '/style.css', '/healthz', '/datos_cuyo_resumen.json']) assert.equal((await fetch('http://127.0.0.1:31987' + route)).status, 200);
    const originalSummary = await (await fetch('http://127.0.0.1:31987/datos_cuyo_resumen.json')).json();
    assert.ok(originalSummary.days && originalSummary.metadata);
    for (const route of ['/.env', '/.git/config', '/data/firms.json', '/server.js', '/%2e%2e/.env']) assert.equal((await fetch('http://127.0.0.1:31987' + route)).status, 404);
    assert.equal((await fetch('http://127.0.0.1:31987/api/calendar?year=bad')).status, 400);
    const data = await (await fetch('http://127.0.0.1:31987/api/calendar?year=2026&month=11')).json();
    assert.equal(data.present.length, 30);
    assert.equal(data.lastSuccess, now.toISOString());
    assert.equal(data.present[14].count, 1);
  } finally { const exited = once(child, 'exit'); child.kill(); await exited; await rm(dir, { recursive: true, force: true }); }
});
