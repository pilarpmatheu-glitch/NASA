import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { csv, detections, merge } from '../lib/firms.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.resolve(process.argv[2] || path.join(root, '..'));
const output = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
const files = [
  ['MODIS10AÑOS/fire_archive_M-C61_850921.csv', 'MODIS_SP'],
  ['SUOMI/fire_archive_SV-C2_850949.csv', 'VIIRS_SNPP_SP'],
  ['NOAA21/fire_archive_J2V-C2_850988.csv', 'VIIRS_NOAA21_SP'],
  ['NOAA21/fire_nrt_J2V-C2_850988.csv', 'VIIRS_NOAA21_NRT'],
  ['modis.csv', 'MODIS_NRT'], ['modis_cuyo.csv', 'MODIS_NRT'],
  ['modis_cuyo_sin_repetidos.csv', 'MODIS_NRT'],
  ['viirsnoaa21.csv', 'VIIRS_NOAA21_NRT'], ['viirsnoaa21_cuyo.csv', 'VIIRS_NOAA21_NRT'],
  ['viirsnoaa21_cuyo_sin_repetidos.csv', 'VIIRS_NOAA21_NRT']
];
const report = { importedAt: new Date().toISOString(), geography: 'Sin filtro nuevo; delimitación pendiente.', products: {}, files: [] };
for (const [file, source] of files) {
  let text;
  try { text = await readFile(path.join(input, file), 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') { report.files.push({ file, missing: true }); continue; } throw e; }
  let normalized = text;
  if (source === 'VIIRS_SNPP_SP') {
    const parsed = csv(text);
    normalized = parsed.header.join(',') + '\n' + parsed.rows.map(r => parsed.header.map(h => h === 'instrument' && r[h] === 'SNPP' ? 'VIIRS' : r[h]).join(',')).join('\n');
  }
  const rows = detections(normalized, source), unique = merge([], rows);
  const dates = unique.map(r => r.acq_date).sort();
  const bounds = unique.reduce((b, r) => [Math.min(b[0], r.longitude), Math.min(b[1], r.latitude), Math.max(b[2], r.longitude), Math.max(b[3], r.latitude)], [180, 90, -180, -90]);
  report.files.push({ file, sha256: createHash('sha256').update(text).digest('hex'), rows: rows.length, unique: unique.length, bounds, first: dates[0], last: dates.at(-1), observedDays: new Set(dates).size, versions: [...new Set(rows.map(r => r.version))], satellites: [...new Set(rows.map(r => r.satellite))], coverageVerified: false });
  if (source.endsWith('_SP')) {
    const counts = {};
    for (const r of unique) counts[r.acq_date] = (counts[r.acq_date] || 0) + 1;
    report.products[source] = { counts, file, coverageVerified: false };
  }
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'history.json.tmp'), JSON.stringify(report, null, 2));
await rename(path.join(output, 'history.json.tmp'), path.join(output, 'history.json'));
console.log(JSON.stringify(report.files.map(({ sha256, ...summary }) => summary), null, 2));
