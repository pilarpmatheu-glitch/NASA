// BRASA: dos calendarios basados en el archivo de Cuyo.
// VIIRS incluye los registros identificados como SNPP y VIIRS.
const YEARS = Array.from({length:10},(_,i)=>2016+i);
const PRESENT = 2026;
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const WEEKDAYS = ['L','M','M','J','V','S','D'];
const limits = [17,34,77];
let dataset = {}, month = new Date().getMonth(), selectedDay = new Date().getDate();
const el = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const key = (year,m,d) => `${year}-${pad(m+1)}-${pad(d)}`;
const valid = (year,m,d) => d <= new Date(Date.UTC(year,m+1,0)).getUTCDate();
const sum = (row) => row?.MODIS?.count == null && row?.VIIRS?.count == null ? null : (row?.MODIS?.count||0)+(row?.VIIRS?.count||0);
const median = arr => {const a=arr.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;return n===0?null:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
const fmt = (v,d=1) => v==null?'Sin dato':Number(v).toLocaleString('es-AR',{maximumFractionDigits:d});
function historical(m,d){
  const annual = YEARS.map(year=>{
    const row=dataset[key(year,m,d)];
    return valid(year,m,d)&&passes(row)?sum(row):null;
  });
  const available = annual.filter(v=>v!==null);
  const values = available.filter(v=>v>0);
  return {annual, med:median(available), availableYears:available.length, eligibleYears:YEARS.filter(year=>valid(year,m,d)).length, detectedYears:values.length, count:values.reduce((a,b)=>a+b,0)};
}
function color(value){
  if(value==null||value===0)return 'no-data';
  const level=Math.round(value); // Las medianas pueden terminar en ,5; clasificar por el entero más cercano.
  if(level<=limits[0])return 'level1';
  if(level<=limits[1])return 'level2';
  if(level<=limits[2])return 'level3';
  return 'level4';
}
function sensorCount(row,s){return row?.[s]?.count??null}
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
    if(!isHistory&&!passes(row))value=null;
    const button=document.createElement('button');button.className='day '+color(value);button.type='button';button.textContent=d;
    if(d===selectedDay)button.classList.add('selected');
    button.title=isHistory?`Mediana de registros disponibles: ${fmt(value)} detecciones (${hist.availableYears}/${hist.eligibleYears} años). Cobertura no verificada.`:`2026: ${fmt(value,0)} detecciones`;
    button.setAttribute('aria-label',`${d} · ${button.title}`);
    button.addEventListener('click',()=>{selectedDay=d;render()});
    container.appendChild(button);
    total+=isHistory?(hist.med||0):(value||0);
  }
  el(isHistory?'history-total':'current-total').textContent=isHistory?'Mediana de los años con registros para cada fecha. Seleccioná un día para ver cuántos años se incluyen.':`Detecciones registradas en el mes: ${fmt(total,0)}`;
}
function sensorCard(title,info){
  return `<div class="sensor-card"><h3>${title}</h3><p><strong>${fmt(info?.count,0)}</strong> detecciones</p><p>FRP mediana: <strong>${info?.frp_median_mw==null?'Sin dato':fmt(info.frp_median_mw)+' MW'}</strong></p><p>Temperatura de brillo mediana: <strong>${info?.brightness_median_c==null?'Sin dato':fmt(info.brightness_median_c)+' °C'}</strong></p><p>Satélites: <strong>${info?.satellites?Object.keys(info.satellites).join(', '):'Sin registros'}</strong></p></div>`;
}
function renderDetails(){
  const present=dataset[key(PRESENT,month,selectedDay)];
  const hist=historical(month,selectedDay);
  const count=passes(present)?sum(present):null;
  el('selected-title').textContent=`${selectedDay} de ${MONTHS[month]}`;
  el('selected-subtitle').textContent='Registros actuales y mediana de los años con datos para el mismo día y mes. Es una referencia descriptiva parcial.';
  el('difference').textContent=hist.med==null?'Sin referencia disponible':'Cobertura y comparabilidad sin verificar';
  el('metrics').innerHTML=`<div class="metric"><b>${fmt(count,0)}</b><span>Total 2026</span></div><div class="metric"><b>${fmt(hist.med)}</b><span>Mediana de registros disponibles</span></div><div class="metric"><b>${hist.availableYears}/${hist.eligibleYears}</b><span>Años incluidos según el filtro</span></div>`;
  el('sensor-grid').innerHTML=sensorCard('MODIS · 2026',present?.MODIS)+sensorCard('VIIRS · 2026',present?.VIIRS);
  const chips=YEARS.map((year,i)=>{const row=dataset[key(year,month,selectedDay)];return `<span class="year-chip"><b>${year}</b>: ${hist.annual[i]===null?'—':hist.annual[i]} (M ${fmt(sensorCount(row,'MODIS'))} / V ${fmt(sensorCount(row,'VIIRS'))})</span>`}).join('');
  const historicalModis=YEARS.map((y,i)=>hist.annual[i]===null?null:sensorCount(dataset[key(y,month,selectedDay)],'MODIS')).filter(Number.isFinite);
  const historicalViirs=YEARS.map((y,i)=>hist.annual[i]===null?null:sensorCount(dataset[key(y,month,selectedDay)],'VIIRS')).filter(Number.isFinite);
  el('historical-years').innerHTML=`<div class="years"><h3>Registros por año · MODIS y VIIRS</h3><div class="year-chips">${chips}</div><p>Mediana MODIS: <strong>${fmt(median(historicalModis))}</strong> (${historicalModis.length} años) · Mediana VIIRS: <strong>${fmt(median(historicalViirs))}</strong> (${historicalViirs.length} años). Se excluyen fechas sin registros o fuera del filtro. La falta de cobertura puede sesgar esta referencia; no demuestra cambios en la cantidad de incendios.</p></div>`;
}
function renderLegend(){
  const labels=[`Baja · 1–${limits[0]}`,`Media · ${limits[0]+1}–${limits[1]}`,`Alta · ${limits[1]+1}–${limits[2]}`,`Muy alta · ${limits[2]+1} o más`];
  el('legend-rows').innerHTML=labels.map((s,i)=>`<div class="legend-row"><i class="swatch level${i+1}"></i>${s} detecciones</div>`).join('')+'<div class="legend-row"><i class="swatch no-data"></i>Sin datos</div>';
}
function render(){el('month').textContent=`${MONTHS[month]} · 2026`;renderCalendar('current',false);renderCalendar('history',true);renderDetails();renderLegend()}
el('prev').addEventListener('click',()=>{month=(month+11)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('next').addEventListener('click',()=>{month=(month+1)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('filter').addEventListener('change',render);
async function refreshData(){
  try {
    const response=await fetch('/api/dashboard',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('No se pudo consultar la API');
    const payload=await response.json();
    dataset=payload.days;
    const statuses=Object.entries(payload.metadata.products).map(([source,p])=>{
      const time=p.lastSuccess?new Date(p.lastSuccess).toLocaleString('es-AR'):'sin actualización';
      return source+': '+time+(p.error||p.stale?' (datos pendientes o desactualizados)':'');
    });
    el('notice').textContent='Datos de Cuyo recibidos del servidor. '+statuses.join(' · ')+'. Totales combinados exploratorios; no representan incendios únicos. Mediana de años con registros: referencia parcial, con cobertura y comparabilidad sin verificar.';
    render();
  }catch(error){el('notice').textContent='No se pudo conectar con la API. Se conservan los últimos datos visibles. Abrí el sitio con npm.cmd start o desde Railway.';}
}
refreshData();
setInterval(refreshData,60000);
