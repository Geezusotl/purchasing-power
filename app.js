/* No framework, external scripts, tracking, or browser-side API credentials. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), M = window.PPMath;
  const money = n => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', maximumFractionDigits:0}).format(n);
  const dollars = n => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2}).format(n);
  const pct = (n, signed=true) => M.valid(n) ? `${signed && n > 0 ? '+' : ''}${Math.abs(n) < .05 ? '0.0' : n.toFixed(1)}%` : 'Unavailable';
  const monthLabel = (date, short=false) => new Date(`${date}-15T12:00:00Z`).toLocaleDateString('en-US', {month:short?'short':'long', year:'numeric', timeZone:'UTC'});
  const stamp = date => new Date(date).toLocaleString('en-US', {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  let S, dates, latest, base, end, chartState, chosenYears='5';
  const ns = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attrs={}, text) { const el=document.createElementNS(ns, tag); for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,String(v)); if(text!==undefined) el.textContent=text; return el; }
  function linePaths(parent, points, x, y, color, width=2, dashed=false) {
    M.segments(points).forEach(group => {
      if(group.length===1) parent.append(svgNode('circle',{cx:x(group[0].date),cy:y(group[0].value),r:2,fill:color}));
      else parent.append(svgNode('path',{d:group.map((p,i)=>`${i?'L':'M'}${x(p.date).toFixed(2)},${y(p.value).toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,...(dashed?{'stroke-dasharray':'6 4'}:{})}));
    });
  }
  const monthNumber = date => Number(date.slice(0,4))*12+Number(date.slice(5));
  function spark(id, points, color) {
    const valid=points.filter(p=>M.valid(p.value)), box=$(id); box.replaceChildren(); if(!valid.length)return;
    const lo=Math.min(...valid.map(p=>p.value)),hi=Math.max(...valid.map(p=>p.value)),svg=svgNode('svg',{viewBox:'0 0 240 35','aria-hidden':'true',preserveAspectRatio:'none'});
    const start=monthNumber(points[0].date),finish=monthNumber(points.at(-1).date);
    linePaths(svg,points,d=>2+(monthNumber(d)-start)/Math.max(1,finish-start)*236,v=>31-(v-lo)/Math.max(.01,hi-lo)*27,color,1.6);
    box.append(svg);
  }
  function realAt(date, then=M.previousYear(date)) {
    return M.realChange(M.value(S.earnings,date),M.value(S.earnings,then),M.value(S.cpiAdjusted,date),M.value(S.cpiAdjusted,then));
  }
  function metrics() {
    const p=S.cpi.latest,w=S.earnings.latest,u=S.unemployment.latest,r=dates.at(-1),growth=realAt(r);
    $('metric-inflation').textContent=pct(M.yoy(S.cpi,p),false);
    $('metric-wages').textContent=dollars(M.value(S.earnings,w));
    $('metric-real').textContent=pct(growth);
    $('metric-unemployment').textContent=pct(M.value(S.unemployment,u),false);
    $('date-inflation').textContent=monthLabel(p)+' · CPI-U, unadjusted';
    const preliminary=S.earnings.data.find(x=>x.date===w)?.notes.some(n=>/preliminary/i.test(n));
    $('date-wages').textContent=monthLabel(w)+(preliminary?' · preliminary':' · seasonally adjusted');
    $('date-real').textContent=monthLabel(r)+' · adjusted series';
    $('date-unemployment').textContent=monthLabel(u)+' · seasonally adjusted';
    $('release-label').textContent='Latest price observation: '+monthLabel(p);
    $('reading').textContent=M.valid(growth)?`After inflation, average hourly pay ${Math.abs(growth)<.05?'was broadly unchanged':growth>0?'rose '+pct(growth,false):'fell '+pct(Math.abs(growth),false)} in the year to ${monthLabel(r)}.`:'An annual real-pay comparison is unavailable for the latest common month.';
    const lastPoints=s=>s.data.slice(-37);
    spark('spark-inflation',lastPoints(S.cpi).map(p=>({date:p.date,value:M.yoy(S.cpi,p.date)})),'#b35f36');
    spark('spark-wages',lastPoints(S.earnings),'#176b59');
    spark('spark-real',lastPoints(S.cpiAdjusted).map(p=>({date:p.date,value:realAt(p.date)})),'#176b59');
    spark('spark-unemployment',lastPoints(S.unemployment),'#66777b');
  }
  function health() {
    const status=window.PP_STATUS, now=Date.now(), checkAge=status?.lastSuccess?(now-Date.parse(status.lastSuccess))/86400000:Infinity;
    const dataAge=(new Date().getUTCFullYear()*12+new Date().getUTCMonth()+1)-monthNumber(latest);
    const warning=!status?.ok||checkAge>3||dataAge>3;
    $('health').classList.toggle('warning',warning);
    const dateText=status?.lastSuccess?stamp(status.lastSuccess):'not recorded';
    $('health').textContent=!status?.ok?'Latest update unsuccessful. Showing the previous valid snapshot.':checkAge>3?`Update check overdue · Last successful check ${dateText}`:dataAge>3?`Published observations are over three months old · Last check ${dateText}`:`Official BLS data · Last successful check ${dateText}`;
    $('update-details').textContent=`Observations last changed or were first retrieved: ${stamp(window.PP_DATA.retrievedAt)}. Last successful check: ${dateText}. Latest attempt: ${status?.lastAttempt?stamp(status.lastAttempt):'not recorded'}.`;
  }
  function setRange(years) {
    chosenYears=years; end=dates.at(-1);
    const desired=years==='all'?dates[0]:`${Number(end.slice(0,4))-Number(years)}${end.slice(4)}`;
    base=dates.find(d=>d>=desired)||dates[0];
    document.querySelectorAll('[data-years]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.years===years)));
    $('base-label').textContent=`${monthLabel(base,true)} = 100`;
    $('chart-range').textContent=`${monthLabel(base,true)} — ${monthLabel(end,true)}`;
    const wage=M.change(M.value(S.earnings,end),M.value(S.earnings,base)),price=M.change(M.value(S.cpiAdjusted,end),M.value(S.cpiAdjusted,base)),real=realAt(end,base);
    $('period-summary').textContent=`Average hourly pay ${wage>=0?'grew':'fell'} ${pct(Math.abs(wage),false)}, while consumer prices ${price>=0?'rose':'fell'} ${pct(Math.abs(price),false)}. That leaves average real hourly pay ${real>=0?'up':'down'} ${pct(Math.abs(real),false)} since ${monthLabel(base)}.`;
    drawChart(); renderTable();
  }
  function drawChart() {
    const box=$('main-chart'), width=Math.max(320,box.clientWidth), height=box.clientHeight||330;
    const left=43,right=width<500?85:107,top=24,bottom=34,pw=width-left-right,ph=height-top-bottom;
    const wages=M.indexed(S.earnings,base,end),prices=M.indexed(S.cpiAdjusted,base,end),all=[...wages,...prices].filter(p=>M.valid(p.value));
    const min=Math.min(...all.map(p=>p.value)),max=Math.max(...all.map(p=>p.value));
    const rawStep=(max-min)/4||1,step=[.5,1,2,5,10,20,25,50,100,200,500].find(n=>n>=rawStep)||1000;
    const low=Math.floor((min-1)/step)*step,high=Math.ceil((max+1)/step)*step;
    const x=d=>left+(monthNumber(d)-monthNumber(base))/Math.max(1,monthNumber(end)-monthNumber(base))*pw,y=v=>top+ph-(v-low)/(high-low)*ph;
    const svg=svgNode('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-labelledby':'chart-title chart-description',tabindex:0});
    svg.append(svgNode('title',{id:'chart-title'},'Hourly earnings compared with consumer prices'));
    svg.append(svgNode('desc',{id:'chart-description'},`Both start at 100 in ${monthLabel(base)}. ${$('period-summary').textContent} Use arrow keys to inspect monthly observations, or the data table below.`));
    for(let tick=low;tick<=high;tick+=step){svg.append(svgNode('line',{x1:left,x2:width-right,y1:y(tick),y2:y(tick),stroke:tick===100?'#b5bfb7':'#dce0d8','stroke-width':1,'stroke-dasharray':tick===100?'3 3':''}));svg.append(svgNode('text',{x:left-10,y:y(tick)+3,'text-anchor':'end',fill:'#637070','font-family':'Arial','font-size':10},String(tick)));}
    const span=monthNumber(end)-monthNumber(base),labelCount=width<500?3:6;
    for(let i=0;i<labelCount;i++){const n=Math.round(span*i/(labelCount-1)),month=monthNumber(base)+n,yr=Math.floor((month-1)/12),mo=(month-1)%12+1,date=`${yr}-${String(mo).padStart(2,'0')}`;svg.append(svgNode('text',{x:x(date),y:height-10,'text-anchor':i===0?'start':i===labelCount-1?'end':'middle',fill:'#637070','font-family':'Arial','font-size':10},monthLabel(date,true)));}
    linePaths(svg,wages,x,y,'#176b59',2.6);linePaths(svg,prices,x,y,'#b35f36',2.4,true);
    const endpoints=[{label:'Pay',point:wages.filter(p=>M.valid(p.value)).at(-1),color:'#176b59'},{label:'Prices',point:prices.filter(p=>M.valid(p.value)).at(-1),color:'#b35f36'}].sort((a,b)=>y(a.point.value)-y(b.point.value));
    let lastY=-Infinity;
    endpoints.forEach(item=>{const yp=Math.max(y(item.point.value),lastY+19);lastY=yp;svg.append(svgNode('circle',{cx:x(item.point.date),cy:y(item.point.value),r:3,fill:item.color}));svg.append(svgNode('text',{x:width-right+10,y:yp+3,fill:item.color,'font-family':'Arial','font-size':11,'font-weight':600},`${item.label} ${item.point.value.toFixed(1)}`));});
    const hover=svgNode('g',{'aria-hidden':'true',visibility:'hidden'}),guide=svgNode('line',{y1:top,y2:height-bottom,stroke:'#7f8b85','stroke-width':1,'stroke-dasharray':'3 3'});hover.append(guide);svg.append(hover);
    const available=Array.from(new Set([...wages,...prices].map(p=>p.date))).sort();let selected=available.length-1;
    function inspect(index){selected=Math.max(0,Math.min(index,available.length-1));const date=available[selected],wv=wages.find(p=>p.date===date)?.value,pv=prices.find(p=>p.date===date)?.value;guide.setAttribute('x1',x(date));guide.setAttribute('x2',x(date));hover.setAttribute('visibility','visible');$('chart-readout').textContent=`${monthLabel(date)} · Hourly earnings: ${M.valid(wv)?wv.toFixed(2):'unavailable'} · Consumer prices: ${M.valid(pv)?pv.toFixed(2):'unavailable'} (index)`;}
    svg.addEventListener('pointermove',event=>{const rect=svg.getBoundingClientRect(),pos=(event.clientX-rect.left)/rect.width*width,target=monthNumber(base)+(pos-left)/pw*span;inspect(available.reduce((best,d,i)=>Math.abs(monthNumber(d)-target)<Math.abs(monthNumber(available[best])-target)?i:best,0));});
    svg.addEventListener('pointerleave',()=>{hover.setAttribute('visibility','hidden');$('chart-readout').textContent='Hover over the chart, or focus it and use the arrow keys to inspect a month.';});
    svg.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();inspect(event.key==='Home'?0:event.key==='End'?available.length-1:selected+(event.key==='ArrowLeft'?-1:1));}});
    svg.addEventListener('focus',()=>inspect(selected));
    box.replaceChildren(svg);$('chart-readout').textContent='Hover over the chart, or focus it and use the arrow keys to inspect a month.';chartState={wages,prices};
  }
  function basket() {
    const target=$('basket-rows'); target.replaceChildren();
    const keys=['cpi','food','shelter','gas'],values=keys.map(key=>M.yoy(S[key],S[key].latest)),magnitude=Math.max(5,...values.filter(M.valid).map(Math.abs));
    keys.forEach((key,i)=>{const s=S[key],growth=values[i],row=document.createElement('div');row.className='basket-row';const head=document.createElement('div');head.className='basket-row-head';const title=document.createElement('h3');title.textContent=key==='cpi'?'All consumer prices':s.name;const number=document.createElement('strong');number.textContent=pct(growth);head.append(title,number);const track=document.createElement('div');track.className='bar-track';track.setAttribute('aria-hidden','true');const bar=document.createElement('span');bar.className='bar-value';const length=M.valid(growth)?Math.abs(growth)/magnitude*(growth<0?24:74):0;bar.style.left=(growth<0?25-length:25)+'%';bar.style.width=length+'%';bar.style.background=growth<0?'#176b59':'#b35f36';track.append(bar);const date=document.createElement('small');date.textContent=monthLabel(s.latest)+' · year over year';row.append(head,track,date);target.append(row);});
  }
  function calculator() {
    const options=S.cpi.data.filter(p=>M.valid(p.value));
    ['from-month','to-month'].forEach(id=>{const select=$(id);for(const p of options){const option=document.createElement('option');option.value=p.date;option.textContent=monthLabel(p.date);select.append(option);}});
    $('from-month').value=options.some(p=>p.date==='2020-01')?'2020-01':options[0].date;$('to-month').value=options.at(-1).date;
    $('calculator-form').addEventListener('submit',event=>{event.preventDefault();calculate();});
    calculate();
  }
  function calculate() {
    const input=$('amount'),amount=input.value.trim()===''?NaN:Number(input.value),from=$('from-month').value,to=$('to-month').value;
    const result=$('calculator-result');result.replaceChildren();
    if(!M.valid(amount)||amount<0||amount>1e12){result.textContent='Enter a valid amount between $0 and $1 trillion.';return;}
    const a=M.value(S.cpi,from),b=M.value(S.cpi,to),equivalent=M.equivalent(amount,a,b);
    if(equivalent===null){result.textContent='A CPI observation is missing for this comparison. Choose another month.';return;}
    const label=document.createElement('p');label.className='result-label';label.textContent='EQUIVALENT BUYING POWER';const total=document.createElement('strong');total.textContent=money(equivalent);const explanation=document.createElement('p');explanation.textContent=`${money(amount)} in ${monthLabel(from)} has the same buying power as ${money(equivalent)} in ${monthLabel(to)}.`;
    const detail=document.createElement('p'),price=M.change(b,a);detail.textContent=`Cumulative price change: ${pct(price)}. ${from===to?'Same-month comparison; no adjustment.':to<from?'This converts back into earlier dollars.':`Difference: ${money(equivalent-amount)}.`}`;
    result.append(label,total,explanation,detail);
  }
  function tableRows(){return Array.from(new Set([S.earnings,S.cpiAdjusted,S.cpi,S.unemployment].flatMap(s=>s.data.map(p=>p.date)))).filter(d=>d>=base&&d<=end).sort().reverse().map(d=>[d,...['earnings','cpiAdjusted','cpi','unemployment'].map(k=>M.value(S[k],d))]);}
  function renderTable(){const rows=tableRows(),body=$('table-body');body.replaceChildren();for(const row of rows){const tr=document.createElement('tr');row.forEach((v,i)=>{const td=document.createElement(i===0?'th':'td');if(i===0){td.scope='row';td.textContent=monthLabel(v,true);}else{td.textContent=v===null?'Unavailable':v.toFixed(i===1?2:i===4?1:3);if(v===null)td.className='missing';}tr.append(td);});body.append(tr);}$('row-count').textContent=`(${rows.length} months)`;}
  function download(){const header=['Month','Average hourly earnings USD SA','CPI-U SA index 1982-84=100','CPI-U NSA index 1982-84=100','Unemployment percent SA'];const lines=[header.join(','),...tableRows().reverse().map(row=>row.map(v=>v===null?'':v).join(','))];const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`purchasing-power-${base}-to-${end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function sources(){for(const s of Object.values(S)){const li=document.createElement('li'),a=document.createElement('a');a.href=s.source;a.textContent=`${s.name} · ${s.id}`;li.append(a,document.createTextNode(' · '+s.adjustment));$('source-list').append(li);}}
  try{
    const data=window.PP_DATA;if(!M||data?.schemaVersion!==1||!data.series)throw new Error('Data snapshot unavailable');S=data.series;
    dates=M.commonDates(S.earnings,S.cpiAdjusted);if(dates.length<13)throw new Error('Insufficient comparable observations');latest=S.cpi.latest;
    metrics();health();basket();calculator();sources();setRange('5');
    document.querySelectorAll('[data-years]').forEach(b=>b.addEventListener('click',()=>setRange(b.dataset.years)));
    $('download-csv').addEventListener('click',download);
    if('ResizeObserver'in window){let queued;new ResizeObserver(()=>{clearTimeout(queued);queued=setTimeout(drawChart,80);}).observe($('main-chart'));}
  }catch(error){$('health').classList.add('warning');$('health').textContent='The dashboard could not load its data. Download the data snapshot below or check the update history.';console.error(error);}
})();
