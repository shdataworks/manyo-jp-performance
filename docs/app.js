const $=id=>document.getElementById(id), metrics=['cost','imp','click','view','3s-view','like','coment','share','save','shop now click','dpv','cart','purchase','sales'];
let rows=[],keywordRows=[],view='overview',page=0,sortKey='cost',sortDir=-1,tableRows=[],sourceLabel='Google Sheets 사본';
// Original sheet assumption: 2,700 JPY at 8.8563 KRW/JPY; not a live FX quote.
const META_ESTIMATE={purchaseRate:0.05,priceJpy:2700,krwPerJpy:8.8563};
function applyMetaEstimate(r){if(r.media==='meta'){r.purchase=r['shop now click']*META_ESTIMATE.purchaseRate;r.sales=Math.round(r.purchase*META_ESTIMATE.priceJpy*META_ESTIMATE.krwPerJpy);}return r;}
const nf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
const fmt=(x,p=false)=>x===null?'—':p?(x*100).toFixed(2)+'%':nf.format(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ratio=(a,b)=>b?a/b:null;
function dateOf(v){if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);let s=String(v??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);let d=new Date(s);return Number.isNaN(+d)?'':d.toISOString().slice(0,10)}
function week(d){let x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()-(x.getUTCDay()+6)%7);return x.toISOString().slice(0,10)}
function normalize(matrix){const heads=matrix[0].map(x=>String(x).replace(/^\uFEFF/,'').trim());for(const k of ['date','media','cost','imp','click','purchase','sales'])if(!heads.includes(k))throw Error('필수 열이 없습니다: '+k);return matrix.slice(1).filter(a=>a.some(v=>v!==null&&v!=='')).map(a=>{let r=Object.fromEntries(heads.map((h,i)=>[h,a[i]??'']));r.date=dateOf(r.date);if(!r.date)throw Error('날짜를 읽을 수 없는 행이 있습니다. yyyy-mm-dd 형식으로 저장하세요.');r.media=String(r.media).trim().toLowerCase();r.product=r.product||'미분류';for(const k of metrics){let v=String(r[k]??'').replace(/,/g,'').trim();r[k]=v===''?0:Number(v);if(!Number.isFinite(r[k]))throw Error(k+' 열에 숫자가 아닌 값이 있습니다.');}applyMetaEstimate(r);r.week=week(r.date);r.month=r.date.slice(0,7);return r;})}
function normalizeKeywords(matrix){const heads=matrix[0].map(x=>String(x).replace(/^\uFEFF/,'').trim());const firstHeads=heads.map((h,i)=>heads.indexOf(h)===i?h:null);for(const k of ['date','keyword','cost','imp','click','purchase','sales'])if(!heads.includes(k))throw Error('키워드 필수 열이 없습니다: '+k);return matrix.slice(1).filter(a=>a.some(v=>v!==null&&v!=='')).map(a=>{let r=Object.fromEntries(firstHeads.flatMap((h,i)=>h?[[h,a[i]??'']]:[]));r.date=dateOf(r.date);if(!r.date)throw Error('키워드 날짜를 읽을 수 없는 행이 있습니다.');r.media='amazon';r.keyword=String(r.keyword??'').trim();r.asin=String(r.asin||'미지정');r.product=r.asin;r.ad='';for(const k of metrics){let v=String(r[k]??'').replace(/,/g,'').trim();r[k]=v===''?0:Number(v);if(!Number.isFinite(r[k]))throw Error(k+' 열에 숫자가 아닌 값이 있습니다.');}r.week=week(r.date);r.month=r.date.slice(0,7);return r})}
function sum(rs){let s=Object.fromEntries(metrics.map(k=>[k,0]));rs.forEach(r=>metrics.forEach(k=>s[k]+=r[k]));s.ctr=ratio(s.click,s.imp);s.cpc=ratio(s.cost,s.click);s.cpm=s.imp?s.cost/s.imp*1000:null;s.cvr=ratio(s.purchase,s.click);s.roas=ratio(s.sales,s.cost);s.acos=ratio(s.cost,s.sales);s.vtr=ratio(s.view,s.imp);s.er=ratio(s.like+s.coment+s.share+s.save,s.imp);return s}
function group(rs,k){let map=new Map();rs.forEach(r=>{let key=r[k]||'미지정';if(!map.has(key))map.set(key,[]);map.get(key).push(r)});return [...map].map(([name,a])=>({name,...sum(a),estimate:a.some(x=>x.media==='meta'),mixed:new Set(a.map(x=>x.media)).size>1}))}
let keywordCampaignsExpanded=false;
// Build campaign children from the same filtered raw rows as each keyword total.
function groupKeywordCampaigns(rs){
  const buckets=new Map();
  for(const r of rs){const key=r.keyword||'미지정';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
  return group(rs,'keyword').map(r=>({...r,campaigns:group(buckets.get(r.name),'campaign')}));
}
function compareTableRows(a,b){return sortDir*(typeof a[sortKey]==='string'?a[sortKey].localeCompare(b[sortKey]):(a[sortKey]??-Infinity)-(b[sortKey]??-Infinity));}
function tableRowHtml(r,columns,child=false){
  const name=child?`<span class="campaign-branch" aria-hidden="true">↳</span><span class="campaign-name"><small>캠페인</small>${esc(r.name)}</span>`:esc(r.name);
  return `<tr class="${child?'keyword-campaign-row':r.campaigns&&keywordCampaignsExpanded?'keyword-total-row':''}">`+columns.map(([k])=>k==='name'?`<td class="${child?'campaign-label':''}">${name}${r.campaigns&&keywordCampaignsExpanded?`<small class="campaign-count">${r.campaigns.length}개 캠페인 합계</small>`:''}</td>`:`<td>${fmt(r[k],percentages.includes(k))}</td>`).join('')+'</tr>';
}
const BUDGET_KEY='manyo-monthly-budgets-v1';
const budgetToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let monthlyBudgets={},budgetReadError=false;
function validBudget(v){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;}
try{const saved=JSON.parse(localStorage.getItem(BUDGET_KEY)||'{}');for(const [month,values] of Object.entries(saved||{})){if(/^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&values&&typeof values==='object'){monthlyBudgets[month]={};for(const media of ['meta','amazon'])if(validBudget(values[media]))monthlyBudgets[month][media]=values[media];}}}catch{budgetReadError=true;}
function budgetStats(data,month,media,targets,today){
  const scope=media==='overview'?['meta','amazon']:[media];
  const relevant=data.filter(r=>r.date.slice(0,7)===month&&r.date<=today&&scope.includes(r.media));
  const spent=relevant.reduce((total,r)=>total+r.cost,0);
  const complete=scope.every(key=>validBudget(targets[key]));
  const target=complete?scope.reduce((total,key)=>total+targets[key],0):null;
  return {spent,target,rate:target>0?spent/target:null,count:relevant.length,latest:relevant.reduce((d,r)=>r.date>d?r.date:d,''),scope};
}
function renderBudget(){
  const panel=$('budgetPanel');panel.hidden=!['overview','meta','amazon'].includes(view);if(panel.hidden)return;
  const today=budgetToday(),month=$('budgetMonth').value||today.slice(0,7);$('budgetMonth').value=month;
  const s=budgetStats(rows,month,view,monthlyBudgets[month]||{},today),label=view==='overview'?'Meta + Amazon':view==='meta'?'Meta':'Amazon PPC';
  $('budgetScope').textContent=label+' · KRW';
  $('budgetSpent').textContent=fmt(s.spent)+'원';$('budgetTarget').textContent=s.target===null?'목표 미설정':fmt(s.target)+'원';
  $('budgetRate').textContent=s.rate===null?'—':fmt(s.rate,true);
  $('budgetFill').style.width=(s.rate===null?0:Math.min(100,Math.max(0,s.rate*100)))+'%';
  $('budgetPanel').classList.toggle('over-budget',s.target!==null&&s.spent>s.target);
  $('budgetProgress').setAttribute('aria-label',label+' 월 광고비 소진율');
  if(s.rate===null){$('budgetProgress').removeAttribute('aria-valuenow');$('budgetProgress').setAttribute('aria-valuetext',s.target===0?'목표 0원 · 소진율 계산 불가':'목표 미설정');}
  else{$('budgetProgress').setAttribute('aria-valuenow',String(Math.min(100,s.rate*100)));$('budgetProgress').setAttribute('aria-valuetext',fmt(s.rate,true));}
  $('budgetRemaining').textContent=s.target===null?(view==='overview'?'Meta와 Amazon 목표를 모두 입력하면 합산 소진율을 표시합니다.':'데이터 관리에서 이 월의 목표 광고비를 입력하세요.'):(s.spent>s.target?'목표 초과 '+fmt(s.spent-s.target)+'원':'남은 예산 '+fmt(s.target-s.spent)+'원');
  const dates=s.scope.map(media=>{const matched=rows.filter(r=>r.media===media&&r.date.slice(0,7)===month&&r.date<=today);return (media==='meta'?'Meta':'Amazon')+' '+(matched.length?latestDate(matched)+'까지':'데이터 없음');});
  $('budgetBasis').textContent=month+' 월 전체 · '+dates.join(' / ')+' · 상단 기간·상품 필터와 별도 집계';
}
function loadBudgetForm(){
  const month=$('budgetEditMonth').value,values=monthlyBudgets[month]||{};
  $('budgetMeta').value=values.meta??'';$('budgetAmazon').value=values.amazon??'';
  $('budgetSaveStatus').textContent=budgetReadError?'저장된 목표를 읽지 못했습니다. 저장 공간 설정을 확인해 주세요.':'';
}
function saveBudgetForm(e){
  e.preventDefault();const month=$('budgetEditMonth').value;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){$('budgetSaveStatus').textContent='목표를 적용할 월을 선택하세요.';return;}
  const values={};for(const [media,id] of [['meta','budgetMeta'],['amazon','budgetAmazon']]){const input=$(id).value.trim();if(input==='')continue;const value=Number(input);if(!validBudget(value)){$('budgetSaveStatus').textContent='목표 광고비는 0 이상의 정수(원)로 입력하세요.';return;}values[media]=value;}
  const next={...monthlyBudgets,[month]:values};
  try{localStorage.setItem(BUDGET_KEY,JSON.stringify(next));monthlyBudgets=next;budgetReadError=false;$('budgetMonth').value=month;renderBudget();$('budgetSaveStatus').textContent=month+' 목표 광고비를 이 브라우저에 저장했습니다.';}
  catch{$('budgetSaveStatus').textContent='저장하지 못했습니다. 브라우저 저장 공간 설정을 확인해 주세요.';}
}
$('budgetMonth').value=budgetToday().slice(0,7);$('budgetEditMonth').value=budgetToday().slice(0,7);loadBudgetForm();
$('budgetMonth').addEventListener('change',renderBudget);$('budgetEditMonth').addEventListener('change',loadBudgetForm);$('budgetForm').addEventListener('submit',saveBudgetForm);
$('budgetSettings').onclick=()=>{$('nav').querySelector('[data-view=source]').click();$('budgetEditMonth').value=$('budgetMonth').value;loadBudgetForm();$('budgetMeta').focus();};


