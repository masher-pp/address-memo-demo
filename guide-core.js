(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ArrivalData=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const step=()=>({id:'s-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),description:'',photo:'',marks:[]});
  function draftFor(p){
    const guide=p.arrivalGuide;
    const steps=guide?.steps?.length?clone(guide.steps):[{...step(),description:p.note||'',photo:p.photos?.[0]?.src||''}];
    return {address:p.address||'',lat:p.lat??null,lng:p.lng??null,accuracy:p.accuracy??null,parking:guide?.parking||'',steps};
  }
  function applyGuide(p,d,time){
    const address=String(d.address||'').trim();
    if(!address)throw Error('请填写地址或位置线索');
    if(address.length>200)throw Error('地址最多 200 字');
    if(!Array.isArray(d.steps)||!d.steps.length||d.steps.length>8)throw Error('请保留 1 至 8 个步骤');
    if(String(d.parking||'').length>200)throw Error('停车说明最多 200 字');
    const steps=d.steps.map((s,i)=>{
      const description=String(s.description||'').trim();
      if(!description)throw Error(`请填写第 ${i+1} 步的路线说明`);
      if(description.length>300)throw Error(`第 ${i+1} 步的说明最多 300 字`);
      const photo=s.photo||'';
      if(photo&&!/^data:image\/(jpeg|png|webp|svg\+xml);/.test(photo))throw Error('图片格式不支持，请重新选择照片');
      const marks=clone(s.marks||[]);
      if(marks.length>30||marks.some(m=>!['arrow','box'].includes(m.type)||['x1','x2','y1','y2'].some(k=>!Number.isFinite(m[k])||m[k]<0||m[k]>1)))throw Error('图片标注无效，请重新标注');
      return {id:s.id||step().id,description,photo,marks};
    });
    const lat=d.lat??null,lng=d.lng??null;
    if((lat===null)!==(lng===null)||lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lng)||lat< -90||lat>90||lng< -180||lng>180))throw Error('位置坐标无效，请重新定位');
    const changed=lat!==(p.lat??null)||lng!==(p.lng??null);
    return {...clone(p),address,lat,lng,accuracy:d.accuracy??null,note:steps.map(s=>s.description).join('\n'),updated:time,
      arrivalGuide:{parking:String(d.parking||'').trim(),steps,updated:time},
      ...(changed&&lat!==null?{x:null,y:null,coordSystem:'wgs84'}:{}),
      ...(changed?{status:lat===null&&p.x==null?'unlocated':'pending',verification:null}:{})};
  }
  return {draftFor,applyGuide,step};
});
