const $=id=>document.getElementById(id), metrics=['cost','imp','click','view','3s-view','like','coment','share','save','shop now click','dpv','cart','purchase','sales'];
let rows=[],keywordRows=[],view='overview',page=0,sortKey='cost',sortDir=-1,tableRows=[],sourceLabel='Google Sheets 사본';
const nf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
const fmt=(x,p=false)=>x===null?'—':p?(x*100).toFixed(2)+'%':nf.format(x);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ratio=(a,b)=>b?a/b:null;
function dateOf(v){if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);let s=String(v??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);let d=new Date(s);return Number.isNaN(+d)?'':d.toISOString().slice(0,10)}
function week(d){let x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()-(x.getUTCDay()+6)%7);return x.toISOString().slice(0,10)}
function normalize(matrix){const heads=matrix[0].map(x=>String(x).replace(/^\uFEFF/,'').trim());for(const k of ['date','media','cost','imp','click','purchase','sales'])if(!heads.includes(k))throw Error('필수 열이 없습니다: '+k);return matrix.slice(1).filter(a=>a.some(v=>v!==null&&v!=='')).map(a=>{let r=Object.fromEntries(heads.map((h,i)=>[h,a[i]??'']));r.date=dateOf(r.date);if(!r.date)throw Error('날짜를 읽을 수 없는 행이 있습니다. yyyy-mm-dd 형식으로 저장하세요.');r.media=String(r.media).toLowerCase();r.product=r.product||'미분류';for(const k of metrics){let v=String(r[k]??'').replace(/,/g,'').trim();r[k]=v===''?0:Number(v);if(!Number.isFinite(r[k]))throw Error(k+' 열에 숫자가 아닌 값이 있습니다.');}r.week=week(r.date);r.month=r.date.slice(0,7);return r;})}
function normalizeKeywords(matrix){const heads=matrix[0].map(x=>String(x).replace(/^\uFEFF/,'').trim());const firstHeads=heads.map((h,i)=>heads.indexOf(h)===i?h:null);for(const k of ['date','keyword','cost','imp','click','purchase','sales'])if(!heads.includes(k))throw Error('키워드 필수 열이 없습니다: '+k);return matrix.slice(1).filter(a=>a.some(v=>v!==null&&v!=='')).map(a=>{let r=Object.fromEntries(firstHeads.flatMap((h,i)=>h?[[h,a[i]??'']]:[]));r.date=dateOf(r.date);if(!r.date)throw Error('키워드 날짜를 읽을 수 없는 행이 있습니다.');r.media='amazon';r.keyword=String(r.keyword??'').trim();r.asin=String(r.asin||'미지정');r.product=r.asin;r.ad='';for(const k of metrics){let v=String(r[k]??'').replace(/,/g,'').trim();r[k]=v===''?0:Number(v);if(!Number.isFinite(r[k]))throw Error(k+' 열에 숫자가 아닌 값이 있습니다.');}r.week=week(r.date);r.month=r.date.slice(0,7);return r})}
function sum(rs){let s=Object.fromEntries(metrics.map(k=>[k,0]));rs.forEach(r=>metrics.forEach(k=>s[k]+=r[k]));s.ctr=ratio(s.click,s.imp);s.cpc=ratio(s.cost,s.click);s.cpm=s.imp?s.cost/s.imp*1000:null;s.cvr=ratio(s.purchase,s.click);s.roas=ratio(s.sales,s.cost);s.acos=ratio(s.cost,s.sales);s.vtr=ratio(s.view,s.imp);s.er=ratio(s.like+s.coment+s.share+s.save,s.imp);return s}
function group(rs,k){let map=new Map();rs.forEach(r=>{let key=r[k]||'미지정';if(!map.has(key))map.set(key,[]);map.get(key).push(r)});return [...map].map(([name,a])=>({name,...sum(a),estimate:a.some(x=>x.media==='meta'),mixed:new Set(a.map(x=>x.media)).size>1}))}
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

