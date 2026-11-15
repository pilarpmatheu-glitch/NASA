import { SOURCES, merge } from './firms.js';
import { insideCuyo } from './geography.js';

const median = values => {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
export function dashboard(state, history, now = new Date()) {
  const products = {};
  // SP and local NRT counts remain separate until selected for presentation.
  for (const [source, product] of Object.entries(history?.products || {})) {
    for (const [date, count] of Object.entries(product.counts)) {
      (products[date] ||= {})[source] = { count, frp_median_mw: null, brightness_median_c: null, satellites: {} };
    }
  }
  const status = {};
  for (const source of SOURCES) {
    const p = state.products[source] || {};
    status[source] = { lastSuccess: p.lastSuccess || null, error: p.error || null, stale: !p.lastSuccess || now - new Date(p.lastSuccess) > 7200000 };
    const byDate = {};
    for (const r of merge([], p.records || [])) if (insideCuyo(r.longitude, r.latitude)) (byDate[r.acq_date] ||= []).push(r);
    for (const date of new Set([...Object.keys(p.queries || {}), ...Object.keys(byDate)])) {
      const rows = byDate[date] || [], satellites = {};
      rows.forEach(r => { satellites[r.satellite] = (satellites[r.satellite] || 0) + 1; });
      (products[date] ||= {})[source] = {
        count: rows.length || null, satellites,
        frp_median_mw: median(rows.map(r => r.frp === '' ? NaN : Number(r.frp))),
        brightness_median_c: median(rows.map(r => Number(r.brightness || r.bright_ti4) - 273.15)),
        records: rows
      };
    }
  }
  const days = {};
  for (const [date, entries] of Object.entries(products)) {
    const selected = Object.entries(entries).filter(([source]) => !source.endsWith('_SP') || !entries[source.replace('_SP', '_NRT')]);
    const day = days[date] = {};
    for (const family of ['MODIS', 'VIIRS']) {
      const members = selected.filter(([s]) => s.startsWith(family));
      if (!members.length) continue;
      const values = members.map(([, v]) => v), count = values.reduce((n, v) => n + (v.count || 0), 0);
      const rows = values.flatMap(v => v.records || []), satellites = {};
      for (const v of values) for (const [sat, n] of Object.entries(v.satellites)) satellites[sat] = (satellites[sat] || 0) + n;
      day[family] = { count: count || null, satellites,
        frp_median_mw: rows.length && values.every(v => v.records) ? median(rows.map(r => Number(r.frp))) : null,
        brightness_median_c: rows.length && values.every(v => v.records) ? median(rows.map(r => Number(r.brightness || r.bright_ti4) - 273.15)) : null,
        products: Object.fromEntries(members.map(([s, v]) => [s, {count: v.count}])) };
    }
  }
  return { days, metadata: { products: status, coverageVerified: false, historicalImportedAt: history?.importedAt || null } };
}
