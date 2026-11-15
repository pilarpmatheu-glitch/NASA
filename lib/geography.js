import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const boundary = JSON.parse(readFileSync(path.join(root, 'cuyo-boundary.json'), 'utf8'));
if (boundary.type !== 'Polygon' || !Array.isArray(boundary.coordinates?.[0])) throw new Error('Límite de Cuyo inválido');
const ring = boundary.coordinates[0];
export function insideCuyo(longitude, latitude) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const cross = (a[1] > latitude) !== (b[1] > latitude) &&
      longitude < (b[0] - a[0]) * (latitude - a[1]) / (b[1] - a[1]) + a[0];
    if (cross) inside = !inside;
  }
  return inside;
}
