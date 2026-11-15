// EmberSpot: two calendars based on the supplied Cuyo data.
// The VIIRS group includes records labeled SNPP or VIIRS in the source data.
const YEARS = Array.from({length:10},(_,i)=>2016+i);
const PRESENT = 2026;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const limits = [17,34,77];
let dataset = {}, month = new Date().getMonth(), selectedDay = new Date().getDate(), lastStatus = '';
const el = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const key = (year,m,d) => `${year}-${pad(m+1)}-${pad(d)}`;
const valid = (year,m,d) => d <= new Date(Date.UTC(year,m+1,0)).getUTCDate();
const sum = row => row?.MODIS?.count == null && row?.VIIRS?.count == null ? null : (row?.MODIS?.count||0)+(row?.VIIRS?.count||0);
const median = arr => {const a=arr.filter(Number.isFinite).sort((x,y)=>x-y),n=a.length;return n===0?null:n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2};
const fmt = (v,d=1) => v==null?'No record':Number(v).toLocaleString('en-US',{maximumFractionDigits:d});
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
  const level=Math.round(value); // Round half counts only for the color; keep the displayed value.
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
    button.title=isHistory?`Middle count: ${fmt(value)} detections (${hist.availableYears} of ${hist.eligibleYears} years have records).`:`2026: ${fmt(value,0)} detections`;
    button.setAttribute('aria-label',`${MONTHS[month]} ${d}, ${button.title}`);
    button.addEventListener('click',()=>{selectedDay=d;render()});
    container.appendChild(button);
    total+=isHistory?(hist.med||0):(value||0);
  }
  el(isHistory?'history-total':'current-total').textContent=isHistory?'Each day shows the middle count from years with records. Choose a day to see which years are included.':`Detections recorded this month: ${fmt(total,0)}`;
}
function sensorCard(title,info){
  return `<div class="sensor-card"><h3>${title}</h3><p><strong>${fmt(info?.count,0)}</strong> detections</p><p>Satellites: <strong>${info?.satellites?Object.keys(info.satellites).join(', '):'No record'}</strong></p></div>`;
}
function renderDetails(){
  const present=dataset[key(PRESENT,month,selectedDay)];
  const hist=historical(month,selectedDay);
  const count=passes(present)?sum(present):null;
  el('selected-title').textContent=`${MONTHS[month]} ${selectedDay}`;
  el('selected-subtitle').textContent='Compare this date in 2026 with the middle count from past years that have records. Some years may be missing.';
  el('difference').textContent=hist.med==null?'No past records for this date':'Past data may be incomplete';
  el('metrics').innerHTML=`<div class="metric"><b>${fmt(count,0)}</b><span>2026 detections</span></div><div class="metric"><b>${fmt(hist.med)}</b><span>Middle count in past years</span></div><div class="metric"><b>${hist.availableYears}/${hist.eligibleYears}</b><span>Past years with records</span></div>`;
  el('sensor-grid').innerHTML=sensorCard('MODIS · 2026',present?.MODIS)+sensorCard('VIIRS · 2026',present?.VIIRS);
  const chips=YEARS.map((year,i)=>{const row=dataset[key(year,month,selectedDay)];return `<span class="year-chip"><b>${year}</b>: ${hist.annual[i]===null?'No record':hist.annual[i]} (MODIS ${fmt(sensorCount(row,'MODIS'))} / VIIRS ${fmt(sensorCount(row,'VIIRS'))})</span>`}).join('');
  el('historical-years').innerHTML=`<div class="years"><h3>What was recorded in past years?</h3><div class="year-chips">${chips}</div><p>These counts come from two different satellite systems. Years without records are left out of the middle count. Missing records make this comparison less reliable; it cannot show whether the number of fires changed.</p></div>`;
}
function renderLegend(){
  const labels=[`Low · 1–${limits[0]}`,`Moderate · ${limits[0]+1}–${limits[1]}`,`High · ${limits[1]+1}–${limits[2]}`,`Very high · ${limits[2]+1} or more`];
  el('legend-rows').innerHTML=labels.map((s,i)=>`<div class="legend-row"><i class="swatch level${i+1}"></i>${s} detections</div>`).join('')+'<div class="legend-row"><i class="swatch no-data"></i>No record</div>';
}
function render(){el('month').textContent=`${MONTHS[month]} · 2026`;renderCalendar('current',false);renderCalendar('history',true);renderDetails();renderLegend()}
el('prev').addEventListener('click',()=>{month=(month+11)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('next').addEventListener('click',()=>{month=(month+1)%12;selectedDay=Math.min(selectedDay,new Date(Date.UTC(PRESENT,month+1,0)).getUTCDate());render()});
el('filter').addEventListener('change',render);
async function refreshData(){
  try {
    const response=await fetch('/api/dashboard',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Could not load data');
    const payload=await response.json();
    dataset=payload.days;
    const productNames={MODIS_NRT:'MODIS',VIIRS_SNPP_NRT:'VIIRS (Suomi NPP)',VIIRS_NOAA20_NRT:'VIIRS (NOAA-20)',VIIRS_NOAA21_NRT:'VIIRS (NOAA-21)'};
    const statuses=Object.entries(payload.metadata.products).map(([source,p])=>{
      const time=p.lastSuccess?new Date(p.lastSuccess).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Argentina/Buenos_Aires'})+' ART':'no update yet';
      return (productNames[source]||source)+': '+time+(p.error||p.stale?' (older data)':'');
    });
    lastStatus='Latest updates: '+statuses.join(' · ')+'.';
    el('notice').textContent=lastStatus+' A detection is a heat spot seen by a satellite, not necessarily a separate fire. Past-year comparisons may have missing records.';
    render();
  }catch(error){el('notice').textContent='Could not refresh the data. The last results shown below may be old. '+lastStatus;}
}
refreshData();
setInterval(refreshData,60000);
