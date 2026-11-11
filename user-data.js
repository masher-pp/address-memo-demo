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
    if(!['每次询问','高德地图','百度地图'].includes(s.settings.mapProvider))s.settings.mapProvider='每次询问';
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
  function hasCoordinates(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;}
  function orderStops(state){
    const remaining=state.route.filter(id=>!state.completed.includes(id));
    const ordered=[];let current={x:48,y:85};
    const virtual=remaining.map(id=>state.places.find(p=>p.id===id)).filter(p=>p?.x!=null);
    while(virtual.length){virtual.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));current=virtual.shift();ordered.push(current.id);}
    const gps=remaining.map(id=>state.places.find(p=>p.id===id)).filter(p=>p?.x==null&&hasCoordinates(p)).map(p=>({...p,...toGcj02(p)}));
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
  function toGcj02(p){
    if(p.coordSystem==='gcj02')return {lat:p.lat,lng:p.lng};
    if(p.coordSystem==='bd09'){
      const x=p.lng-.0065,y=p.lat-.006,z=Math.hypot(x,y)-.00002*Math.sin(y*Math.PI*3000/180);
      const angle=Math.atan2(y,x)-.000003*Math.cos(x*Math.PI*3000/180);
      return {lat:z*Math.sin(angle),lng:z*Math.cos(angle)};
    }
    return gcj02(p.lat,p.lng);
  }
  function toBd09(p){if(p.coordSystem==='bd09')return {lat:p.lat,lng:p.lng};const c=toGcj02(p);return bd09(c.lat,c.lng);}
  function wgs84FromGcj(lat,lng){
    let point={lat,lng};
    for(let i=0;i<8;i++){const offset=gcj02(point.lat,point.lng);const dy=offset.lat-lat,dx=offset.lng-lng;point={lat:point.lat-dy,lng:point.lng-dx};if(Math.max(Math.abs(dx),Math.abs(dy))<1e-8)break;}
    return point;
  }
  function toWgs84(p){
    if(!hasCoordinates(p))return null;
    if(p.coordSystem==='bd09'){const c=toGcj02(p);return wgs84FromGcj(c.lat,c.lng);}
    if(p.coordSystem==='gcj02')return wgs84FromGcj(p.lat,p.lng);
    return {lat:p.lat,lng:p.lng};
  }
  function addOrUpdateLocation(state,fields,{id,time=new Date().toLocaleString('zh-CN',{hour12:false})}={}){
    id=id||fields.id;
    const enterprise=String(fields.enterprise??'').trim(),name=String(fields.name??'').trim(),address=String(fields.address??'').trim();
    if(!enterprise)throw Error('请填写企业名称');if(!name)throw Error('请填写场所名称');if(!address)throw Error('请填写地址');
    if(enterprise.length>120||name.length>120||address.length>200)throw Error('企业、场所或地址文字过长');
    const lat=fields.lat??null,lng=fields.lng??null;
    if((lat===null)!==(lng===null)||lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180))throw Error('位置坐标无效，请重新选择');
    const same=s=>s.id!==id&&s.enterprise.trim().toLocaleLowerCase()===enterprise.toLocaleLowerCase()&&s.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()&&s.address.trim().toLocaleLowerCase()===address.toLocaleLowerCase();
    const duplicate=state.places.find(same);if(duplicate)return {state,place:duplicate,duplicate:true};
    const next=clone(state);
    let place=next.places.find(p=>p.id===id);
    if(!place){
      const enterpriseId=next.places.find(p=>p.enterprise.toLocaleLowerCase()===enterprise.toLocaleLowerCase())?.enterpriseId||'e-'+Date.now().toString(36);
      place={id:id||'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),enterpriseId,enterprise,name,address,status:lat===null?'unlocated':'pending',x:null,y:null,lat,lng,accuracy:fields.accuracy??null,coordSystem:lat===null?undefined:fields.coordSystem||'wgs84',tags:[],contact:'',phone:'',note:'',photos:[],comments:[],verification:null,updated:time};
      if(!place.coordSystem)delete place.coordSystem;
      next.places.unshift(place);
    }else{
      const changed=lat!==(place.lat??null)||lng!==(place.lng??null)||address!==place.address||enterprise!==place.enterprise||name!==place.name||(lat!==null&&(fields.coordSystem||'wgs84')!==(place.coordSystem||'wgs84'));
      Object.assign(place,{enterprise,name,address,lat,lng,accuracy:fields.accuracy??null,x:null,y:null,updated:time});
      if(lat!==null)place.coordSystem=fields.coordSystem||'wgs84';
      else delete place.coordSystem;
      if(changed||lat===null){place.status=lat===null?'unlocated':'pending';place.verification=null;}
    }
    return {state:next,place,duplicate:false};
  }
  function mapAppUrl(provider,p,platform='android'){
    if(!hasCoordinates(p))throw Error('请先补充真实入口位置，再开始导航');
    const q=encodeURIComponent([p.enterprise,p.name].filter(Boolean).join(' '));
    const c=toGcj02(p);
    if(provider==='百度地图'){
      const b=toBd09(p);
      if(platform==='ios')return `baidumap://map/navi?location=${b.lat.toFixed(6)},${b.lng.toFixed(6)}&coord_type=bd09ll&query=${q}&type=DEFAULT&src=ios.addressmemo.demo`;
      return `bdapp://map/navi?location=${b.lat.toFixed(6)},${b.lng.toFixed(6)}&coord_type=bd09ll&query=${q}&type=DEFAULT&src=andr.addressmemo.demo`;
    }
    if(provider==='高德地图'){
      const scheme=platform==='ios'?'iosamap://path':'amapuri://route/plan/';
      return `${scheme}?sourceApplication=addressmemo&dlat=${c.lat.toFixed(6)}&dlon=${c.lng.toFixed(6)}&dname=${q}&dev=0&t=0`;
    }
    return null;
  }
  return {KEY,normalize,persist,filterPlaces,nextStop,hasLocation,hasCoordinates,orderStops,gcj02,toGcj02,toWgs84,mapAppUrl,addOrUpdateLocation};
});
