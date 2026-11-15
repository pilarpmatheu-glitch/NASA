import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { dashboard } from '../lib/dashboard.js';

// Exercise the actual calculation/color functions, without a browser or network.
function model(days, filter = 'all') {
  const context = vm.createContext({
    document: { getElementById: () => ({ value: filter, addEventListener() {} }) },
    fetch: () => new Promise(() => {}), AbortSignal, setInterval() {}
  });
  vm.runInContext(readFileSync(new URL('../script.js', import.meta.url), 'utf8'), context);
  context.input = days;
  vm.runInContext('dataset=input', context);
  return expression => vm.runInContext(expression, context);
}
test('mediana y color usan años disponibles sin convertir ausencias en ceros', () => {
  const run = model({'2016-11-01': { MODIS: {count: 1} }, '2017-11-01': {MODIS: {count: 2}}});
  assert.equal(run('historical(10,1).med'), 1.5);
  assert.equal(run('historical(10,1).availableYears'), 2);
  assert.equal(run('color(historical(10,1).med)'), 'level2');
  assert.equal(run('historical(10,2).med'), null);
  assert.equal(run('color(historical(10,2).med)'), 'no-data');
  for (const [value, expected] of [[0,'level1'],[1,'level1'],[1.5,'level2'],[2,'level2'],[3,'level3'],[4.5,'level3'],[5,'level4']]) {
    assert.equal(run(`color(${value})`), expected);
  }
});
test('filtro de ambos sensores y años bisiestos se respetan en la referencia', () => {
  const run = model({'2016-02-29': {MODIS: {count: 10}, VIIRS: {count: 20}}, '2020-02-29': {MODIS: {count: 100}}}, 'both');
  assert.equal(run('historical(1,29).med'), 30);
  assert.equal(run('historical(1,29).availableYears'), 1);
  assert.equal(run('historical(1,29).eligibleYears'), 3);
});
test('el histórico real vuelve a producir celdas de color en noviembre', () => {
  const history = JSON.parse(readFileSync(new URL('../cuyo-history.json', import.meta.url), 'utf8'));
  const run = model(dashboard({products:{}}, history).days);
  assert.equal(run('Array.from({length:30},(_,i)=>color(historical(10,i+1).med)).filter(c=>c.startsWith("level")).length'), 30);
});
