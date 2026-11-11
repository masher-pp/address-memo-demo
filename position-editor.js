(function(root){
  'use strict';
  const U=root.UserData;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function create(host){
    const dialog=document.createElement('dialog');dialog.id='position-dialog';dialog.setAttribute('aria-label','记录场所地址');document.body.append(dialog);
    let id=null,source=null,draft=null,initial='',busy=false,error='',duplicateId=null,mapView=null,session=0;
    const dirty=()=>JSON.stringify(draft)!==initial;
    function render(){
      mapView?.destroy();mapView=null;
      const location=draft.lat!==null?`<p class="position-coordinate">${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}${draft.accuracy!=null?' · 精度约 '+Math.round(draft.accuracy)+' 米':''}</p>`:'';
      dialog.innerHTML=`<header class="position-head"><button data-pos="close" aria-label="返回">‹</button><h1>${id?'补充场所位置':'记录场所位置'}</h1><span></span></header><div class="position-body"><label>企业名称<input data-field="enterprise" maxlength="120" value="${esc(draft.enterprise)}" placeholder="输入企业名称" autocomplete="organization"></label><label>场所名称<input data-field="name" maxlength="120" value="${esc(draft.name)}" placeholder="例如：生产厂区、仓库"></label><label>详细地址<input data-field="address" maxlength="200" value="${esc(draft.address)}" placeholder="道路、园区、楼栋和门牌"></label><section class="position-location"><div><b>位置</b><button data-pos="locate" ${busy?'disabled':''}>${busy?'定位中…':'使用手机定位'}</button></div>${location}<div class="position-map-wrap"><div id="position-picker" aria-label="地图选点"></div><p class="real-map-status" hidden></p></div></section>${error?`<p class="position-error" role="alert">${esc(error)}${duplicateId?'<button data-pos="existing">查看已有场所</button>':''}</p>`:''}</div><footer class="position-footer"><button data-pos="save" ${busy?'disabled':''}>保存地址</button></footer>`;
      if(!dialog.open)return;
      mapView=root.LocationMap.mount(dialog.querySelector('#position-picker'),[],null,point=>{draft.lat=point.lat;draft.lng=point.lng;draft.coordSystem='wgs84';draft.accuracy=point.accuracy;error='';updateLocation();},{pick:true,center:draft.lat===null?undefined:U.toWgs84(draft),zoom:16});
    }
    function updateLocation(){
      const button=dialog.querySelector('[data-pos="locate"]');button.disabled=busy;button.textContent=busy?'定位中…':'使用手机定位';
      dialog.querySelector('[data-pos="save"]').disabled=busy;
      let coordinate=dialog.querySelector('.position-coordinate');
      if(draft.lat!==null){
        if(!coordinate){coordinate=document.createElement('p');coordinate.className='position-coordinate';coordinate.setAttribute('role','status');dialog.querySelector('.position-map-wrap').before(coordinate);}
        coordinate.textContent=`${draft.lat.toFixed(6)}, ${draft.lng.toFixed(6)}${draft.accuracy!=null?' · 精度约 '+Math.round(draft.accuracy)+' 米':''}`;
      }
      let message=dialog.querySelector('.position-error');
      if(!error){message?.remove();return;}
      if(!message){message=document.createElement('p');message.className='position-error';message.setAttribute('role','alert');dialog.querySelector('.position-body').append(message);}
      message.textContent=error;message.scrollIntoView({block:'nearest'});
    }
    function showError(message){error=message;updateLocation();}
    function open(placeId,seed={}){
      session++;id=placeId||null;source=id?host.getPlace(id):null;error='';duplicateId=null;busy=false;
      draft={id,enterprise:seed.enterprise||source?.enterprise||'',name:seed.name||source?.name||'',address:seed.address||source?.address||'',lat:source?.lat??null,lng:source?.lng??null,coordSystem:source?.coordSystem||'wgs84',accuracy:source?.accuracy??null};
      if(source&&!U.hasCoordinates(source)){draft.lat=null;draft.lng=null;}
      initial=JSON.stringify(draft);render();dialog.showModal();render();
    }
    function close(force=false){if(!dialog.open)return;if(!force&&dirty()){if(dialog.querySelector('.position-discard'))return;dialog.insertAdjacentHTML('beforeend','<div class="position-discard"><section role="alertdialog" aria-label="放弃未保存的地址"><h2>地址还未保存</h2><p>退出后会丢失这次填写。</p><div><button data-pos="keep">继续填写</button><button data-pos="discard">放弃</button></div></section></div>');return;}session++;mapView?.destroy();mapView=null;dialog.close();}
    function locate(){
      if(!root.isSecureContext){showError('手机定位需要 HTTPS 页面。你仍可手动选点或只保存地址。');return;}
      if(!root.navigator.geolocation){showError('浏览器不支持定位，可在地图上选点或只保存地址。');return;}
      const request=session;busy=true;error='';updateLocation();
      root.navigator.geolocation.getCurrentPosition(pos=>{if(request!==session)return;busy=false;draft.lat=pos.coords.latitude;draft.lng=pos.coords.longitude;draft.coordSystem='wgs84';draft.accuracy=pos.coords.accuracy;updateLocation();mapView?.setPosition(draft);dialog.querySelector('#position-picker').scrollIntoView({block:'nearest'});},e=>{if(request!==session)return;busy=false;showError(e.code===1?'定位权限未开启。请允许浏览器使用位置，或在地图上选点。':e.code===3?'定位超时，可重试或手动选点。':'暂时无法定位，可重试或手动选点。');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    }
    function commit(){
      dialog.querySelectorAll('[data-field]').forEach(e=>draft[e.dataset.field]=e.value.trim());
      try{
        const result=U.addOrUpdateLocation(host.getState(),draft,{id,time:new Date().toLocaleString('zh-CN',{hour12:false})});
        if(result.duplicate){duplicateId=result.place.id;error=`已存在同名场所：${result.place.enterprise} · ${result.place.name}`;render();return;}
        host.save(result.state,result.place,id?'更新场所地址':'新增场所地址',result.place.address);id=result.place.id;source=result.place;draft={id,enterprise:source.enterprise,name:source.name,address:source.address,lat:source.lat??null,lng:source.lng??null,coordSystem:source.coordSystem||'wgs84',accuracy:source.accuracy??null};initial=JSON.stringify(draft);close(true);host.onSaved?.(source);
      }catch(e){showError(e.message);}
    }
    dialog.addEventListener('input',e=>{if(e.target.matches('[data-field]')){draft[e.target.dataset.field]=e.target.value;error='';}});
    dialog.addEventListener('click',e=>{const b=e.target.closest('[data-pos]');if(!b||b.disabled)return;switch(b.dataset.pos){case'close':close();break;case'existing':{const existing=host.getPlace(duplicateId);close(true);if(existing)host.onExisting?.(existing);break;}case'locate':locate();break;case'save':commit();break;case'toggle-map':dialog.querySelector('.position-map-wrap')?.scrollIntoView({behavior:'smooth',block:'center'});break;case'keep':dialog.querySelector('.position-discard')?.remove();break;case'discard':dialog.querySelector('.position-discard')?.remove();close(true);break;}});
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    return {open,close,isOpen:()=>dialog.open};
  }
  root.PositionEditor={create};
})(window);
