import { insideCuyo } from './geography.js';
export const BBOX = [-70.8, -37.8, -64.5, -28.2];
export const SOURCES = ['MODIS_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'];
export const DAY = 86400000;
export const isoDay = d => new Date(d).toISOString().slice(0, 10);

export function csv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else field += c;
  }
  if (quoted) throw new Error('CSV incompleto');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift() || [];
  return { header, rows: rows.map(r => {
    if (r.length !== header.length) throw new Error('CSV inválido');
    return Object.fromEntries(header.map((h, i) => [h, r[i]]));
  }) };
}

export function detections(text, source) {
  const parsed = csv(text);
  for (const field of ['latitude', 'longitude', 'acq_date', 'acq_time', 'satellite', 'instrument', 'version']) {
    if (!parsed.header.includes(field)) throw new Error('Respuesta FIRMS inválida');
  }
  return parsed.rows.map(r => {
    const latitude = Number(r.latitude), longitude = Number(r.longitude);
    const time = r.acq_time.padStart(4, '0');
    if (!r.latitude || !r.longitude || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(r.acq_date) ||
        !Number.isFinite(Date.parse(r.acq_date)) || isoDay(r.acq_date) !== r.acq_date ||
        !/^\d{4}$/.test(time) || +time.slice(0, 2) > 23 || +time.slice(2) > 59 ||
        r.instrument !== (source.startsWith('MODIS') ? 'MODIS' : 'VIIRS')) throw new Error('Registro FIRMS inválido');
    return { ...r, latitude, longitude, acq_time: time, source };
  }).filter(r => insideCuyo(r.longitude, r.latitude));
}

export const identity = r => [r.source, r.satellite, r.instrument, r.acq_date, r.acq_time, r.latitude, r.longitude].join('|');

export function merge(old, incoming) {
  const map = new Map(old.map(r => [identity(r), r]));
  incoming.forEach(r => map.set(identity(r), r));
  return [...map.values()];
}

export async function collectSource(previous, source, key, fetcher = fetch, now = new Date()) {
  const attempt = now.toISOString();
  const result = { records: [], queries: {}, ...previous, lastAttempt: attempt };
  try {
    if (!key) throw new Error('Falta FIRMS_MAP_KEY');
    const start = isoDay(now.getTime() - 4 * DAY), end = isoDay(now);
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${BBOX.join(',')}/5/${start}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(45000), redirect: 'error' });
    if (!response.ok) throw new Error('NASA no disponible');
    const incoming = detections(await response.text(), source);
    if (incoming.some(r => r.acq_date < start || r.acq_date > end)) throw new Error('Fechas inesperadas');
    result.records = merge(result.records, incoming);
    result.queries = { ...result.queries };
    for (let n = 0; n < 5; n++) result.queries[isoDay(now.getTime() - n * DAY)] = attempt;
    result.lastSuccess = attempt;
    result.error = null;
  } catch {
    // Never retain exception text: fetch errors can contain the secret URL.
    result.error = key ? 'No se pudo validar o descargar FIRMS. Se conservan los datos previos.' : 'Falta FIRMS_MAP_KEY en el servidor.';
  }
  return result;
}

export function calendar(state, history, source, year, month, now = new Date()) {
  const product = state.products[source] || {};
  const counts = {};
  for (const r of product.records || []) if (insideCuyo(r.longitude, r.latitude)) counts[r.acq_date] = (counts[r.acq_date] || 0) + 1;
  const historical = history?.products?.[source.replace('_NRT', '_SP')] || {};
  function days(y, historic = false) {
    return Array.from({ length: new Date(Date.UTC(y, month, 0)).getUTCDate() }, (_, i) => {
      const date = `${y}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const count = (historic ? historical.counts : counts)?.[date] ?? null;
      return { date, count, status: date > isoDay(now) ? 'future' : historic ? (count === null ? 'unknown' : 'historical-unverified') : count !== null ? 'provisional' : product.queries?.[date] ? 'no-records-coverage-unknown' : 'unknown' };
    });
  }
  return {
    source, bbox: BBOX, geography: 'Cuyo: polígono provisto por el equipo (último punto aislado excluido). La consulta FIRMS usa un rectángulo amplio y filtra con el polígono.',
    lastAttempt: product.lastAttempt || null, lastSuccess: product.lastSuccess || null,
    stale: !product.lastSuccess || now - new Date(product.lastSuccess) > 2 * 3600000,
    error: product.error || null, present: days(year), past: days(year - 10, true),
    average: days(year).map(d => ({ ...d, count: null, status: 'not-comparable' })),
    historicalReason: 'Históricos de referencia sin cobertura diaria verificada; procesamiento SP distinto de NRT. Promedio no calculado para evitar sesgos.',
    historicalImportedAt: history?.importedAt || null
  };
}
