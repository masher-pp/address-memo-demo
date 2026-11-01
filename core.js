(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Memo = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const tags = ['叉车使用','起重机使用','电梯使用','锅炉使用','压力管道使用','压力容器使用','特种设备销售','特种设备生产','工业许可企业','食品生产企业'];
  const statuses = {verified:'已核实',pending:'待核实',review:'需复查',unlocated:'未定位'};
  const roles = {
    officer: {name:'林晓',title:'授权执法人员',department:'市场监管部门',edit:true,restricted:true},
    collaborator: {name:'周宁',title:'协作人员',department:'应急管理部门',edit:true,restricted:false},
    admin: {name:'陈悦',title:'平台管理员',department:'平台管理',edit:true,restricted:true},
    guest: {name:'访客',title:'公开访问',department:'未登录',edit:false,restricted:false}
  };
  const now = () => new Date().toLocaleString('zh-CN',{hour12:false});
  const uid = () => 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const clone = value => JSON.parse(JSON.stringify(value));
  const sampleRows = [
    {enterprise:'青禾食品有限公司',name:'食品生产车间',address:'青川区科创路126号',tags:['食品生产企业','锅炉使用'],x:38,y:33},
    {enterprise:'恒星特种设备有限公司',name:'设备展示与销售中心',address:'青川区智造大道208号',tags:['特种设备销售'],x:73,y:60},
    {enterprise:'启明机电有限公司',name:'实际经营场所',address:'青川区先锋工业园内（门牌待补充）',tags:['起重机使用'],x:null,y:null}
  ];
  function fresh() {
    const seed = [
      ['p1','e1','远川精密制造有限公司','一号生产车间','科创路88号 · 智造园A区','verified',29,40,['叉车使用','压力容器使用','工业许可企业'],'陈师傅','138 0000 1024','从科创路东门进入，沿主路直行约200米，A3栋一层。','factory'],
      ['p2','e2','澄光食品有限公司','食品生产基地','青禾路56号 · 食品产业园','verified',58,23,['食品生产企业','锅炉使用'],'赵经理','139 0000 2086','从南门进入，二号厂房二层；楼梯在厂房东侧。','food'],
      ['p3','e3','新桥机电设备有限公司','设备生产车间','智造大道170号 · 新桥产业园','pending',76,38,['起重机使用','特种设备生产'],'王工','137 0000 3308','地图匹配位置，实际厂房入口待确认。','factory'],
      ['p4','e4','青川科创中心有限公司','园区综合楼','科创路18号 · 科创中心','verified',44,59,['电梯使用','压力容器使用'],'李主管','136 0000 4516','综合楼北侧入口，物业办公室在一层。','building'],
      ['p5','e5','瑞丰能源装备有限公司','锅炉与管道车间','青川区滨河路90号','review',66,73,['锅炉使用','压力管道使用','工业许可企业'],'刘工','135 0000 6127','原入口施工封闭，需确认西侧新入口。','factory'],
      ['p6','e1','远川精密制造有限公司','二号仓储场所','智造大道98号 · 智造园B区','verified',23,70,['叉车使用'],'陈师傅','138 0000 1024','仓库位于B2栋；货车入口在西侧。','warehouse'],
      ['p7','e6','云帆设备销售有限公司','设备销售门店','青川区新桥片区（详细门牌缺失）','unlocated',null,null,['特种设备销售'],'孙经理','134 0000 7621','名单中地址不完整，需现场补点。','warehouse'],
      ['p8','e7','朗森工业技术有限公司','压力设备生产基地','新桥路36号 · 创新工坊','pending',83,61,['压力容器使用','特种设备生产'],'许工','133 0000 8842','需要确认厂区实际入口。','factory']
    ];
    return {version:1,places:seed.map((s,i)=>({id:s[0],enterpriseId:s[1],enterprise:s[2],name:s[3],address:s[4],status:s[5],x:s[6],y:s[7],tags:s[8],contact:s[9],phone:s[10],note:s[11],photo:s[12],photos:[],comments:i===0?[{id:'c1',text:'东门门牌不明显，认准蓝色厂房及“A3”标识；进入后在第一个路口右转。',author:'林晓',department:'市场监管部门',time:'2026/10/29 14:20'},{id:'c2',text:'已与园区物业电话确认，该企业一号车间仍在原址。',author:'周宁',department:'应急管理部门',time:'2026/10/28 09:35'}]:[],updated:'2026/10/'+(29-i),verification:s[5]==='verified'?{method:i%2?'remote':'onsite',basis:i%2?'园区物业确认场所及入口':'到访确认企业门牌与入口',author:'林晓',time:'2026/10/29'}:null})),history:[{id:'h-seed',placeId:'p1',action:'现场核实位置',author:'林晓',department:'市场监管部门',time:'2026/10/29 14:18',before:{status:'pending'},after:{status:'verified'},summary:'现场核对门牌，确认东门入口'}],route:[],applications:[{id:'a1',name:'张晗',department:'消防救援部门',reason:'希望共享辖区企业的实际场所信息',status:'pending'}]};
  }
  function requireEdit(role) { if (!roles[role]?.edit) throw Error('请先申请加入并通过审核'); }
  function requireRestricted(role) { if (!roles[role]?.restricted) throw Error('需要获授权的角色才能操作现场资料'); }
  function record(state,p,role,action,before,after,summary='') {
    state.history.unshift({id:uid(),placeId:p.id,action,author:roles[role].name,department:roles[role].department,time:now(),before:clone(before),after:clone(after),summary});
    p.updated=now();
  }
  function visible(p,role) {
    const copy=clone(p);
    if (!roles[role]?.restricted) ['contact','phone','note','photo','photos','comments','verification'].forEach(k=>delete copy[k]);
    return copy;
  }
  function search(state,{query='',tags:chosen=[],match='any',status='all'}={}) {
    return state.places.filter(p=>(!query||[p.enterprise,p.name,p.address].join(' ').toLowerCase().includes(query.trim().toLowerCase()))&&(status==='all'||p.status===status)&&(!chosen.length||(match==='all'?chosen.every(t=>p.tags.includes(t)):chosen.some(t=>p.tags.includes(t)))));
  }
  function get(state,id) { const p=state.places.find(p=>p.id===id);if(!p)throw Error('未找到场所');return p; }
  function clean(fields) {
    const out={};
    ['enterprise','name','address','contact','phone','note'].forEach(k=>{if(k in fields)out[k]=String(fields[k]??'').trim().slice(0,k==='note'?1200:160);});
    if ('enterprise' in out&&!out.enterprise)throw Error('请填写企业名称');
    if ('name' in out&&!out.name)throw Error('请填写场所名称');
    if ('address' in out&&!out.address)throw Error('请填写实际地址或现有地址线索');
    if ('tags' in fields)out.tags=[...new Set(fields.tags)].filter(t=>tags.includes(t));
    if ('x' in fields||'y' in fields){
      if(fields.x==null&&fields.y==null){out.x=null;out.y=null;}
      else {if(!Number.isFinite(Number(fields.x))||!Number.isFinite(Number(fields.y))||Number(fields.x)<0||Number(fields.x)>100||Number(fields.y)<0||Number(fields.y)>100)throw Error('请在演示地图内选择位置');out.x=Number(fields.x);out.y=Number(fields.y);}
    }
    return out;
  }
  function update(state,id,fields,role) {
    requireEdit(role);const p=get(state,id);const data=clean(fields);
    if(!roles[role].restricted&&['contact','phone','note'].some(k=>k in data))throw Error('没有修改现场资料的权限');
    const before={};const after={};
    Object.keys(data).forEach(k=>{if(JSON.stringify(p[k])!==JSON.stringify(data[k])){before[k]=clone(p[k]??null);after[k]=data[k];}});
    if(!Object.keys(after).length)return p;
    if(('x'in after||'y'in after)){before.status=p.status;after.status=data.x==null?'unlocated':'pending';before.verification=p.verification;after.verification=null;}
    if('enterprise'in after){before.enterpriseId=p.enterpriseId;after.enterpriseId=state.places.find(x=>x.enterprise===after.enterprise&&x.id!==p.id)?.enterpriseId||uid();}
    Object.assign(p,after);record(state,p,role,'更新场所记录',before,after);return p;
  }
  function add(state,fields,role) {
    requireEdit(role);const data=clean(fields);
    if(!data.enterprise)throw Error('请填写企业名称');if(!data.name)throw Error('请填写场所名称');if(!data.address)throw Error('请填写实际地址或现有地址线索');
    if(!roles[role].restricted&&['contact','phone','note'].some(k=>data[k]))throw Error('没有录入现场资料的权限');
    const p={id:uid(),enterpriseId:state.places.find(p=>p.enterprise===data.enterprise)?.enterpriseId||uid(),...data,tags:data.tags||[],x:data.x??null,y:data.y??null,status:data.x==null?'unlocated':'pending',contact:data.contact||'',phone:data.phone||'',note:data.note||'',photo:'factory',photos:[],comments:[],verification:null,updated:now()};
    state.places.unshift(p);record(state,p,role,'新增实际场所',{},data);return p;
  }
  function verify(state,id,method,basis,role) {
    requireEdit(role);const p=get(state,id);if(p.x==null)throw Error('请先补充位置');if(!basis.trim())throw Error('请填写核实依据');
    if(!['remote','onsite'].includes(method))throw Error('请选择核实方式');
    const before={status:p.status,verification:p.verification};p.status='verified';p.verification={method,basis:basis.trim().slice(0,1000),author:roles[role].name,time:now()};record(state,p,role,'核实位置',before,{status:p.status,verification:p.verification});return p;
  }
  function review(state,id,reason,role){requireEdit(role);if(!reason.trim())throw Error('请填写需复查原因');const p=get(state,id);if(p.x==null)throw Error('该场所需要先补充位置');const before={status:p.status};p.status='review';record(state,p,role,'标记需复查',before,{status:p.status},reason.trim().slice(0,500));}
  function comment(state,id,text,role) {
    requireRestricted(role);text=text.trim();if(!text)throw Error('请填写评论');if(text.length>1000)throw Error('评论最多1000字');const p=get(state,id);
    p.comments.unshift({id:uid(),text,author:roles[role].name,department:roles[role].department,time:now()});record(state,p,role,'补充协作评论',{}, {},text);return p;
  }
  function photo(state,id,data,name,role){requireRestricted(role);if(!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw Error('请上传 JPG、PNG 或 WebP 图片');if(data.length>1600000)throw Error('图片较大，请压缩后重试');const p=get(state,id);if(p.photos.length>=6)throw Error('每个场所最多添加6张照片');p.photos.push({id:uid(),src:data,name:String(name).slice(0,100)});record(state,p,role,'上传现场照片',{}, {},String(name).slice(0,100));}
  function previewRows(state,rows) {const keys=new Set(state.places.map(p=>[p.enterprise,p.name,p.address].join('|')));return rows.map(row=>{let error='';let data;try{data=clean(row);if(!data.enterprise)error='缺少企业名称';if(!data.address)error='缺少地址线索';}catch(e){error=e.message;data=row;}const key=[data.enterprise,data.name,data.address].join('|');const duplicate=keys.has(key);keys.add(key);return {...data,error,result:error?'error':duplicate?'duplicate':data.x==null?'unlocated':'matched'};});}
  function importRows(state,rows,role){if(role!=='admin')throw Error('需要管理员角色导入名单');let added=0,skipped=0,errors=0;previewRows(state,rows).forEach(row=>{if(row.result==='error'){errors++;return;}if(row.result==='duplicate'){skipped++;return;}add(state,{...row,name:row.name||'实际经营场所'},role);added++;});return {added,skipped,errors};}
  function parseCSV(text){
    if(text.length>500000)throw Error('演示版仅支持500KB以内的CSV文件');const rows=[];let row=[],value='',quoted=false;
    text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(value);value='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';}else value+=ch;}if(quoted)throw Error('CSV引号未闭合');row.push(value);if(row.some(x=>x.trim()))rows.push(row);
    const headers=rows.shift()||[];const aliases={enterprise:['企业名称','enterprise'],name:['场所名称','name'],address:['实际地址','地址','address'],tags:['标签','tags']};const cols={};Object.entries(aliases).forEach(([key,names])=>cols[key]=headers.findIndex(h=>names.includes(h.trim())));if(cols.enterprise<0||cols.address<0)throw Error('CSV需包含“企业名称”和“实际地址”列');if(rows.length>100)throw Error('演示版每次最多导入100条记录');return rows.map(r=>({enterprise:r[cols.enterprise]||'',name:r[cols.name]||'实际经营场所',address:r[cols.address]||'',tags:(r[cols.tags]||'').split(/[;；、]/).map(s=>s.trim()).filter(Boolean),x:null,y:null}));
  }
  function orderRoute(state,ids,start={x:48,y:85}){const remaining=[...new Set(ids)].map(id=>get(state,id)).filter(p=>p.x!=null);const out=[];let current=start;while(remaining.length){remaining.sort((a,b)=>Math.hypot(a.x-current.x,a.y-current.y)-Math.hypot(b.x-current.x,b.y-current.y));current=remaining.shift();out.push(current.id);}return out;}
  return {tags,statuses,roles,fresh,visible,search,get,update,add,verify,review,comment,photo,sampleRows,previewRows,importRows,parseCSV,orderRoute,clone};
});
