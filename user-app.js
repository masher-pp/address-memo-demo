(function(){
  'use strict';
  const C=window.Memo,U=window.UserData,M=window.MemoMap,$=s=>document.querySelector(s),content=$('#user-content'),modal=$('#user-modal');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg aria-hidden="true"><use href="#u-${n}"/></svg>`;
  const now=()=>new Date().toLocaleString('zh-CN',{hour12:false});
  function fresh(){const s=C.fresh();return window.PublicFactories.merge(U.normalize({places:s.places,history:s.history,recent:['p1','p2']}));}
  let loadProblem='';
  function load(){try{const raw=localStorage.getItem(U.KEY);if(raw){const s=JSON.parse(raw);if(!Array.isArray(s.places)||!s.places.length)throw Error('invalid');return window.PublicFactories.merge(U.normalize(s));}}catch{loadProblem='无法读取本机记录，当前展示示例。';}return fresh();}
  let state=load(),page='home',subpage='',query='',searchOpen=false,composing=false,selected=null,managing=false,toastTimer;
  let filters={status:'all',tags:[]},modalDirty=null,modalLeave=null;
  const place=id=>state.places.find(p=>p.id===id),scrolls=new Map();
  function save(change){state=U.persist(state,change,localStorage);}
  function trySave(change){try{save(change);return true;}catch(e){toast(e.message);return false;}}
  function toast(t){clearTimeout(toastTimer);$('#user-toast').textContent=t;$('#user-toast').hidden=false;toastTimer=setTimeout(()=>$('#user-toast').hidden=true,3600);}
  function seed(s){const p=s.places.find(p=>p.id==='p1');if(p&&!p.arrivalGuide&&p.note===C.fresh().places[0].note)p.arrivalGuide=window.ArrivalGuide.exampleGuide();}seed(state);
  const status=p=>`<span class="status ${esc(p.status)}">${esc(C.statuses[p.status]||'待核实')}</span>`;
  const empty=(t,d,a='')=>`<div class="empty">${icon('pin')}<h2>${esc(t)}</h2><p>${esc(d)}</p>${a}</div>`;
  function openModal(title,body,screen=false){modalDirty=null;modalLeave=null;modal.classList.remove('info-editing');modal.querySelector('.leave-overlay')?.remove();$('#user-modal-title').textContent=title;$('#user-modal-body').innerHTML=body;modal.classList.toggle('modal-screen',screen);if(!modal.open)modal.showModal();$('#user-modal-body').scrollTop=0;}
  function closeModal(){
    if(modal.querySelector('.leave-overlay'))return;
    if(modalDirty?.()){
      const overlay=document.createElement('div');overlay.className='leave-overlay';overlay.innerHTML='<section role="alertdialog" aria-label="放弃未保存的内容"><h3>内容还未保存</h3><p>退出会放弃这次填写的内容。</p><div><button class="plain-button" data-action="keep-modal">继续填写</button><button class="danger-button" data-action="discard-modal">放弃修改</button></div></section>';modal.append(overlay);overlay.querySelector('button').focus();return;
    }
    if(modalLeave){const back=modalLeave;modalLeave=null;back();}else modal.close();
  }
  function key(){return page+'/'+subpage;}
  function go(p,sub=''){scrolls.set(key(),window.scrollY);page=p;subpage=sub;render();window.scrollTo(0,scrolls.get(key())||0);}
  function header(){const title=({records:'我的现场记录',history:'最近修改',settings:'设置',help:'使用说明',map:'地图查看'})[subpage]||({home:'企业地址',route:'走访清单',mine:'我的'})[page];
    $('.user-topbar').innerHTML=`<div class="page-heading">${subpage?`<button class="icon-button" data-action="back-page" aria-label="返回">${icon('back')}</button>`:''}<h1>${title}</h1></div>${!subpage&&page==='home'&&!searchOpen?`<button class="header-action" data-action="show-map">${icon('map')}地图</button>`:!subpage&&page==='route'&&state.route.length?`<button class="header-action" data-action="route-manage">${managing?'完成':'管理'}</button>`:!subpage&&page==='mine'?`<button class="icon-button" data-action="settings" aria-label="设置">${icon('settings')}</button>`:''}`;
    document.querySelectorAll('.user-tabbar [data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false');});
    const n=state.route.filter(id=>!state.completed.includes(id)).length;$('#user-route-count').hidden=!n;$('#user-route-count').textContent=n;
  }
  function render(){header();content.className=subpage==='map'?'map-page':page==='route'&&!subpage?'has-dock':'';
    if(subpage==='map')renderMap();else if(subpage==='records')renderRecords();else if(subpage==='history')renderHistory();else if(subpage==='settings')renderSettings();else if(subpage==='help')renderHelp();else if(page==='home')renderHome();else if(page==='route')renderRoute();else renderMine();}
  function renderHome(){
    content.innerHTML=`<div class="search-area"><label class="search-box">${icon('search')}<input id="user-search" type="search" autocomplete="off" enterkeyhint="search" value="${esc(query)}" placeholder="搜索企业名称、场所或地址" aria-label="搜索企业、场所或地址"><button class="clear-search ${query?'visible':''}" data-action="clear-query" aria-label="清除搜索">${icon('close')}</button></label></div><div id="search-controls"></div><div id="search-results"></div>`;updateSearch();
    const input=$('#user-search');input.addEventListener('focus',()=>{if(!searchOpen){searchOpen=true;updateSearch();}});
    input.addEventListener('compositionstart',()=>composing=true);input.addEventListener('compositionend',()=>{composing=false;query=input.value;updateSearch();});
    input.addEventListener('input',e=>{query=input.value;searchOpen=true;if(!composing&&!e.isComposing)updateSearch();});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!composing){e.preventDefault();input.blur();searchOpen=true;updateSearch();}});
  }
  const results=()=>U.filterPlaces(state,{query,...filters});
  function updateSearch(){
    const controls=$('#search-controls'),body=$('#search-results');if(!controls||!body)return;
    $('.clear-search')?.classList.toggle('visible',!!query);header();
    if(!searchOpen){const recent=state.recent.map(place).filter(Boolean);controls.innerHTML='';body.innerHTML=`<section class="public-factories"><button class="browse-all" data-action="public-factories"><span>苏州工厂<small>3 家企业 · 4 个厂区 · 官网公开定位</small></span>${icon('chevron')}</button></section><section class="recent-section"><div class="section-heading"><h2>最近查看</h2>${recent.length?`<button class="icon-button" data-action="clear-recent" aria-label="清除最近查看">${icon('trash')}</button>`:''}</div><div class="recent-list">${recent.length?recent.map(p=>`<button class="recent-item" data-action="detail" data-id="${esc(p.id)}"><span class="recent-icon">${icon('clock')}</span><span><b>${esc(p.enterprise)}</b><small>${esc(p.name)} · ${esc(p.address)}</small></span>${icon('chevron')}</button>`).join(''):'<p class="quiet-empty">查看过的企业会保留在这里</p>'}</div></section><button class="browse-all" data-action="browse-all">查看全部企业${icon('chevron')}</button>`;return;}
    const list=results(),n=filters.tags.length+(filters.status!=='all'?1:0);
    controls.innerHTML=`<div class="search-tools"><div class="filter-scroll"><button data-action="filter" class="filter-chip ${filters.tags.length?'selected':''}">${icon('filter')}${filters.tags.length?filters.tags.length+' 个标签':'企业标签'}</button><button data-action="filter-status" class="filter-chip ${filters.status!=='all'?'selected':''}">${esc(filters.status==='all'?'核实状态':C.statuses[filters.status])}${icon('down')}</button></div><button class="icon-button" data-action="show-map" aria-label="在地图上查看结果">${icon('map')}</button></div><div class="result-summary"><span>${list.length} 个场所</span>${n?'<button data-action="reset-filters">清除筛选</button>':'<button data-action="end-search">收起</button>'}</div>`;
    body.innerHTML=`<div class="result-list">${list.length?list.map(resultCard).join(''):empty('没有找到相关企业','试试企业简称、园区或道路名称','<button class="plain-button" data-action="reset-search">重置搜索</button>')}</div>`;
  }
  function resultCard(p){const added=state.route.includes(p.id),located=U.hasLocation(p);return `<article class="result-card"><button class="result-main" data-action="detail" data-id="${esc(p.id)}"><div class="result-title"><h2>${esc(p.enterprise)}</h2>${icon('chevron')}</div><p class="place-name">${esc(p.name)} ${p.publicSource?'<span class="status pending">公开定位</span>':status(p)}</p><p class="result-address">${esc(p.address)}</p></button><div class="result-bottom"><div class="result-tags">${(p.tags||[]).slice(0,2).map(t=>`<span>${esc(t.replace(/使用$/,''))}</span>`).join('')}</div><div class="result-actions"><button class="icon-button ${added?'is-added':''}" data-action="route-add" data-id="${esc(p.id)}" aria-label="${added?'已加入走访':'加入走访'}">${icon(added?'check':'route')}</button><button class="icon-button" data-action="place-menu" data-id="${esc(p.id)}" aria-label="更多场所操作">${icon('more')}</button><button class="compact-primary" data-action="${located?'navigate':'record'}" data-id="${esc(p.id)}">${icon(located?'arrow':'pin')}${located?'导航':'补充位置'}</button></div></div></article>`;}
  function openGuide(id){if(!place(id))return;selected=id;scrolls.set(key(),window.scrollY);trySave(s=>s.recent=[id,...s.recent.filter(x=>x!==id)].slice(0,10));arrival.open(id);}
  function openFilters(statusOnly=false){
    openModal(statusOnly?'核实状态':'筛选企业',`<form id="filter-form"><fieldset><legend>核实状态</legend><div class="choice-grid">${[['all','全部'],...Object.entries(C.statuses)].map(([v,t])=>`<label class="choice"><input type="radio" name="status" value="${v}" ${filters.status===v?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset>${statusOnly?'':`<fieldset><legend>企业标签 <small>匹配其中一项即可</small></legend><div class="choice-grid tags-grid">${C.tags.map(t=>`<label class="choice"><input type="checkbox" name="tags" value="${t}" ${filters.tags.includes(t)?'checked':''}><span>${t}</span></label>`).join('')}</div></fieldset>`}<div class="sheet-actions"><button type="button" class="plain-button" data-action="filter-reset">重置</button><button class="primary" type="submit">查看结果</button></div></form>`);
    $('#filter-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);filters={status:f.get('status')||'all',tags:statusOnly?filters.tags:f.getAll('tags')};modal.close();searchOpen=true;if(subpage==='map')renderMap();else updateSearch();});
  }
  function renderMap(){
    const list=results(),located=list.filter(p=>p.x!=null);if(!located.some(p=>p.id===selected))selected=located[0]?.id||null;const p=place(selected);
    content.innerHTML=`<div class="map-surface">${M.map(located,selected).replaceAll('data-action="detail"','data-action="map-select"')}<span class="map-disclaimer">示例地图 · 虚构地点</span></div><div class="map-search-label">${icon('search')}<span>${esc(query||'全部企业')} · ${located.length} 个示例点</span><button class="icon-button" data-action="filter" aria-label="筛选地图点位">${icon('filter')}</button></div><div class="map-result-panel">${p?`<div class="map-result-heading">${status(p)}<small>${located.findIndex(x=>x.id===p.id)+1} / ${located.length}</small></div><button class="map-place-main" data-action="detail" data-id="${esc(p.id)}"><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)} · ${esc(p.address)}</p></button><div class="map-place-actions"><button class="plain-button" data-action="detail" data-id="${esc(p.id)}">看入口指引${icon('chevron')}</button><button class="compact-primary" data-action="navigate" data-id="${esc(p.id)}">${icon('arrow')}导航</button></div>`:empty('没有可显示的示例点','未定位企业可在列表中补充位置')}<button class="map-to-list" data-action="show-list">${icon('list')}返回列表${list.length>located.length?' · 另有 '+(list.length-located.length)+' 处未在示例地图显示':''}</button></div>`;
  }
  function routeAdd(id){const p=place(id);if(!p)return;if(!U.hasLocation(p)){toast('请先补充这个场所的位置');return;}if(state.route.includes(id)){toast('已经在走访清单里');return;}if(trySave(s=>s.route.push(id))){updateSearch();header();toast('已加入走访清单');}}
  function renderRoute(){
    const todo=state.route.filter(id=>!state.completed.includes(id)).map(place).filter(Boolean),done=state.route.filter(id=>state.completed.includes(id)).map(place).filter(Boolean),next=todo[0];
    content.innerHTML=`<div class="route-overview"><span>${todo.length?`待走访 <b>${todo.length}</b> 家`:done.length?'本次走访已完成':'安排本次走访'}</span>${state.route.length?`<span class="muted">已完成 ${done.length} 家</span>`:''}</div>${next?`<section class="next-stop"><span class="section-kicker">下一站</span><button data-action="detail" data-id="${next.id}"><h2>${esc(next.enterprise)}</h2><p>${esc(next.name)}</p><small>${esc(next.address)}</small></button><div class="next-stop-actions"><button class="plain-button" data-action="detail" data-id="${next.id}">看入口指引${icon('chevron')}</button><button class="arrival-button" data-action="route-complete" data-id="${next.id}">${icon('check')}已到访</button></div></section>`:''}${todo.length?`<div class="section-heading"><h2>走访顺序</h2><button class="text-button" data-action="route-suggest">${icon('sort')}按点位调整</button></div><div class="route-list">${todo.map((p,i)=>routeRow(p,i,false)).join('')}</div><p class="list-footnote">${managing?'上下调整顺序，或移除暂不走访的企业。':'到访后点击“已到访”，继续前往下一家。'}</p>`:!done.length?empty('还没有走访安排','查找企业后，点击路线图标加入清单','<button class="primary" data-action="add-visits">添加企业</button>'):`<div class="route-finished">${icon('check')}<h2>本次走访已完成</h2><p>已完成 ${done.length} 个场所的到访</p><button class="plain-button" data-action="add-visits">继续添加企业</button></div>`}${done.length?`<div class="section-heading"><h2>已完成 <small>${done.length}</small></h2>${managing?'<button class="text-button" data-action="route-clear-done">清除已完成</button>':''}</div><div class="route-list completed-list">${done.map((p,i)=>routeRow(p,i,true)).join('')}</div>`:''}${next?`<div class="route-dock"><button class="secondary" data-action="add-visits">${icon('plus')}添加企业</button><button class="primary" data-action="route-navigate">${icon('arrow')}导航下一站</button></div>`:''}`;
  }
  function routeRow(p,i,done){return `<article class="route-item ${done?'is-completed':''}"><span class="route-num">${done?icon('check'):i+1}</span><button class="route-place" data-action="detail" data-id="${p.id}"><b>${esc(p.enterprise)}</b><small>${esc(p.name)}</small></button>${managing?`<div class="route-controls">${done?`<button class="icon-button" data-action="route-restore" data-id="${p.id}" aria-label="恢复待走访">${icon('undo')}</button>`:`<button class="icon-button" data-action="route-up" data-id="${p.id}" ${i===0?'disabled':''} aria-label="上移">${icon('up')}</button><button class="icon-button" data-action="route-down" data-id="${p.id}" ${i===state.route.filter(id=>!state.completed.includes(id)).length-1?'disabled':''} aria-label="下移">${icon('down')}</button>`}<button class="icon-button" data-action="route-remove" data-id="${p.id}" aria-label="移除">${icon('close')}</button></div>`:`<button class="icon-button" data-action="navigate" data-id="${p.id}" aria-label="导航到${esc(p.name)}">${icon('arrow')}</button>`}</article>`;}
  function moveRoute(id,delta){const ids=state.route.filter(x=>!state.completed.includes(x)),i=ids.indexOf(id),j=i+delta;if(i<0||j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];if(trySave(s=>s.route=[...ids,...s.route.filter(x=>s.completed.includes(x))]))render();}
  function menuRow(symbol,title,hint,action){return `<button class="menu-row" data-action="${action}">${icon(symbol)}<span>${title}</span><small>${esc(hint)}</small>${icon('chevron')}</button>`;}
  function renderMine(){content.innerHTML=`<section class="profile"><span class="profile-avatar">${icon('user')}</span><div><h2>演示体验</h2><p>现场记录保存在这台设备</p></div><span class="local-badge">本机</span></section><div class="menu-group">${menuRow('camera','我的现场记录',state.recorded.length+' 个场所','my-records')}${menuRow('clock','最近修改',state.history.length+' 条','my-history')}</div><div class="menu-group">${menuRow('map','默认导航地图',state.settings.mapProvider,'map-settings')}${menuRow('info','使用说明','','guide')}${menuRow('settings','设置与备份','','settings')}</div><p class="page-note">地址备忘录 · 用户端演示<br>当前尚未连接账号和共享服务</p>`;}
  function renderRecords(){const ps=state.recorded.map(place).filter(Boolean);content.innerHTML=`<p class="subpage-note">你补充过的入口位置、图文路线和现场信息</p>${ps.length?`<div class="record-list">${ps.map(p=>`<article class="record-card"><button data-action="detail" data-id="${p.id}"><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)}</p><span>${esc(p.arrivalGuide?.steps?.[0]?.description||p.guideFeedback?.[0]?.text||p.note||p.address)}</span></button><footer><small>${esc(p.updated)}</small><button class="text-button" data-action="record" data-id="${p.id}">继续编辑${icon('chevron')}</button></footer></article>`).join('')}</div>`:empty('还没有现场记录','在到访指引中点击“我来指路”，或补充入口位置。','<button class="plain-button" data-action="add-visits">查找企业</button>')}`;}
  function renderHistory(){content.innerHTML=state.history.length?`<div class="history-list">${state.history.map(h=>`<button class="history-entry" data-action="detail" data-id="${esc(h.placeId)}"><span class="history-dot"></span><div><div class="history-entry-title"><b>${esc(h.action)}</b><time>${esc(h.time)}</time></div><h2>${esc(place(h.placeId)?.enterprise||'场所记录')}</h2><p>${esc(h.summary||'资料已更新')}</p></div>${icon('chevron')}</button>`).join('')}</div>`:empty('暂无修改记录','保存现场信息后会在这里显示');}
  function renderSettings(){content.innerHTML=`<div class="settings-group"><h2>导航</h2>${menuRow('map','默认导航地图',state.settings.mapProvider,'map-settings')}</div><div class="settings-group"><h2>本机数据</h2>${menuRow('download','导出记录备份','JSON 文件','export-backup')}${menuRow('undo','恢复示例数据','','clear-local')}</div><p class="subpage-note">备份包含本机保存的地址、照片、补充说明和走访清单。浏览器清理网站数据后，这些记录也会被清除。</p><div class="settings-group"><h2>关于</h2>${menuRow('info','使用说明','','guide')}<div class="settings-caption"><span>版本</span><small>用户端 Demo 3.2</small></div></div>`;}
  function renderHelp(){content.innerHTML=`<div class="help-content"><h2>找企业，看入口</h2><p>搜索企业、场所或地址，点开结果查看完整图文指引。同一家企业的不同场所分别显示。</p><h2>导航与走访</h2><p>点击导航选择地图。需要连续去几家企业时，先加入走访清单；到访后标记完成，再去下一站。</p><h2>记录现场</h2><p>“我来指路”可上传照片、补充入口变化。修改整条路线或入口位置，在场所“更多”中选择“编辑图文指引”。</p><h2>这份演示的数据</h2><p>“苏州工厂”收录了企业官网公开的厂区地址与坐标，尚未实地核实入口。其他初始企业及示意地图点位为虚构示例。新增内容只保存在当前浏览器，未同步到其他设备；可在设置中导出备份。</p><h2>地图与手机定位</h2><p>苏州工厂可直接使用公开厂区坐标导航；虚构示例没有真实坐标，需在实际入口处定位并保存后再导航。百度、高德可调用手机 App 驾车导航；百度网页版会先获取当前位置作为起点。手机定位需 HTTPS 和位置权限；实际路线以地图软件为准。</p></div>`;}
  function mapSettings(){openModal('默认导航地图',`<div class="option-list">${['每次询问','高德地图','百度地图','腾讯地图'].map(n=>`<button data-action="set-map-provider" data-id="${n}"><span>${n}</span>${state.settings.mapProvider===n?icon('check'):''}</button>`).join('')}</div><p class="sheet-note">选择后，导航面板会优先显示这张地图。</p>`);}
  function navigationPlatform(){return /iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1?'ios':/Android|HarmonyOS/i.test(navigator.userAgent)?'android':'desktop';}
  function navigate(id){
    const p=place(id);if(!p)return;selected=id;
    const heading=`<div class="navigation-place"><h3>${esc(p.enterprise)}</h3><p>${esc(p.name)} · ${esc(p.address)}</p></div>`;
    if(!U.hasCoordinates(p)){
      openModal('还没有真实入口位置',heading+'<p class="navigation-caution">这个场所尚未记录真实坐标。示意地图上的点不能用于实际导航。</p><button class="primary navigation-record" data-action="navigation-record" data-id="'+esc(id)+'">到入口现场补充定位</button><p class="sheet-note">请在实际入口处使用手机定位，保存后即可导航到该位置。</p>');return;
    }
    const platform=navigationPlatform(),mobile=platform!=='desktop',providers=['高德地图','百度地图','腾讯地图'];
    if(providers.includes(state.settings.mapProvider))providers.sort((a,b)=>a===state.settings.mapProvider?-1:b===state.settings.mapProvider?1:0);
    const rows=providers.map((n,i)=>{
      const href=mobile?U.mapAppUrl(n,p,platform):null;
      const inside=`<span class="provider-icon provider-${i}">${n[0]}</span><span>${n}<small>${href?'打开 App 驾车导航':'网页路线规划'}</small></span>${icon('chevron')}`;
      return href?`<a class="provider-app" href="${esc(href)}" data-action="app-navigation" data-id="${n}" data-place="${p.id}">${inside}</a>`:`<button data-action="provider" data-id="${n}" data-place="${p.id}">${inside}</button>`;
    }).join('');
    openModal(window.PublicFactories.usesPublishedPosition(p)?'导航到厂区':'导航到入口',heading+`<div class="provider-list">${rows}</div><div id="provider-result" role="status"></div>${mobile?`<details class="navigation-fallback"><summary>地图没有唤起？</summary><p class="sheet-note">请先安装地图 App。微信内打不开时，用手机自带浏览器打开本站。</p><button class="plain-button" data-action="provider" data-id="百度地图" data-place="${p.id}">使用百度网页版规划路线</button></details>`:''}<p class="sheet-note">${window.PublicFactories.usesPublishedPosition(p)?'目的地为官网标注的厂区，实际门岗入口待现场确认。':'目的地已使用记录的入口坐标。'}地图中如出现确认提示，请按提示开始导航。</p>`);
  }
  function openWebRoute(provider,id){
    const p=place(id);if(!U.hasCoordinates(p)){navigate(id);return;}
    const result=$('#provider-result');
    if(provider!=='百度地图'){
      const url=U.mapUrl(provider,p);window.open(url,'_blank','noopener');
      result.innerHTML=`<a class="external-map-link" href="${esc(url)}" target="_blank" rel="noopener">打开${esc(provider)}路线规划${icon('arrow')}</a>`;return;
    }
    result.innerHTML='<p class="provider-status">正在获取当前位置作为起点…</p>';
    if(!window.isSecureContext||!navigator.geolocation){result.innerHTML='<p class="form-error">当前浏览器无法定位，请用手机浏览器打开 HTTPS 链接，或直接使用地图 App 导航。</p>';return;}
    navigator.geolocation.getCurrentPosition(pos=>{
      if(!modal.open||selected!==id||!result.isConnected)return;
      const url=U.mapUrl(provider,p,{lat:pos.coords.latitude,lng:pos.coords.longitude});
      result.innerHTML=`<a class="external-map-link" href="${esc(url)}" target="_blank" rel="noopener">打开百度驾车路线${icon('arrow')}</a><p class="sheet-note">已准备好起点和入口坐标，点击上方按钮打开路线。</p>`;
    },e=>{
      if(!modal.open||selected!==id||!result.isConnected)return;
      result.innerHTML=`<p class="form-error">${e.code===1?'未获位置权限，无法确定路线起点。请允许浏览器定位，或选择地图 App 导航。':e.code===3?'获取起点超时，请重试或选择地图 App 导航。':'暂时无法获取起点，请重试或选择地图 App 导航。'}</p>`;
    },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
  }
  function placeMenu(id){const p=place(id);if(!p)return;openModal(p.name,`<p class="sheet-place-name">${esc(p.enterprise)}</p><div class="option-list"><button data-action="menu-info" data-id="${p.id}">${icon('info')}场所资料${icon('chevron')}</button><button data-action="menu-record" data-id="${p.id}">${icon('edit')}编辑图文指引${icon('chevron')}</button><button data-action="menu-route" data-id="${p.id}">${icon('route')}${state.route.includes(id)?'已在走访清单':'加入走访清单'}${icon('chevron')}</button></div>`);}
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
    const source=p.publicSource;
    const sourceInfo=source?`<section class="info-block public-source"><h2>公开定位来源</h2><p>${esc(source.map)} · ${esc(source.checkedOn)}</p><p>原始坐标：${source.lng}, ${source.lat}（${esc(source.coordSystem.toUpperCase())}，经度、纬度）</p><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">查看企业官网</a><p>${window.PublicFactories.usesPublishedPosition(p)?'厂区位置，实际入口待现场核实':'当前坐标已在本机修改；以上为最初收录依据'}</p></section>`:'';
    openModal('场所资料',`<section class="info-heading"><h3>${esc(p.enterprise)}</h3><p>${esc(p.name)}</p>${status(p)}</section>${sourceInfo}<section class="info-block"><div class="section-heading"><h2>联系人</h2><button class="text-button" data-action="info-edit" data-id="${p.id}">编辑资料</button></div><div class="contact-summary"><span>${esc(p.contact||'暂无联系人')}</span>${phone?`<a href="tel:${phone}">${icon('phone')}${esc(p.phone)}</a>`:'<small>暂无联系方式</small>'}</div></section><section class="info-block"><div class="section-heading"><h2>企业标签</h2></div><div class="info-tags">${p.tags?.length?p.tags.map(t=>`<span>${esc(t)}</span>`).join(''):'<small>暂无标签</small>'}</div></section><section class="comments-section"><div class="section-heading"><h2>现场留言 <small>${p.comments?.length||0}</small></h2><button class="text-button" data-action="comment-write" data-id="${p.id}">${icon('edit')}写留言</button></div>${p.comments?.map(c=>`<article class="comment-entry"><header><b>${esc(c.author)}</b><time>${esc(c.time)}</time></header><p>${esc(c.text)}</p></article>`).join('')||'<p class="quiet-empty">暂无现场留言</p>'}</section>`,true);
  }
  function writeComment(id){
    openModal('补充现场留言',`<form id="comment-form"><label><span class="sr-only">补充现场留言</span><textarea name="comment" maxlength="1000" rows="4" placeholder="补充楼层、门牌或其他现场信息"></textarea></label><div><small>最多 1000 字</small><button class="plain-button" type="submit">发布留言</button></div><p id="comment-error" class="form-error" role="alert" hidden></p></form>`);
    modalLeave=()=>showInfo(id);modalDirty=()=>!!modal.querySelector('textarea').value.trim();
    $('#comment-form').addEventListener('submit',e=>{e.preventDefault();const text=String(new FormData(e.target).get('comment')||'').trim();if(!text){formError('#comment-error','请先填写留言');return;}try{save(s=>{const p=s.places.find(p=>p.id===id);p.comments=[{id:'c-'+Date.now(),text,author:'当前用户',time:now()},...(p.comments||[])];p.updated=now();addHistory(s,id,'补充现场留言',text);});showInfo(id);toast('留言已保存到本机');}catch(e){formError('#comment-error',e.message);}});
  }
  function commitArrival(id,p,action,summary){save(s=>{s.places[s.places.findIndex(p=>p.id===id)]=p;addHistory(s,id,action,summary);});}
  function exportBackup(){const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='地址备忘录-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('已生成本机记录备份');}
  function resetData(){const next=fresh();seed(next);next.recent=[];try{localStorage.setItem(U.KEY,JSON.stringify(next));state=next;modal.close();render();toast('已恢复示例数据');}catch{formError('#reset-error','未恢复：浏览器无法写入本机数据，原记录未更改。');}}
  function action(name,el){const id=el?.dataset.id;switch(name){
    case'detail':openGuide(id);break;case'record':arrival.edit(id);break;
    case'guide':go(page,'help');break;case'settings':go('mine','settings');break;case'my-records':go('mine','records');break;case'my-history':go('mine','history');break;case'back-page':go(subpage==='map'?'home':page);break;
    case'public-factories':query='苏州';filters={status:'all',tags:[]};searchOpen=true;$('#user-search').value=query;updateSearch();break;case'browse-all':searchOpen=true;updateSearch();break;case'end-search':searchOpen=false;$('#user-search').blur();updateSearch();break;
    case'clear-query':query='';$('#user-search').value='';searchOpen=true;updateSearch();$('#user-search').focus();break;
    case'reset-search':query='';filters={status:'all',tags:[]};$('#user-search').value='';searchOpen=true;updateSearch();break;
    case'clear-recent':if(trySave(s=>s.recent=[]))updateSearch();break;
    case'filter':openFilters();break;case'filter-status':openFilters(true);break;
    case'filter-reset':modal.querySelectorAll('input[type="checkbox"]').forEach(e=>e.checked=false);modal.querySelector('input[value="all"]').checked=true;break;
    case'reset-filters':filters={status:'all',tags:[]};updateSearch();break;
    case'show-map':$('#user-search')?.blur();go('home','map');break;case'map-select':selected=id;renderMap();break;case'show-list':searchOpen=true;go('home');break;
    case'navigate':navigate(id);break;
    case'app-navigation':$('#provider-result').innerHTML='<p class="provider-status">如未进入导航，请检查是否已安装地图 App，或展开下方其他方式。</p>';break;
    case'provider':openWebRoute(id,el.dataset.place);break;
    case'navigation-record':modal.close();arrival.edit(id);break;
    case'route-add':routeAdd(id);break;case'route-manage':managing=!managing;render();break;case'route-up':moveRoute(id,-1);break;case'route-down':moveRoute(id,1);break;
    case'route-remove':if(trySave(s=>{s.route=s.route.filter(x=>x!==id);s.completed=s.completed.filter(x=>x!==id);})){render();toast('已移出走访清单');}break;
    case'route-complete':if(trySave(s=>{if(!s.completed.includes(id))s.completed.push(id);})){render();toast(U.nextStop(state)?'已记录到访，可继续下一站':'本次走访已完成');}break;
    case'route-restore':if(trySave(s=>s.completed=s.completed.filter(x=>x!==id)))render();break;
    case'route-clear-done':if(trySave(s=>{s.route=s.route.filter(x=>!s.completed.includes(x));s.completed=[];}))render();break;
    case'route-suggest':if(trySave(s=>s.route=U.orderStops(s))){render();toast('已按点位距离调整；实际道路以地图为准');}break;
    case'route-navigate':{const p=U.nextStop(state);if(p)navigate(p.id);break;}case'add-visits':searchOpen=true;go('home');break;
    case'place-menu':placeMenu(id);break;case'menu-info':showInfo(id);break;case'menu-record':modal.close();arrival.edit(id);break;case'menu-route':routeAdd(id);modal.close();break;
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
  document.addEventListener('click',e=>{const nav=e.target.closest('[data-page]');if(nav){go(nav.dataset.page);return;}const el=e.target.closest('[data-action]');if(el&&!el.disabled)try{action(el.dataset.action,el);}catch(e){toast(e.message);}});
  modal.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  render();if(loadProblem)toast(loadProblem);
})();