const activeRows=()=>view==='keyword'?keywordRows:rows;
function fillOptions(id,key,label,data=activeRows()){$(id).innerHTML='<option value="">'+label+'</option>'+[...new Set(data.map(r=>r[key]).filter(Boolean))].sort().map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')}
function refreshFilters(){$('creativeGroupFilter').hidden=view!=='creative';$('creativeAdFilter').hidden=view!=='creative';$('creativeGroup').value='';$('creativeAd').value='';const kw=view==='keyword';$('campaignFilter').hidden=!(kw||view==='campaign'||view==='creative');fillOptions('campaign','campaign','전체 캠페인');$('keywordFilter').hidden=!kw;fillOptions('keyword','keyword','전체 키워드',keywordRows);$('typeFilter').hidden=kw;$('group').hidden=false;$('search').placeholder=kw?'키워드 검색':'이름 검색';for(const option of $('group').options){option.disabled=kw&&option.value!=='keyword';option.hidden=option.disabled;}$('mediaFilter').hidden=kw;$('productLabel').textContent=kw?'ASIN':'상품';fillOptions('media','media','전체 매체');fillOptions('product','product',kw?'전체 ASIN':'전체 상품');fillOptions('type','ad type','전체 유형')}
let datePreset='month';
function presetRange(preset,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 const d=new Date(today+'T00:00:00Z'),iso=d=>d.toISOString().slice(0,10),shift=n=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return iso(x)};
 if(preset==='yesterday')return [shift(-1),shift(-1)];
 if(preset==='week'){const mondayOffset=(d.getUTCDay()+6)%7;return [shift(-mondayOffset-7),shift(-mondayOffset-1)]}
 if(preset==='lastMonth')return [iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1))),iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0)))];
 if(preset==='30days')return [shift(-29),today];
 return [today.slice(0,7)+'-01',today];
}
function syncDateButtons(){document.querySelectorAll('[data-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.period===datePreset)));$('reset').setAttribute('aria-pressed',String(datePreset==='all'))}
function applyDatePreset(preset){datePreset=preset;const dates=preset==='all'?activeRows().map(r=>r.date).sort():[];const range=preset==='all'?[dates[0]||'',dates.at(-1)||'']:presetRange(preset);[$('start').value,$('end').value]=range;syncDateButtons()}
function initialize(){applyDatePreset('month');refreshFilters();page=0;render()}

function selected(ignoreDates=false){return activeRows().filter(r=>(ignoreDates||!$('start').value||r.date>=$('start').value)&&(ignoreDates||!$('end').value||r.date<=$('end').value)&&(!$('media').value||r.media===$('media').value)&&(!$('product').value||r.product===$('product').value)&&(!$('type').value||r['ad type']===$('type').value)&&(!['keyword','campaign','creative'].includes(view)||!$('campaign').value||r.campaign===$('campaign').value)&&(view!=='keyword'||!$('keyword').value||r.keyword===$('keyword').value)&&(!(view==='amazon'||view==='meta')||r.media===view)&&(view!=='creative'||(r.ad&&(!$('creativeGroup').value||r.adset===$('creativeGroup').value)&&(!$('creativeAd').value||r.ad===$('creativeAd').value))))}
function render(){if(view==='compare'){if(typeof renderComparison==='function')renderComparison();return;}renderBudget();syncCreativeFilters();syncKeywordPicker();if(view==='source')return;for(const id of ['performanceNotice','kpis','trendPanel','breakdownPanels'])$(id).hidden=false;let rs=selected(),s=sum(rs);const basis=view==='meta'?'Shop now 클릭 × 5% 추정':view==='keyword'?'키워드 광고 보고값':view==='amazon'?'Amazon 광고 보고값':'통합 성과',currency=view==='keyword'?'JPY':'KRW';const cards=[['광고비',fmt(s.cost),currency],['노출',fmt(s.imp),'회'],['클릭',fmt(s.click),'CTR '+fmt(s.ctr,true)],['구매',fmt(s.purchase),basis],['매출',fmt(s.sales),currency+' · '+basis],[view==='meta'?'추정 ROAS':'ROAS',fmt(s.roas,true),view==='meta'?'추정 매출 ÷ 광고비':'매출 ÷ 광고비']];$('kpis').innerHTML=cards.map(c=>`<div class="kpi"><div class="label">${c[0]}</div><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('');$('period').textContent=`${$('start').value} — ${$('end').value} · ${nf.format(rs.length)}개 원본 행`;
$('amazonCampaignPanel').hidden=view!=='amazon';drawChart(rs);if(view==='amazon')drawCampaignChart(rs);bars('channels',group(rs,'media'),true);bars('products',group(rs,'product').sort((a,b)=>b.cost-a.cost).slice(0,5));let k=view==='keyword'?'keyword':$('group').value;tableRows=(view==='keyword'?groupKeywordCampaigns(rs):group(rs,k)).filter(r=>r.name.toLowerCase().includes($('search').value.toLowerCase()));drawTable();drawDailyTable(rs)}
function bars(id,data,channel=false){let total=data.reduce((s,r)=>s+r.cost,0),symbol=view==='keyword'?'¥':'₩';$(id).innerHTML=data.length?data.map((r,i)=>`<div class="barrow"><div class="barlabel"><span>${esc(r.name)}</span><strong>${symbol}${fmt(r.cost)}</strong></div><div class="track"><div class="fill" style="width:${total?r.cost/total*100:0}%;background:${i===1?'#8dabc9':'#3568a8'}"></div></div>${channel?`<div class="mini">클릭 ${fmt(r.click)} · CPC ${symbol}${fmt(r.cpc)} · ROAS ${fmt(r.roas,true)}</div>`:''}</div>`).join(''):'<div class="empty">해당 데이터가 없습니다.</div>'}
function niceAxisMax(peak,percent=false){
  if(!Number.isFinite(peak)||peak<=0)return percent?0.05:5;
  const displayPeak=peak*(percent?100:1),target=displayPeak*1.05/5;
  const magnitude=10**Math.floor(Math.log10(target));
  const step=[1,2,3,5,10].find(n=>n*magnitude>=target)*magnitude;
  return step*5/(percent?100:1);
}
function axisNumber(value){return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:8}).format(Number(value.toPrecision(10)))}
function drawChart(rs){
  const barKey=$('trendMetric').value,lineKey=$('lineMetric').value;
  const barLabel=$('trendMetric').selectedOptions[0].text,lineLabel=$('lineMetric').selectedOptions[0].text;
  const a=group(rs,$('grain').value).sort((x,y)=>x.name.localeCompare(y.name));
  if(!a.length){$('chart').innerHTML='<div class="empty">선택한 조건에 해당하는 추이 데이터가 없습니다.</div>';return}
  const W=1100,H=280,L=90,R=90,T=34,B=35,iw=W-L-R,ih=H-T-B;
  const maxFor=key=>{const peak=Math.max(0,...a.map(r=>r[key]??0));return niceAxisMax(peak,['roas','ctr'].includes(key))};
  const barMax=maxFor(barKey),lineMax=maxFor(lineKey),step=iw/a.length,bw=Math.min(40,step*.65);
  const xx=i=>L+(i+.5)*step,yy=(v,max)=>T+ih-v/max*ih;
  const pct=key=>['roas','ctr'].includes(key);
  const axis=(v,key)=>pct(key)?axisNumber(v*100)+'%':Math.abs(v)>=100000000?axisNumber(v/100000000)+'억':Math.abs(v)>=10000?axisNumber(v/10000)+'만':axisNumber(v);
  const value=(v,key)=>fmt(v,pct(key))+(v!==null&&['cost','sales','cpc'].includes(key)?(view==='keyword'?'엔':'원'):'');
  const grid=Array.from({length:6},(_,i)=>{const part=1-i/5,y=T+i*ih/5;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#e8edf4"/><text x="${L-10}" y="${y+4}" text-anchor="end" fill="#527cad" font-size="12">${axis(barMax*part,barKey)}</text><text x="${W-R+10}" y="${y+4}" fill="#b96a24" font-size="12">${axis(lineMax*part,lineKey)}</text>`}).join('');
  const bars=a.map((r,i)=>r[barKey]==null?'':`<rect x="${xx(i)-bw/2}" y="${yy(r[barKey],barMax)}" width="${bw}" height="${Math.max(0,r[barKey]/barMax*ih)}" rx="2" fill="#8cafd5"><title>${esc(r.name)} · ${esc(barLabel)}: ${value(r[barKey],barKey)}</title></rect>`).join('');
  let connected=false;
  const path=a.map((r,i)=>{if(r[lineKey]==null){connected=false;return ''}const segment=`${connected?'L':'M'} ${xx(i)} ${yy(r[lineKey],lineMax)}`;connected=true;return segment}).join(' ');
  const dots=a.map((r,i)=>r[lineKey]==null?'':`<circle cx="${xx(i)}" cy="${yy(r[lineKey],lineMax)}" r="${a.length>70?2:3.5}" fill="#cb792e"><title>${esc(r.name)} · ${esc(lineLabel)}: ${value(r[lineKey],lineKey)}</title></circle>`).join('');
  const labels=a.map((r,i)=>i===0||i===a.length-1||i%Math.max(1,Math.ceil(a.length/7))===0?`<text x="${xx(i)}" y="${H-10}" text-anchor="middle" fill="#7b899c" font-size="12">${esc($('grain').value==='month'?r.name:r.name.slice(5))}</text>`:'').join('');
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="막대 ${esc(barLabel)} · 꺾은선 ${esc(lineLabel)} 복합 추이 차트">${grid}${bars}<path d="${path}" fill="none" stroke="#cb792e" stroke-width="2.5"/>${dots}${labels}<line class="chart-guide" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="#536f93" stroke-dasharray="4 4" visibility="hidden"/>${a.map((r,i)=>`<rect class="chart-hit" data-index="${i}" x="${L+i*step}" y="${T}" width="${step}" height="${ih}" fill="transparent" tabindex="0" aria-label="${esc(r.name)} · ${esc(barLabel)} ${esc(value(r[barKey],barKey))} · ${esc(lineLabel)} ${esc(value(r[lineKey],lineKey))}"/>`).join('')}</svg><div class="chart-tooltip" role="tooltip" hidden></div>`;
  const chart=$('chart'),tip=chart.querySelector('.chart-tooltip'),guide=chart.querySelector('.chart-guide'),svg=chart.querySelector('svg');
  const hide=()=>{tip.hidden=true;guide.setAttribute('visibility','hidden')};
  const show=(i)=>{
    const r=a[i];
    tip.innerHTML=`<strong>${esc(r.name)}</strong><div><span class="tooltip-bar">● ${esc(barLabel)}</span><b>${esc(value(r[barKey],barKey))}</b></div><div><span class="tooltip-line">● ${esc(lineLabel)}</span><b>${esc(value(r[lineKey],lineKey))}</b></div>`;
    tip.hidden=false;guide.setAttribute('x1',xx(i));guide.setAttribute('x2',xx(i));guide.setAttribute('visibility','visible');
    const box=chart.getBoundingClientRect(),plot=svg.getBoundingClientRect(),x=plot.left-box.left+xx(i)/W*plot.width;
    const left=x+16+tip.offsetWidth>box.width?x-tip.offsetWidth-16:x+16;
    tip.style.left=Math.max(4,Math.min(left,box.width-tip.offsetWidth-4))+'px';tip.style.top=(plot.top-box.top+T/H*plot.height+8)+'px';
  };
  chart.querySelectorAll('.chart-hit').forEach(hit=>{const i=Number(hit.dataset.index);hit.onpointerenter=()=>show(i);hit.onpointerdown=()=>show(i);hit.onfocus=()=>show(i);hit.onblur=hide;hit.onkeydown=e=>{if(e.key==='Escape'){hide();hit.blur()}}});
  svg.onpointerleave=hide;

}
function drawCampaignChart(rs){const m=$('campaignMetric').value,pct=m==='roas',data=group(rs,'campaign').filter(r=>r.name&&r.name!=='미지정').sort((a,b)=>(b[m]??-Infinity)-(a[m]??-Infinity)).slice(0,10),max=Math.max(...data.map(r=>r[m]||0),1);$('campaignChart').innerHTML=data.length?data.map(r=>`<div class="barrow"><div class="barlabel"><span>${esc(r.name)}</span><strong>${pct?fmt(r[m],true):m==='cost'||m==='sales'?'₩'+fmt(r[m]):fmt(r[m])}</strong></div><div class="track"><div class="fill" style="width:${Math.max(1,(r[m]||0)/max*100)}%"></div></div><div class="mini">광고비 ₩${fmt(r.cost)} · 구매 ${fmt(r.purchase)} · 매출 ₩${fmt(r.sales)} · ROAS ${fmt(r.roas,true)}</div></div>`).join(''):'<div class="empty">해당 캠페인 데이터가 없습니다.</div>'}
const columns=[['name','분석 항목'],['cost','광고비 (원)'],['imp','노출'],['click','클릭'],['ctr','CTR'],['cpc','CPC (원)'],['cpm','CPM (원)'],['view','조회'],['vtr','VTR'],['3s-view','3초 조회'],['like','좋아요'],['coment','댓글'],['share','공유'],['save','저장'],['er','ER'],['shop now click','Shop now'],['dpv','DPV'],['cart','장바구니'],['purchase','구매*'],['sales','매출* (원)'],['cvr','CVR*'],['roas','ROAS*'],['acos','ACOS*']], percentages=['ctr','vtr','er','cvr','roas','acos'];
const keywordColumns=['name','cost','imp','click','ctr','cpm','cpc','view','dpv','cart','purchase','sales','cvr','roas','acos'].map(key=>{const [,label]=columns.find(([k])=>k===key);return [key,key==='name'?'키워드':label.replaceAll('*','').replaceAll('(원)','(엔)')]});
const activeColumns=()=>view==='keyword'?keywordColumns:columns;
function drawTable(){const columns=activeColumns();$('toggleCampaigns').hidden=view!=='keyword';$('toggleCampaigns').textContent=keywordCampaignsExpanded?'캠페인 전체 접기':'캠페인 전체 펼치기';$('toggleCampaigns').setAttribute('aria-expanded',String(keywordCampaignsExpanded));$('tableTitle').textContent=view==='keyword'?'키워드 성과 상세':'성과 상세';tableRows.sort(compareTableRows);tableRows.forEach(r=>r.campaigns?.sort(compareTableRows));let pages=Math.max(1,Math.ceil(tableRows.length/15));page=Math.min(page,pages-1);$('table').innerHTML='<thead><tr>'+columns.map(([k,l])=>`<th><button data-sort="${k}" style="border:0;background:none;color:inherit;padding:0;white-space:nowrap">${l}${sortKey===k?(sortDir===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr></thead><tbody>'+tableRows.slice(page*15,page*15+15).map(r=>tableRowHtml(r,columns)+(keywordCampaignsExpanded?r.campaigns||[]:[]).map(c=>tableRowHtml(c,columns,true)).join('')).join('')+'</tbody>';$('count').textContent=view==='keyword'?`${tableRows.length}개 키워드 · ${keywordCampaignsExpanded?'하위 행은 캠페인별 상세':'키워드 합계'} · 금액 단위 JPY`:`${tableRows.length}개 항목 · * Meta 구매·매출·관련 비율은 추정`;$('page').textContent=`${page+1} / ${pages}`;$('prev').disabled=page===0;$('next').disabled=page===pages-1;$('table').querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{let k=b.dataset.sort;sortDir=sortKey===k?-sortDir:-1;sortKey=k;drawTable()})}
$('toggleCampaigns').onclick=()=>{keywordCampaignsExpanded=!keywordCampaignsExpanded;drawTable()};
document.querySelectorAll('#filters input:not(#keywordSearch),#filters select,#group,#search,#grain,#trendMetric,#lineMetric,#campaignMetric').forEach(el=>el.addEventListener(el.id==='search'?'input':'change',()=>{if(el.id==='start'||el.id==='end'){datePreset=null;syncDateButtons()}if(el.id==='group'&&['keyword','asin'].includes(el.value)&&view!=='keyword'){const key=el.value;$('nav').querySelector('[data-view=keyword]').click();$('group').value=key;}page=0;render()}));$('reset').onclick=()=>{applyDatePreset('all');page=0;render()};document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{applyDatePreset(b.dataset.period);page=0;render()});$('prev').onclick=()=>{page--;drawTable()};$('next').onclick=()=>{page++;drawTable()};
const titles={compare:'광고 성과 기간 비교',overview:'광고 성과 한눈에 보기',amazon:'Amazon PPC 성과',meta:'Meta 광고 성과',keyword:'키워드별 성과 분석',campaign:'캠페인별 성과 분석',creative:'소재별 성과 분석',source:'데이터 관리'};
$('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$('title').textContent=titles[view];$('nav').querySelectorAll('button').forEach(n=>n.classList.toggle('active',n===b));$('comparison').hidden=view!=='compare';$('source').hidden=view!=='source';$('dashboard').hidden=['source','compare'].includes(view);$('filters').hidden=['source','compare'].includes(view);$('export').hidden=['source','compare'].includes(view);$('media').value='';$('product').value='';$('type').value='';$('group').value=view==='keyword'?'keyword':view==='campaign'?'campaign':view==='creative'?'ad':view==='amazon'?'ad type':view==='meta'?'adset':'media';if(view!=='source'){refreshFilters();if(datePreset)applyDatePreset(datePreset);}page=0;render()});
function csvParse(text){let all=[],row=[],s='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++}else q=!q}else if(c===','&&!q){row.push(s);s=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(x=>x!==''))all.push(row);row=[];s=''}else s+=c}if(q)throw Error('CSV의 따옴표가 닫히지 않았습니다.');row.push(s);if(row.some(x=>x!==''))all.push(row);return all}
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;let next=normalize(csvParse(await f.text()));if(!next.length)throw Error('데이터 행이 없습니다.');rows=next;sourceLabel=f.name;$('status').textContent=`${sourceLabel} · ${nf.format(rows.length)}행 · 브라우저 임시 적용`;$('importStatus').textContent=`${nf.format(rows.length)}행을 적용했습니다. 왼쪽 전체 요약에서 확인하세요.`;initialize()}catch(err){$('importStatus').textContent='불러오기 실패: '+err.message}};
$('export').onclick=()=>{const columns=activeColumns();const encode=v=>'"'+String(v??'').replace(/"/g,'""')+'"';let csv='\uFEFF'+[columns.map(x=>x[1]).concat('추정치 포함'),...tableRows.map(r=>columns.map(([k])=>r[k]).concat(r.estimate?'예':'아니오'))].map(r=>r.map(encode).join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=u;a.download='JP_performance_'+$('group').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function latestDate(rs){return rs.reduce((latest,r)=>r.date>latest?r.date:latest,'')}
function dataStatus(label){return `Google Sheets · 성과 ${nf.format(rows.length)}행 (${latestDate(rows)}까지) · 키워드 ${nf.format(keywordRows.length)}행 (${latestDate(keywordRows)}까지) · ${label}`}
// Load each dataset independently; a failed keyword request must not discard performance data.
const companyFeed = 'https://script.google.com/macros/s/AKfycbyyQaOb05tdY1ZD5cdnjMNTCnCCxwjt7fzRcmXkEjakZzuog6m2Syo72SAKf3tChtDrcA/exec';
const dataSources = [
  {id:'performance',label:'성과',file:'data.json',normalize,read:()=>rows,write:value=>{rows=value}},
  {id:'keywords',label:'키워드',file:'keywords.json',normalize:normalizeKeywords,read:()=>keywordRows,write:value=>{keywordRows=value}}
];
// Keep the last successful response across reloads without changing the source sheet.
const snapshotSavedAt=Date.parse('2026-09-30T06:18:17.068Z');
function datasetCache(mode,id,value){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){resolve(null);return;}
    const request=indexedDB.open('manyo-jp-datasets',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('datasets');
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>resolve(null);
    request.onsuccess=()=>{
      const db=request.result;
      const tx=db.transaction('datasets',mode);
      const store=tx.objectStore('datasets');
      const operation=mode==='readonly'?store.get(id):store.put(value,id);
      tx.oncomplete=()=>{const result=operation.result;db.close();resolve(result)};
      tx.onerror=()=>{db.close();reject(tx.error)};
      tx.onabort=()=>{db.close();reject(tx.error||Error('저장 취소'))};
    };
  });
}
function saveDatasetCache(id,matrix){return datasetCache('readwrite',id,{matrix,savedAt:Date.now()})}
const sourceStates = Object.fromEntries(dataSources.map(source=>[source.id,{message:'저장본 확인 중',error:'',history:''}]));
function updateDataStatus(){
  $('status').textContent='v2026.10.06-3 · Google Sheets · '+dataSources.map(source=>{
    const data=source.read(),state=sourceStates[source.id];
    return `${source.label} ${nf.format(data.length)}행 (${latestDate(data)||'날짜 없음'}까지) · ${state.message}`;
  }).join(' / ');
  const failures=dataSources.filter(source=>sourceStates[source.id].error);
  $('refreshStatus').dataset.error=String(failures.length>0);
  $('refreshStatus').textContent=failures.map(source=>{
    const state=sourceStates[source.id];
    return source.read().length?`${source.label} 실시간 갱신 미완료 (${state.error}). ${latestDate(source.read())}까지 확인된 데이터를 표시합니다.`:`${source.label} 불러오기 실패: ${state.error}`;
  }).join(' ');
  const history=dataSources.map(source=>sourceStates[source.id].history).filter(Boolean).join(' · ');
  if(history)$('refreshStatus').textContent+=($('refreshStatus').textContent?' ':'')+'원본에 없는 기간: '+history;
}
async function fetchDataset(url,onRetry=()=>{},attempts=3){
  for(let attempt=0;attempt<attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    let retry=false;
    try{
      // A unique request URL also avoids reusing a stale Apps Script redirect.
      const requestUrl=new URL(url,location.href);
      requestUrl.searchParams.set('_',Date.now()+'-'+attempt);
      const response=await fetch(requestUrl.href,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if(!response.ok){
        const error=Error('데이터 연결 응답 오류: '+response.status);
        error.retryable=[404,408,429].includes(response.status)||response.status>=500;
        throw error;
      }
      const result=await response.json();
      if(result.error||!Array.isArray(result.rows)||!Array.isArray(result.rows[0])){
        const error=Error('데이터 응답 형식을 확인해 주세요.');
        error.retryable=false;
        throw error;
      }
      return result.rows;
    }catch(error){
      retry=attempt+1<attempts&&error.retryable!==false;
      if(!retry)throw Error(error.name==='AbortError'?'데이터 조회 시간이 초과되었습니다.':error.message);
    }finally{clearTimeout(timer)}
    if(retry){
      onRetry(attempt+2,attempts);
      await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
    }
  }
}
function normalizeDataset(source,matrix){
  const data=source.normalize(matrix);
  if(!data.length)throw Error('시트에 데이터 행이 없어 기존 데이터를 유지했습니다.');
  return data;
}
// Each response is authoritative for the media/month partitions it contains.
// Absent months are retained as history, not appended to overlapping partitions.
function historyPartition(source,row){return (source.id==='performance'?row.media+'|':'')+row.month}
function reconcileHistory(source,previous,incoming){
  const supplied=new Set(incoming.map(row=>historyPartition(source,row)));
  const retained=previous.filter(row=>!supplied.has(historyPartition(source,row)));
  return {rows:[...retained,...incoming],retained};
}
function cacheMatrix(records,headers){
  const columns=[...new Set(headers.map(value=>String(value).replace(/^\uFEFF/,'').trim()))];
  return [columns,...records.map(row=>columns.map(key=>row[key]??''))];
}
function historyNote(source,retained){
  const groups=new Map();
  for(const row of retained){const key=historyPartition(source,row);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,data])=>{
    const row=data[0],label=source.id==='performance'?(row.media==='meta'?'Meta':row.media==='amazon'?'Amazon':row.media):'키워드';
    return `${label} ${row.month} 보관 이력 ${nf.format(data.length)}행 (${latestDate(data)}까지)`;
  }).join(' · ');
}
function renderUpdatedData(){
  // Read controls at completion time, so navigation and filters changed while loading survive.
  const ids=['start','end','media','product','type','campaign','keyword','creativeGroup','creativeAd'];
  const filters=Object.fromEntries(ids.map(id=>[id,$(id).value]));
  refreshFilters();
  for(const id of ids){
    if(['start','end'].includes(id)||[...$(id).options].some(option=>option.value===filters[id]))$(id).value=filters[id];
  }
  if(datePreset)applyDatePreset(datePreset);
  page=0;render();
}
async function refreshDataset(source){
  const state=sourceStates[source.id];
  state.message='원본 조회 중';state.error='';updateDataStatus();
  try{
    const url=companyFeed+'?'+new URLSearchParams({dataset:source.id});
    const matrix=await fetchDataset(url,(attempt,total)=>{
      state.message=`연결 재시도 ${attempt}/${total}`;updateDataStatus();
    });
    const next=normalizeDataset(source,matrix);
    if(source.read().length&&latestDate(next)<latestDate(source.read()))throw Error('원본 응답의 마지막 날짜가 저장된 데이터보다 이전이어서 최신 저장본을 유지합니다.');
    const merged=reconcileHistory(source,source.read(),next);
    source.write(merged.rows);
    state.history=historyNote(source,merged.retained);
    saveDatasetCache(source.id,cacheMatrix(merged.rows,matrix[0])).catch(()=>{});
    sourceLabel='Google Sheets';
    state.message='원본 조회 '+new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})+' KST';
    renderUpdatedData();
  }catch(error){
    state.error=error.message;state.message=source.read().length?'실시간 연결 지연 · 확인된 데이터 표시':'불러오기 실패';
  }
  updateDataStatus();
}
$('refresh').onclick=async()=>{
  if($('refresh').disabled)return;
  $('refresh').disabled=true;$('refreshSource').disabled=true;
  $('refresh').textContent='↻ 불러오는 중…';$('refreshSource').textContent='↻ 불러오는 중…';
  try{
    await Promise.allSettled(dataSources.map(refreshDataset));
    updateDataStatus();
    if(dataSources.every(source=>!sourceStates[source.id].error)){
      const history=dataSources.map(source=>sourceStates[source.id].history).filter(Boolean).join(' · ');
      $('refreshStatus').textContent=history?'최신 응답을 반영했습니다. 원본에 없는 기간은 보관 이력으로 유지합니다: '+history:'최신 성과·키워드 데이터를 적용했습니다.';
    }
  }finally{
    $('refresh').disabled=false;$('refreshSource').disabled=false;
    $('refresh').textContent='↻ 데이터 새로고침';$('refreshSource').textContent='↻ 지금 데이터 새로 가져오기';
  }
};
$('refreshSource').onclick=()=> $('refresh').onclick();
async function loadStoredData(){
  await Promise.allSettled(dataSources.map(async source=>{
    const state=sourceStates[source.id];
    let cached=null;
    try{
      cached=await datasetCache('readonly',source.id);
      if(cached){source.write(normalizeDataset(source,cached.matrix));state.message='브라우저 저장본 · 원본 확인 대기';updateDataStatus();renderUpdatedData();}
    }catch(error){cached=null}
    try{
      const matrix=await fetchDataset(source.file,()=>{},2);
      const snapshot=normalizeDataset(source,matrix);
      // A newer cache may still be missing an entire historical media/month.
      // Always reconcile it with the deployment snapshot, even if its latest date is newer.
      if(!cached){source.write(snapshot);state.message='배포 저장본 · 원본 확인 대기';}
      else{
        const snapshotPreferred=snapshotSavedAt>cached.savedAt;
        const merged=snapshotPreferred?reconcileHistory(source,source.read(),snapshot):reconcileHistory(source,snapshot,source.read());
        source.write(merged.rows);state.history=historyNote(source,merged.retained);
        state.message='브라우저·배포 이력 복원 · 원본 확인 대기';
        await saveDatasetCache(source.id,cacheMatrix(merged.rows,matrix[0])).catch(()=>{});
      }
    }catch(error){if(!source.read().length)state.message='저장본 없음 · 원본 확인 대기'}
  }));
  updateDataStatus();initialize();
  $('refresh').disabled=false;$('refreshSource').disabled=false;
  await $('refresh').onclick();
}
loadStoredData();

