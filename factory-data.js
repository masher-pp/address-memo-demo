(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.PublicFactories=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Coordinates copied from each company's official contact-page map, not field-surveyed entrances.
  const entries=[
    {id:'sz-higer-suhong',enterpriseId:'sz-higer',enterprise:'金龙联合汽车工业（苏州）有限公司',name:'海格客车 · 苏虹东路厂区',address:'苏州工业园区苏虹东路288号',lat:31.34533,lng:120.75899,coordSystem:'wgs84',url:'https://www.higer.com/contactus.html',map:'官网天地图标注'},
    {id:'sz-xingao-yangzhuang',enterpriseId:'sz-xingao',enterprise:'苏州市新高金属设备制造有限公司',name:'洋庄路厂区',address:'苏州高新区洋庄路8号',lat:31.347826,lng:120.520555,coordSystem:'bd09',url:'https://szxingao.com.cn/a/contact',mapUrl:'https://szxingao.com.cn/template/default/html/map.html',map:'官网百度地图标注'},
    {id:'sz-maxwell-dajing',enterpriseId:'sz-maxwell',enterprise:'苏州迈为科技股份有限公司',name:'总部产研中心 · 大兢路',address:'江苏省苏州市吴江区大兢路8号',lat:31.101079,lng:120.708483,coordSystem:'gcj02',url:'https://www.maxwell-gp.com/contactus_category/contact/',map:'官网高德地图标注'},
    {id:'sz-maxwell-ludang',enterpriseId:'sz-maxwell',enterprise:'苏州迈为科技股份有限公司',name:'智能制造产业园 · 芦荡路',address:'江苏省苏州市吴江区芦荡路228号',lat:31.116652,lng:120.666584,coordSystem:'gcj02',url:'https://www.maxwell-gp.com/contactus_category/contact/',map:'官网高德地图标注'}
  ];
  function places(){return entries.map(({url,mapUrl,map,...p})=>({...p,x:null,y:null,status:'pending',verification:null,tags:[],contact:'',phone:'',note:'',photos:[],comments:[],updated:'2026-11-04',publicSource:{url,mapUrl:mapUrl||url,map,checkedOn:'2026-11-04',lat:p.lat,lng:p.lng,coordSystem:p.coordSystem}}));}
  function merge(state){
    const next=JSON.parse(JSON.stringify(state));
    const ids=new Set(next.places.map(p=>p.id));
    next.places=[...places().filter(p=>!ids.has(p.id)),...next.places];
    return next;
  }
  function usesPublishedPosition(p){const s=p?.publicSource;return !!s&&p.lat===s.lat&&p.lng===s.lng&&p.coordSystem===s.coordSystem;}
  return {places,merge,usesPublishedPosition};
});
