/* Optional, approved v9 extension. Original diary objects remain plain text. */
(function(root){
  'use strict';
  const key='my-life-dashboard-ideas-meta-v1',dbName='lifeos-ideas-media-v1',MAX=20*1024*1024;
  const blank=()=>({version:1,documents:[]}), clone=v=>JSON.parse(JSON.stringify(v));
  const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
  const id=v=>typeof v==='string'&&v.length>0&&v.length<=200&&!/[\u0000-\u001f]/.test(v);
  const plain=delta=>delta.ops.map(op=>typeof op.insert==='string'?op.insert:'').join('').replace(/\n$/,'');
  const refs=delta=>[...new Set(delta.ops.filter(op=>typeof op.insert==='object').map(op=>op.insert.localImage))];
  function deltaError(delta){
    if(!exact(delta,['ops'])||!Array.isArray(delta.ops)||!delta.ops.length||delta.ops.length>12000)return '富文本结构无效。';
    let chars=0;
    for(const op of delta.ops){
      if(!exact(op,op?.attributes?['insert','attributes']:['insert']))return '富文本操作无效。';
      if(typeof op.insert==='string'){chars+=op.insert.length;}else if(!exact(op.insert,['localImage'])||!id(op.insert.localImage))return '不支持的图片引用。';
      if(op.attributes){if(typeof op.insert!=='string'||!exact(op.attributes,Object.keys(op.attributes)))return '格式属性无效。';
        for(const [k,v] of Object.entries(op.attributes))if(!((['bold','underline'].includes(k)&&v===true)||(k==='background'&&v==='#fff2a8')||(k==='list'&&v==='ordered')))return '不支持的文字格式。';}
    }
    if(chars>3001||!delta.ops.at(-1)?.insert?.endsWith?.('\n')||delta.ops.filter(op=>typeof op.insert==='object').length>3)return '正文最多3000字，每条最多3张图片。';
    return '';
  }
  function validate(meta,notes,strict=true){
    if(!exact(meta,['version','documents'])||meta.version!==1||!Array.isArray(meta.documents)||meta.documents.length>50000)return '妙想扩展格式无效。';
    const ids=new Set();
    for(const d of meta.documents){
      if(!exact(d,['recordId','plainTextSnapshot','delta','attachmentIds','updatedAt'])||!id(d.recordId)||ids.has(d.recordId)||typeof d.plainTextSnapshot!=='string'||d.plainTextSnapshot.length>3000||!Number.isSafeInteger(d.updatedAt)||d.updatedAt<0)return '妙想格式副本无效。';
      ids.add(d.recordId);const error=deltaError(d.delta);if(error)return error;
      if(!Array.isArray(d.attachmentIds)||JSON.stringify(refs(d.delta))!==JSON.stringify(d.attachmentIds)||plain(d.delta)!==d.plainTextSnapshot)return '富文本与正文或图片关联不一致。';
      if(strict&&notes){const n=notes.find(n=>n.id===d.recordId);if(!n||n.content!==d.plainTextSnapshot)return '妙想正文与格式副本冲突，请先核对原记录。';}
    }return '';
  }
  function read(notes){try{const raw=localStorage.getItem(key);const data=raw===null?blank():JSON.parse(raw);const error=validate(data,notes,false);return {data,error:error?('妙想扩展无法读取：'+error):'',raw};}catch(e){return {data:null,error:'妙想扩展无法读取，已停止写入；原数据保留。'};}}
  function merge(current,incoming,notes){
    const a=validate(current,null,false)||validate(incoming,null,false);if(a)return {error:a};
    const merged=clone(current);for(const d of incoming.documents){const old=merged.documents.find(x=>x.recordId===d.recordId);if(old&&JSON.stringify(old)!==JSON.stringify(d))return {error:'同一妙想的格式副本冲突，未覆盖。'};if(!old)merged.documents.push(clone(d));}
    merged.documents=merged.documents.filter(d=>notes.some(n=>n.id===d.recordId));
    return {merged,error:validate(merged,notes)};
  }
  let dbPromise;
  function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,1);req.onupgradeneeded=()=>{for(const n of ['assets','drafts','pendingSaves'])if(!req.result.objectStoreNames.contains(n))req.result.createObjectStore(n,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>{dbPromise=null;reject(new Error('无法打开本地图片/草稿存储：'+req.error?.message));};req.onblocked=()=>reject(new Error('本地存储升级被其他页面阻塞，请关闭其他 Life OS 标签页。'));}));}
  async function transaction(store,mode,act){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(store,mode),s=tx.objectStore(store);let req;try{req=act(s);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(new Error('本地存储失败：'+tx.error?.message));tx.onabort=()=>reject(new Error('本地存储操作中止：'+tx.error?.message));});}
  const all=store=>transaction(store,'readonly',s=>s.getAll()),get=(store,k)=>transaction(store,'readonly',s=>s.get(k)),put=(store,v)=>transaction(store,'readwrite',s=>s.put(v)),remove=(store,k)=>transaction(store,'readwrite',s=>s.delete(k));
  async function putDraft(value,expected){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('drafts','readwrite'),store=tx.objectStore('drafts');let conflict=false;const req=store.get('current');req.onsuccess=()=>{if(JSON.stringify(req.result||null)!==expected){conflict=true;tx.abort();return;}store.put(value);};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(new Error(conflict?'草稿已在其他页面变化，未覆盖。请保留当前输入并核对原草稿。':'草稿暂存中止：'+tx.error?.message));tx.onerror=()=>reject(new Error('草稿暂存失败：'+tx.error?.message));});}
  const sha=async bytes=>{if(!root.crypto?.subtle)throw new Error('图片校验需要安全来源，请使用HTTPS或本机127.0.0.1地址。');return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');};
  const newId=()=>root.crypto?.randomUUID?root.crypto.randomUUID():Date.now().toString(36)+'-'+[...root.crypto.getRandomValues(new Uint32Array(4))].map(x=>x.toString(16)).join('-');
  function signature(bytes,mime){if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);return String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';}
  async function image(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('请选择10MB以内的 JPEG、PNG 或 WebP 图片。');
    const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>40000000)throw new Error('图片像素过大，请缩小后重试。');const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',0.82));if(!blob||blob.size>1024*1024)throw new Error('压缩后图片仍超过1MB，请缩小后重试。');const asset={id:newId(),mime:blob.type,size:blob.size,width:canvas.width,height:canvas.height,sha256:await sha(await blob.arrayBuffer()),blob};await stageAssets([asset]);return asset;}finally{bitmap.close();}
  }
  async function stageAssets(rows){const current=await all('assets');let size=current.reduce((n,a)=>n+a.size,0);for(const a of rows){const old=current.find(x=>x.id===a.id);if(old){if(old.sha256!==a.sha256||old.size!==a.size)throw new Error('图片ID冲突，未覆盖现有图片。');continue;}size+=a.size;if(size>MAX)throw new Error('本地妙想图片总量超过20MB，已停止写入。请先导出备份。');await transaction('assets','readwrite',s=>s.add(a));}}
  async function checkDraft(draft){
    if(draft===null)return;
    if(!exact(draft,['id','revision','context','delta','updatedAt'])||draft.id!=='current'||!id(draft.revision)||!Number.isSafeInteger(draft.updatedAt)||!draft.context||typeof draft.context.content!=='string'||!Array.isArray(draft.context.tags))throw new Error('草稿结构无效。');
    const e=deltaError(draft.delta);if(e||plain(draft.delta)!==draft.context.content)throw new Error(e||'草稿正文不一致。');
    const c=draft.context,required=['edit','dirty','date','title','content','tags','tagInput'],optional=['richDelta','revision','saveId','richExpected'];
    if(required.some(k=>!Object.hasOwn(c,k))||Object.keys(c).some(k=>!required.concat(optional).includes(k))||typeof c.dirty!=='boolean'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||typeof c.title!=='string'||c.title.length>80||typeof c.tagInput!=='string'||c.tagInput.length>80)throw new Error('草稿内容字段无效。');
    if(root.LifeContent.validate({assignments:[{recordId:'draft',tags:c.tags}]}))throw new Error('草稿标签无效。');
    if(c.edit!==null&&(!exact(c.edit,['expected','id','tags'])||!id(c.edit.id)||typeof c.edit.expected!=='string'||c.edit.expected.length>16000||typeof c.edit.tags!=='string'||c.edit.tags.length>4000))throw new Error('草稿编辑关联无效。');
    if(c.saveId!==undefined&&!id(c.saveId)||c.revision!==undefined&&c.revision!==draft.revision||c.richDelta&&JSON.stringify(c.richDelta)!==JSON.stringify(draft.delta)||c.richExpected!==undefined&&c.richExpected!==null&&(typeof c.richExpected!=='string'||c.richExpected.length>100000))throw new Error('草稿格式或身份无效。');
  }
  async function recover(){for(const j of await all('pendingSaves')){const after=j.entries.every(e=>localStorage.getItem(e.key)===e.after),before=j.entries.every(e=>localStorage.getItem(e.key)===e.before);if(after){if(j.draft){const d=await get('drafts','current')||null;if(JSON.stringify(d)!==j.draftExpected&&JSON.stringify(d)!==JSON.stringify(j.draft))throw new Error('记录已合并，但草稿在其他页面变化，未覆盖。请保留页面并导出当前数据。');if(JSON.stringify(d)!==JSON.stringify(j.draft))await put('drafts',j.draft);}if(j.clearRevision){const d=await get('drafts','current');if(d?.revision===j.clearRevision&&JSON.stringify(d)===j.clearDraftSnapshot)await remove('drafts','current');}await remove('pendingSaves',j.id);}else if(before)await remove('pendingSaves',j.id);else throw new Error('发现未完成的跨存储保存，已停止新写入。请保留页面和数据，导出备份后联系维护；不会自动覆盖记录。');}}
  async function commit(entries,write,options={}){
    await recover();
    const journal={id:newId(),entries:entries.map(([key,value])=>({key,before:localStorage.getItem(key),after:JSON.stringify(value)})),draft:options.draft||null,clearRevision:options.clearRevision||null,clearDraftSnapshot:options.clearDraftSnapshot||null,draftExpected:options.draftExpected};
    if(options.expected&&Object.entries(options.expected).some(([k,v])=>localStorage.getItem(k)!==v))throw new Error('数据已在其他页面改变，输入仍保留，请重新核对。');
    await stageAssets(options.assets||[]);
    if(options.draftExpected!==undefined&&JSON.stringify(await get('drafts','current')||null)!==options.draftExpected)throw new Error('未保存草稿已变化，已停止恢复，请重新预览。');
    await put('pendingSaves',journal);
    if(journal.entries.some(e=>localStorage.getItem(e.key)!==e.before))throw new Error('数据发生并发修改，已停止保存，草稿仍保留。');
    const error=write(entries);if(error)throw new Error(error);
    // LocalStorage is committed. Cleanup can be retried on reload without creating another record.
    let warning='';try{await recover();}catch(e){warning='记录已保存；草稿清理待恢复：'+e.message;}return {warning};
  }
  async function exportMedia(meta){await recover();const assets=await all('assets'),draft=await get('drafts','current')||null;await checkDraft(draft);const wanted=new Set(meta.documents.flatMap(d=>d.attachmentIds).concat(draft?refs(draft.delta):[]));const attachments=[];for(const id of wanted){const a=assets.find(x=>x.id===id);if(!a)throw new Error('图片缺失，已停止完整导出：'+id);const bytes=new Uint8Array(await a.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));attachments.push({id:a.id,mime:a.mime,size:a.size,width:a.width,height:a.height,sha256:a.sha256,base64:btoa(binary)});}return {ideasAttachments:attachments,ideasDraft:draft};}
  async function decodeBackup(backup){
    if(backup.schemaVersion!==9)return {assets:[],draft:null};
    const e=validate(backup.ideasMeta,backup.personal.diary);if(e)throw new Error(e);
    if(!Array.isArray(backup.ideasAttachments)||backup.ideasAttachments.length>150003)throw new Error('图片列表无效。');
    await checkDraft(backup.ideasDraft);const assets=[],ids=new Set();let total=0;
    for(const a of backup.ideasAttachments){if(!exact(a,['id','mime','size','width','height','sha256','base64'])||!id(a.id)||ids.has(a.id)||!['image/jpeg','image/png','image/webp'].includes(a.mime)||!Number.isInteger(a.size)||a.size<=0||a.size>1024*1024||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>1600||a.height>1600||typeof a.base64!=='string'||a.base64.length>1400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64))throw new Error('备份图片字段无效。');ids.add(a.id);total+=a.size;if(total>MAX)throw new Error('图片总量超过20MB。');const bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));if(!signature(bytes,a.mime)||bytes.length!==a.size||await sha(bytes)!==a.sha256)throw new Error('图片校验失败：大小或SHA256不一致。');const blob=new Blob([bytes],{type:a.mime});const b=await createImageBitmap(blob);const ok=b.width===a.width&&b.height===a.height;b.close();if(!ok)throw new Error('图片尺寸不一致。');assets.push({...a,base64:undefined,blob});}
    const wanted=backup.ideasMeta.documents.flatMap(d=>d.attachmentIds).concat(backup.ideasDraft?refs(backup.ideasDraft.delta):[]);if(wanted.some(i=>!ids.has(i)))throw new Error('备份缺少关联图片。');return {assets,draft:backup.ideasDraft};
  }
  async function mediaConflict(decoded){await recover();const rows=await all('assets');for(const a of decoded.assets){const old=rows.find(x=>x.id===a.id);if(old&&(old.sha256!==a.sha256||old.size!==a.size))throw new Error('图片ID冲突，已停止恢复。');}const d=await get('drafts','current');if(decoded.draft&&d&&JSON.stringify(d)!==JSON.stringify(decoded.draft))throw new Error('当前已有不同的未保存草稿，已停止恢复；请先保存或明确放弃草稿。');}
  const urls=new Map();
  async function imageURL(id){if(urls.has(id))return urls.get(id);const a=await get('assets',id);if(!a)throw new Error('本地图片缺失，请从完整v9备份恢复。');const url=URL.createObjectURL(a.blob);urls.set(id,url);return url;}
  const displays=new Map();let pendingLayout=Promise.resolve();
  function imageDisplay(id){if(!displays.has(id))displays.set(id,get('assets',id).then(async a=>{if(!a)throw new Error('本地图片缺失，请从完整v9备份恢复。');return {width:a.width,height:a.height,url:await imageURL(id)};}).catch(e=>{displays.delete(id);throw e;}));return displays.get(id);}
  function render(target,delta){
    const e=deltaError(delta);if(e){target.textContent=e;return Promise.resolve();}target.replaceChildren();let line=document.createElement('p'),list=null;const images=[];
    for(const op of delta.ops){if(typeof op.insert==='object'){if(line.childNodes.length)target.append(line);line=document.createElement('p');list=null;const figure=document.createElement('p'),img=document.createElement('img');img.alt='妙想附件';img.loading='lazy';figure.append(img);target.append(figure);images.push(imageDisplay(op.insert.localImage).then(a=>{img.width=a.width;img.height=a.height;img.style.aspectRatio=a.width+'/'+a.height;img.src=a.url;}).catch(e=>{img.replaceWith(document.createTextNode(e.message));}));continue;}
      const parts=op.insert.split('\n');parts.forEach((text,i)=>{if(text){let span=document.createElement('span');span.textContent=text;if(op.attributes?.bold)span.style.fontWeight='700';if(op.attributes?.underline)span.style.textDecoration='underline';if(op.attributes?.background)span.style.backgroundColor='#fff2a8';line.append(span);}if(i<parts.length-1){if(op.attributes?.list==='ordered'){if(!list){list=document.createElement('ol');target.append(list);}const li=document.createElement('li');li.append(...line.childNodes);list.append(li);}else{list=null;target.append(line);}line=document.createElement('p');}});
    }if(line.childNodes.length)target.append(line);return Promise.all(images);
  }
  function hydrate(scope,notes){const stored=read(notes);if(stored.error)return Promise.resolve();const images=[];for(const el of scope.querySelectorAll('[data-rich-note]')){const n=notes.find(n=>n.id===el.dataset.richNote),d=stored.data.documents.find(d=>d.recordId===n?.id);if(d&&d.plainTextSnapshot===n.content)images.push(render(el,d.delta));else if(d){const warning=document.createElement('small');warning.className='rich-conflict';warning.textContent='格式副本与正文不同，显示原正文；请核对后编辑。';el.append(warning);}}pendingLayout=Promise.all(images);return pendingLayout;}
  root.LifeIdeasRich=Object.freeze({key,dbName,blank,validate,read,merge,plain,refs,deltaError,newId,image,imageURL,all,get,put,putDraft,remove,commit,recover,exportMedia,decodeBackup,mediaConflict,render,hydrate,checkDraft,layoutReady:()=>pendingLayout});
})(window);