function syncKeywordPicker(){
  $('keywordToggle').textContent=$('keyword').selectedOptions[0]?.text||'전체 키워드';
  closeKeywordPicker();
}
function closeKeywordPicker(){
  $('keywordPopup').hidden=true;
  $('keywordToggle').setAttribute('aria-expanded','false');
}
function drawKeywordOptions(){
  const query=$('keywordSearch').value.trim().toLocaleLowerCase();
  const options=[...$('keyword').options].filter(o=>!o.value||o.text.toLocaleLowerCase().includes(query));
  $('keywordOptions').innerHTML=options.map(o=>`<button type="button" class="keyword-option" data-value="${esc(o.value)}" aria-pressed="${o.value===$('keyword').value}">${esc(o.text)}</button>`).join('');
  const count=options.filter(o=>o.value).length;
  $('keywordResultCount').textContent=count?`${nf.format(count)}개 키워드`:'검색 결과가 없습니다.';
}
$('keywordToggle').onclick=()=>{
  if(!$('keywordPopup').hidden){closeKeywordPicker();return}
  $('keywordSearch').value='';drawKeywordOptions();$('keywordPopup').hidden=false;
  $('keywordToggle').setAttribute('aria-expanded','true');$('keywordSearch').focus();
};
$('keywordSearch').addEventListener('input',drawKeywordOptions);
$('keywordOptions').onclick=e=>{
  const option=e.target.closest('[data-value]');if(!option)return;
  $('keyword').value=option.dataset.value;
  $('keyword').dispatchEvent(new Event('change',{bubbles:true}));
  closeKeywordPicker();$('keywordToggle').focus();
};
$('keywordFilter').addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(e.key==='Escape'){closeKeywordPicker();$('keywordToggle').focus();e.preventDefault()}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    const options=[...$('keywordOptions').querySelectorAll('button')];
    if($('keywordPopup').hidden||!options.length)return;
    const index=options.indexOf(document.activeElement);
    options[(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();e.preventDefault();
  }
});
document.addEventListener('click',e=>{if(!$('keywordFilter').contains(e.target))closeKeywordPicker()});
$('keywordFilter').addEventListener('focusout',e=>{if(!$('keywordFilter').contains(e.relatedTarget))closeKeywordPicker()});

