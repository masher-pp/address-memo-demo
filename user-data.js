(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.UserData=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='address-memo-user-v2';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const unique=values=>[...new Set(Array.isArray(values)?values:[])];
  function normalize(raw){
    const s=clone(raw||{});
    s.version=2;s.places=Array.isArray(s.places)?s.places:[];
    const ids=new Set(s.places.map(p=>p.id));
    for(const key of ['route','recent','recorded'])s[key]=unique(s[key]).filter(id=>ids.has(id));
    s.completed=unique(s.completed).filter(id=>s.route.includes(id));
    s.history=Array.isArray(s.history)?s.history:[];
    s.settings={mapProvider:'每次询问',...(s.settings||{})};
    if(!['每次询问','高德地图','百度地图','腾讯地图'].includes(s.settings.mapProvider))s.settings.mapProvider='每次询问';
    return s;
  }
  function persist(state,change,storage){
    const next=clone(state);change(next);
    try{storage.setItem(KEY,JSON.stringify(next));}
    catch{throw Error('未保存：本机存储空间不足或浏览器禁止保存。请释放空间后重试，原记录未更改。');}
    return next;
  }
  function filterPlaces(state,{query='',tags=[],status='all'}={}){
    const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return state.places.filter(p=>words.every(w=>[p.enterprise,p.name,p.address].join(' ').toLocaleLowerCase().includes(w))
      &&(status==='all'||status===p.status)&&(!tags.length||tags.some(t=>p.tags?.includes(t))));
  }
  function nextStop(state){return state.route.filter(id=>!state.completed.includes(id)).map(id=>state.places.find(p=>p.id===id)).find(Boolean)||null;}
  function hasLocation(p){return p.x!=null||(Number.isFinite(p.lat)&&Number.isFinite(p.lng));}
  function orderStops(state){
    const remaining=state.route.filter(id=>!state.completed.includes(id));
    const ordered=[];let current={x:48,y:85};
    const virtual=remaining.map(id=>state.places.find(p=>p.id===id)).filter(p=>p?.x!=null);
    while(virtual.length){virtual.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));current=virtual.shift();ordered.push(current.id);}
    const gps=remaining.map(id=>state.places.find(p=>p.id===id)).filter(p=>p?.x==null&&Number.isFinite(p.lat)&&Number.isFinite(p.lng));
    let start=gps[0];
    while(gps.length){gps.sort((a,b)=>Math.hypot((a.lng-start.lng)*Math.cos(start.lat*Math.PI/180),a.lat-start.lat)-Math.hypot((b.lng-start.lng)*Math.cos(start.lat*Math.PI/180),b.lat-start.lat));start=gps.shift();ordered.push(start.id);}
    return [...ordered,...remaining.filter(id=>!ordered.includes(id)),...state.route.filter(id=>state.completed.includes(id))];
  }
  // Browser geolocation returns WGS84; domestic navigation endpoints require GCJ02 or BD09.
  function gcj02(lat,lng){
    if(lng<72.004||lng>137.8347||lat<.8293||lat>55.8271)return {lat,lng};
    const x=lng-105,y=lat-35,pi=Math.PI,a=6378245,ee=.006693421622965943;
    let dy=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
    dy+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
    dy+=(20*Math.sin(y*pi)+40*Math.sin(y/3*pi))*2/3;
    dy+=(160*Math.sin(y/12*pi)+320*Math.sin(y*pi/30))*2/3;
    let dx=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
    dx+=(20*Math.sin(6*x*pi)+20*Math.sin(2*x*pi))*2/3;
    dx+=(20*Math.sin(x*pi)+40*Math.sin(x/3*pi))*2/3;
    dx+=(150*Math.sin(x/12*pi)+300*Math.sin(x/30*pi))*2/3;
    const rad=lat/180*pi,magic=1-ee*Math.sin(rad)**2,sqrt=Math.sqrt(magic);
    return {lat:lat+dy*180/((a*(1-ee))/(magic*sqrt)*pi),lng:lng+dx*180/(a/sqrt*Math.cos(rad)*pi)};
  }
  function bd09(lat,lng){
    const z=Math.hypot(lng,lat)+.00002*Math.sin(lat*Math.PI*3000/180);
    const angle=Math.atan2(lat,lng)+.000003*Math.cos(lng*Math.PI*3000/180);
    return {lat:z*Math.sin(angle)+.006,lng:z*Math.cos(angle)+.0065};
  }
  function mapUrl(provider,p){
    const name=[p.enterprise,p.name,p.address].filter(Boolean).join(' '),q=encodeURIComponent(name);
    const coords=Number.isFinite(p.lat)&&Number.isFinite(p.lng)?(p.coordSystem==='gcj02'?{lat:p.lat,lng:p.lng}:gcj02(p.lat,p.lng)):null;
    if(provider==='高德地图')return coords?`https://uri.amap.com/navigation?to=${coords.lng.toFixed(6)},${coords.lat.toFixed(6)},${q}&mode=car&src=addressmemo`:`https://uri.amap.com/search?keyword=${q}&src=addressmemo`;
    if(provider==='百度地图'){
      if(!coords)return `https://map.baidu.com/search/${q}`;
      const b=bd09(coords.lat,coords.lng);
      return `https://api.map.baidu.com/direction?destination=latlng:${b.lat.toFixed(6)},${b.lng.toFixed(6)}|name:${q}&mode=driving&coord_type=bd09ll&output=html&src=addressmemo`;
    }
    return coords?`https://apis.map.qq.com/uri/v1/routeplan?type=drive&to=${q}&tocoord=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}&referer=addressmemo`:`https://apis.map.qq.com/uri/v1/search?keyword=${q}&referer=addressmemo`;
  }
  return {KEY,normalize,persist,filterPlaces,nextStop,hasLocation,orderStops,gcj02,mapUrl};
});