function selected(){return activeRows().filter(r=>(!$('start').value||r.date>=$('start').value)&&(!$('end').value||r.date<=$('end').value)&&(!$('media').value||r.media===$('media').value)&&(!$('product').value||r.product===$('product').value)&&(!$('type').value||r['ad type']===$('type').value)&&(!['keyword','campaign','creative'].includes(view)||!$('campaign').value||r.campaign===$('campaign').value)&&(view!=='keyword'||!$('keyword').value||r.keyword===$('keyword').value)&&(!(view==='amazon'||view==='meta')||r.media===view)&&(view!=='creative'||(r.ad&&(!$('creativeGroup').value||r.adset===$('creativeGroup').value)&&(!$('creativeAd').value||r.ad===$('creativeAd').value))))}
function render(){syncCreativeFilters();syncKeywordPicker();if(view==='source')return;for(const id of ['performanceNotice','kpis','trendPanel','breakdownPanels'])$(id).hidden=false;let rs=selected(),s=sum(rs);const basis=view==='meta'?'RAW 추정값':view==='keyword'?'키워드 광고 보고값':view==='amazon'?'Amazon 광고 보고값':'통합 성과';const cards=[['광고비',fmt(s.cost),'KRW'],['노출',fmt(s.imp),'회'],['클릭',fmt(s.click),'CTR '+fmt(s.ctr,true)],['구매',fmt(s.purchase),basis],['매출',fmt(s.sales),'KRW · '+basis],['ROAS',fmt(s.roas,true),'매출 ÷ 광고비']];$('kpis').innerHTML=cards.map(c=>`<div class="kpi"><div class="label">${c[0]}</div><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('');$('period').textContent=`${$('start').value} — ${$('end').value} · ${nf.format(rs.length)}개 원본 행`;
$('amazonCampaignPanel').hidden=view!=='amazon';drawChart(rs);if(view==='amazon')drawCampaignChart(rs);bars('channels',group(rs,'media'),true);bars('products',group(rs,'product').sort((a,b)=>b.cost-a.cost).slice(0,5));let k=view==='keyword'?'keyword':$('group').value;tableRows=group(rs,k).filter(r=>r.name.toLowerCase().includes($('search').value.toLowerCase()));drawTable();drawDailyTable(rs)}
function bars(id,data,channel=false){let total=data.reduce((s,r)=>s+r.cost,0);$(id).innerHTML=data.length?data.map((r,i)=>`<div class="barrow"><div class="barlabel"><span>${esc(r.name)}</span><strong>₩${fmt(r.cost)}</strong></div><div class="track"><div class="fill" style="width:${total?r.cost/total*100:0}%;background:${i===1?'#8dabc9':'#3568a8'}"></div></div>${channel?`<div class="mini">클릭 ${fmt(r.click)} · CPC ₩${fmt(r.cpc)} · ROAS ${fmt(r.roas,true)}</div>`:''}</div>`).join(''):'<div class="empty">해당 데이터가 없습니다.</div>'}
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
  const value=(v,key)=>fmt(v,pct(key))+(v!==null&&['cost','sales'].includes(key)?'원':'');
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
const keywordColumns=['name','cost','imp','click','ctr','cpm','cpc','view','dpv','cart','purchase','sales','cvr','roas','acos'].map(key=>{const [,label]=columns.find(([k])=>k===key);return [key,key==='name'?'키워드':label.replaceAll('*','')]});
const activeColumns=()=>view==='keyword'?keywordColumns:columns;
function drawTable(){const columns=activeColumns();$('tableTitle').textContent=view==='keyword'?'키워드 성과 상세':'성과 상세';tableRows.sort((a,b)=>sortDir*(typeof a[sortKey]==='string'?a[sortKey].localeCompare(b[sortKey]):(a[sortKey]??-Infinity)-(b[sortKey]??-Infinity)));let pages=Math.max(1,Math.ceil(tableRows.length/15));page=Math.min(page,pages-1);$('table').innerHTML='<thead><tr>'+columns.map(([k,l])=>`<th><button data-sort="${k}" style="border:0;background:none;color:inherit;padding:0;white-space:nowrap">${l}${sortKey===k?(sortDir===1?' ↑':' ↓'):''}</button></th>`).join('')+'</tr></thead><tbody>'+tableRows.slice(page*15,page*15+15).map(r=>'<tr>'+columns.map(([k])=>k==='name'?`<td>${esc(r.name)}</td>`:`<td>${fmt(r[k],percentages.includes(k))}</td>`).join('')+'</tr>').join('')+'</tbody>';$('count').textContent=view==='keyword'?`${tableRows.length}개 항목 · Amazon 키워드 광고 보고값`:`${tableRows.length}개 항목 · * Meta 구매·매출·관련 비율은 추정`;$('page').textContent=`${page+1} / ${pages}`;$('prev').disabled=page===0;$('next').disabled=page===pages-1;$('table').querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{let k=b.dataset.sort;sortDir=sortKey===k?-sortDir:-1;sortKey=k;drawTable()})}
document.querySelectorAll('#filters input:not(#keywordSearch),#filters select,#group,#search,#grain,#trendMetric,#lineMetric,#campaignMetric').forEach(el=>el.addEventListener(el.id==='search'?'input':'change',()=>{if(el.id==='start'||el.id==='end'){datePreset=null;syncDateButtons()}if(el.id==='group'&&['keyword','asin'].includes(el.value)&&view!=='keyword'){const key=el.value;$('nav').querySelector('[data-view=keyword]').click();$('group').value=key;}page=0;render()}));$('reset').onclick=()=>{applyDatePreset('all');page=0;render()};document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{applyDatePreset(b.dataset.period);page=0;render()});$('prev').onclick=()=>{page--;drawTable()};$('next').onclick=()=>{page++;drawTable()};
const titles={overview:'광고 성과 한눈에 보기',amazon:'Amazon PPC 성과',meta:'Meta 광고 성과',keyword:'키워드별 성과 분석',campaign:'캠페인별 성과 분석',creative:'소재별 성과 분석',source:'데이터 관리'};
$('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>{view=b.dataset.view;$('title').textContent=titles[view];$('nav').querySelectorAll('button').forEach(n=>n.classList.toggle('active',n===b));$('source').hidden=view!=='source';$('dashboard').hidden=view==='source';$('filters').hidden=view==='source';$('export').hidden=view==='source';$('media').value='';$('product').value='';$('type').value='';$('group').value=view==='keyword'?'keyword':view==='campaign'?'campaign':view==='creative'?'ad':view==='amazon'?'ad type':view==='meta'?'adset':'media';if(view!=='source'){refreshFilters();if(datePreset)applyDatePreset(datePreset);}page=0;render()});
function csvParse(text){let all=[],row=[],s='',q=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){s+='"';i++}else q=!q}else if(c===','&&!q){row.push(s);s=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(x=>x!==''))all.push(row);row=[];s=''}else s+=c}if(q)throw Error('CSV의 따옴표가 닫히지 않았습니다.');row.push(s);if(row.some(x=>x!==''))all.push(row);return all}
$('file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;let next=normalize(csvParse(await f.text()));if(!next.length)throw Error('데이터 행이 없습니다.');rows=next;sourceLabel=f.name;$('status').textContent=`${sourceLabel} · ${nf.format(rows.length)}행 · 브라우저 임시 적용`;$('importStatus').textContent=`${nf.format(rows.length)}행을 적용했습니다. 왼쪽 전체 요약에서 확인하세요.`;initialize()}catch(err){$('importStatus').textContent='불러오기 실패: '+err.message}};
$('export').onclick=()=>{const columns=activeColumns();const encode=v=>'"'+String(v??'').replace(/"/g,'""')+'"';let csv='\uFEFF'+[columns.map(x=>x[1]).concat('추정치 포함'),...tableRows.map(r=>columns.map(([k])=>r[k]).concat(r.estimate?'예':'아니오'))].map(r=>r.map(encode).join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=u;a.download='JP_performance_'+$('group').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
function latestDate(rs){return rs.reduce((latest,r)=>r.date>latest?r.date:latest,'')}
function dataStatus(label){return `Google Sheets · 성과 ${nf.format(rows.length)}행 (${latestDate(rows)}까지) · 키워드 ${nf.format(keywordRows.length)}행 (${latestDate(keywordRows)}까지) · ${label}`}
Promise.all([fetch('data.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('성과 데이터 파일을 열 수 없습니다.');return r.json()}),fetch('keywords.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('키워드 데이터 파일을 열 수 없습니다.');return r.json()})]).then(([d,k])=>{rows=normalize(d.rows);keywordRows=normalizeKeywords(k.rows);$('status').textContent=dataStatus('저장된 데이터 · 원본 확인 중');initialize()}).catch(e=>{$('status').textContent='저장된 데이터 불러오기 실패: '+e.message}).finally(()=>{$('refresh').disabled=false;$('refreshSource').disabled=false;$('refresh').onclick()});

// Google Visualization's public-sheet JSONP transport avoids cross-origin CSV restrictions.
function sheetMatrix(result){
  if(result.status!=='ok'||!result.table)throw Error('구글 시트를 읽을 수 없습니다. 원본 시트의 접근 권한을 확인하세요.');
  const {cols,rows}=result.table;
  return [cols.map(c=>c.label),...rows.map(r=>cols.map((col,i)=>{
    const v=r.c[i]?.v??'';
    if(col.type==='date'||col.type==='datetime'){
      const m=String(v).match(/^Date\((\d+),(\d+),(\d+)/);
      if(m)return `${m[1]}-${String(Number(m[2])+1).padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    }
    return v;
  }))];
}
function readLiveSheet(sheet){
  return new Promise((resolve,reject)=>{
    const callback='manyoSheet_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let timer;
    const cleanup=()=>{clearTimeout(timer);script.remove();delete window[callback]};
    window[callback]=result=>{cleanup();try{resolve(sheetMatrix(result))}catch(e){reject(e)}};
    script.onerror=()=>{cleanup();reject(Error('구글 시트 연결에 실패했습니다. 네트워크와 원본 시트 접근 권한을 확인하세요.'))};
    timer=setTimeout(()=>{cleanup();reject(Error('구글 시트 응답 시간이 초과되었습니다. 잠시 후 다시 시도하세요.'))},60000);
    const params=new URLSearchParams({sheet,headers:'1',tqx:'out:json;responseHandler:'+callback,_:String(Date.now())});
    script.src='https://docs.google.com/spreadsheets/d/1KUezmcwvTmioQfoWoyg9ueen5p8mxOygUBQ4G2HIY0Y/gviz/tq?'+params;
    document.head.appendChild(script);
  });
}
$('refresh').onclick=async()=>{
  if($('refresh').disabled)return;
  $('refresh').disabled=true;$('refreshSource').disabled=true;$('refreshSource').textContent='↻ 불러오는 중…';$('refresh').textContent='↻ 불러오는 중…';
  $('refreshStatus').dataset.error='false';$('refreshStatus').textContent='구글 시트에서 최신 성과·키워드 데이터를 가져오는 중입니다…';
  try{
    const [data,keywords]=await Promise.all([readLiveSheet('AMZ JP RAW'),readLiveSheet('AMZ JP Keywords Raw')]);
    const nextRows=normalize(data),nextKeywords=normalizeKeywords(keywords);
    if(!nextRows.length||!nextKeywords.length)throw Error('시트에 데이터 행이 없어 기존 데이터를 유지했습니다.');
    // Capture current controls after loading so navigation during the request is respected.
    const ids=['start','end','media','product','type','campaign','keyword','creativeGroup','creativeAd'];
    const filters=Object.fromEntries(ids.map(id=>[id,$(id).value]));
    const currentPreset=datePreset;
    rows=nextRows;keywordRows=nextKeywords;sourceLabel='Google Sheets';
    refreshFilters();
    for(const id of ids){if(['start','end'].includes(id)||[...$(id).options].some(o=>o.value===filters[id]))$(id).value=filters[id]}
    if(currentPreset)applyDatePreset(currentPreset);
    page=0;render();
    $('status').textContent=dataStatus('원본 조회 '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' KST');
    $('refreshStatus').textContent='최신 구글 시트 데이터를 적용했습니다.';
  }catch(e){$('status').textContent=dataStatus('원본 조회 실패 · 기존 데이터 표시');$('refreshStatus').dataset.error='true';$('refreshStatus').textContent='새로고침 실패: '+e.message+' 기존 데이터는 유지됩니다.'}
  finally{$('refresh').disabled=false;$('refreshSource').disabled=false;$('refreshSource').textContent='↻ 지금 데이터 새로 가져오기';$('refresh').textContent='↻ 데이터 새로고침'}
};