function drawDailyTable(rs=selected()){
  const picker=$('dailyMonth'), previous=picker.value;
  const months=[...new Set(rs.map(r=>r.date.slice(0,7)))].sort().reverse();
  picker.innerHTML=(months.length?months.map(m=>`<option value="${esc(m)}">${m.slice(0,4)}년 ${Number(m.slice(5))}월</option>`).join('') :'<option value="">데이터 없음</option>')+'<option value="30days">최근 30일</option>';
  picker.disabled=false;
  picker.value=previous==='30days'||months.includes(previous)?previous:(months[0]||'');
  const recent=picker.value==='30days',[from,to]=presetRange('30days');
  const filtered=recent?selected(true).filter(r=>r.date>=from&&r.date<=to):rs.filter(r=>r.date.slice(0,7)===picker.value);
  const days=group(filtered,'date').sort((a,b)=>a.name.localeCompare(b.name));
  const cols=activeColumns().map(([k,label])=>[k,k==='name'?'일자':label]);
  const cells=r=>cols.map(([k])=>k==='name'?`<th scope="row">${esc(r.name)}</th>`:`<td>${fmt(r[k],percentages.includes(k))}</td>`).join('');
  $('dailyTable').innerHTML='<thead><tr>'+cols.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')+'</tr></thead><tbody>'+(days.length?days.map(r=>'<tr>'+cells(r)+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty">선택한 조건에 해당하는 일자별 데이터가 없습니다.</td></tr>` )+'</tbody>'+(days.length?'<tfoot><tr>'+cells({name:recent?'최근 30일 합계':'선택 월 합계',...sum(filtered)})+'</tr></tfoot>':'');
  $('dailySummary').textContent=days.length?`${recent?from+' — '+to+' · 최근 30일 (오늘 포함)':picker.value} · ${days.length}일 · 비율 지표는 조회 기간 합계 기준으로 재계산`:'';
}
$('dailyMonth').addEventListener('change',()=>drawDailyTable());

function syncCreativeFilters(){
  if(view!=='creative')return;
  const base=rows.filter(r=>r.ad&&(!$('start').value||r.date>=$('start').value)&&(!$('end').value||r.date<=$('end').value)&&(!$('media').value||r.media===$('media').value)&&(!$('product').value||r.product===$('product').value)&&(!$('type').value||r['ad type']===$('type').value));
  const update=(id,key,label,data)=>{
    const old=$(id).value;fillOptions(id,key,label,data);
    if([...$(id).options].some(o=>o.value===old))$(id).value=old;
  };
  update('campaign','campaign','전체 캠페인',base);
  const campaigns=base.filter(r=>!$('campaign').value||r.campaign===$('campaign').value);
  update('creativeGroup','adset','전체 그룹',campaigns);
  update('creativeAd','ad','전체 소재',campaigns.filter(r=>!$('creativeGroup').value||r.adset===$('creativeGroup').value));
}
