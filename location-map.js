(function(root){
  'use strict';
  const FALLBACK=[31.29834,120.58319];
  const icon=(selected=false)=>root.L.divIcon({className:'memo-map-pin'+(selected?' is-selected':''),html:'<span></span>',iconSize:[26,34],iconAnchor:[13,32]});
  function mount(element,places=[],selectedId='',onSelect=()=>{},options={}){
    const L=root.L;
    if(!L||!element)return {destroy(){}};
    const points=places.map(p=>({place:p,point:root.UserData.toWgs84(p)})).filter(x=>x.point);
    let center=options.center||points.find(x=>x.place.id===selectedId)?.point||points[0]?.point||FALLBACK;
    if(!Array.isArray(center))center=[center.lat,center.lng];
    const map=L.map(element,{zoomControl:false,attributionControl:true,scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,tap:true}).setView(center,points.length?13:12);
    L.control.zoom({position:'bottomright'}).addTo(map);
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
    const message=element.parentElement.querySelector('.real-map-status');
    let loaded=0;
    if(message){message.hidden=false;message.textContent='正在加载地图…';}
    const showFailure=()=>{if(!message||loaded)return;message.hidden=false;message.innerHTML=(options.pick?'底图未加载，暂不能选点。可用手机定位或先保存地址。':'底图加载失败，请重试或返回列表查看地址。')+' <button type="button" data-map-retry>重试</button>';message.querySelector('[data-map-retry]')?.addEventListener('click',()=>{message.textContent='正在重新加载地图…';tiles.redraw();});};
    const loadingTimer=setTimeout(showFailure,10000);
    tiles.on('tileload',()=>{loaded++;if(message){message.hidden=true;}});
    tiles.on('tileerror',showFailure);
    let alive=true;
    function emit(detail){requestAnimationFrame(()=>{if(alive)onSelect(detail);});}
    function pick(point){if(!options.pick)return;if(!loaded){showFailure();return;}emit({lat:point.lat,lng:point.lng,coordSystem:'wgs84',accuracy:null});}
    points.forEach(({place,point})=>{
      const m=L.marker([point.lat,point.lng],{icon:icon(place.id===selectedId),keyboard:true,title:[place.enterprise,place.name].filter(Boolean).join(' · ')}).addTo(map);
      m.on('click',()=>options.pick?pick(point):emit({id:place.id,focus:true}));
    });
    if(options.center){map.setView(center,options.zoom||16);}
    else if(points.length>1){const bounds=L.latLngBounds(points.map(x=>[x.point.lat,x.point.lng]));map.fitBounds(bounds.pad(.2),{maxZoom:15});}
    if(options.pick){
      const marker=L.marker(center,{icon:icon(),draggable:true}).addTo(map);
      marker.on('dragend',()=>pick(marker.getLatLng()));
      map.on('click',e=>{marker.setLatLng(e.latlng);pick(e.latlng);});
    }
    return {map,destroy(){alive=false;clearTimeout(loadingTimer);map.remove();},focus(id){const p=points.find(x=>x.place.id===id);if(p)map.setView([p.point.lat,p.point.lng],15);}};
  }
  root.LocationMap={mount};
})(window);
