import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csv, identity } from '../lib/firms.js';
import { insideCuyo } from '../lib/geography.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) throw new Error('Uso: npm run import:cuyo -- "ruta/detecciones_cuyo_todos_los_sensores.csv"');
const content = await readFile(file, 'utf8');
const { header, rows } = csv(content);
for (const field of ['latitude', 'longitude', 'acq_date', 'acq_time', 'satellite', 'instrument', 'source_file']) {
  if (!header.includes(field)) throw new Error(`Falta ${field}`);
}
const sources = {
  'fire_archive_M-C61_850921.csv': 'MODIS_SP',
  'fire_archive_SV-C2_850949.csv': 'VIIRS_SNPP_SP',
  'fire_archive_J2V-C2_850988.csv': 'VIIRS_NOAA21_SP',
  'fire_nrt_J2V-C2_850988.csv': 'VIIRS_NOAA21_NRT'
};
const result = { importedAt: new Date().toISOString(), inputSha256: createHash('sha256').update(content).digest('hex'), geography: 'Polígono suministrado por el equipo; último punto aislado excluido.', coverageVerified: false, products: {}, rows: rows.length, duplicateIdentities: 0 };
const seen = new Set();
for (const r of rows) {
  const source = sources[r.source_file];
  const latitude = Number(r.latitude), longitude = Number(r.longitude);
  const time = r.acq_time.padStart(4, '0');
  if (!source || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !insideCuyo(longitude, latitude) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(r.acq_date) || new Date(r.acq_date).toISOString().slice(0, 10) !== r.acq_date ||
      !/^\d{4}$/.test(time) || +time.slice(0, 2) > 23 || +time.slice(2) > 59 ||
      (source.startsWith('MODIS') ? r.instrument !== 'MODIS' : !['VIIRS', 'SNPP'].includes(r.instrument))) throw new Error('Fila inválida en CSV de Cuyo');
  const id = identity({ ...r, latitude, longitude, acq_time: time, source });
  if (seen.has(id)) { result.duplicateIdentities++; continue; }
  seen.add(id);
  const product = result.products[source] ||= { counts: {}, file: path.basename(file), coverageVerified: false };
  product.counts[r.acq_date] = (product.counts[r.acq_date] || 0) + 1;
}
await writeFile(path.join(root, 'cuyo-history.json'), JSON.stringify(result));
console.log(JSON.stringify({ rows: result.rows, unique: seen.size, duplicateIdentities: result.duplicateIdentities, products: Object.fromEntries(Object.entries(result.products).map(([k, v]) => [k, Object.values(v.counts).reduce((a, b) => a + b, 0)])) }, null, 2));
