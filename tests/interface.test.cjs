const {test}=require('node:test'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
function app(options={}){
  const errors=[],downloads=[],virtualConsole=new VirtualConsole();virtualConsole.on('error',e=>errors.push(String(e)));virtualConsole.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{runScripts:'outside-only',url:'https://example.test/purchasing-power/',virtualConsole});
  const w=dom.window;w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
  for(const file of ['math.js','data.js','status.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
  if(options.status)w.PP_STATUS=options.status;
  if(options.noData)delete w.PP_DATA;
  w.eval(fs.readFileSync(path.join(root,'app.js'),'utf8'));
  return {dom,w,d:w.document,errors,downloads};
}
test('real snapshot loads indicators, sources, graph, and monthly observations',()=>{
  const a=app();assert.deepEqual(a.errors,[]);assert.match(a.d.getElementById('metric-wages').textContent,/^\$\d/);assert.equal(a.d.querySelectorAll('#source-list li').length,7);assert.ok(a.d.querySelector('#main-chart svg title'));assert.ok(a.d.querySelectorAll('#table-body tr').length>=60);assert.ok(!a.d.body.textContent.includes('NaN'));a.dom.window.close();
});
test('all range controls change the chart and table',()=>{
  const a=app();let previous=0;for(const years of ['1','5','10','all']){const button=a.d.querySelector(`[data-years="${years}"]`);button.click();assert.equal(button.getAttribute('aria-pressed'),'true');const count=a.d.querySelectorAll('#table-body tr').length;assert.ok(count>previous);previous=count;}a.dom.window.close();
});
test('calculator result agrees with independently computed source ratio',()=>{
  const a=app();a.d.getElementById('amount').value='80000';a.d.getElementById('from-month').value='2020-01';a.d.getElementById('to-month').value=a.w.PP_DATA.series.cpi.latest;
  a.d.getElementById('calculator-form').dispatchEvent(new a.w.Event('submit',{bubbles:true,cancelable:true}));
  const data=a.w.PP_DATA.series.cpi.data,from=data.find(p=>p.date==='2020-01').value,to=data.filter(p=>p.value!==null).at(-1).value;
  const expected=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(80000*to/from);
  assert.equal(a.d.querySelector('#calculator-result strong').textContent,expected);a.dom.window.close();
});
test('same-month, zero, reverse conversion, and invalid amount',()=>{
  const a=app(),form=a.d.getElementById('calculator-form'),submit=()=>form.dispatchEvent(new a.w.Event('submit',{cancelable:true}));
  a.d.getElementById('to-month').value='2020-01';a.d.getElementById('from-month').value='2020-01';submit();assert.equal(a.d.querySelector('#calculator-result strong').textContent,'$60,000');
  a.d.getElementById('amount').value='0';submit();assert.equal(a.d.querySelector('#calculator-result strong').textContent,'$0');
  a.d.getElementById('amount').value='100';a.d.getElementById('from-month').value='2024-01';submit();assert.match(a.d.getElementById('calculator-result').textContent,/earlier dollars/);
  a.d.getElementById('amount').value='-10';submit();assert.match(a.d.getElementById('calculator-result').textContent,/valid amount/);
  a.d.getElementById('amount').value='';submit();assert.match(a.d.getElementById('calculator-result').textContent,/valid amount/);a.dom.window.close();
});
test('missing months cannot be selected for calculator',()=>{
  const a=app();for(const p of a.w.PP_DATA.series.cpi.data.filter(p=>p.value===null)){assert.equal(a.d.querySelectorAll(`#from-month option[value="${p.date}"]`).length,0);}a.dom.window.close();
});
test('keyboard navigation exposes readable chart values',()=>{
  const a=app(),svg=a.d.querySelector('#main-chart svg');svg.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.match(a.d.getElementById('chart-readout').textContent,/Hourly earnings: 100.00/);svg.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.ok(!a.d.getElementById('chart-readout').textContent.includes('NaN'));a.dom.window.close();
});
test('CSV download uses chosen period and creates a file',()=>{
  const a=app();a.d.querySelector('[data-years="1"]').click();a.d.getElementById('download-csv').click();assert.equal(a.downloads.length,2);assert.ok(a.downloads[0].size>200);assert.match(a.downloads[1],/^purchasing-power-\d{4}-\d{2}-to-\d{4}-\d{2}\.csv$/);a.dom.window.close();
});
test('failed update warning preserves usable calculator and charts',()=>{
  const a=app({status:{ok:false,lastSuccess:'2026-10-01T12:00:00Z',lastAttempt:'2026-10-02T12:00:00Z'}});assert.match(a.d.getElementById('health').textContent,/unsuccessful/);assert.ok(a.d.getElementById('health').classList.contains('warning'));assert.ok(a.d.querySelector('#calculator-result strong'));assert.deepEqual(a.errors,[]);a.dom.window.close();
});
test('overdue update check is visible',()=>{
  const a=app({status:{ok:true,lastSuccess:'2020-01-01T00:00:00Z',lastAttempt:'2020-01-01T00:00:00Z'}});assert.match(a.d.getElementById('health').textContent,/overdue/);a.dom.window.close();
});
test('missing snapshot produces useful error and leaves source download available',()=>{
  const a=app({noData:true});assert.match(a.d.getElementById('health').textContent,/could not load/);assert.ok(a.d.querySelector('a[href="data/snapshot.json"]'));a.dom.window.close();
});
test('no remote assets or third party requests in the runtime',()=>{
  const a=app();for(const el of a.d.querySelectorAll('script[src],link[rel="stylesheet"],img[src]')){assert.ok(!/^(https?:)?\/\//.test(el.getAttribute('src')||el.getAttribute('href')));}const code=fs.readFileSync(path.join(root,'app.js'),'utf8');assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(code));a.dom.window.close();
});
test('all labels target existing fields and every id is unique',()=>{
  const a=app(),ids=Array.from(a.d.querySelectorAll('[id]'),el=>el.id);assert.equal(ids.length,new Set(ids).size);for(const label of a.d.querySelectorAll('label[for]'))assert.ok(a.d.getElementById(label.htmlFor));a.dom.window.close();
});
