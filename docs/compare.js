let cmpTableSort=null;
let cmpHistory=[],cmpPerformanceSource='all';
let cmpPath=[],cmpPage=0,cmpResults=[],cmpSort='abs',cmpValid=false;
const cmpMetricLabels=[['cost','광고비'],['sales','매출'],['imp','노출'],['click','클릭'],['purchase','구매'],['roas','ROAS'],['ctr','CTR'],['cpc','CPC'],['cpm','CPM'],['view','조회'],['vtr','VTR'],['3s-view','3초 조회'],['like','좋아요'],['coment','댓글'],['share','공유'],['save','저장'],['er','ER'],['shop now click','Shop now 클릭'],['dpv','DPV'],['cart','장바구니'],['cvr','CVR'],['acos','ACOS']];
const cmpIso=d=>d.toISOString().slice(0,10),cmpShift=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return cmpIso(d)},cmpDays=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000)+1;
function cmpMonthRange(m){const [y,n]=m.split('-').map(Number);return [m+'-01',cmpIso(new Date(Date.UTC(y,n,0)))];}
function compareAggregate(data,a,b,keys){
  const map=new Map();
  for(const row of data){const inA=row.date>=a[0]&&row.date<=a[1],inB=row.date>=b[0]&&row.date<=b[1];if(!inA&&!inB)continue;
    const parts=keys.map(k=>String(row[k]||'미지정')),id=JSON.stringify(parts);if(!map.has(id))map.set(id,{id,parts,a:[],b:[]});const item=map.get(id);if(inA)item.a.push(row);if(inB)item.b.push(row);
  }
  return [...map.values()].map(g=>({id:g.id,parts:g.parts,name:g.parts.at(-1),before:sum(g.a),after:sum(g.b),aCount:g.a.length,bCount:g.b.length}));
}
function cmpDelta(r,k){return r.before[k]===null||r.after[k]===null?null:r.after[k]-r.before[k];}
function cmpSigned(v,p=false){return v===null?'—':(v>0?'+':'')+(p?(v*100).toFixed(2)+'%p':fmt(v));}
function cmpChange(r,k){const a=r.before[k],b=r.after[k];if(a===null||b===null)return '—';if(a===0)return b===0?'0.00%':'기준 0 · 산출 불가';return cmpSigned((b-a)/Math.abs(a)*100)+'%';}
function cmpKeys(){const last=$('cmpSource').value==='keyword'?'keyword':'ad';return ['media','campaign',...($('cmpLevel').value==='campaign'?[]:['adset']),...(['keyword','ad'].includes($('cmpLevel').value)?[last]:[])];}
function cmpSourceRows(){const mode=$('cmpSource').value;return (mode==='keyword'?keywordRows:rows).filter(r=>(!['meta','amazon'].includes(mode)||r.media===mode)&&(!cmpPath.length||cmpPath.every(([key,value])=>String(r[key]||'미지정')===value)));}
function cmpPresets(){
  const mode=$('cmpMode').value,today=budgetToday();let a,b;
  $('cmpMonths').hidden=mode!=='month';$('cmpWeeks').hidden=mode!=='week';
  if(mode==='month'){if(!$('cmpAMonth').value||!$('cmpBMonth').value)return; a=cmpMonthRange($('cmpAMonth').value);b=cmpMonthRange($('cmpBMonth').value);}
  else if(mode==='week'){if(!$('cmpAWeek').value||!$('cmpBWeek').value)return;const x=week($('cmpAWeek').value),y=week($('cmpBWeek').value);a=[x,cmpShift(x,6)];b=[y,cmpShift(y,6)];}
  else if(mode==='30days'){b=[cmpShift(today,-29),today];a=[cmpShift(today,-59),cmpShift(today,-30)];}
  if(a){[$('cmpAStart').value,$('cmpAEnd').value]=a;[$('cmpBStart').value,$('cmpBEnd').value]=b;}
  cmpPage=0;renderComparison();
}
function cmpResetPath(){cmpPath=[];cmpPage=0;cmpHistory=[];}
function cmpRemember(){cmpHistory.push({path:cmpPath.map(p=>[...p]),page:cmpPage,source:$('cmpSource').value,level:$('cmpLevel').value,search:$('cmpSearch').value,metric:$('cmpMetric').value,order:$('cmpOrder').value,tableSort:cmpTableSort?{...cmpTableSort}:null});}
function cmpBack(){const previous=cmpHistory.pop();if(!previous)return;cmpTableSort=previous.tableSort;cmpPath=previous.path;cmpPage=previous.page;$('cmpSource').value=previous.source;const leaf=$('cmpLevel').querySelector('option[data-leaf]');leaf.value=previous.source==='keyword'?'keyword':'ad';leaf.textContent=previous.source==='keyword'?'키워드별':'소재별';for(const [id,key] of [['cmpLevel','level'],['cmpSearch','search'],['cmpMetric','metric'],['cmpOrder','order']])$(id).value=previous[key];renderComparison();}
function cmpChooseLevel(level){
  if(level===$('cmpLevel').value)return;
  cmpRemember();const oldSource=$('cmpSource').value;
  if(level==='keyword'&&oldSource!=='keyword'){cmpPerformanceSource=oldSource;$('cmpSource').value='keyword';cmpPath=[];}
  if(level==='ad'&&oldSource==='keyword'){$('cmpSource').value=cmpPerformanceSource;cmpPath=[];}
  const keyword=$('cmpSource').value==='keyword',leaf=$('cmpLevel').querySelector('option[data-leaf]');leaf.value=keyword?'keyword':'ad';leaf.textContent=keyword?'키워드별':'소재별';
  if(level==='campaign')cmpPath=[];else if(level==='adset')cmpPath=cmpPath.filter(([key])=>['media','campaign'].includes(key));
  $('cmpLevel').value=level;$('cmpSearch').value='';cmpPage=0;renderComparison();
}
function cmpDrill(index){const r=cmpResults[index];if(!r)return;const keys=cmpKeys();if(keys.at(-1)==='ad'||keys.at(-1)==='keyword')return;cmpRemember();cmpPath=keys.map((k,i)=>[k,r.parts[i]]);$('cmpLevel').value=keys.at(-1)==='campaign'?'adset':$('cmpSource').value==='keyword'?'keyword':'ad';$('cmpSearch').value='';cmpPage=0;renderComparison();}
function renderComparison(){
  if(view!=='compare')return;const keyword=$('cmpSource').value==='keyword',currency=keyword?'JPY':'KRW',unit=keyword?'엔':'원';
  const leaf=$('cmpLevel').querySelector('option[data-leaf]');leaf.value=keyword?'keyword':'ad';leaf.textContent=keyword?'키워드별':'소재별';
  const unsupported=keyword?['vtr','3s-view','like','coment','share','save','er','shop now click']:[];
  for(const option of $('cmpMetric').options){option.disabled=unsupported.includes(option.value);option.hidden=option.disabled;}
  if(unsupported.includes($('cmpMetric').value))$('cmpMetric').value='cost';
  const a=[$('cmpAStart').value,$('cmpAEnd').value],b=[$('cmpBStart').value,$('cmpBEnd').value];
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'));
  cmpValid=[...a,...b].every(validDate)&&a[0]<=a[1]&&b[0]<=b[1];
  $('cmpError').textContent=cmpValid?'':'두 기간의 시작일과 종료일을 올바르게 입력하세요.';$('cmpBody').hidden=!cmpValid;$('cmpExport').disabled=!cmpValid;if(!cmpValid)return;
  const q=$('cmpSearch').value.trim().toLowerCase(),metric=$('cmpMetric').value;
  const data=cmpSourceRows().filter(r=>cmpKeys().map(k=>String(r[k]||'미지정')).join(' ').toLowerCase().includes(q)),ar=data.filter(r=>r.date>=a[0]&&r.date<=a[1]),br=data.filter(r=>r.date>=b[0]&&r.date<=b[1]),total={before:sum(ar),after:sum(br)};
  const coverage=(rs)=>rs.length?`${new Set(rs.map(r=>r.date)).size}일 데이터 / ${nf.format(rs.length)}행`:'데이터 없음';
  const warnings=[];if(cmpDays(...a)!==cmpDays(...b))warnings.push('기간 길이가 다릅니다. 일평균이 아닌 총액을 비교합니다.');if(a[0]<=b[1]&&b[0]<=a[1])warnings.push('두 기간이 겹칩니다.');if(a[1]>budgetToday()||b[1]>budgetToday())warnings.push('미래 날짜가 포함되어 아직 채워지지 않은 기간입니다.');if(!ar.length||!br.length)warnings.push('데이터가 없는 기간이 있습니다. 누락을 실제 실적 0으로 단정하지 마세요.');
  $('cmpCoverage').textContent=`기준 A ${a.join(' ~ ')} (${cmpDays(...a)}일, ${coverage(ar)}) → 비교 B ${b.join(' ~ ')} (${cmpDays(...b)}일, ${coverage(br)})`;
  $('cmpWarning').textContent=warnings.join(' ');$('cmpWarning').hidden=!warnings.length;
  $('cmpBasis').textContent=`증감 = B − A · 증감률 = (B − A) ÷ A · 비율 지표 증감은 %p · 금액 ${currency}. `+(keyword?'Amazon 키워드 원본 기준이며 일반 성과 원본과 합산하지 않습니다.':'Meta 구매·매출은 기존 추정 기준, Amazon은 광고 보고값입니다.');
  $('cmpCrumbs').innerHTML='<button type="button" class="button" id="cmpRoot">전체로 돌아가기</button>'+cmpPath.filter(([k])=>k!=='media').map(([k,v])=>`<span>${esc(v)}</span>`).join('<span>›</span>');$('cmpRoot').onclick=()=>{cmpResetPath();$('cmpLevel').value='campaign';renderComparison();};
  $('cmpDetailBack').disabled=!cmpHistory.length;$('cmpDetailBack').onclick=cmpBack;
  $('cmpDetailRoot').disabled=!cmpPath.length;$('cmpDetailRoot').onclick=()=>{cmpResetPath();$('cmpLevel').value='campaign';$('cmpSearch').value='';renderComparison();};
  $('cmpDetailPath').textContent=cmpPath.length?cmpPath.map(([key,value])=>key==='media'?(value==='meta'?'Meta':'Amazon'):value).join(' › '):'전체 항목';
  $('cmpDetailSource').textContent=keyword?'Amazon 키워드 · JPY':$('cmpSource').selectedOptions[0].textContent;
  $('cmpLevelButtons').querySelectorAll('[data-level]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.level===$('cmpLevel').value));button.onclick=()=>cmpChooseLevel(button.dataset.level);});

  $('cmpCards').innerHTML=['cost','sales','purchase','roas'].map(k=>{const d=cmpDelta(total,k);return `<div class="kpi"><div class="label">${cmpMetricLabels.find(([key])=>key===k)[1]} 증감${['cost','sales'].includes(k)?' ('+unit+')':''}</div><strong class="${d>0?'cmp-up':d<0?'cmp-down':''}">${cmpSigned(d,percentages.includes(k))}</strong><small>A ${fmt(total.before[k],percentages.includes(k))} → B ${fmt(total.after[k],percentages.includes(k))}</small></div>`;}).join('');
  cmpResults=compareAggregate(data,a,b,cmpKeys()).filter(r=>r.parts.join(' ').toLowerCase().includes(q));
  const columns=cmpColumns(metric,unit);
  if(cmpTableSort&&!columns.some(c=>c.key===cmpTableSort.key))cmpTableSort=null;
  const order=$('cmpOrder').value==='table'?'abs':$('cmpOrder').value;
  cmpResults.sort((x,y)=>cmpTableSort?cmpCompareRows(x,y,cmpTableSort.key,cmpTableSort.dir,metric):order==='abs'?(Math.abs(cmpDelta(y,metric)||0)-Math.abs(cmpDelta(x,metric)||0)||x.id.localeCompare(y.id)):cmpCompareRows(x,y,'delta',order==='up'?-1:1,metric));
  $('cmpOrder').value=cmpTableSort?'table':order==='table'?'abs':order;
  $('cmpSummary').innerHTML=cmpHierarchySummary(ar,br,unit,keywordRows.filter(r=>r.date>=a[0]&&r.date<=a[1]),keywordRows.filter(r=>r.date>=b[0]&&r.date<=b[1]),warnings);
  const ranking=(key,up)=>cmpResults.map((r,index)=>({r,index,d:cmpDelta(r,key)})).filter(x=>up?x.d>0:x.d<0).sort((x,y)=>up?y.d-x.d:x.d-y.d).slice(0,5);
  $('cmpRanks').innerHTML=[['cost',true,'광고비 증가'],['cost',false,'광고비 감소'],['sales',true,'매출 증가'],['sales',false,'매출 감소']].map(([k,up,title])=>{const rank=ranking(k,up),max=Math.max(...rank.map(x=>Math.abs(x.d)),1);return `<div class="panel cmp-rank"><h3>${title} TOP 5 <small>${unit}</small></h3>${rank.length?rank.map(({r,index,d})=>`<button type="button" class="cmp-rank-item" data-rank="${index}"><span>${esc(r.name)}</span><strong class="${up?'cmp-up':'cmp-down'}">${cmpSigned(d)}</strong><small>${esc(r.parts.slice(0,-1).join(' › '))}</small><i style="width:${Math.abs(d)/max*100}%"></i></button>`).join(''):'<p>해당 증감 항목이 없습니다.</p>'}</div>`;}).join('');
  const pages=Math.max(1,Math.ceil(cmpResults.length/20));cmpPage=Math.min(cmpPage,pages-1);const ratios=percentages.includes(metric),label=cmpMetricLabels.find(([k])=>k===metric)[1],canDrill=['campaign','adset'].includes($('cmpLevel').value);
  const cell=(r,key)=>key==='before'||key==='after'?fmt(r[key][metric],ratios):key==='rate'?cmpChange(r,metric):cmpSigned(cmpDelta(r,key==='delta'?metric:key),key==='delta'&&ratios);
  $('cmpTable').innerHTML='<thead><tr>'+columns.map(c=>`<th aria-sort="${cmpTableSort?.key===c.key?(cmpTableSort.dir===1?'ascending':'descending'):'none'}"><button type="button" class="cmp-sort" data-sort="${c.key}">${c.label} <span>${cmpTableSort?.key===c.key?(cmpTableSort.dir===1?'↑':'↓'):'↕'}</span></button></th>`).join('')+'</tr></thead><tbody>'+(cmpResults.length?cmpResults.slice(cmpPage*20,cmpPage*20+20).map((r,i)=>`<tr><td>${canDrill?`<button type="button" class="cmp-drill" data-drill="${cmpPage*20+i}">${esc(r.name)} →</button>`:`<strong>${esc(r.name)}</strong>`}<small>${esc(r.parts.slice(0,-1).join(' › '))}</small></td>${columns.slice(1).map(c=>`<td class="${['delta','cost','sales'].includes(c.key)?(cmpSortValue(r,c.key,metric)>0?'cmp-up':cmpSortValue(r,c.key,metric)<0?'cmp-down':''):''}">${cell(r,c.key)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}" class="empty">해당 조건의 데이터가 없습니다.</td></tr>`)+'</tbody>';
  $('cmpTable').querySelectorAll('[data-sort]').forEach(el=>el.onclick=()=>{const key=el.dataset.sort;cmpTableSort={key,dir:cmpTableSort?.key===key?-cmpTableSort.dir:key==='name'?1:-1};cmpPage=0;renderComparison();});
  $('cmpPager').textContent=`${nf.format(cmpResults.length)}개 항목 · ${cmpPage+1} / ${pages}`;$('cmpPrev').disabled=cmpPage===0;$('cmpNext').disabled=cmpPage===pages-1;
  $('cmpTable').querySelectorAll('[data-drill]').forEach(el=>el.onclick=()=>cmpDrill(Number(el.dataset.drill)));
  $('cmpRanks').querySelectorAll('[data-rank]').forEach(el=>el.onclick=()=>{if(canDrill)cmpDrill(Number(el.dataset.rank));else{$('cmpSearch').value=cmpResults[Number(el.dataset.rank)].name;cmpPage=0;renderComparison();}});
}
function cmpExport(){
  const k=$('cmpMetric').value,unit=$('cmpSource').value==='keyword'?'JPY':'KRW',encode=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const header=['매체','캠페인','그룹','키워드/소재','기준 시작','기준 종료','비교 시작','비교 종료','통화','지표','A','B','증감 (비율은 %p)','증감률',...['cost','sales'].filter(key=>key!==k).map(key=>key==='cost'?'광고비 증감':'매출 증감')];
  const data=cmpResults.map(r=>[r.parts[0],r.parts[1],r.parts[2]||'',r.parts[3]||'',...['cmpAStart','cmpAEnd','cmpBStart','cmpBEnd'].map(id=>$(id).value),unit,cmpMetricLabels.find(([key])=>key===k)[1],fmt(r.before[k],percentages.includes(k)),fmt(r.after[k],percentages.includes(k)),cmpSigned(cmpDelta(r,k),percentages.includes(k)),cmpChange(r,k),...['cost','sales'].filter(key=>key!==k).map(key=>cmpDelta(r,key))]);
  const url=URL.createObjectURL(new Blob(['\uFEFF'+[header,...data].map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='JP_period_comparison.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function cmpColumns(metric,unit){
  const label=cmpMetricLabels.find(([k])=>k===metric)[1],ratios=percentages.includes(metric);
  return [{key:'name',label:'분석 항목 / 경로'}, {key:'before',label:'기준 A · '+label}, {key:'after',label:'비교 B · '+label}, {key:'delta',label:label+' 증감'+(ratios?' (%p)':['cost','sales','cpc','cpm'].includes(metric)?' ('+unit+')':'')}, {key:'rate',label:'증감률'}, ...['cost','sales'].filter(k=>k!==metric).map(k=>({key:k,label:(k==='cost'?'광고비':'매출')+' 증감 ('+unit+')'}))];
}
function cmpSortValue(r,key,metric){
  if(key==='name')return r.name+' › '+r.parts.slice(0,-1).join(' › ');
  if(key==='before'||key==='after')return r[key][metric];
  if(key==='rate'){const a=r.before[metric],b=r.after[metric];return a===null||b===null||a===0&&b!==0?null:a===0?0:(b-a)/Math.abs(a);}
  return cmpDelta(r,key==='delta'?metric:key);
}
function cmpCompareRows(x,y,key,dir,metric){
  const a=cmpSortValue(x,key,metric),b=cmpSortValue(y,key,metric);
  if(a===null||!Number.isFinite(a)&&typeof a!=='string')return b===null?x.id.localeCompare(y.id):1;
  if(b===null||!Number.isFinite(b)&&typeof b!=='string')return -1;
  return (typeof a==='string'?a.localeCompare(b,'ko',{numeric:true}):a-b)*dir||x.id.localeCompare(y.id);
}
function cmpPairGroups(ar,br,keys){
  const map=new Map();
  for(const [side,rs] of [['a',ar],['b',br]])for(const r of rs){
    const parts=keys.map(k=>String(r[k]||'미지정')),id=JSON.stringify(parts);
    if(!map.has(id))map.set(id,{id,parts,name:parts.at(-1),a:[],b:[]});
    map.get(id)[side].push(r);
  }
  return [...map.values()].map(g=>({...g,before:sum(g.a),after:sum(g.b),aCount:g.a.length,bCount:g.b.length}));
}
function cmpHierarchySummary(ar,br,unit,kwA,kwB,warnings){
  if(!ar.length||!br.length)return '<p>양 기간 모두 데이터가 있어야 계층별 변동을 분석할 수 있습니다. 기간 또는 원본 누락 여부를 확인하세요.</p>';
  const campaigns=cmpPairGroups(ar,br,['media','campaign']);
  const amount=(r,k)=>cmpSigned(cmpDelta(r,k))+unit;
  const named=r=>`<b>${esc(r.name)}</b>`;
  const mismatch=r=>cmpDelta(r,'cost')>0&&cmpDelta(r,'sales')<0;
  const rank=(rs,up)=>rs.filter(r=>up?cmpDelta(r,'sales')>0:cmpDelta(r,'sales')<0).sort((x,y)=>up?cmpDelta(y,'sales')-cmpDelta(x,'sales'):cmpDelta(x,'sales')-cmpDelta(y,'sales'));
  const status=r=>!r.aCount||!r.bCount?' (한 기간에만 데이터가 있어 신규·중단 또는 누락 확인 필요)':'';
  function leaves(g,up,media){
    let leafUnit=unit,aa=g.a,bb=g.b,key=media==='meta'?'ad':'keyword',note='';
    if(media==='amazon'&&unit==='원'){
      const match=r=>['media','campaign','adset'].every((k,i)=>String(r[k]||'미지정')===g.parts[i]);
      aa=kwA.filter(match);bb=kwB.filter(match);leafUnit='엔';
      note='키워드 원본(JPY) 별도 분석: ';
      if(!aa.length||!bb.length)return '<p class="cmp-child">↳ 이 그룹과 일치하는 키워드 데이터가 양 기간에 없어 하위 원인을 확인할 수 없습니다.</p>';
    }
    const rs=cmpPairGroups(aa,bb,['media','campaign','adset',key]);
    const relevant=rank(rs,up).slice(0,3),risks=rs.filter(mismatch).sort((x,y)=>cmpDelta(y,'cost')-cmpDelta(x,'cost')).slice(0,2);
    const selected=[...new Map([...relevant,...risks].map(r=>[r.id,r])).values()];
    if(!selected.length)return '<p class="cmp-child">↳ 하위 항목의 매출 변동이 없습니다.</p>';
    return `<p class="cmp-child">↳ ${note}${selected.map(r=>`${key==='ad'?'소재':'키워드'} ${named(r)}의 광고비 ${cmpSigned(cmpDelta(r,'cost'))}${leafUnit}, 매출 ${cmpSigned(cmpDelta(r,'sales'))}${leafUnit}${mismatch(r)?' 변동하여, 광고비가 늘었지만 매출은 감소했습니다':cmpDelta(r,'sales')>0?' 변동하여 매출 증가에 기여했습니다':' 변동하여 매출 감소에 기여했습니다'}${status(r)}`).join('. ')}.${note?' 키워드 금액은 그룹 성과(KRW)와 원본·통화가 달라 직접 합산하거나 기여율로 환산하지 않습니다.':''}</p>`;
  }
  function campaignText(c,up){
    const groups=cmpPairGroups(c.a,c.b,['media','campaign','adset']),same=rank(groups,up),gross=same.reduce((s,r)=>s+Math.abs(cmpDelta(r,'sales')),0);
    const opposite=rank(groups,!up).reduce((s,r)=>s+Math.abs(cmpDelta(r,'sales')),0);
    const chosen=[...new Map([...same.slice(0,3),...groups.filter(mismatch).sort((x,y)=>cmpDelta(y,'cost')-cmpDelta(x,'cost')).slice(0,2)].map(g=>[g.id,g])).values()];
    let html=`<article class="cmp-story"><h3>${named(c)} <span class="${up?'cmp-up':'cmp-down'}">매출 ${amount(c,'sales')}</span></h3><p>${esc(c.parts[0]==='meta'?'Meta':'Amazon')} 캠페인의 광고비는 ${amount(c,'cost')} 변동했습니다${mismatch(c)?'. 광고비가 늘었는데 매출이 감소한 캠페인입니다':''}.${status(c)} 전체 ${groups.length}개 그룹 중 ${same.length}개에서 매출이 ${up?'증가':'감소'}했습니다${same.length>groups.length/2?' — 과반수 그룹에서 같은 방향의 변화가 나타났습니다':''}. ${opposite?`반대 방향의 그룹 변동 ${fmt(opposite)}${unit}이 일부 상쇄했습니다.`:''}</p>`;
    for(const g of chosen){
      const d=cmpDelta(g,'sales'),aligned=up?d>0:d<0;
      html+=`<div class="cmp-story-group"><p><strong>그룹 ${named(g)}</strong> 매출 ${amount(g,'sales')}, 광고비 ${amount(g,'cost')}.${aligned&&gross?` 이 캠페인 내 그룹들의 전체 ${up?'증가액':'감소액'} 중 ${fmt(Math.abs(d)/gross,true)}를 차지합니다.`:''}${mismatch(g)?' 특히 광고비 증가에도 매출이 감소하여 하위 항목 확인이 필요한 그룹입니다.':''}${status(g)}</p>${leaves(g,d>0,c.parts[0])}</div>`;
    }
    if(c.parts[0]==='meta')html+='<p class="cmp-summary-note">Meta 매출은 Shop now 클릭 기반 추정값이므로 위 소재 분석도 추정 매출의 변동입니다.</p>';
    return html+'</article>';
  }
  let html='<p>캠페인 → 그룹 → 키워드·소재 순으로 매출 변동을 추적합니다. 각 방향의 상위 3개 캠페인과 주요 그룹·하위 항목을 표시합니다.</p>';
  for(const up of [false,true]){
    const ranked=rank(campaigns,up);html+=`<h3 class="cmp-story-title">매출 ${up?'증가':'감소'} 주요 경로</h3>`;
    html+=ranked.length?ranked.slice(0,3).map((c,i)=>i===0?campaignText(c,up):`<details class="cmp-story-more"><summary>${esc(c.name)} · 매출 ${amount(c,'sales')} — 분석 펼치기</summary>${campaignText(c,up)}</details>`).join(''):'<p>해당 방향으로 변동한 캠페인이 없습니다.</p>';
  }
  if(warnings.length)html+=`<p><strong>비교 조건</strong> ${esc(warnings.join(' '))}</p>`;
  return html;
}

function initComparison(){
  $('cmpMetric').innerHTML=cmpMetricLabels.map(([k,l])=>`<option value="${k}">${l}</option>`).join('');
  const monday=week(budgetToday()),b=cmpShift(monday,-7),a=cmpShift(monday,-14);$('cmpAWeek').value=a;$('cmpBWeek').value=b;
  const current=budgetToday().slice(0,7),previous=cmpShift(current+'-01',-1).slice(0,7);$('cmpAMonth').value=previous;$('cmpBMonth').value=current;cmpPresets();
  for(const id of ['cmpMode','cmpAMonth','cmpBMonth','cmpAWeek','cmpBWeek'])$(id).onchange=cmpPresets;
  for(const id of ['cmpAStart','cmpAEnd','cmpBStart','cmpBEnd'])$(id).onchange=()=>{$('cmpMode').value='custom';cmpPresets();};
  $('cmpPrevious').onclick=()=>{const from=$('cmpBStart').value,to=$('cmpBEnd').value;if(!from||!to||from>to)return;$('cmpAEnd').value=cmpShift(from,-1);$('cmpAStart').value=cmpShift(from,-cmpDays(from,to));$('cmpMode').value='custom';cmpPresets();};
  $('cmpSource').onchange=()=>{cmpResetPath();$('cmpLevel').value='campaign';$('cmpSearch').value='';renderComparison();};
  $('cmpLevel').onchange=()=>{cmpResetPath();renderComparison();};
  for(const id of ['cmpMetric','cmpOrder'])$(id).onchange=()=>{cmpTableSort=null;if($('cmpOrder').value==='table')$('cmpOrder').value='abs';cmpPage=0;renderComparison();};$('cmpSearch').oninput=()=>{cmpPage=0;renderComparison();};
  $('cmpPrev').onclick=()=>{cmpPage--;renderComparison();};$('cmpNext').onclick=()=>{cmpPage++;renderComparison();};$('cmpExport').onclick=cmpExport;
  if(view==='compare')renderComparison();
}
initComparison();


