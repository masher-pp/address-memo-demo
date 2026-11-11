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
    const sources=[
      {url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'},
      {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',attribution:'Tiles &copy; Esri — Esri, HERE, Garmin, USGS, NGA, EPA, NPS'}
    ];
    let tiles=null,sourceIndex=0,loadingTimer,alive=true,loaded=0,picker=null;
    const message=element.parentElement.querySelector('.real-map-status');
    function showFailure(){
      if(!alive||loaded)return;
      if(sourceIndex<sources.length-1){useSource(sourceIndex+1);return;}
      if(!message)return;
      message.hidden=false;message.innerHTML=(options.pick?'地图暂未加载，可重试或使用手机定位。':'地图加载失败，请重试。')+' <button type="button" data-map-retry>重试</button>';
      message.querySelector('[data-map-retry]').addEventListener('click',()=>useSource(0));
    }
    function useSource(index){
      if(!alive)return;
      clearTimeout(loadingTimer);if(tiles){map.removeLayer(tiles);tiles.off();}
      sourceIndex=index;loaded=0;
      if(message){message.hidden=false;message.textContent='正在加载地图…';}
      const source=sources[index];
      tiles=L.tileLayer(source.url,{maxZoom:19,attribution:source.attribution});
      tiles.on('loading',()=>{loaded=0;clearTimeout(loadingTimer);loadingTimer=setTimeout(showFailure,6000);});
      tiles.on('tileload',()=>{loaded++;clearTimeout(loadingTimer);if(message)message.hidden=true;});
      tiles.on('tileerror',()=>{clearTimeout(loadingTimer);loadingTimer=setTimeout(showFailure,250);});
      tiles.addTo(map);
      loadingTimer=setTimeout(showFailure,6000);
    }
    useSource(0);
    function emit(detail){requestAnimationFrame(()=>{if(alive)onSelect(detail);});}
    function pick(point){if(!options.pick)return;if(!loaded){showFailure();return;}picker?.setLatLng(point);emit({lat:point.lat,lng:point.lng,coordSystem:'wgs84',accuracy:null});}
    points.forEach(({place,point})=>{
      const m=L.marker([point.lat,point.lng],{icon:icon(place.id===selectedId),keyboard:true,title:[place.enterprise,place.name].filter(Boolean).join(' · ')}).addTo(map);
      m.on('click',()=>options.pick?pick(point):emit({id:place.id,focus:true}));
    });
    if(options.center){map.setView(center,options.zoom||16);}
    else if(points.length>1){const bounds=L.latLngBounds(points.map(x=>[x.point.lat,x.point.lng]));map.fitBounds(bounds.pad(.2),{maxZoom:15});}
    if(options.pick){
      picker=L.marker(center,{icon:icon(),draggable:true,keyboard:true,title:'拖动调整位置'}).addTo(map);
      picker.on('dragend',()=>pick(picker.getLatLng()));
      map.on('click',e=>pick(e.latlng));
    }
    return {map,setPosition(point){picker?.setLatLng([point.lat,point.lng]);map.setView([point.lat,point.lng],options.zoom||16);requestAnimationFrame(()=>{if(alive)map.invalidateSize();});},destroy(){alive=false;clearTimeout(loadingTimer);map.remove();tiles?.off();},focus(id){const p=points.find(x=>x.place.id===id);if(p)map.setView([p.point.lat,p.point.lng],15);}};
  }
  root.LocationMap={mount};
})(window);
