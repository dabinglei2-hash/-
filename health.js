/* Health V1: pure validation/query/providers; app.js owns all persistent writes. */
(function(root){
  'use strict';
  const key='my-life-dashboard-health-v1', format='lifeos-health-backup', maxBytes=5*1024*1024;
  const metrics=Object.freeze({
    steps_total:{name:'累计步数',unit:'步',integer:true},steps_hourly:{name:'小时步数',unit:'步',integer:true},
    heart_rate:{name:'心率',unit:'bpm'},sleep:{name:'睡眠',unit:'分钟'},active_minutes:{name:'活动时长',unit:'分钟'},
    distance:{name:'活动距离',unit:'km'},energy:{name:'活动消耗',unit:'kcal'},spo2:{name:'血氧',unit:'%'},
    stress:{name:'压力（百分制）',unit:'%'},resting_heart_rate:{name:'静息心率',unit:'bpm'}
  });
  const fields=['id','metric','value','unit','measuredAt','source','recordType','ingestedAt','updatedAt','periodStart','periodEnd','stages','externalId'];
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
  const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
  const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\u0000-\u001f]/.test(v);
  const dateValid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  const stamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(v)&&dateValid(v.slice(0,10))&&Number.isFinite(Date.parse(v));
  const epoch=v=>Number.isSafeInteger(v)&&v>0;
  const blank=()=>({version:1,records:[],lastImportAt:null});
  const day=row=>row.metric==='steps_hourly'&&row.periodStart?row.periodStart.slice(0,10):row.measuredAt.slice(0,10);
  const canonical=v=>Array.isArray(v)?v.map(canonical):plain(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  function identity(row){return JSON.stringify(row.externalId?[row.source.id,'external',row.metric,row.externalId]:[row.source.id,'sample',row.metric,Date.parse(row.measuredAt),row.periodStart?Date.parse(row.periodStart):null,row.periodEnd?Date.parse(row.periodEnd):null]);}
  function measurement(row){const {id,ingestedAt,updatedAt,recordType,...content}=row;return {...content,measuredAt:Date.parse(row.measuredAt),periodStart:row.periodStart?Date.parse(row.periodStart):null,periodEnd:row.periodEnd?Date.parse(row.periodEnd):null};}
  function recordError(row){
    if(!exact(row,fields)||!text(row.id,120)||!Object.hasOwn(metrics,row.metric))return '健康记录字段、ID或指标类型无效。';
    const spec=metrics[row.metric];
    if(typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<0||row.value>1e9||row.unit!==spec.unit||(spec.integer&&!Number.isSafeInteger(row.value)))return '健康数值或单位无效。';
    if(['heart_rate','resting_heart_rate','sleep'].includes(row.metric)&&row.value<=0)return '心率或睡眠时长必须大于0。';
    if(['spo2','stress'].includes(row.metric)&&row.value>100)return '百分比不能超过100。';
    if(!stamp(row.measuredAt)||!epoch(row.ingestedAt)||!epoch(row.updatedAt)||row.updatedAt<row.ingestedAt)return '测量时间（须带时区）或记录时间无效。';
    if(!exact(row.source,['id','name'])||!text(row.source.id,120)||!text(row.source.name,80)||!['manual','file','device'].includes(row.recordType))return '健康来源或记录类型无效；演示数据不可持久保存。';
    if(row.source.id==='demo')return '演示来源仅供预览，不接受持久记录。';
    if(row.externalId!==null&&!text(row.externalId,160))return '原始记录引用无效。';
    const hasStart=row.periodStart!==null,hasEnd=row.periodEnd!==null;
    if(hasStart!==hasEnd||hasStart&&(!stamp(row.periodStart)||!stamp(row.periodEnd)||Date.parse(row.periodEnd)<=Date.parse(row.periodStart)||Date.parse(row.measuredAt)<Date.parse(row.periodEnd)))return '起止时间须成对填写，结束晚于开始且不晚于测量时间。';
    if(!['sleep','steps_hourly'].includes(row.metric)&&hasStart)return '此指标不接受区间数据。';
    if(row.metric==='steps_hourly'&&(!hasStart||Date.parse(row.periodEnd)-Date.parse(row.periodStart)!==3600000||!/:00:00(?:\.000)?(?:Z|[+-])/.test(row.periodStart)||day(row)!==row.periodStart.slice(0,10)))return '小时步数须提供同一测量日、整点开始的真实一小时区间。';
    if(row.metric==='sleep'&&hasStart&&row.value>(Date.parse(row.periodEnd)-Date.parse(row.periodStart))/60000)return '睡眠时长不能超过填写的起止区间。';
    if(row.stages!==null){
      if(row.metric!=='sleep'||!Array.isArray(row.stages)||!row.stages.length||row.stages.length>4)return '睡眠分期无效。';
      const seen=new Set();let asleep=0,all=0;
      for(const stage of row.stages){if(!exact(stage,['type','minutes'])||!['deep','light','rem','awake'].includes(stage.type)||seen.has(stage.type)||typeof stage.minutes!=='number'||!Number.isFinite(stage.minutes)||stage.minutes<0)return '睡眠分期字段无效。';seen.add(stage.type);all+=stage.minutes;if(stage.type!=='awake')asleep+=stage.minutes;}
      if(asleep>row.value+0.001||hasStart&&all>(Date.parse(row.periodEnd)-Date.parse(row.periodStart))/60000+0.001)return '分期分钟超过总睡眠或起止区间。';
    }
    return '';
  }
  function validate(value){
    if(!exact(value,['version','records','lastImportAt'])||value.version!==1||!Array.isArray(value.records)||value.records.length>10000||value.lastImportAt!==null&&!epoch(value.lastImportAt))return '健康存储格式无效或超过10000条。';
    const ids=new Set(),samples=new Set();
    for(const row of value.records){const error=recordError(row);if(error)return error;if(ids.has(row.id)||samples.has(identity(row)))return '健康数据包含重复ID或同一来源的重复测量身份。';ids.add(row.id);samples.add(identity(row));}
    if(new TextEncoder().encode(JSON.stringify(value)).length>maxBytes-1024)return '健康数据超过5MiB文件的安全容量，未截断保存。';
    return '';
  }
  function read(storage){
    try{const raw=storage.getItem(key);if(raw===null)return {data:blank(),raw,error:''};const data=JSON.parse(raw),error=validate(data);return {data:error?null:data,raw,error:error?'健康数据无法安全读取：'+error:''};}
    catch(error){return {data:null,raw:null,error:'健康存储不可读取，已停止写入；请保留原存储并检查浏览器权限。'};}
  }
  function merge(current,incoming){
    const error=validate(current)||validate(incoming);if(error)return {error,merged:null,additions:[],duplicates:0};
    const byId=new Map(current.records.map(row=>[row.id,row])),bySample=new Map(current.records.map(row=>[identity(row),row]));
    const additions=[];let duplicates=0;
    for(const row of incoming.records){
      const idMatch=byId.get(row.id),sample=bySample.get(identity(row));
      if(idMatch){if(!same(idMatch,row))return {error:'健康记录同ID内容冲突，已停止整份恢复，不覆盖原记录。',merged:null,additions:[],duplicates};duplicates++;continue;}
      if(sample){if(!same(measurement(sample),measurement(row)))return {error:'同一来源/测量身份的内容不同（可能含更完整分期），已停止恢复。',merged:null,additions:[],duplicates};duplicates++;continue;}
      additions.push(row);byId.set(row.id,row);bySample.set(identity(row),row);
    }
    const merged={version:1,records:current.records.concat(additions),lastImportAt:current.lastImportAt};
    const limit=validate(merged);return {error:limit,merged:limit?null:merged,additions,duplicates};
  }
  function select(records,{date='',metric='',source=''}={}){return records.filter(row=>(!date||day(row)===date)&&(!metric||row.metric===metric)&&(!source||row.source.id===source)).slice().sort((a,b)=>Date.parse(b.measuredAt)-Date.parse(a.measuredAt)||b.ingestedAt-a.ingestedAt||a.id.localeCompare(b.id));}
  function latest(records,metric,date,exactDay=false){return select(records.filter(row=>row.metric===metric&&(exactDay?day(row)===date:day(row)<=date)))[0]||null;}
  function summary(value,date){return {steps:latest(value.records,'steps_total',date,true),heart:latest(value.records,'heart_rate',date),sleep:latest(value.records,'sleep',date),updatedAt:value.records.length?Math.max(value.lastImportAt||0,...value.records.map(row=>row.updatedAt)):value.lastImportAt,status:value.lastImportAt?'已导入':value.records.length?'本地记录 · 未连接':'未连接'};}
  function addDay(date,offset){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
  function trend(records,date,period,source=''){
    const metric=period==='day'?'steps_hourly':'steps_total';
    const start=period==='day'?date:addDay(date,-6),eligible=select(records.filter(row=>row.metric===metric&&day(row)>=start&&day(row)<=date));
    const sources=[...new Map(eligible.map(row=>[row.source.id,row.source])).values()];
    const chosen=sources.find(row=>row.id===source)||sources[0]||null;
    const rows=chosen?eligible.filter(row=>row.source.id===chosen.id):[];
    const buckets=Array.from({length:period==='day'?24:7},(_,i)=>{
      const label=period==='day'?String(i).padStart(2,'0')+':00':addDay(start,i);
      const row=rows.find(row=>period==='day'?row.periodStart.slice(11,13)===label.slice(0,2):day(row)===label);
      return {label,value:row?row.value:null,id:row?.id||null};
    });
    return {start,end:date,source:chosen,sources,buckets};
  }
  function localStamp(value){const d=new Date(value),offset=-d.getTimezoneOffset();if(!Number.isFinite(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+(offset<0?'-':'+')+pad(Math.floor(Math.abs(offset)/60))+':'+pad(Math.abs(offset)%60);}
  function manual(values,existing,id,now){
    if(existing&&existing.recordType!=='manual')return {error:'同步/导入原始测量只读，可删除后明确重新录入手动值。'};
    const resolve=(value,original)=>{
      if(!value)return null;const normalized=value.length===16?value+':00':value;
      if(original){if(normalized===original.slice(0,19))return original;return normalized+(original.endsWith('Z')?'Z':original.slice(-6));}
      return localStamp(value);
    };
    const measuredAt=resolve(values.measuredAt,existing?.measuredAt)||'';
    const row={...(existing||{}),id:existing?.id||id,metric:values.metric,value:values.value===''?NaN:Number(values.value),unit:metrics[values.metric]?.unit||'',measuredAt,
      source:values.source==='manual-miband'?{id:'manual-miband',name:'小米手环10 NFC · 手动抄录'}:{id:'manual',name:'手动记录'},recordType:'manual',ingestedAt:existing?.ingestedAt||now,updatedAt:now,
      periodStart:resolve(values.periodStart,existing?.periodStart),periodEnd:resolve(values.periodEnd,existing?.periodEnd),stages:existing?.stages||null,externalId:existing?.externalId||null};
    // Keep exact source identity when editing an imported manual backup.
    if(existing&&!['manual','manual-miband'].includes(existing.source.id))row.source=existing.source;
    return {row,error:recordError(row)};
  }
  function parseFile(value){if(!exact(value,['format','schemaVersion','exportedAt','health'])||value.format!==format||value.schemaVersion!==1||!stamp(value.exportedAt))return {error:'仅支持 Life OS 健康 JSON v1；完整v10请从数据备份页恢复，小米原始文件仍需适配。'};return {data:value.health,error:validate(value.health)};}
  const ManualHealthProvider=Object.freeze({id:'manual',name:'手动记录',create:manual});
  const FileImportHealthProvider=Object.freeze({id:'file',name:'健康JSON文件',parse:parseFile});
  const DeviceHealthProvider=Object.freeze({id:'miband10',name:'小米手环 10 NFC',capabilities:()=>({connected:false,sync:false,reason:'设备协议与本地桥接尚未接入；本版本不尝试蓝牙连接、账号登录或同步。'}),sync:async()=>{throw new Error('尚未实现设备同步，请使用手动记录或健康JSON导入。');}});
  const DemoHealthProvider=Object.freeze({id:'demo',name:'合成演示 · 不保存',read:date=>{
    const sample=(id,metric,value,time)=>({id,metric,value,unit:metrics[metric].unit,measuredAt:date+'T'+time+':00+08:00',source:{id:'demo',name:'合成演示'},recordType:'demo',ingestedAt:Date.parse(date+'T20:00:00+08:00'),updatedAt:Date.parse(date+'T20:00:00+08:00'),periodStart:null,periodEnd:null,stages:null,externalId:null});
    return {version:1,lastImportAt:null,records:[sample('demo-steps','steps_total',4260,'18:00'),sample('demo-heart','heart_rate',72,'17:45'),sample('demo-sleep','sleep',435,'08:00')]};
  }});
  const api={key,format,maxBytes,metrics,blank,validate,recordError,read,merge,select,latest,summary,trend,day,dateValid,stamp,same,identity,localStamp,providers:{ManualHealthProvider,FileImportHealthProvider,DeviceHealthProvider,DemoHealthProvider}};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LifeHealth=Object.freeze(api);
})(typeof window==='object'?window:globalThis);
