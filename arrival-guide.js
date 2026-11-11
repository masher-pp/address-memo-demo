/* Mobile arrival instructions: each photo belongs to exactly one written step. */
(function(){
  'use strict';
  const G=window.ArrivalData;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<svg aria-hidden="true"><use href="#u-${name}"/></svg>`;
  const num=i=>String(i+1).padStart(2,'0');
  const clone=o=>JSON.parse(JSON.stringify(o));

  function create(host){
    const dialog=document.createElement('dialog');
    dialog.id='arrival-dialog';dialog.setAttribute('aria-label','到访指引');
    document.body.append(dialog);
    let placeId=null,mode='view',draft=null,initial='',previousOverflow='',error='',busy=false,locating=false,session=0;
    let returnMode='view',activePhoto=0,markDraft=[],markTool='arrow',markStart=null,markEnd=null,markImage=null,markCanvas=null;
    let feedback={text:'',photo:''},feedbackInitial='',zoomed=false,viewScroll=0,recordsReturn='feedback';
    const place=()=>host.getPlace(placeId);
    const field=(name,value,placeholder='',max=200)=>`<label class="ag-field"><span>${esc(name==='parking'?'停车说明（选填）':'地址 / 位置线索')}</span><textarea data-ag-field="${name}" maxlength="${max}" rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
    function bar(title,right=''){return `<header class="ag-bar"><button data-ag="back" aria-label="返回">${icon('back')}</button><h1>${esc(title)}</h1>${right||'<span class="ag-bar-space"></span>'}</header>`;}
    function footer(buttons){return `<footer class="ag-footer">${buttons}</footer>`;}
    function errorBox(){return `<p class="ag-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p>`;}
    function setError(message){error=message;let el=dialog.querySelector('.ag-error');if(el){el.textContent=error;el.hidden=false;el.scrollIntoView({block:'nearest'});}}
    function reset(){error='';busy=false;locating=false;session++;}
    function open(id,edit=false){
      if(!host.getPlace(id))return;
      reset();placeId=id;mode=edit?'edit':'view';draft=null;viewScroll=0;
      if(edit)beginEdit();
      if(!dialog.open)previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
      render();if(!dialog.open)dialog.showModal();
    }
    function close(){session++;dialog.close();document.body.style.overflow=previousOverflow;host.onClose?.();}
    function beginEdit(){draft=G.draftFor(place());initial=JSON.stringify(draft);mode='edit';error='';}
    function currentGuide(){return G.draftFor(place());}
    function photoButton(s,i){return s.photo?`<button class="ag-step-photo" data-ag="photo-view" data-index="${i}" aria-label="放大第 ${i+1} 步照片"><canvas data-ag-photo="${i}" role="img" aria-label="第 ${i+1} 步路线照片"></canvas></button>`:'';}
    function renderView(){
      const p=place(),g=currentGuide(),hasContent=g.steps.some(s=>s.description||s.photo),cover=p.photos?.[0]?.src;
      const noRealPhoto=!cover;
      return bar('到访指引',host.more?`<button data-ag="more" aria-label="更多场所操作">${icon('more')}</button>`:'')+`<div class="ag-body ag-reader"><section class="ag-place"><div class="ag-cover ${noRealPhoto?'ag-cover-compact':''}">${cover?`<img src="${esc(cover)}" alt="场所入口">`:`<div class="ag-cover-empty">${icon('pin')}<span>尚无现场照片</span></div>`}<div class="ag-cover-info"><div><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)} · ${esc(p.address)}</p></div><button data-ag="navigate" aria-label="导航到入口">${icon('arrow')}<span>导航</span></button></div></div></section>${g.parking?`<section class="ag-parking"><h2>停车指南</h2><p>${esc(g.parking)}</p></section>`:''}<section class="ag-route"><div class="ag-section-head"><h2>企业指路</h2><button data-ag="feedback">${icon('edit')}我来指路</button></div>${hasContent?`<ol class="ag-timeline">${g.steps.map((s,i)=>`<li class="ag-read-step"><span class="ag-step-num">${num(i)}</span><div class="ag-step-content"><p>${esc(s.description)}</p>${photoButton(s,i)}</div></li>`).join('')}</ol>`:'<div class="ag-empty">暂时还没有指路信息</div>'}</section></div>`;
    }
    function stepEditor(s,i){
      return `<article class="ag-edit-step" data-step="${esc(s.id)}"><header><b><span>${num(i)}</span> ${i===0?'从这里开始':'下一步'}</b><div><button data-ag="move-up" data-index="${i}" aria-label="上移第 ${i+1} 步" ${i===0?'disabled':''}>↑</button><button data-ag="move-down" data-index="${i}" aria-label="下移第 ${i+1} 步" ${i===draft.steps.length-1?'disabled':''}>↓</button><button data-ag="remove-step" data-index="${i}" aria-label="删除第 ${i+1} 步" ${draft.steps.length===1?'disabled':''}>${icon('trash')}</button></div></header><label class="ag-photo-input">${s.photo?`<canvas data-ag-edit-photo="${i}" role="img" aria-label="第 ${i+1} 步照片"></canvas><span class="ag-replace">更换照片</span>`:`<span class="ag-photo-empty">${icon('camera')}拍摄 / 选择照片</span>`}<input data-ag="photo-file" data-index="${i}" type="file" accept="image/jpeg,image/png,image/webp" aria-label="第 ${i+1} 步照片"></label>${s.photo?`<div class="ag-photo-tools"><button data-ag="annotate" data-index="${i}">画箭头 / 框${s.marks?.length?' · '+s.marks.length:''}</button><button data-ag="remove-photo" data-index="${i}">移除照片</button></div>`:''}<label class="ag-step-text"><span class="ag-sr">第 ${i+1} 步说明</span><textarea data-ag-field="description" data-index="${i}" maxlength="300" rows="3" placeholder="${i===0?'例如：从科创路东门进入，沿主路直行约200米':'例如：在A3栋左转，一层蓝色门牌处即到'}">${esc(s.description)}</textarea><small data-ag-count="${i}">${s.description.length}/300</small></label></article>`;
    }
    function renderEditor(){
      const p=place();
      return bar('填写到访指引',`<button class="ag-text" data-ag="preview">预览</button>`)+`<div class="ag-body"><div class="ag-edit-intro"><h2>${esc(p.enterprise)}</h2><p>${esc(p.name)}</p></div><section class="ag-position"><div><h2>入口位置</h2><button data-ag="locate" ${locating?'disabled':''}>${icon('pin')}${locating?'定位中…':draft.lat!==null?'重新定位':'使用手机定位'}</button></div>${draft.lat!==null?`<p class="ag-coordinate">已获取 ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}${draft.accuracy!==null?' · 精度约 '+Math.round(draft.accuracy)+' 米':''}</p>`:'<p class="ag-position-hint">位置不变时无需重新定位。</p>'}${field('address',draft.address,'道路、园区、楼栋和门牌')}</section><section class="ag-parking-edit">${field('parking',draft.parking,'例如：东门外停车，步行进入园区')}</section><div class="ag-edit-route-head"><h2>图文路线</h2></div><div class="ag-edit-steps">${draft.steps.map(stepEditor).join('')}</div><button class="ag-add-step" data-ag="add-step" ${draft.steps.length>=8?'disabled':''}>${icon('plus')}${draft.steps.length>=8?'最多 8 步':'添加下一步'}</button>${busy?'<p class="ag-busy" role="status">正在处理照片…</p>':''}${errorBox()}</div>`+footer(`<button class="ag-primary" data-ag="save" ${busy||locating?'disabled':''}>保存指引</button>`);
    }
    function renderPreview(){
      return bar('预览指引')+`<div class="ag-body"><div class="ag-preview-note">尚未保存</div><h2 class="ag-preview-title">${esc(place().enterprise)}</h2>${draft.parking?`<section class="ag-parking"><h2>停车说明</h2><p>${esc(draft.parking)}</p></section>`:''}<ol class="ag-timeline ag-preview-timeline">${draft.steps.map((s,i)=>`<li class="ag-read-step"><span class="ag-step-num">${num(i)}</span><div class="ag-step-content"><p>${esc(s.description||'（未填写说明）')}</p>${s.photo?`<canvas data-ag-edit-photo="${i}" role="img" aria-label="第 ${i+1} 步照片"></canvas>`:''}</div></li>`).join('')}</ol>${errorBox()}</div>`+footer('<button class="ag-primary" data-ag="return-edit">继续编辑</button>');
    }
    function renderFeedback(){
      return bar('信息报错',`<button data-ag="records" class="ag-text">贡献记录</button>`)+`<div class="ag-body"><div class="ag-feedback-form"><h2>上传图片</h2><label class="ag-feedback-upload">${feedback.photo?`<img src="${esc(feedback.photo)}" alt="补充照片">`:`${icon('camera')}<span>上传照片</span>`}<input type="file" data-ag="feedback-file" accept="image/jpeg,image/png,image/webp" aria-label="上传补充照片"></label><label class="ag-feedback-text"><b>补充说明</b><textarea data-ag-field="feedback" maxlength="300" rows="4" placeholder="补充入口、楼层或路线说明">${esc(feedback.text)}</textarea><small id="ag-feedback-count">${feedback.text.length}/300</small></label>${busy?'<p class="ag-busy" role="status">正在处理照片…</p>':''}${errorBox()}</div></div><footer class="ag-footer ag-submit"><button class="ag-primary" data-ag="feedback-save" ${busy?'disabled':''}>提交</button></footer>`;
    }
    function renderRecords(){
      const records=place().guideFeedback||[];
      return bar('贡献记录')+`<div class="ag-body"><section class="ag-feedback-list">${records.length?records.map((f,i)=>`<article class="ag-feedback-record"><p>${esc(f.text)}</p>${f.photo?`<button data-ag="feedback-photo-view" data-index="${i}" class="ag-feedback-photo"><img src="${esc(f.photo)}" alt="补充照片"></button>`:''}<small>${esc(f.time)}</small></article>`).join(''):'<p class="ag-empty">还没有贡献记录</p>'}</section><div class="ag-record-tools"><button class="ag-text" data-ag="edit">编辑图文指引${icon('chevron')}</button></div></div>`;
    }
    function renderPhoto(){
      const s=returnMode==='feedback-photo'?{photo:place().guideFeedback[activePhoto].photo,marks:[]}:currentGuide().steps[activePhoto];
      return bar('查看照片',`<button data-ag="zoom" class="ag-text">${zoomed?'缩小':'放大'}</button>`)+`<div class="ag-lightbox ${zoomed?'ag-zoomed':''}"><canvas id="ag-lightbox-canvas" role="img" aria-label="路线照片，含标注"></canvas></div><p class="ag-photo-caption">${esc(s.description||'补充照片')}</p>`;
    }
    function renderAnnotator(){return bar('标注照片',`<button class="ag-text" data-ag="mark-done">完成</button>`)+`<div class="ag-body ag-annotation"><p>在照片上拖动画箭头或框。完成后返回填写。</p><canvas id="ag-mark-canvas" role="img" aria-label="可拖动标注的路线照片"></canvas><div class="ag-mark-tools"><button data-ag="tool-arrow" class="${markTool==='arrow'?'active':''}">箭头</button><button data-ag="tool-box" class="${markTool==='box'?'active':''}">框选</button><button data-ag="mark-undo" ${markDraft.length?'':'disabled'}>撤销</button><button data-ag="mark-clear" ${markDraft.length?'':'disabled'}>清除</button></div></div>`;}
    function render(keepScroll=false){
      const scroll=keepScroll?dialog.querySelector('.ag-body')?.scrollTop||0:0;
      dialog.classList.toggle('ag-dark',mode==='photo');
      dialog.innerHTML=mode==='view'?renderView():mode==='edit'?renderEditor():mode==='preview'?renderPreview():mode==='feedback'?renderFeedback():mode==='records'?renderRecords():mode==='photo'?renderPhoto():mode==='annotate'?renderAnnotator():bar('退出编辑')+`<div class="ag-body ag-exit"><h2>还未保存</h2><p>退出会放弃本次修改。</p><button class="ag-primary" data-ag="keep-edit">继续填写</button><button data-ag="discard">放弃修改</button></div>`;
      if(dialog.querySelector('.ag-body'))dialog.querySelector('.ag-body').scrollTop=mode==='view'?viewScroll:scroll;
      const readSteps=currentGuide().steps;
      dialog.querySelectorAll('[data-ag-photo]').forEach(c=>{const s=readSteps[Number(c.dataset.agPhoto)];paintPhoto(c,s);});
      dialog.querySelectorAll('[data-ag-edit-photo]').forEach(c=>paintPhoto(c,draft.steps[Number(c.dataset.agEditPhoto)]));
      if(mode==='photo'){const s=returnMode==='feedback-photo'?{photo:place().guideFeedback[activePhoto].photo,marks:[]}:readSteps[activePhoto];paintPhoto(dialog.querySelector('#ag-lightbox-canvas'),s);}
      if(mode==='annotate')setupAnnotator();
    }
    function back(){
      if(busy||locating){setError('请等待处理完成后再返回');return;}
      if(mode==='annotate'){mode='edit';render();return;}
      if(mode==='photo'){mode=returnMode==='feedback-photo'?'records':'view';render();return;}
      if(mode==='records'){mode=recordsReturn;render();return;}
      if(mode==='preview'){mode='edit';render();return;}
      if(mode==='confirm'){mode=returnMode;render();return;}
      if(mode==='edit'||mode==='feedback'){
        const dirty=mode==='edit'?JSON.stringify(draft)!==initial:JSON.stringify(feedback)!==feedbackInitial;
        if(dirty){returnMode=mode;mode='confirm';render();return;}
        mode='view';render();return;
      }
      close();
    }
    function locate(){
      if(!window.isSecureContext){setError('手机定位需要 HTTPS 链接，请用浏览器打开 HTTPS 页面后重试。');return;}
      if(!navigator.geolocation){setError('当前浏览器不支持定位，请保留已有地址或填写位置线索。');return;}
      const request=session;locating=true;render(true);
      navigator.geolocation.getCurrentPosition(pos=>{
        if(request!==session||mode!=='edit')return;
        locating=false;draft.lat=pos.coords.latitude;draft.lng=pos.coords.longitude;draft.accuracy=pos.coords.accuracy;render(true);
      },e=>{
        if(request!==session||mode!=='edit')return;
        locating=false;render(true);setError(e.code===1?'定位权限未开启，请在浏览器设置中允许位置访问。':e.code===3?'定位超时，请到室外或信号较好的位置重试。':'暂时无法定位，请稍后重试；已填内容会保留。');
      },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    }
    async function upload(input){
      const file=input.files[0];if(!file)return;
      const request=session,target=mode==='edit'?draft.steps[Number(input.dataset.index)]:feedback;
      const fromMode=mode;busy=true;error='';render(true);
      try{
        const src=await compressPhoto(file);
        if(session!==request||mode!==fromMode)return;
        if(fromMode==='edit'){target.photo=src;target.marks=[];}else target.photo=src;
      }catch(e){error=e.message;}
      finally{if(session===request){busy=false;render(true);}}
    }
    function saveGuide(){
      if(busy||locating)return;
      try{G.applyGuide(place(),draft,new Date().toLocaleString('zh-CN',{hour12:false}));host.saveGuide(placeId,draft);mode='view';draft=null;error='';render();}
      catch(e){setError(e.message);}
    }
    function saveFeedback(){
      if(busy)return;
      if(!feedback.text.trim()){setError('请填写补充说明');return;}
      try{host.saveFeedback(placeId,{text:feedback.text.trim(),photo:feedback.photo});feedback={text:'',photo:''};feedbackInitial=JSON.stringify(feedback);recordsReturn='view';mode='records';error='';render();}
      catch(e){setError(e.message);}
    }
    function action(name,el){
      const i=Number(el.dataset.index);
      if(mode==='view')viewScroll=dialog.querySelector('.ag-body')?.scrollTop||0;
      if(busy||locating){if(name!=='back')return;}
      switch(name){
        case 'back':back();break;
        case 'more':host.more?.(placeId);break;
        case 'edit':beginEdit();render();break;
        case 'save':saveGuide();break;
        case 'preview':mode='preview';render();break;
        case 'return-edit':mode='edit';render();break;
        case 'locate':locate();break;
        case 'add-step':if(draft.steps.length<8){draft.steps.push(G.step());render(true);dialog.querySelector('.ag-edit-step:last-child').scrollIntoView({block:'start',behavior:'smooth'});}break;
        case 'remove-step':if(draft.steps.length>1){draft.steps.splice(i,1);render(true);}break;
        case 'move-up':case 'move-down':{const j=i+(name==='move-up'?-1:1);if(j>=0&&j<draft.steps.length){[draft.steps[i],draft.steps[j]]=[draft.steps[j],draft.steps[i]];render(true);}break;}
        case 'remove-photo':draft.steps[i].photo='';draft.steps[i].marks=[];render(true);break;
        case 'annotate':activePhoto=i;markDraft=clone(draft.steps[i].marks||[]);markTool='arrow';mode='annotate';render();break;
        case 'mark-done':draft.steps[activePhoto].marks=clone(markDraft);mode='edit';render();break;
        case 'tool-arrow':case 'tool-box':markTool=name==='tool-box'?'box':'arrow';render(true);break;
        case 'mark-undo':markDraft.pop();render(true);break;
        case 'mark-clear':markDraft=[];render(true);break;
        case 'photo-view':activePhoto=i;returnMode='view';zoomed=false;mode='photo';render();break;
        case 'feedback-photo-view':activePhoto=i;returnMode='feedback-photo';zoomed=false;mode='photo';render();break;
        case 'zoom':zoomed=!zoomed;render();break;
        case 'feedback':beginEdit();render();break;
        case 'records':recordsReturn='feedback';mode='records';error='';render();break;
        case 'feedback-save':saveFeedback();break;
        case 'keep-edit':mode=returnMode;render();break;
        case 'discard':mode='view';draft=null;error='';render();break;
        case 'navigate':close();host.navigate(placeId);break;
      }
    }
    dialog.addEventListener('click',e=>{const el=e.target.closest('[data-ag]');if(el&&!el.disabled)action(el.dataset.ag,el);});
    dialog.addEventListener('input',e=>{
      const input=e.target,kind=input.dataset.agField;if(!kind)return;
      if(kind==='description'){draft.steps[Number(input.dataset.index)].description=input.value;dialog.querySelector(`[data-ag-count="${input.dataset.index}"]`).textContent=input.value.length+'/300';}
      else if(kind==='feedback'){feedback.text=input.value;dialog.querySelector('#ag-feedback-count').textContent=input.value.length+'/300';}
      else if(draft)draft[kind]=input.value;
      error='';const er=dialog.querySelector('.ag-error');if(er)er.hidden=true;
    });
    dialog.addEventListener('change',e=>{if(e.target.matches('input[type="file"][data-ag]'))upload(e.target);});
    dialog.addEventListener('cancel',e=>{e.preventDefault();back();});
    function setupAnnotator(){
      markCanvas=dialog.querySelector('#ag-mark-canvas');markImage=null;markStart=null;markEnd=null;
      const thisCanvas=markCanvas,img=new Image();
      img.onload=()=>{if(!thisCanvas.isConnected)return;markImage=img;thisCanvas.width=img.naturalWidth;thisCanvas.height=img.naturalHeight;redraw();};
      img.src=draft.steps[activePhoto].photo;
      const point=e=>{const r=thisCanvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
      thisCanvas.addEventListener('pointerdown',e=>{if(!markImage||markDraft.length>=30)return;e.preventDefault();thisCanvas.setPointerCapture(e.pointerId);markStart=point(e);markEnd=markStart;});
      thisCanvas.addEventListener('pointermove',e=>{if(!markStart)return;markEnd=point(e);redraw();});
      thisCanvas.addEventListener('pointerup',e=>{if(!markStart)return;markEnd=point(e);if(Math.hypot(markEnd.x-markStart.x,markEnd.y-markStart.y)>.025)markDraft.push({type:markTool,x1:markStart.x,y1:markStart.y,x2:markEnd.x,y2:markEnd.y});markStart=null;markEnd=null;redraw();dialog.querySelectorAll('[data-ag="mark-undo"],[data-ag="mark-clear"]').forEach(b=>b.disabled=!markDraft.length);});
      thisCanvas.addEventListener('pointercancel',()=>{markStart=null;markEnd=null;redraw();});
    }
    function redraw(){if(!markImage||!markCanvas?.isConnected)return;const preview=markStart&&markEnd?[{type:markTool,x1:markStart.x,y1:markStart.y,x2:markEnd.x,y2:markEnd.y}]:[];draw(markCanvas,markImage,[...markDraft,...preview]);}
    return {open,close,edit:id=>open(id,true),isOpen:()=>dialog.open};
  }

  function draw(canvas,img,marks=[]){
    const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
    for(const m of marks){
      const x1=m.x1*w,y1=m.y1*h,x2=m.x2*w,y2=m.y2*h;
      const width=Math.max(4,w*.009);
      ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#fff';ctx.lineWidth=width+Math.max(2,width*.65);
      function path(){ctx.beginPath();if(m.type==='box'){ctx.rect(Math.min(x1,x2),Math.min(y1,y2),Math.abs(x2-x1),Math.abs(y2-y1));}else{const a=Math.atan2(y2-y1,x2-x1),len=Math.min(Math.hypot(x2-x1,y2-y1)*.3,w*.065);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x2-len*Math.cos(a-Math.PI/6),y2-len*Math.sin(a-Math.PI/6));ctx.lineTo(x2,y2);ctx.lineTo(x2-len*Math.cos(a+Math.PI/6),y2-len*Math.sin(a+Math.PI/6));}ctx.stroke();}
      path();ctx.strokeStyle='#e43d2f';ctx.lineWidth=width;path();
    }
  }
  function paintPhoto(canvas,s){if(!s?.photo)return;const img=new Image();img.onload=()=>{if(!canvas.isConnected)return;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;draw(canvas,img,s.marks||[]);};img.src=s.photo;}
  async function compressPhoto(file){
    if(file.size>20*1024*1024)throw Error('照片超过 20MB，请选择小一些的图片');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 照片');
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('照片无法读取，请重新选择'));i.src=url;});
      const scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.8);
    }finally{URL.revokeObjectURL(url);}
  }
  function exampleGuide(){
    const frame=(label,scene)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><rect width="720" height="480" fill="#e9edf0"/>${scene}<rect x="20" y="20" width="170" height="38" rx="4" fill="white"/><text x="34" y="46" font-family="sans-serif" font-size="23" fill="#55636d">示例 · ${label}</text></svg>`);
    return {parking:'东门外设有临时停车位，勿占消防通道。',updated:'2026/10/31',steps:[
      {id:'example-entry',description:'从科创路东门进入，认准“智造园A区”入口标识。',photo:frame('园区入口','<rect y="310" width="720" height="170" fill="#cbd2d5"/><path d="M300 480 340 280h45l80 200" fill="#f4f5f5"/><rect x="120" y="120" width="32" height="200" fill="#81939b"/><rect x="560" y="120" width="32" height="200" fill="#81939b"/><rect x="105" y="110" width="500" height="60" fill="#5b7584"/><text x="205" y="152" fill="white" font-family="sans-serif" font-size="32">智造园 A区 · 东门</text><rect x="30" y="220" width="190" height="100" fill="#b2c1c7"/><rect x="505" y="225" width="150" height="95" fill="#b2c1c7"/>'),marks:[{type:'arrow',x1:.52,y1:.94,x2:.50,y2:.52}]},
      {id:'example-road',description:'沿主路直行约200米，在A3栋前向左转。',photo:frame('楼栋路口','<path d="M260 480 330 200h65l95 280" fill="#c4cdd1"/><path d="M0 320h360v65H0" fill="#c4cdd1"/><rect x="40" y="130" width="220" height="160" fill="#a2b8c1"/><rect x="460" y="150" width="220" height="155" fill="#bac9cf"/><text x="90" y="230" fill="#304d5b" font-family="sans-serif" font-size="50">A3栋</text><rect x="350" y="105" width="16" height="120" fill="#657c87"/><rect x="300" y="100" width="170" height="46" fill="#5b7584"/><text x="315" y="133" fill="white" font-family="sans-serif" font-size="25">← A3栋</text>'),marks:[{type:'arrow',x1:.53,y1:.94,x2:.48,y2:.74},{type:'arrow',x1:.48,y1:.74,x2:.15,y2:.74}]},
      {id:'example-door',description:'一层蓝色门牌处即到，门牌写有“一号生产车间”。',photo:frame('车间门牌','<rect x="50" y="90" width="620" height="340" fill="#b4c6ce"/><rect x="235" y="205" width="250" height="225" fill="#587783"/><path d="M360 210v220" stroke="#c7d3d7" stroke-width="5"/><rect x="220" y="125" width="280" height="62" fill="#3f647a"/><text x="239" y="165" fill="white" font-family="sans-serif" font-size="30">一号生产车间</text><rect x="85" y="180" width="95" height="100" fill="#e0e7eb"/><rect x="540" y="180" width="95" height="100" fill="#e0e7eb"/>'),marks:[{type:'box',x1:.30,y1:.25,x2:.70,y2:.40}]}]};
  }
  window.ArrivalGuide={create,exampleGuide};
})();
