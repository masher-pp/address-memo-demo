(function(){
  'use strict';
  const C=window.Memo,U=window.UserData,$=s=>document.querySelector(s),content=$('#user-content'),modal=$('#user-modal');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg aria-hidden="true"><use href="#u-${n}"/></svg>`;
  const now=()=>new Date().toLocaleString('zh-CN',{hour12:false});
  function fresh(){const s=C.fresh();return window.PublicFactories.merge(U.normalize({places:s.places,history:[],recent:[]}));}
  let loadProblem='';
  function load(){try{const raw=localStorage.getItem(U.KEY);if(raw){const s=JSON.parse(raw);if(!Array.isArray(s.places)||!s.places.length)throw Error('invalid');if(JSON.stringify(s.recent)===JSON.stringify(['p1','p2'])&&s.history?.length===1&&s.history[0].id==='h-seed'&&!s.recorded?.length&&!s.route?.length){s.recent=[];s.history=[];}return window.PublicFactories.merge(U.normalize(s));}}catch{loadProblem='无法读取本机记录，当前展示示例。';}return fresh();}
  let state=load(),page='home',subpage='',query='',sourceOnly=false,searchOpen=false,composing=false,selected=null,managing=false,toastTimer;
  let filters={status:'all',tags:[]},modalDirty=null,modalLeave=null;
  let visitQuery='',visitSelection=null;
  const place=id=>state.places.find(p=>p.id===id),scrolls=new Map();
  function save(change){state=U.persist(state,change,localStorage);}
  function trySave(change){try{save(change);return true;}catch(e){toast(e.message);return false;}}
  function toast(t){clearTimeout(toastTimer);$('#user-toast').textContent=t;$('#user-toast').hidden=false;toastTimer=setTimeout(()=>$('#user-toast').hidden=true,3600);}
  function seed(s){const p=s.places.find(p=>p.id==='p1');if(p&&!p.arrivalGuide&&p.note===C.fresh().places[0].note)p.arrivalGuide=window.ArrivalGuide.exampleGuide();}seed(state);
  const status=p=>`<span class="status ${esc(p.status)}">${esc(C.statuses[p.status]||'待核实')}</span>`;
  const empty=(t,d,a='')=>`<div class="empty">${icon('pin')}<h2>${esc(t)}</h2><p>${esc(d)}</p>${a}</div>`;
  function openModal(title,body,screen=false){cancelAppNotice();modalDirty=null;modalLeave=null;modal.classList.remove('info-editing');modal.querySelector('.leave-overlay')?.remove();$('#user-modal-title').textContent=title;$('#user-modal-body').innerHTML=body;modal.classList.toggle('modal-screen',screen);if(!modal.open)modal.showModal();$('#user-modal-body').scrollTop=0;}
  function closeModal(){
    cancelAppNotice();
    if(modal.querySelector('.leave-overlay'))return;
    if(modalDirty?.()){
      const overlay=document.createElement('div');overlay.className='leave-overlay';overlay.innerHTML='<section role="alertdialog" aria-label="放弃未保存的内容"><h3>内容还未保存</h3><p>退出会放弃这次填写的内容。</p><div><button class="plain-button" data-action="keep-modal">继续填写</button><button class="danger-button" data-action="discard-modal">放弃修改</button></div></section>';modal.append(overlay);overlay.querySelector('button').focus();return;
    }
    if(modalLeave){const back=modalLeave;modalLeave=null;back();}else modal.close();
  }
  function key(){return page+'/'+subpage;}
  function go(p,sub=''){clearTimeout(toastTimer);$('#user-toast').hidden=true;scrolls.set(key(),window.scrollY);if(p!=='route'||sub||page!=='route'||subpage)managing=false;if(subpage==='visit-select'&&(p!=='route'||sub!=='visit-select'))visitSelection=null;page=p;subpage=sub;render();window.scrollTo(0,scrolls.get(key())||0);}
  function header(){const title=({records:'我的现场记录',history:'最近修改',settings:'设置',help:'使用说明',map:'地图查看','visit-select':'选择走访场所'})[subpage]||({home:'企业地址',route:'走访清单',mine:'我的'})[page];
    $('.user-topbar').innerHTML=`<div class="page-heading">${subpage?`<button class="icon-button" data-action="back-page" aria-label="返回">${icon('back')}</button>`:''}<h1>${title}</h1></div>${!subpage&&page==='home'&&!searchOpen?`<button class="header-action" data-action="show-map">${icon('map')}地图</button>`:!subpage&&page==='route'&&state.route.length?`<button class="header-action" data-action="route-manage">${managing?'完成':'管理'}</button>`:''}`;
    document.querySelectorAll('.user-tabbar [data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
    const n=state.route.filter(id=>!state.completed.includes(id)).length;$('#user-route-count').hidden=!n;$('#user-route-count').textContent=n;
  }
  function render(){if(subpage!=='map'){realMap?.destroy();realMap=null;}if(!state.route.length)managing=false;header();content.className=subpage==='map'?'map-page':subpage==='visit-select'||page==='route'&&!subpage&&!managing&&U.nextStop(state)?'has-dock':'';
    if(subpage==='visit-select')renderVisitSelection();else if(subpage==='map')renderMap();else if(subpage==='records')renderRecords();else if(subpage==='history')renderHistory();else if(subpage==='settings')renderSettings();else if(subpage==='help')renderHelp();else if(page==='home')renderHome();else if(page==='route')renderRoute();else renderMine();}
  function renderHome(){
    content.innerHTML=`<div class="search-area"><label class="search-box">${icon('search')}<input id="user-search" type="search" autocomplete="off" enterkeyhint="search" value="${esc(query)}" placeholder="搜索企业名称、场所或地址" aria-label="搜索企业、场所或地址"><button class="clear-search ${query?'visible':''}" data-action="clear-query" aria-label="清除搜索">${icon('close')}</button></label></div><div id="search-controls"></div><div id="search-results"></div>`;updateSearch();
    const input=$('#user-search');input.addEventListener('focus',()=>{if(!searchOpen){searchOpen=true;updateSearch();}});
    input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;sourceOnly=false;query=input.value;updateSearch();});
    input.addEventListener('input',e=>{sourceOnly=false;query=input.value;searchOpen=true;if(!composing&&!e.isComposing)updateSearch();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!composing){e.preventDefault();input.blur();searchOpen=true;updateSearch();}});
  }
  const results=()=>U.filterPlaces(state,{query,...filters}).filter(p=>!sourceOnly||p.publicSource);
  function updateSearch(){
    const controls=$('#search-controls'),body=$('#search-results');if(!controls||!body)return;
    $('.clear-search')?.classList.toggle('visible',!!query);header();
    if(!searchOpen){const recent=state.recent.map(place).filter(Boolean),factories=state.places.filter(p=>p.publicSource);controls.innerHTML='';body.innerHTML=`<section class="public-factories"><div class="section-heading"><h2>苏州工厂</h2><button class="text-button" data-action="public-factories">全部 ${factories.length}${icon('chevron')}</button></div>${factories.map(p=>`<button class="recent-item public-factory-row" data-action="detail" data-id="${esc(p.id)}"><span class="recent-icon">${icon('pin')}</span><span><b>${esc(p.enterprise)}</b><small>${esc(p.name)} · ${esc(p.address)}</small></span>${icon('chevron')}</button>`).join('')}</section>${recent.length?`<section class="recent-section"><div class="section-heading"><h2>最近查看</h2><button class="icon-button" data-action="clear-recent" aria-label="清除最近查看">${icon('trash')}</button></div><div class="recent-list">${recent.map(p=>`<button class="recent-item" data-action="detail" data-id="${esc(p.id)}"><span class="recent-icon">${icon('clock')}</span><span><b>${esc(p.enterprise)}</b><small>${esc(p.name)} · ${esc(p.address)}</small></span>${icon('chevron')}</button>`).join('')}</div></section>`:''}<button class="browse-all" data-action="browse-all">查看全部企业${icon('chevron')}</button><button class="home-add-place" data-action="add-place">${icon('plus')}记录新场所</button>`;return;}
    const list=results(),n=filters.tags.length+(filters.status!=='all'?1:0);
    controls.innerHTML=`<div class="search-tools"><div class="filter-scroll"><button data-action="filter" class="filter-chip ${filters.tags.length?'selected':''}">${icon('filter')}${filters.tags.length?filters.tags.length+' 个标签':'企业标签'}</button><button data-action="filter-status" class="filter-chip ${filters.status!=='all'?'selected':''}">${esc(filters.status==='all'?'核实状态':C.statuses[filters.status])}${icon('down')}</button></div><button class="icon-button" data-action="show-map" aria-label="在地图上查看结果">${icon('map')}</button></div><div class="result-summary"><span>${sourceOnly?'苏州工厂 · ':''}${list.length} 个场所</span>${n?'<button data-action="reset-filters">清除筛选</button>':'<button data-action="end-search">收起</button>'}</div>`;
    body.innerHTML=`<div class="result-list">${list.length?list.map(resultCard).join(''):empty('没有找到相关企业','试试企业简称、园区或道路名称','<button class="primary" data-action="add-place">记录新场所</button><button class="plain-button" data-action="reset-search">重置搜索</button>')}</div>`;
  }
  function resultCard(p){
    const pending=state.route.includes(p.id)&&!state.completed.includes(p.id),again=state.completed.includes(p.id),located=U.hasCoordinates(p);
    return `<article class="result-card"><button class="result-main" data-action="detail" data-id="${esc(p.id)}"><div class="result-title"><h2>${esc(p.enterprise)}</h2>${icon('chevron')}</div><p class="place-name">${esc(p.name)} ${!located?'<span class="status pending">待补位置</span>':status(p)}</p><p class="result-address">${esc(p.address)}</p></button><div class="result-bottom"><div class="result-tags">${(p.tags||[]).slice(0,2).map(t=>`<span>${esc(t.replace(/使用$/,''))}</span>`).join('')}</div><div class="result-actions"><button class="route-add-text ${pending?'is-added':''}" data-action="${pending?'route-open':'route-add'}" data-id="${esc(p.id)}">${icon(pending?'check':'plus')}${pending?'查看走访':again?'再次走访':'加入走访'}</button><button class="compact-primary" data-action="${located?'navigate':'record'}" data-id="${esc(p.id)}">${icon(located?'arrow':'pin')}${located?'导航':'补充位置'}</button></div></div></article>`;
  }
  function openGuide(id){if(!place(id))return;selected=id;scrolls.set(key(),window.scrollY);trySave(s=>s.recent=[id,...s.recent.filter(x=>x!==id)].slice(0,10));arrival.open(id);}
  function openFilters(statusOnly=false){
    openModal(statusOnly?'核实状态':'筛选企业',`<form id="filter-form"><fieldset><legend>核实状态</legend><div class="choice-grid">${[['all','全部'],...Object.entries(C.statuses)].map(([v,t])=>`<label class="choice"><input type="radio" name="status" value="${v}" ${filters.status===v?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset>${statusOnly?'':`<fieldset><legend>企业标签 <small>匹配其中一项即可</small></legend><div class="choice-grid tags-grid">${C.tags.map(t=>`<label class="choice"><input type="checkbox" name="tags" value="${t}" ${filters.tags.includes(t)?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset>`}<div class="sheet-actions"><button type="button" class="plain-button" data-action="filter-reset">重置</button><button class="primary" type="submit">查看结果</button></div></form>`);
    $('#filter-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);filters={status:f.get('status')||'all',tags:statusOnly?filters.tags:f.getAll('tags')};modal.close();searchOpen=true;if(subpage==='map')renderMap();else updateSearch();});
  }
  let realMap=null;
  function renderMap(){
    const view=realMap?{center:realMap.map.getCenter(),zoom:realMap.map.getZoom()}:{};
    realMap?.destroy();realMap=null;
    const list=results(),located=list.filter(p=>U.hasCoordinates(p));if(!located.some(p=>p.id===selected))selected=located[0]?.id||null;const p=place(selected);
    content.innerHTML=`<div class="real-map-wrap"><div id="real-map" aria-label="企业厂区位置地图"></div><p class="real-map-status" hidden></p></div><div class="map-search-label">${icon('search')}<span>${esc(sourceOnly?'苏州工厂':query||'全部企业')} · ${located.length} 处</span><button class="icon-button" data-action="filter" aria-label="筛选地图点位">${icon('filter')}</button></div><div class="map-result-panel">${p?`<div class="map-result-heading">${p.publicSource?'<span class="status pending">入口待核实</span>':status(p)}<small>${located.findIndex(x=>x.id===p.id)+1} / ${located.length}</small></div><button class="map-place-main" data-action="detail" data-id="${esc(p.id)}"><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)} · ${esc(p.address)}</p></button><div class="map-place-actions"><button class="plain-button" data-action="detail" data-id="${esc(p.id)}">看指引${icon('chevron')}</button><button class="compact-primary" data-action="navigate" data-id="${esc(p.id)}">${icon('arrow')}导航</button></div>`:empty('没有已定位的场所','搜索企业后补充位置，可在地图查看')}<button class="map-to-list" data-action="show-list">${icon('list')}返回列表</button></div>`;
    realMap=window.LocationMap.mount($('#real-map'),located,selected,detail=>{if(detail.id){selected=detail.id;renderMap();}},view);
  }
  function startVisitSelection(){
    visitQuery='';visitSelection=new Set(state.route.filter(id=>!state.completed.includes(id)));scrolls.delete('route/visit-select');go('route','visit-select');
  }
  function renderVisitSelection(){
    content.innerHTML=`<div class="search-area"><label class="search-box">${icon('search')}<input id="visit-search" type="search" autocomplete="off" enterkeyhint="search" value="${esc(visitQuery)}" placeholder="搜索已有场所" aria-label="搜索已有场所"></label></div><div class="section-heading"><h2>已有场所</h2><span id="visit-selection-count"></span></div><div id="visit-options"></div><div class="route-dock visit-selection-dock"><button class="secondary" data-action="visit-cancel">取消</button><button class="primary" data-action="visit-confirm">确认并返回走访</button></div>`;
    $('#visit-search').addEventListener('input',e=>{visitQuery=e.target.value;renderVisitOptions();});renderVisitOptions();
  }
  function renderVisitOptions(){
    const list=U.filterPlaces(state,{query:visitQuery});
    $('#visit-selection-count').textContent=`已选 ${visitSelection.size} 处`;
    $('#visit-options').innerHTML=list.length?`<div class="visit-options">${list.map(p=>{const checked=visitSelection.has(p.id);return `<button class="visit-option ${checked?'is-selected':''}" data-action="visit-toggle" data-id="${esc(p.id)}" aria-pressed="${checked}"><span class="visit-checkbox">${checked?icon('check'):''}</span><span class="visit-option-text"><b>${esc(p.enterprise)}</b><span>${esc(p.name)}</span><small>${esc(p.address)}</small>${!U.hasCoordinates(p)?'<span class="visit-location-needed">待补位置</span>':state.completed.includes(p.id)?'<span class="visit-finished-label">已到访，可再次选择</span>':''}</span></button>`;}).join('')}</div>`:empty('没有匹配的场所','试试企业名称或地址');
  }
  function confirmVisitSelection(){
    const chosen=[...visitSelection],chosenSet=new Set(chosen);
    if(!trySave(s=>{
      const pending=s.route.filter(id=>!s.completed.includes(id)&&chosenSet.has(id));
      const done=s.route.filter(id=>s.completed.includes(id)&&!chosenSet.has(id));
      s.route=[...pending,...chosen.filter(id=>!pending.includes(id)),...done];s.completed=done;
    }))return;
    go('route');
  }
  function showRoute(){modal.close();if(arrival.isOpen())arrival.close();managing=false;go('route');}
  function routeAdd(id){
    if(!place(id))return false;
    if(state.route.includes(id)&&!state.completed.includes(id)){showRoute();return true;}
    const again=state.completed.includes(id);
    if(!trySave(s=>{s.completed=s.completed.filter(x=>x!==id);s.route=[...s.route.filter(x=>x!==id),id];}))return false;
    updateSearch();header();toast(again?'已重新加入待走访':'已加入走访清单');return true;
  }
  function renderRoute(){
    const todo=state.route.filter(id=>!state.completed.includes(id)).map(place).filter(Boolean),done=state.route.filter(id=>state.completed.includes(id)).map(place).filter(Boolean),next=todo[0],remaining=managing?todo:todo.slice(1);
    content.innerHTML=`<div class="route-overview"><span>${todo.length?`待走访 <b>${todo.length}</b> 处`:done.length?'本次走访已完成':'本次走访'}</span>${state.route.length?`<span class="muted">已完成 ${done.length} 处</span>`:''}</div>${next&&!managing?`<section class="next-stop"><span class="section-kicker">下一站</span><button data-action="detail" data-id="${esc(next.id)}"><h2>${esc(next.enterprise)}</h2><p>${esc(next.name)}</p><small>${esc(next.address)}</small></button>${!U.hasCoordinates(next)?'<p class="visit-location-needed">待补位置</p>':''}<div class="next-stop-actions"><button class="arrival-button" data-action="route-complete" data-id="${esc(next.id)}">${icon('check')}标记已到访</button></div></section>`:''}${remaining.length?`<div class="section-heading"><h2>${managing?'调整顺序':'后续站点'}</h2></div><div class="route-list">${remaining.map((p,i)=>routeRow(p,managing?i:i+1,false)).join('')}</div>`:next?'':!done.length?empty('还没有走访安排','','<button class="primary" data-action="add-visits">选择走访场所</button>'):`<div class="route-finished">${icon('check')}<h2>本次走访已完成</h2><button class="plain-button" data-action="add-visits">选择走访场所</button></div>`}${done.length?`<div class="section-heading"><h2>已完成 <small>${done.length}</small></h2>${managing?'<button class="text-button" data-action="route-clear-done">清除已完成</button>':''}</div><div class="route-list completed-list">${done.map((p,i)=>routeRow(p,i,true)).join('')}</div>`:''}${next&&!managing?`<div class="route-dock"><button class="secondary" data-action="add-visits">${icon('plus')}选择场所</button><button class="primary" data-action="route-navigate">${icon(U.hasCoordinates(next)?'arrow':'pin')}${U.hasCoordinates(next)?'导航下一站':'补充位置'}</button></div>`:''}`;
  }
  function routeRow(p,i,done){
    return `<article class="route-item ${done?'is-completed':''}"><span class="route-num">${done?icon('check'):i+1}</span><button class="route-place" data-action="detail" data-id="${esc(p.id)}"><b>${esc(p.enterprise)}</b><small>${esc(p.name)}</small>${!done&&!U.hasCoordinates(p)?'<span class="visit-location-needed">待补位置</span>':''}</button>${done?`<button class="text-button visit-undo" data-action="route-restore" data-id="${esc(p.id)}" aria-label="撤销到访">撤销到访</button>`:''}${managing?`<div class="route-controls">${!done?`<button class="icon-button" data-action="route-up" data-id="${esc(p.id)}" ${i===0?'disabled':''} aria-label="上移">${icon('up')}</button><button class="icon-button" data-action="route-down" data-id="${esc(p.id)}" ${i===state.route.filter(id=>!state.completed.includes(id)).length-1?'disabled':''} aria-label="下移">${icon('down')}</button>`:''}<button class="icon-button" data-action="route-remove" data-id="${esc(p.id)}" aria-label="移出清单">${icon('close')}</button></div>`:''}</article>`;
  }
  function moveRoute(id,delta){const ids=state.route.filter(x=>!state.completed.includes(x)),i=ids.indexOf(id),j=i+delta;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];if(trySave(s=>s.route=[...ids,...s.route.filter(x=>s.completed.includes(x))]))render();}
  function menuRow(symbol,title,hint,action){return `<button class="menu-row" data-action="${action}">${icon(symbol)}<span>${title}</span><small>${esc(hint)}</small>${icon('chevron')}</button>`;}
  function renderMine(){content.innerHTML=`<section class="profile"><span class="profile-avatar">${icon('user')}</span><div><h2>我的记录</h2></div><span class="local-badge">本机</span></section><div class="menu-group">${menuRow('camera','我的现场记录',state.recorded.length+' 个场所','my-records')}${menuRow('clock','最近修改',state.history.length+' 条','my-history')}</div><div class="menu-group">${menuRow('download','记录备份与设置','','settings')}</div>`;}
  function renderRecords(){const ps=state.recorded.map(place).filter(Boolean);content.innerHTML=`${ps.length?`<div class="record-list">${ps.map(p=>`<article class="record-card"><button data-action="detail" data-id="${p.id}"><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)}</p><span>${esc(p.arrivalGuide?.steps?.[0]?.description||p.guideFeedback?.[0]?.text||p.note||p.address)}</span></button><footer><small>${esc(p.updated)}</small><button class="text-button" data-action="record-detail" data-id="${p.id}">查看记录${icon('chevron')}</button></footer></article>`).join('')}</div>`:empty('还没有现场记录','在到访指引中点击“我来指路”，或补充入口位置。','<button class="plain-button" data-action="find-enterprises">查找企业</button>')}`;}
  function renderHistory(){content.innerHTML=state.history.length?`<div class="history-list">${state.history.map(h=>`<button class="history-entry" data-action="detail" data-id="${esc(h.placeId)}"><span class="history-dot"></span><div><div class="history-entry-title"><b>${esc(h.action)}</b><time>${esc(h.time)}</time></div><h2>${esc(place(h.placeId)?.enterprise||'场所记录')}</h2><p>${esc(h.summary||'资料已更新')}</p></div>${icon('chevron')}</button>`).join('')}</div>`:empty('暂无修改记录','保存现场信息后会在这里显示');}
  function renderSettings(){content.innerHTML=`<div class="settings-group"><h2>导航</h2>${menuRow('map','默认导航地图',state.settings.mapProvider,'map-settings')}</div><div class="settings-group"><h2>本机数据</h2>${menuRow('download','导出记录备份','JSON 文件','export-backup')}${menuRow('undo','恢复示例数据','','clear-local')}</div><div class="settings-group"><h2>关于</h2>${menuRow('info','使用说明','','guide')}<div class="settings-caption"><span>版本</span><span>2026.11</span></div></div>`;}
  function renderHelp(){content.innerHTML=`<div class="help-content"><h2>找企业</h2><p>搜索企业或地址，查看入口和图文指引。</p><h2>导航</h2><p>在手机浏览器中选择已安装的高德或百度地图，打开路线后按 App 提示开始导航。</p><h2>记录现场</h2><p>点击“我来指路”补充照片和说明；在“更多”中编辑地址与图文路线。</p><h2>走访</h2><p>将企业加入清单，到访后标记完成，再前往下一站。</p><h2>数据保存</h2><p>记录保存在当前浏览器，可在设置中导出备份。清理网站数据会移除记录，当前不支持多人同步。</p></div>`;}
  function mapSettings(){openModal('默认导航地图',`<div class="option-list">${['每次询问','高德地图','百度地图'].map(n=>`<button data-action="set-map-provider" data-id="${n}"><span>${n}</span>${state.settings.mapProvider===n?icon('check'):''}</button>`).join('')}</div>`);}
  function navigationPlatform(){return /iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1?'ios':/Android|HarmonyOS/i.test(navigator.userAgent)?'android':'desktop';}
  function navigate(id){
    const p=place(id);if(!p)return;selected=id;
    const heading=`<div class="navigation-place"><h3>${esc(p.enterprise)}</h3><p>${esc(p.name)} · ${esc(p.address)}</p></div>`;
    if(!U.hasCoordinates(p)){
      openModal('请先记录位置',heading+'<button class="primary navigation-record" data-action="navigation-record" data-id="'+esc(id)+'">补充入口位置</button>');return;
    }
    const platform=navigationPlatform(),providers=['高德地图','百度地图'];
    if(platform==='desktop'){openModal('导航',heading+'<p class="provider-status">请在手机浏览器中打开此页面导航。</p>');return;}
    if(providers.includes(state.settings.mapProvider))providers.sort((a,b)=>a===state.settings.mapProvider?-1:b===state.settings.mapProvider?1:0);
    const rows=providers.map((n,i)=>{
      const href=U.mapAppUrl(n,p,platform);
      return `<a class="provider-app" href="${esc(href)}" data-action="app-navigation" data-id="${n}" data-place="${p.id}"><span class="provider-icon provider-${n==='高德地图'?0:1}">${n[0]}</span><span>${n}</span>${icon('chevron')}</a>`;
    }).join('');
    openModal('导航',heading+`<div class="provider-list">${rows}</div><div id="provider-result" role="status" aria-live="polite"></div>`);
  }
  let cancelAppNotice=()=>{};
  function appNavigationNotice(){
    cancelAppNotice();
    const result=$('#provider-result');if(!result)return;
    result.textContent='';
    const stop=()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
    const visibility=()=>{if(document.hidden)stop();};
    const timer=setTimeout(()=>{stop();if(modal.open&&result.isConnected&&!document.hidden){const message=/MicroMessenger/i.test(navigator.userAgent)?'未打开？微信中请点右上角「…」，选择“在浏览器打开”。':'未打开？请确认已安装对应地图，并允许浏览器打开外部应用。';result.innerHTML=`<p class="provider-status">${message}</p>`;}},1800);
    document.addEventListener('visibilitychange',visibility);cancelAppNotice=stop;
  }
  function placeMenu(id){const p=place(id);if(!p)return;openModal(p.name,`<p class="sheet-place-name">${esc(p.enterprise)}</p><div class="option-list"><button data-action="menu-info" data-id="${p.id}">${icon('info')}场所资料${icon('chevron')}</button><button data-action="place-location" data-id="${p.id}">${icon('pin')}修改场所位置${icon('chevron')}</button><button data-action="menu-record" data-id="${p.id}">${icon('edit')}编辑图文指引${icon('chevron')}</button><button data-action="menu-route" data-id="${p.id}">${icon('route')}${state.completed.includes(id)?'再次走访':state.route.includes(id)?'查看走访清单':'加入走访清单'}${icon('chevron')}</button></div>`);}
  function formError(selector,message){const e=$(selector);e.hidden=false;e.textContent=message;e.scrollIntoView({block:'nearest'});}
  function addHistory(s,id,action,summary){s.recorded=[id,...s.recorded.filter(x=>x!==id)];s.history.unshift({id:'h-'+Date.now(),placeId:id,action,summary,author:'当前用户',time:now()});}
  function editInfo(id){const p=place(id);if(!p)return;
    openModal('场所资料',`<section class="info-heading"><h3>${esc(p.enterprise)}</h3><p>${esc(p.name)}</p>${status(p)}</section><form id="place-info-form"><div class="info-section"><h3>联系人</h3><label class="line-field"><span>姓名</span><input name="contact" maxlength="60" value="${esc(p.contact||'')}" placeholder="选填"></label><label class="line-field"><span>电话</span><input name="phone" type="tel" maxlength="40" value="${esc(p.phone||'')}" placeholder="选填"></label></div><fieldset class="info-section"><legend>企业标签</legend><div class="choice-grid tags-grid">${C.tags.map(t=>`<label class="choice"><input type="checkbox" name="tags" value="${t}" ${p.tags?.includes(t)?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset><p id="info-error" class="form-error" role="alert" hidden></p><button class="primary" type="submit">保存资料</button></form>`,true);
    modal.classList.add('info-editing');modalLeave=()=>showInfo(id);
    const initial=JSON.stringify([...new FormData($('#place-info-form'))]);modalDirty=()=>JSON.stringify([...new FormData($('#place-info-form'))])!==initial;
    $('#place-info-form').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);try{save(s=>{const p=s.places.find(p=>p.id===id);p.contact=String(data.get('contact')).trim();p.phone=String(data.get('phone')).trim();p.tags=data.getAll('tags');p.updated=now();addHistory(s,id,'更新场所资料','联系人与企业标签');});toast('资料已保存到本机');showInfo(id);}catch(e){formError('#info-error',e.message);}});

  }
  function showInfo(id){
    const p=place(id);if(!p)return;
    const phone=(p.phone||'').replace(/[^\d+*#-]/g,'');
    openModal('场所资料',`<section class="info-heading"><h3>${esc(p.enterprise)}</h3><p>${esc(p.name)}</p>${status(p)}</section><section class="info-block"><div class="section-heading"><h2>联系人</h2><button class="text-button" data-action="info-edit" data-id="${p.id}">编辑资料</button></div><div class="contact-summary"><span>${esc(p.contact||'暂无联系人')}</span>${phone?`<a href="tel:${phone}">${icon('phone')}${esc(p.phone)}</a>`:'<small>暂无联系方式</small>'}</div></section><section class="info-block"><div class="section-heading"><h2>企业标签</h2></div><div class="info-tags">${p.tags?.length?p.tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<small>暂无标签</small>'}</div></section><section class="comments-section"><div class="section-heading"><h2>现场留言 <small>${p.comments?.length||0}</small></h2><button class="text-button" data-action="comment-write" data-id="${p.id}">${icon('edit')}写留言</button></div>${p.comments?.map(c=>`<article class="comment-entry"><header><b>${esc(c.author)}</b><time>${esc(c.time)}</time></header><p>${esc(c.text)}</p></article>`).join('')||'<p class="quiet-empty">暂无现场留言</p>'}</section>`,true);
  }
  function writeComment(id){
    openModal('补充现场留言',`<form id="comment-form"><label><span class="sr-only">补充现场留言</span><textarea name="comment" maxlength="1000" rows="4" placeholder="补充楼层、门牌或其他现场信息"></textarea></label><div><button class="plain-button" type="submit">发布留言</button></div><p id="comment-error" class="form-error" role="alert" hidden></p></form>`);
    modalLeave=()=>showInfo(id);modalDirty=()=>!!modal.querySelector('textarea').value.trim();
    $('#comment-form').addEventListener('submit',e=>{e.preventDefault();const text=String(new FormData(e.target).get('comment')||'').trim();if(!text){formError('#comment-error','请先填写留言');return;}try{save(s=>{const p=s.places.find(p=>p.id===id);p.comments=[{id:'c-'+Date.now(),text,author:'当前用户',time:now()},...(p.comments||[])];p.updated=now();addHistory(s,id,'补充现场留言',text);});showInfo(id);toast('留言已保存到本机');}catch(e){formError('#comment-error',e.message);}});
  }
  function commitArrival(id,p,action,summary){save(s=>{s.places[s.places.findIndex(p=>p.id===id)]=p;addHistory(s,id,action,summary);});}
  function exportBackup(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='地址备忘录-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已生成本机记录备份');}
  function resetData(){const next=fresh();seed(next);next.recent=[];try{localStorage.setItem(U.KEY,JSON.stringify(next));state=next;modal.close();render();toast('已恢复示例数据');}catch{formError('#reset-error','未恢复：浏览器无法写入本机数据，原记录未更改。');}}
  const positionEditor=window.PositionEditor.create({getPlace:place,getState:()=>state,save(next,p,action,summary){state=U.persist(next,s=>addHistory(s,p.id,action,summary),localStorage);},onSaved(p){render();if(arrival.isOpen())arrival.open(p.id);toast('场所地址已保存');},onExisting(p){openGuide(p.id);}});
  function action(name,el){const id=el?.dataset.id;switch(name){
    case'detail':openGuide(id);break;case'record':positionEditor.open(id);break;case'record-detail':openGuide(id);break;case'add-place':positionEditor.open(null,{enterprise:query});break;case'place-location':modal.close();positionEditor.open(id);break;
    case'guide':go(page,'help');break;case'settings':go('mine','settings');break;case'my-records':go('mine','records');break;case'my-history':go('mine','history');break;case'back-page':go(subpage==='map'?'home':page);break;
    case'public-factories':sourceOnly=true;query='';filters={status:'all',tags:[]};searchOpen=true;$('#user-search').value=query;updateSearch();break;case'browse-all':sourceOnly=false;searchOpen=true;updateSearch();break;case'end-search':searchOpen=false;$('#user-search').blur();updateSearch();break;
    case'clear-query':sourceOnly=false;query='';$('#user-search').value='';searchOpen=true;updateSearch();$('#user-search').focus();break;
    case'reset-search':sourceOnly=false;query='';filters={status:'all',tags:[]};$('#user-search').value='';searchOpen=true;updateSearch();break;
    case'clear-recent':if(trySave(s=>s.recent=[]))updateSearch();break;
    case'filter':openFilters();break;case'filter-status':openFilters(true);break;
    case'filter-reset':modal.querySelectorAll('input[type="checkbox"]').forEach(e=>e.checked=false);modal.querySelector('input[value="all"]').checked=true;break;
    case'reset-filters':filters={status:'all',tags:[]};updateSearch();break;
    case'show-map':$('#user-search')?.blur();go('home','map');break;case'map-select':selected=id;renderMap();break;case'show-list':searchOpen=true;go('home');break;
    case'navigate':navigate(id);break;
    case'app-navigation':appNavigationNotice();break;
    case'navigation-record':modal.close();positionEditor.open(id);break;
    case'route-add':routeAdd(id);break;case'route-open':showRoute();break;case'route-manage':managing=!managing;render();break;case'route-up':moveRoute(id,-1);break;case'route-down':moveRoute(id,1);break;
    case'route-remove':if(trySave(s=>{s.route=s.route.filter(x=>x!==id);s.completed=s.completed.filter(x=>x!==id);})){render();toast('已移出走访清单');}break;
    case'route-complete':if(trySave(s=>{if(!s.completed.includes(id))s.completed.push(id);})){render();toast(U.nextStop(state)?'已记录到访，可继续下一站':'本次走访已完成');}break;
    case'route-restore':if(trySave(s=>s.completed=s.completed.filter(x=>x!==id)))render();break;
    case'route-clear-done':openModal('清除已完成场所','<p class="confirm-copy">仅从本次走访清单移除，场所资料仍会保留。</p><div class="sheet-actions"><button class="plain-button" data-action="close-modal">取消</button><button class="danger-button" data-action="route-confirm-clear">确认清除</button></div>');break;case'route-confirm-clear':if(trySave(s=>{s.route=s.route.filter(x=>!s.completed.includes(x));s.completed=[];})){modal.close();render();}break;
    
    case'route-navigate':{const p=U.nextStop(state);if(p){if(U.hasCoordinates(p))navigate(p.id);else positionEditor.open(p.id);}break;}case'add-visits':startVisitSelection();break;case'find-enterprises':searchOpen=true;go('home');break;case'visit-toggle':if(visitSelection.has(id))visitSelection.delete(id);else visitSelection.add(id);renderVisitOptions();break;case'visit-confirm':confirmVisitSelection();break;case'visit-cancel':go('route');break;
    case'place-menu':placeMenu(id);break;case'menu-info':showInfo(id);break;case'menu-record':modal.close();arrival.edit(id);break;case'menu-route':if(routeAdd(id))modal.close();break;
    case'info-edit':editInfo(id);break;case'comment-write':writeComment(id);break;
    case'close-modal':closeModal();break;case'keep-modal':modal.querySelector('.leave-overlay')?.remove();break;case'discard-modal':{const back=modalLeave;modalDirty=null;modalLeave=null;modal.querySelector('.leave-overlay')?.remove();if(back)back();else modal.close();break;}
    case'map-settings':mapSettings();break;case'set-map-provider':if(trySave(s=>s.settings.mapProvider=id)){modal.close();render();}break;case'export-backup':exportBackup();break;
    case'clear-local':openModal('恢复示例数据','<p class="confirm-copy">这会移除本机新增的现场记录、照片和走访清单，并恢复初始示例。建议先导出备份。</p><p id="reset-error" class="form-error" role="alert" hidden></p><div class="sheet-actions"><button class="plain-button" data-action="close-modal">取消</button><button class="danger-button" data-action="confirm-clear">确认恢复</button></div>');break;case'confirm-clear':resetData();break;
  }}
  const arrival=window.ArrivalGuide.create({getPlace:place,more:placeMenu,navigate,
    saveGuide(id,draft){const p=window.ArrivalData.applyGuide(place(id),draft,now());commitArrival(id,p,'更新到访指引',p.arrivalGuide.steps.length+' 段图文路线');toast('到访指引已保存到本机');},
    saveFeedback(id,feedback){const p=C.clone(place(id));p.updated=now();p.guideFeedback=[{...feedback,time:p.updated,id:'f-'+Date.now()},...(p.guideFeedback||[])];commitArrival(id,p,'补充到访信息',feedback.text);toast('补充已保存到本机');},
    onClose(){const y=scrolls.get(key())||window.scrollY;render();window.scrollTo(0,y);}
  });
  document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav){managing=false;go(nav.dataset.page);return;}const el=e.target.closest('[data-action]');if(el&&!el.disabled)try{action(el.dataset.action,el);}catch(e){toast(e.message);}});
  modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  render();if(loadProblem)toast(loadProblem);
})();
