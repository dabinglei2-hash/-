/* Independent notes model. Persistence and navigation are injected by app.js. */
(function(root){
  'use strict';
  const key='my-life-dashboard-notes-v1',format='lifeos-notes-backup',maxBytes=5*1024*1024;
  const categories=['日常记录','学习笔记','交易系统','AI 与网站开发','灵感与想法','其他'];
  const states={local:'本地笔记',synced:'已同步',pending:'待同步',failed:'同步失败',conflict:'存在冲突',uncertain:'结果待核对'};
  const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
  const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
  const text=(x,n)=>typeof x==='string'&&x.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
  const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(x);
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
  const epoch=x=>Number.isSafeInteger(x)&&x>0;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const canonical=x=>Array.isArray(x)?x.map(canonical):plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const blank=()=>({version:1,notes:[],lastSyncAt:null});
  function recordError(row){
    if(!exact(row,['id','title','body','category','createdAt','updatedAt','remote','sync'])||!id(row.id)||!text(row.title,200)||!row.title.trim()||!text(row.body,100000)||!text(row.category,100)||!epoch(row.createdAt)||!epoch(row.updatedAt)||row.updatedAt<row.createdAt)return '笔记字段、标题、正文长度或时间无效。';
    if(!exact(row.sync,['state','operationId','intent','error'])||!Object.hasOwn(states,row.sync.state)||row.sync.operationId!==null&&!id(row.sync.operationId)||![null,'save','archive'].includes(row.sync.intent)||!text(row.sync.error,500))return '笔记同步状态无效。';
    if(row.remote!==null){const r=row.remote;if(!exact(r,['pageId','sourceId','url','revision','editable','missing'])||!uuid(r.pageId)||!uuid(r.sourceId)||!/^https:\/\/(?:www\.)?notion\.(?:so|com)\//.test(r.url)||!text(r.url,2000)||!text(r.revision,200)||!r.revision||typeof r.editable!=='boolean'||typeof r.missing!=='boolean'||row.sync.state==='local')return 'Notion 页面身份或来源无效。';}
    else if(row.sync.state==='synced'||row.sync.intent==='archive')return '本地笔记不能标记为已同步或远端归档。';
    if(['pending','failed','uncertain'].includes(row.sync.state)&&(!row.sync.operationId||!row.sync.intent))return '待同步操作缺少稳定身份。';
    return '';
  }
  function validate(data){
    if(!exact(data,['version','notes','lastSyncAt'])||data.version!==1||!Array.isArray(data.notes)||data.notes.length>2000||data.lastSyncAt!==null&&!epoch(data.lastSyncAt))return '笔记存储格式无效或超过2000条。';
    const ids=new Set(),pages=new Set();for(const row of data.notes){const error=recordError(row);if(error)return error;const identity=row.remote?row.remote.sourceId+'/'+row.remote.pageId:null;if(ids.has(row.id)||identity&&pages.has(identity))return '笔记包含重复ID或Notion页面身份。';ids.add(row.id);if(identity)pages.add(identity);}
    if(new TextEncoder().encode(JSON.stringify(data)).length>maxBytes-2048)return '笔记超过5MiB安全容量，未截断保存。';return '';
  }
  function read(storage){try{const raw=storage.getItem(key);if(raw===null)return {data:blank(),raw,error:''};const data=JSON.parse(raw),error=validate(data);return {data:error?null:data,raw,error:error?'笔记无法安全读取：'+error:''};}catch(error){return {data:null,raw:null,error:'笔记存储不可读取，已停止写入；原数据没有重置。'};}}
  function make(values,existing,idValue,now){
    const row={id:existing?.id||idValue,title:values.title.trim(),body:values.body,category:values.category.trim(),createdAt:existing?.createdAt||now,updatedAt:now,remote:existing?.remote||null,sync:existing?.sync||{state:'local',operationId:null,intent:null,error:''}};
    return {row,error:recordError(row)};
  }
  function select(rows,{query='',category='',origin='',state=''}={}){const q=query.trim().toLocaleLowerCase();return rows.filter(row=>(!q||(row.title+'\n'+row.body).toLocaleLowerCase().includes(q))&&(!category||row.category===category)&&(!origin||(origin==='notion')===Boolean(row.remote))&&(!state||row.sync.state===state)).slice().sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));}
  function merge(current,incoming){const error=validate(current)||validate(incoming);if(error)return {error,merged:null,additions:[],duplicates:0};const merged=structuredClone(current),ids=new Map(current.notes.map(row=>[row.id,row])),pages=new Map(current.notes.filter(r=>r.remote).map(r=>[r.remote.sourceId+'/'+r.remote.pageId,r]));const additions=[];let duplicates=0;
    for(const row of incoming.notes){const old=ids.get(row.id)||(row.remote?pages.get(row.remote.sourceId+'/'+row.remote.pageId):null);if(old){if(!equal(old,row))return {error:'笔记同ID或Notion页面内容冲突，已停止整份恢复，不覆盖本地编辑。',merged:null,additions:[],duplicates};duplicates++;}else{additions.push(row);merged.notes.push(structuredClone(row));}}
    return {error:validate(merged),merged,additions,duplicates};
  }
  function remoteRow(item,existing,now){
    return {id:existing?.id||'notion-'+item.id.replaceAll('-',''),title:item.title||'无标题',body:item.body,category:item.category||'',createdAt:Date.parse(item.createdAt),updatedAt:Date.parse(item.updatedAt),remote:{pageId:item.id,sourceId:item.sourceId,url:item.url,revision:item.revision,editable:item.editable,missing:false},sync:{state:'synced',operationId:null,intent:null,error:''}};
  }
  function reconcile(data,items,now){const next=structuredClone(data);for(const item of items){const index=next.notes.findIndex(r=>r.remote?.pageId===item.id&&r.remote?.sourceId===item.sourceId),old=next.notes[index];if(old&&old.sync.state!=='synced'){if(old.remote.revision!==item.revision){old.sync={...old.sync,state:'conflict',error:'Notion 内容已变化，本地编辑已保留。请核对远端或另存本地副本。'};}continue;}const row=remoteRow(item,old,now),error=recordError(row);if(error)throw new Error(error);if(index<0)next.notes.push(row);else next.notes[index]=row;}next.lastSyncAt=now;const error=validate(next);if(error)throw new Error(error);return next;}
  function exportData(data){const copy=structuredClone(data);for(const row of copy.notes){if(!row.remote&&row.sync.operationId&&row.sync.state!=='local'){row.sync.state='uncertain';row.sync.error='从备份恢复的创建操作须先在Notion核对，不自动重发。';}}return copy;}
  function parseFile(value){if(!exact(value,['format','schemaVersion','exportedAt','notes'])||value.format!==format||value.schemaVersion!==1||typeof value.exportedAt!=='string'||!Number.isFinite(Date.parse(value.exportedAt)))return {error:'仅支持 Life OS 笔记 JSON v1；完整v11请从数据备份页恢复。'};return {data:value.notes,error:validate(value.notes)};}
  const api={key,format,maxBytes,categories,states,blank,read,validate,recordError,make,select,merge,reconcile,remoteRow,exportData,parseFile,equal};root.LifeNotes=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