$('refreshSource').onclick=()=> $('refresh').onclick();

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
  picker.innerHTML=months.length?months.map(m=>`<option value="${esc(m)}">${m.slice(0,4)}년 ${Number(m.slice(5))}월</option>`).join(''):'<option value="">데이터 없음</option>';
  picker.disabled=!months.length;
  picker.value=months.includes(previous)?previous:(months[0]||'');
  const filtered=rs.filter(r=>r.date.slice(0,7)===picker.value);
  const days=group(filtered,'date').sort((a,b)=>a.name.localeCompare(b.name));
  const cols=activeColumns().map(([k,label])=>[k,k==='name'?'일자':label]);
  const cells=r=>cols.map(([k])=>k==='name'?`<th scope="row">${esc(r.name)}</th>`:`<td>${fmt(r[k],percentages.includes(k))}</td>`).join('');
  $('dailyTable').innerHTML='<thead><tr>'+cols.map(([,label])=>`<th scope="col">${esc(label)}</th>`).join('')+'</tr></thead><tbody>'+(days.length?days.map(r=>'<tr>'+cells(r)+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty">선택한 조건에 해당하는 일자별 데이터가 없습니다.</td></tr>` )+'</tbody>'+(days.length?'<tfoot><tr>'+cells({name:'선택 월 합계',...sum(filtered)})+'</tr></tfoot>':'');
  $('dailySummary').textContent=days.length?`${picker.value} · ${days.length}일 · 비율 지표는 선택 월 합계 기준으로 재계산`:'';
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
