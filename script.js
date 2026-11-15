// BRASA: dos calendarios basados en el archivo de Cuyo.
// VIIRS incluye los registros identificados como SNPP y VIIRS.
const YEARS = Array.from({length:10},(_,i)=>2016+i);
const PRESENT = 2026;
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['L','M','M','J','V','S','D'];
let dataset = {}, month = 10, selectedDay = 12, limits = [1,2,3];
const el = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const key = (year,m,d) => `${year}-${pad(m+1)}-${pad(d)}`;
const valid = (year,m,d) => d <= new Date(Date.UTC(year,m+1,0)).getUTCDate();
const sum = (row) => (row?.MODIS?.count||0)+(row?.VIIRS?.count||0);
const median = arr => {const a=[...arr].sort((x,y)=>x-y),n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
const fmt = (v,d=1) => v==null?'Sin dato':Number(v).toLocaleString('es-AR',{maximumFractionDigits:d});
function historical(m,d){
  const annual = YEARS.map(year=>valid(year,m,d)?sum(dataset[key(year,m,d)]):null);
  const available = annual.filter(v=>v!==null);
  const values = available.filter(v=>v>0);
  return {annual, med:available.length?median(available):null, detectedYears:values.length, count:values.reduce((a,b)=>a+b,0)};
}
function calcLimits(){
  const positive=[];
  for(let m=0;m<12;m++) for(let d=1;d<=31;d++){
    if(!valid(2025,m,d))continue;
    const v=historical(m,d).med;
    if(v>0)positive.push(v);
  }
  positive.sort((a,b)=>a-b);
  const quantile=q=>positive.length?positive[Math.min(positive.length-1,Math.floor((positive.length-1)*q))]:0;
  limits=[quantile(.25),quantile(.5),quantile(.75)];
}
function color(value){
  if(value==null||value===0)return 'no-data';
  if(value<=limits[0])return 'level1';
  if(value<=limits[1])return 'level2';
  if(value<=limits[2])return 'level3';
  return 'level4';
}
function sensorCount(row,s){return row?.[s]?.count||0}
function passes(row){return el('filter').value!=='both'||(sensorCount(row,'MODIS')>0&&sensorCount(row,'VIIRS')>0)}
function renderCalendar(id,isHistory){
  const container=el(id);container.innerHTML='';
  WEEKDAYS.forEach(label=>{const node=document.createElement('div');node.className='weekday';node.textContent=label;container.appendChild(node)});
  const offset=(new Date(Date.UTC(PRESENT,month,1)).getUTCDay()+6)%7;
  const days=new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate();
  for(let i=0;i<offset;i++){const blank=document.createElement('div');blank.className='day blank';container.appendChild(blank)}
  let total=0;
  for(let d=1;d<=days;d++){
    const row=dataset[key(PRESENT,month,d)];
    const hist=historical(month,d);
    let value=isHistory?hist.med:sum(row);
    if(!isHistory&&!passes(row))value=0;
    const button=document.createElement('button');button.className='day '+color(value);button.type='button';button.textContent=d;
    if(d===selectedDay)button.classList.add('selected');
    button.title=isHistory?`Mediana histórica: ${fmt(value)} detecciones`:`2026: ${fmt(value,0)} detecciones`;
    button.addEventListener('click',()=>{selectedDay=d;render()});
    container.appendChild(button);
    total+=isHistory?(hist.med||0):(value||0);
  }
  el(isHistory?'history-total':'current-total').textContent=isHistory?`Suma de medianas diarias del mes: ${fmt(total)} (indicador descriptivo)`:`Detecciones registradas en el mes: ${fmt(total,0)}`;
}
function sensorCard(title,info){
  return `<div class="sensor-card"><h3>${title}</h3><p><strong>${fmt(info?.count||0,0)}</strong> detecciones</p><p>FRP mediana: <strong>${info?.frp_median_mw==null?'Sin dato':fmt(info.frp_median_mw)+' MW'}</strong></p><p>Temperatura de brillo mediana: <strong>${info?.brightness_median_c==null?'Sin dato':fmt(info.brightness_median_c)+' °C'}</strong></p><p>Satélites: <strong>${info?.satellites?Object.keys(info.satellites).join(', '):'Sin registros'}</strong></p></div>`;
}
function renderDetails(){
  const present=dataset[key(PRESENT,month,selectedDay)];
  const hist=historical(month,selectedDay);
  const count=passes(present)?sum(present):0;
  el('selected-title').textContent=`${selectedDay} de ${MONTHS[month]}`;
  el('selected-subtitle').textContent='Comparación entre los registros de 2026 y el comportamiento histórico para el mismo día y mes.';
  el('difference').textContent=hist.med===0?'Mediana histórica: 0':hist.med==null?'Sin referencia histórica':`2026 vs mediana: ${count-hist.med>=0?'+':''}${fmt(count-hist.med)} detecciones`;
  el('metrics').innerHTML=`<div class="metric"><b>${fmt(count,0)}</b><span>Total 2026</span></div><div class="metric"><b>${fmt(hist.med)}</b><span>Mediana 2016–2025</span></div><div class="metric"><b>${hist.detectedYears}/10</b><span>Años con registros en esta fecha</span></div>`;
  el('sensor-grid').innerHTML=sensorCard('MODIS · 2026',present?.MODIS)+sensorCard('VIIRS · 2026',present?.VIIRS);
  const chips=YEARS.map((year,i)=>{const row=dataset[key(year,month,selectedDay)];return `<span class="year-chip"><b>${year}</b>: ${hist.annual[i]===null?'—':hist.annual[i]} (M ${sensorCount(row,'MODIS')} / V ${sensorCount(row,'VIIRS')})</span>`}).join('');
  const historicalModis=YEARS.map(y=>sensorCount(dataset[key(y,month,selectedDay)],'MODIS'));
  const historicalViirs=YEARS.map(y=>sensorCount(dataset[key(y,month,selectedDay)],'VIIRS'));
  el('historical-years').innerHTML=`<div class="years"><h3>Registros por año · MODIS y VIIRS</h3><div class="year-chips">${chips}</div><p>Mediana MODIS: <strong>${fmt(median(historicalModis))}</strong> · Mediana VIIRS: <strong>${fmt(median(historicalViirs))}</strong>. La mediana combinada se calcula sobre el total diario de cada año; no es la suma de las dos medianas individuales.</p></div>`;
}
function renderLegend(){
  const labels=[`Hasta ${fmt(limits[0])}`,`Más de ${fmt(limits[0])} y hasta ${fmt(limits[1])}`,`Más de ${fmt(limits[1])} y hasta ${fmt(limits[2])}`,`Más de ${fmt(limits[2])}`];
  el('legend-rows').innerHTML=labels.map((s,i)=>`<div class="legend-row"><i class="swatch level${i+1}"></i>${s} detecciones</div>`).join('')+'<div class="legend-row"><i class="swatch no-data"></i>Sin detecciones registradas</div>';
}
function render(){el('month').textContent=`${MONTHS[month]} · 2026`;renderCalendar('current',false);renderCalendar('history',true);renderDetails();renderLegend()}
el('prev').addEventListener('click',()=>{month=(month+11)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('next').addEventListener('click',()=>{month=(month+1)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('filter').addEventListener('change',render);
fetch('datos_cuyo_resumen.json').then(r=>{if(!r.ok)throw Error('No se encontró datos_cuyo_resumen.json');return r.json()}).then(payload=>{
  dataset=payload.days;calcLimits();
  el('notice').textContent=`${fmt(payload.metadata.records,0)} registros originales de Cuyo · 2016–2026. En 2026 el archivo solo contiene VIIRS; MODIS figura sin detecciones registradas. El archivo fuente aplicó deduplicación espacial de 1 km y conservó la primera fecha por ubicación.`;
  render();
}).catch(error=>{el('notice').textContent=`Error: ${error.message}. Abrí index.html con Live Server y verificá que el JSON esté en la misma carpeta.`;render()});
