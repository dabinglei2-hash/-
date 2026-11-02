/* Local health views. All writes are injected by the existing app controller. */
(function(root){
  'use strict';
  const H=root.LifeHealth,$=s=>document.querySelector(s),icon=name=>root.LifeIcons.render(name);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let config,activeRoute='',state={date:'',historyDate:'',metric:'',source:'',period:'day',trendSource:'',heartSource:'',page:1};
  let edit=null,reservedId='',editRaw=null,formDirty=false,busy=false,pending=null,fileGeneration=0,viewportFrame=0;
  const matches=route=>route==='#health'||/^#health\/(history|data|demo)$/.test(route||'')||/^#health\/(record|sleep)\//.test(route||'');
  const typeLabel={manual:'手动记录',file:'文件导入',device:'设备记录（不代表当前连接）',demo:'合成演示'};
  const display=row=>row?row.metric==='sleep'?Math.floor(row.value/60)+'小时 '+Number((row.value%60).toFixed(1))+'分':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(row.value)+' '+row.unit:'暂无数据';
  const time=row=>row?row.measuredAt.slice(0,10)+' '+row.measuredAt.slice(11,19):'暂无';
  const imported=value=>value?new Date(value).toLocaleString('zh-CN'):'暂无';
  const options=(items,value)=>items.map(([id,label])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(label)+'</option>').join('');
  const status=(text,error=false)=>{$('#health-status').textContent=text;$('#health-status').classList.toggle('is-error',error);};
  function date(){return state.date||config.today();}
  function snapshot(){return {...state};}
  function restore(value){
    if(!value||typeof value!=='object')return;
    if(H.dateValid(value.date))state.date=value.date;
    if(value.historyDate===''||H.dateValid(value.historyDate))state.historyDate=value.historyDate;
    if(value.metric===''||Object.hasOwn(H.metrics,value.metric))state.metric=value.metric;
    if(typeof value.source==='string')state.source=value.source;
    if(['day','week'].includes(value.period))state.period=value.period;
    if(typeof value.trendSource==='string')state.trendSource=value.trendSource;
    if(typeof value.heartSource==='string')state.heartSource=value.heartSource;
    state.page=Math.max(1,Number(value.page)||1);render();
  }
  function chooseDate(value){if(!H.dateValid(value)){$('#health-date').value=date();status('请选择有效日期；当前查看范围保持不变。',true);return;}state.date=value;state.trendSource='';render();config.remember();}
  function metricCard(title,row,key){return '<article class="health-metric"><span>'+title+'</span><strong id="health-'+key+'">'+esc(display(row))+'</strong><small>'+esc(row?row.source.name:'尚无记录')+'</small><small>'+esc(row?(H.day(row)!==date()?'历史记录 · ':'')+time(row):'')+'</small></article>';}
  function renderHomeCard(homeDate){
    if(!config)return;const stored=config.read(),summary=H.summary(stored.data||H.blank(),homeDate);
    $('#home-health-steps').textContent=stored.error?'读取受限':display(summary.steps);
    $('#home-health-heart').textContent=stored.error?'读取受限':display(summary.heart);
    $('#home-health-sleep').textContent=stored.error?'读取受限':display(summary.sleep);
    $('#home-health-status').textContent=stored.error?'读取受限':summary.status;
    $('#home-health-times').textContent='心率 '+(summary.heart?time(summary.heart):'暂无')+' · 睡眠 '+(summary.sleep?H.day(summary.sleep):'暂无');
  }
  function renderTrend(data){
    const trend=H.trend(data.records,date(),state.period,state.trendSource),values=trend.buckets.filter(row=>row.value!==null),max=Math.max(1,...values.map(row=>row.value));
    $('#health-trend-source').innerHTML=options([['','自动选择最新来源'],...trend.sources.map(s=>[s.id,s.name])],state.trendSource);
    $('#health-trend-range').textContent=trend.start+' 至 '+trend.end+' · '+(trend.source?.name||'暂无来源')+' · 缺测留空，不计为0';
    $('#health-trend-empty').classList.toggle('hidden',values.length>0);
    $('#health-trend-bars').classList.toggle('hidden',!values.length);
    $('#health-trend-bars').innerHTML=values.length?trend.buckets.map((row,i)=>'<div class="health-bar-cell"><span class="health-bar '+(row.value===null?'is-missing':'')+'" style="--health-bar:'+((row.value||0)/max*100)+'%" title="'+esc(row.label+' '+(row.value===null?'暂无数据':row.value+' 步'))+'"></span><small>'+(state.period==='week'?row.label.slice(5):i%4===0?String(i):'')+'</small></div>').join(''):'';
    $('#health-trend-table').innerHTML=values.map(row=>'<tr><th scope="row">'+esc(row.label)+'</th><td>'+row.value+' 步</td></tr>').join('');
    $('#health-trend-bars').setAttribute('aria-label',(state.period==='week'?'近7日累计步数':'实际小时步数')+'，'+values.length+' 个有记录时间点，明细见下方');
    document.querySelectorAll('[data-health-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.healthPeriod===state.period)));
  }
  function home(data,demo=false){
    const summary=H.summary(data,date());
    $('#health-date').value=date();$('#health-updated').textContent='最近数据更新：'+imported(summary.updatedAt);
    $('#health-core').innerHTML=metricCard('当日累计步数',summary.steps,'steps')+metricCard('最近心率',summary.heart,'heart')+metricCard('最近完整睡眠',summary.sleep,'sleep');
    $('#health-optional').innerHTML=['active_minutes','distance','energy','spo2','stress','resting_heart_rate'].map(metric=>{
      const row=H.latest(data.records,metric,date(),true);return row?'<div><span>'+esc(H.metrics[metric].name)+'</span><strong>'+esc(display(row))+'</strong><small>'+esc(row.source.name)+' · '+esc(row.measuredAt.slice(11,19))+'</small></div>':'';
    }).join('');
    const rates=H.select(data.records,{date:date(),metric:'heart_rate'}),sources=[...new Map(rates.map(row=>[row.source.id,row.source])).values()],source=sources.find(row=>row.id===state.heartSource)||rates[0]?.source;
    const points=rates.filter(row=>row.source.id===source?.id).reverse();
    $('#health-heart-trend').classList.toggle('hidden',rates.length<2);
    $('#health-heart-picker').innerHTML=options([['','最新记录的来源'],...sources.map(row=>[row.id,row.name])],state.heartSource);
    $('#health-heart-points').innerHTML=points.map(row=>'<li>'+esc(row.measuredAt.slice(11,19))+' · '+esc(display(row))+'</li>').join('');
    $('#health-heart-source').textContent=source?source.name+' · '+points.length+'次离散测量；连线仅辅助查看，非实时':'';
    const min=Math.min(...points.map(row=>row.value)),max=Math.max(...points.map(row=>row.value)),first=Date.parse(points[0]?.measuredAt),last=Date.parse(points.at(-1)?.measuredAt);
    const coordinates=points.map(row=>({x:10+(Date.parse(row.measuredAt)-first)/Math.max(1,last-first)*300,y:72-(row.value-min)/Math.max(1,max-min)*54}));
    $('#health-heart-chart').innerHTML=points.length?'<svg viewBox="0 0 320 96" role="img" aria-label="所选来源当天'+points.length+'次实际心率测量，单位bpm">'+(points.length>1?'<polyline points="'+coordinates.map(point=>point.x+','+point.y).join(' ')+'" fill="none" stroke="currentColor" stroke-width="1.5"/>':'')+coordinates.map(point=>'<circle cx="'+point.x+'" cy="'+point.y+'" r="3" fill="white" stroke="currentColor"/>').join('')+'<text x="10" y="94">'+min+'–'+max+' bpm</text></svg>':'';
    renderTrend(data);
    const sleep=summary.sleep;
    $('#health-sleep-summary').innerHTML=sleep?'<strong>'+esc(display(sleep))+'</strong><span>'+esc(H.day(sleep))+' · '+esc(sleep.source.name)+'</span><small>'+(sleep.periodStart?esc(sleep.periodStart.slice(0,16).replace('T',' ')+' → '+sleep.periodEnd.slice(0,16).replace('T',' ')):'未提供入睡/醒来时间')+'</small>':'<strong>暂无睡眠记录</strong><small>可手动填写时长，未提供的分期不推测。</small>';
    $('#health-sleep-open').disabled=!sleep||demo;$('#health-sleep-open').dataset.healthSleep=sleep?.id||'';
  }
  function rowMarkup(row){return '<article class="health-history-row"><a href="#health/record/'+encodeURIComponent(row.id)+'" data-health-open><span><strong>'+esc(H.metrics[row.metric].name)+'</strong><small>'+esc(time(row))+'</small><small>'+esc(row.source.name)+' · '+esc(typeLabel[row.recordType])+'</small></span><strong>'+esc(display(row))+'</strong>'+icon('chevronRight')+'</a></article>';}
  function historyView(data){
    const sources=[...new Map(data.records.map(row=>[row.source.id,row.source.name])).entries()];
    if(state.source&&!sources.some(([id])=>id===state.source))sources.push([state.source,'所选来源暂无记录']);
    $('#health-history-date').value=state.historyDate;
    $('#health-history-metric').innerHTML=options([['','全部指标'],...Object.entries(H.metrics).map(([id,spec])=>[id,spec.name])],state.metric);
    $('#health-history-source').innerHTML=options([['','全部来源'],...sources],state.source);
    const rows=H.select(data.records,{date:state.historyDate,metric:state.metric,source:state.source}),pages=Math.max(1,Math.ceil(rows.length/20));state.page=Math.min(state.page,pages);
    $('#health-history-list').innerHTML=rows.slice((state.page-1)*20,state.page*20).map(rowMarkup).join('');
    $('#health-history-empty').classList.toggle('hidden',rows.length>0);$('#health-history-summary').textContent=(state.historyDate||'全部日期')+' · '+rows.length+' 条 · 测量时间从新到旧';
    $('#health-page-label').textContent=state.page+' / '+pages;$('#health-page-prev').disabled=state.page<=1;$('#health-page-next').disabled=state.page>=pages;
  }
  function detail(data,route){
    let id='';try{id=decodeURIComponent(route.split('/').slice(2).join('/'));}catch(error){id='';}
    const row=data.records.find(row=>row.id===id);
    if(!row){$('#health-detail').innerHTML='<div class="empty-state"><strong>健康记录不存在</strong><p>记录可能已删除或链接无效。</p><button type="button" class="secondary-button" data-back-fallback="#health/history">返回历史记录</button></div>';return;}
    const stages={deep:'深睡',light:'浅睡',rem:'REM',awake:'清醒'};
    $('#health-detail').innerHTML='<article class="health-panel"><h2>'+esc(H.metrics[row.metric].name)+'</h2><p class="health-detail-value">'+esc(display(row))+'</p><dl class="health-details">'+[['测量时间',row.measuredAt.replace('T',' ')],['数据来源',row.source.name],['记录类型',typeLabel[row.recordType]],['首次记录/导入',imported(row.ingestedAt)],['最近编辑',imported(row.updatedAt)]].map(([key,value])=>'<div><dt>'+key+'</dt><dd>'+esc(value)+'</dd></div>').join('')+(row.periodStart?'<div><dt>开始 / 结束</dt><dd>'+esc(row.periodStart.replace('T',' ')+' → '+row.periodEnd.replace('T',' '))+'</dd></div>':'')+'</dl>'+(row.stages?'<h3>来源提供的睡眠分期</h3><ul>'+row.stages.map(stage=>'<li>'+stages[stage.type]+' '+stage.minutes+' 分钟</li>').join('')+'</ul>':row.metric==='sleep'?'<p class="subtle-copy">未提供睡眠分期。</p>':'')+'<div class="health-actions">'+(row.recordType==='manual'?'<button type="button" class="secondary-button" data-health-edit="'+esc(row.id)+'">编辑记录</button>':'<p class="subtle-copy">原始导入/设备测量只读；可新建明确标记的手动记录。</p>')+'<button type="button" class="secondary-button delete-button" data-health-delete="'+esc(row.id)+'">删除记录</button></div></article>';
  }
  function render(){
    if(!config)return;const stored=config.read(),data=stored.data||H.blank();
    $('#health-read-error').textContent=stored.error;$('#health-read-error').classList.toggle('hidden',!stored.error);
    const demo=activeRoute==='#health/demo',isHome=activeRoute==='#health'||demo;
    $('#health-home').classList.toggle('hidden',!isHome);$('#health-history').classList.toggle('hidden',activeRoute!=='#health/history');$('#health-data').classList.toggle('hidden',activeRoute!=='#health/data');$('#health-detail').classList.toggle('hidden',!/^#health\/(record|sleep)\//.test(activeRoute));
    $('#health-demo-banner').classList.toggle('hidden',!demo);$('#health-real-actions').classList.toggle('hidden',demo);$('#health-device-card').classList.toggle('hidden',demo);
    home(demo?H.providers.DemoHealthProvider.read(date()):data,demo);historyView(data);
    if(/^#health\/(record|sleep)\//.test(activeRoute))detail(data,activeRoute);
    $('#health-import-time').textContent='最近健康导入：'+imported(data.lastImportAt);
    $('#health-device-import').textContent='本地数据：'+H.summary(data,date()).status+' · 最近导入 '+imported(data.lastImportAt);
    $('#health-data-count').textContent=data.records.length+' 条健康记录 · 仅在当前浏览器来源保存';
    root.LifeUI.enhance();
  }
  function route(target){activeRoute=target;if(matches(target))render();else if($('#health-editor').open)root.LifeUI.closeSheet($('#health-editor'));if($('#health-device-dialog').open&&target!=='#health')root.LifeUI.closeSheet($('#health-device-dialog'));}
  function formStatus(text,error=false){$('#health-form-status').textContent=text;$('#health-form-status').classList.toggle('is-error',error);}
  function syncForm(){const spec=H.metrics[$('#health-metric').value];$('#health-unit').textContent=spec.unit;$('#health-value').step=spec.integer?'1':'any';$('#health-value').min=['heart_rate','resting_heart_rate','sleep'].includes($('#health-metric').value)?'0.01':'0';$('#health-sleep-fields').classList.toggle('hidden',$('#health-metric').value!=='sleep');}
  async function openEditor(id){
    const stored=config.read();if(stored.error){status(stored.error,true);return;}
    const row=stored.data.records.find(row=>row.id===id);
    if(id&&!row){status('这条健康记录已不存在。',true);return;}
    if(formDirty&&((edit?.id||'')!==(id||''))&&!await config.confirm('当前健康草稿尚未保存，放弃后打开另一条？','切换健康记录','放弃并切换'))return;
    if(!formDirty||(edit?.id||'')!==(id||'')){
      edit=row||null;editRaw=stored.raw;reservedId=config.makeId();$('#health-form').reset();
      $('#health-editor-title').textContent=row?'编辑健康记录':'记录健康数据';$('#health-metric').value=row?.metric||'steps_total';$('#health-metric').disabled=Boolean(row);
      $('#health-value').value=row?.value??'';$('#health-measured').value=row?row.measuredAt.slice(0,19):date()+'T'+H.localStamp(new Date()).slice(11,19);
      $('#health-manual-source').value=row?.source.id==='manual-miband'?'manual-miband':'manual';
      $('#health-sleep-start').value=row?.periodStart?.slice(0,19)||'';$('#health-sleep-end').value=row?.periodEnd?.slice(0,19)||'';syncForm();formStatus('');
    }
    $('#health-editor').showModal();
    updateEditorViewport();
  }
  function updateEditorViewport(){
    if(viewportFrame)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;const editor=$('#health-editor');if(!editor?.open)return;const viewport=window.visualViewport,normal=!viewport||viewport.scale===1;const height=normal?(viewport?.height||window.innerHeight):window.innerHeight,bottom=normal?Math.max(0,document.documentElement.clientHeight-height-(viewport?.offsetTop||0)):0;editor.style.setProperty('--health-visual-height',height+'px');editor.style.setProperty('--health-keyboard-offset',bottom+'px');});
  }
  async function submit(event){
    event.preventDefault();if(busy)return;busy=true;$('#health-save').disabled=true;
    try{
      const stored=config.read();if(stored.error)throw new Error(stored.error);
      if(stored.raw!==editRaw)throw new Error('健康数据已在其他页面改变，输入仍保留。请先复制输入，再放弃草稿并重新打开核对。');
      const result=H.providers.ManualHealthProvider.create({metric:$('#health-metric').value,value:$('#health-value').value,measuredAt:$('#health-measured').value,source:$('#health-manual-source').value,periodStart:$('#health-metric').value==='sleep'?$('#health-sleep-start').value:'',periodEnd:$('#health-metric').value==='sleep'?$('#health-sleep-end').value:''},edit,reservedId,Date.now());
      if(result.error)throw new Error(result.error);
      const next={...stored.data,records:stored.data.records.filter(row=>row.id!==result.row.id).concat(result.row)},error=H.validate(next);if(error)throw new Error(error);
      const saved=config.save(next,editRaw);if(saved)throw new Error(saved);
      formDirty=false;config.clearDraft('health-form');edit=null;$('#health-form').reset();root.LifeUI.closeSheet($('#health-editor'));render();config.refreshHome();config.toast('健康记录已保存');
    }catch(error){formStatus(error.message,true);}finally{busy=false;$('#health-save').disabled=false;}
  }
  async function remove(id){
    const stored=config.read();if(stored.error){status(stored.error,true);return;}if(!stored.data.records.some(row=>row.id===id))return;
    if(!await config.confirm('只删除这条健康记录，不影响其他模块；导出的旧备份仍可能包含它。','删除健康记录','确认删除'))return;
    const error=config.save({...stored.data,records:stored.data.records.filter(row=>row.id!==id)},stored.raw);if(error){status(error,true);return;}
    config.toast('健康记录已删除');render();config.refreshHome();
  }
  function download(){
    const stored=config.read();if(stored.error){status(stored.error,true);return;}
    const value={format:H.format,schemaVersion:1,exportedAt:new Date().toISOString(),health:stored.data};
    const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='LifeOS-health-v1-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已发起健康JSON下载（含敏感记录），请在下载列表确认保存。文件不会上传。');
  }
  async function inspect(file){
    const generation=++fileGeneration;pending=null;$('#health-import-preview').classList.add('hidden');if(!file)return;
    if(file.size>H.maxBytes){status('健康文件超过5MiB，已拒绝读取。',true);return;}
    status('正在本地检查健康文件…');
    try{
      const result=H.providers.FileImportHealthProvider.parse(JSON.parse(await file.text()));if(generation!==fileGeneration)return;
      if(result.error)throw new Error(result.error);const stored=config.read();if(stored.error)throw new Error(stored.error);const merge=H.merge(stored.data,result.data);if(merge.error)throw new Error(merge.error);
      pending={data:result.data,raw:stored.raw};$('#health-import-preview').classList.remove('hidden');
      const kinds=[...new Set(result.data.records.map(row=>H.metrics[row.metric].name))],sources=[...new Set(result.data.records.map(row=>row.source.name))];
      $('#health-import-summary').textContent='健康v1 · '+result.data.records.length+' 条；新增 '+merge.additions.length+' 条，重复跳过 '+merge.duplicates+' 条。指标：'+(kinds.join('、')||'无')+'。来源：'+(sources.join('、')||'无')+'。现有记录不覆盖。';status('文件校验完成，尚未写入。确认前可先导出当前健康数据。');
    }catch(error){if(generation===fileGeneration)status('健康导入未执行：'+error.message,true);}
  }
  async function confirmImport(){
    if(!pending||busy)return;busy=true;$('#health-import-confirm').disabled=true;
    const candidate=pending;
    try{
      if(!await config.confirm('按健康预览追加记录；完全相同跳过，冲突停止，不修改其他模块。','恢复健康JSON','确认合并'))return;
      if(candidate!==pending)throw new Error('预览已改变，请重新检查文件。');const stored=config.read();if(stored.error)throw new Error(stored.error);if(stored.raw!==candidate.raw)throw new Error('预览后健康数据已变化，请重新选择文件。');
      const merge=H.merge(stored.data,candidate.data);if(merge.error)throw new Error(merge.error);
      if(merge.additions.length){merge.merged.lastImportAt=Date.now();const error=config.save(merge.merged,stored.raw);if(error)throw new Error(error);}
      pending=null;$('#health-import-preview').classList.add('hidden');$('#health-import-file').value='';render();config.refreshHome();status('健康恢复完成：新增 '+merge.additions.length+' 条，跳过 '+merge.duplicates+' 条；设备仍未连接。');
    }catch(error){status('恢复未完成：'+error.message,true);}finally{busy=false;$('#health-import-confirm').disabled=false;}
  }
  function init(optionsConfig){
    config=optionsConfig;state.date=config.today();
    $('#health-section').innerHTML='<p id="health-read-error" class="app-status hidden" role="alert"></p><p id="health-demo-banner" class="health-demo-banner hidden">合成演示预览 · 不是真实测量，不保存、不进入首页或备份。<a href="#health" data-health-open>退出演示</a></p><div id="health-home"><div class="health-date-row"><label for="health-date" class="sr-only">健康查看日期</label><input id="health-date" type="date"><button type="button" class="text-button" id="health-today">今天</button><button type="button" class="ui-icon-button" data-health-device aria-label="数据来源与设备说明">'+icon('settings')+'</button></div><p class="subtle-copy" id="health-updated"></p><article class="health-panel health-device-card" id="health-device-card"><div><strong>我的设备 · 小米手环 10 NFC</strong><span class="health-connection">未连接</span><small>等待同步 · 最近同步：暂无</small></div><button type="button" class="text-button" data-health-device>连接设备</button><button type="button" class="text-button" disabled aria-describedby="health-sync-limit">同步数据</button><span id="health-sync-limit" class="sr-only">真实设备同步尚未实现，可查看设备说明</span></article><div id="health-core" class="health-metrics"></div><div id="health-real-actions" class="health-actions"><button id="health-new" type="button" class="primary-button">'+icon('add')+' 手动记录</button><a href="#health/data" class="secondary-button" data-health-open>'+icon('restore')+' 导入导出</a><a href="#health/history" class="text-button" data-health-open>历史记录</a></div><div id="health-optional" class="health-optional"></div><details class="health-panel hidden" id="health-heart-trend"><summary>当日心率测量</summary><p id="health-heart-source" class="subtle-copy"></p><ol id="health-heart-points" class="health-heart-points"></ol></details><article class="health-panel health-trend"><div class="health-panel-heading"><h3>活动趋势</h3><div class="segmented"><button type="button" data-health-period="day">小时</button><button type="button" data-health-period="week">近7天</button></div></div><label class="sr-only" for="health-trend-source">趋势数据来源</label><select id="health-trend-source"></select><p id="health-trend-range" class="subtle-copy"></p><div id="health-trend-bars" role="img"></div><p id="health-trend-empty" class="subtle-copy">暂无实际趋势记录。可导入健康JSON；累计快照不推算小时步数。</p><details class="compose-details"><summary>查看真实数值明细</summary><table><tbody id="health-trend-table"></tbody></table></details></article><article class="health-panel health-sleep-card"><div><h3>睡眠记录</h3><div id="health-sleep-summary"></div></div><button type="button" class="ui-icon-button" id="health-sleep-open" aria-label="查看最近睡眠详情">'+icon('chevronRight')+'</button></article><p class="health-footnote">各指标显示真实来源的最近记录；不同来源不叠加。历史测量时间见卡片，不代表实时数据。</p></div><div id="health-history" class="hidden"><div class="health-filters"><label>测量日期<input id="health-history-date" type="date"></label><label>指标<select id="health-history-metric"></select></label><label>来源<select id="health-history-source"></select></label><button id="health-history-clear" type="button" class="text-button">清除筛选</button></div><p id="health-history-summary" class="subtle-copy" role="status"></p><div id="health-history-list" tabindex="0" aria-label="健康历史记录"></div><div id="health-history-empty" class="empty-state"><strong>当前条件下暂无健康记录</strong><p>可清除筛选或回到健康页手动记录。</p></div><div class="history-pagination"><button id="health-page-prev" class="secondary-button" type="button">上一页</button><span id="health-page-label"></span><button id="health-page-next" class="secondary-button" type="button">下一页</button></div></div><div id="health-detail" class="hidden"></div><div id="health-data" class="hidden"><article class="health-panel"><h2>健康数据与备份</h2><p id="health-data-count"></p><p id="health-import-time" class="subtle-copy"></p><p>健康JSON包含敏感记录，保存在你选择的下载位置；不会上传。原生活v5–v9不含健康，整站完整备份请选择v10。</p><div class="health-actions"><button type="button" class="primary-button" id="health-export">导出健康 JSON</button><a class="secondary-button" href="#backup" data-health-open>整站完整备份</a></div><label class="health-file-label">导入健康 JSON<input id="health-import-file" type="file" accept=".json,application/json"></label><p class="subtle-copy">仅支持Life OS健康v1文件，最大5MiB/10000条；暂不直接读取小米原始导出或数据库。</p><div id="health-import-preview" class="hidden"><p id="health-import-summary"></p><div class="health-actions"><button class="primary-button" type="button" id="health-import-confirm">确认合并健康记录</button><button class="secondary-button" type="button" id="health-import-cancel">取消导入</button></div></div></article></div><p id="health-status" class="form-status" role="status"></p>';
    const editor=document.createElement('dialog');editor.id='health-editor';editor.className='editor-dialog ui-sheet';editor.setAttribute('aria-labelledby','health-editor-title');
    editor.innerHTML='<header class="ui-sheet-header"><h2 id="health-editor-title">记录健康数据</h2><button type="button" class="ui-icon-button" data-health-close aria-label="关闭并保留健康草稿">'+icon('close')+'</button></header><form id="health-form" class="form-stack"><div class="form-row"><label>指标<select id="health-metric">'+options(Object.entries(H.metrics).filter(([id])=>id!=='steps_hourly').map(([id,spec])=>[id,spec.name]),'steps_total')+'</select></label><label>数值 <span id="health-unit"></span><input id="health-value" type="number" step="any" min="0" inputmode="decimal" required></label></div><label>测量时间<input id="health-measured" type="datetime-local" step="1" required></label><label>来源<select id="health-manual-source"><option value="manual">手动记录</option><option value="manual-miband">小米手环读数 · 手动抄录</option></select></label><div id="health-sleep-fields" class="hidden"><p class="subtle-copy">入睡/醒来时间可同时留空；填写时测量时间应不早于醒来时间。</p><div class="form-row"><label>入睡时间（可选）<input id="health-sleep-start" type="datetime-local" step="1"></label><label>醒来时间（可选）<input id="health-sleep-end" type="datetime-local" step="1"></label></div></div><p class="subtle-copy">累计指标填写当日快照。未填写不保存成0，手动抄录不会显示为设备同步。</p><p id="health-form-status" class="form-status" role="status"></p><div class="health-actions health-editor-actions"><button type="button" class="secondary-button" data-health-close>关闭并保留草稿</button><button id="health-save" class="primary-button" type="submit">保存记录</button></div></form>';
    const device=document.createElement('dialog');device.id='health-device-dialog';device.className='editor-dialog ui-sheet';device.setAttribute('aria-labelledby','health-device-title');
    device.innerHTML='<header class="ui-sheet-header"><h2 id="health-device-title">设备与数据来源</h2><button class="ui-icon-button" type="button" data-health-device-close aria-label="关闭设备说明">'+icon('close')+'</button></header><p><strong>小米手环 10 NFC · 未连接</strong></p><p>同步状态：等待同步；最近设备同步：暂无。</p><p id="health-device-import" class="subtle-copy"></p><p>本版本未实现蓝牙或小米账号接入。NFC不是健康数据接口；iPhone浏览器/PWA不能据此视为支持蓝牙直连。</p><p id="health-browser-capability" class="subtle-copy"></p><p>可先手动记录或导入Life OS健康JSON。后续由独立设备提供者适配本地桥接，测量时间与导入时间分开保存。</p><div class="health-actions"><a class="secondary-button" href="#health/data" data-health-open>健康文件导入</a><a class="text-button" href="#health/demo" data-health-open>查看合成演示（不保存）</a></div><p class="subtle-copy">只展示客观记录，不提供医疗诊断、疾病判断或健康评分。</p>';
    document.body.append(editor,device);
    window.addEventListener('storage',event=>{if(event.key!==H.key)return;render();config.refreshHome();if(pending){pending=null;fileGeneration++;$('#health-import-preview').classList.add('hidden');status('其他页面已修改健康数据，请重新选择文件以核对预览。',true);}});
    const heartPicker=document.createElement('select');heartPicker.id='health-heart-picker';heartPicker.setAttribute('aria-label','心率趋势数据来源');$('#health-heart-source').before(heartPicker);
    const heartChart=document.createElement('div');heartChart.id='health-heart-chart';$('#health-heart-source').after(heartChart);
    heartPicker.addEventListener('change',event=>{state.heartSource=event.target.value;render();config.remember();});
    window.visualViewport?.addEventListener('resize',updateEditorViewport,{passive:true});window.visualViewport?.addEventListener('scroll',updateEditorViewport,{passive:true});window.addEventListener('resize',updateEditorViewport,{passive:true});
    const discard=document.createElement('button');discard.id='health-discard';discard.type='button';discard.className='text-button';discard.textContent='放弃未保存草稿';$('#health-form-status').after(discard);
    discard.addEventListener('click',async()=>{if(formDirty&&!await config.confirm('只放弃本次未保存输入，不删除已有健康记录。','放弃健康草稿','确认放弃'))return;formDirty=false;edit=null;reservedId='';editRaw=null;config.clearDraft('health-form');$('#health-form').reset();formStatus('');root.LifeUI.closeSheet(editor);});
    document.addEventListener('click',event=>{
      const control=event.target.closest('[data-health-open],[data-health-device],[data-health-close],[data-health-device-close],[data-health-edit],[data-health-delete],[data-health-period]');if(!control)return;
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      if(control.hasAttribute('data-health-open')){if(device.open)root.LifeUI.closeSheet(device);config.open(control.getAttribute('href'));return;}
      if(control.hasAttribute('data-health-close')){root.LifeUI.closeSheet(editor);return;}
      if(control.hasAttribute('data-health-device-close')){root.LifeUI.closeSheet(device);return;}
      if(control.hasAttribute('data-health-device')){render();$('#health-browser-capability').textContent=('bluetooth' in navigator?'浏览器暴露了蓝牙接口，但手环协议/权限/设备兼容尚未验证，本站不会调用。':'当前浏览器未提供Web Bluetooth接口。')+' 此检测不代表设备已连接。';device.showModal();return;}
      if(control.hasAttribute('data-health-edit')){void openEditor(control.dataset.healthEdit);return;}
      if(control.hasAttribute('data-health-delete')){void remove(control.dataset.healthDelete);return;}
      if(control.hasAttribute('data-health-period')){state.period=control.dataset.healthPeriod;render();config.remember();}
    });
    $('#health-new').addEventListener('click',()=>void openEditor(''));
    $('#health-date').addEventListener('change',event=>chooseDate(event.target.value));$('#health-today').addEventListener('click',()=>chooseDate(config.today()));
    $('#health-trend-source').addEventListener('change',event=>{state.trendSource=event.target.value;render();config.remember();});
    for(const [id,field]of [['health-history-date','historyDate'],['health-history-metric','metric'],['health-history-source','source']])$('#'+id).addEventListener('change',event=>{state[field]=event.target.value;state.page=1;render();$('#health-history-list').scrollTop=0;config.remember();});
    $('#health-history-clear').addEventListener('click',()=>{state.historyDate=state.metric=state.source='';state.page=1;render();config.remember();});
    for(const [id,offset]of [['health-page-prev',-1],['health-page-next',1]])$('#'+id).addEventListener('click',()=>{state.page+=offset;render();$('#health-history-list').scrollTop=0;config.remember();});
    $('#health-sleep-open').addEventListener('click',event=>config.open('#health/sleep/'+encodeURIComponent(event.currentTarget.dataset.healthSleep)));
    $('#health-form').addEventListener('input',()=>{formDirty=true;config.markDraft('health-form');});$('#health-metric').addEventListener('change',syncForm);$('#health-form').addEventListener('submit',event=>void submit(event));
    $('#health-export').addEventListener('click',download);$('#health-import-file').addEventListener('change',event=>void inspect(event.target.files?.[0]));$('#health-import-confirm').addEventListener('click',()=>void confirmImport());
    $('#health-import-cancel').addEventListener('click',()=>{pending=null;fileGeneration++;$('#health-import-file').value='';$('#health-import-preview').classList.add('hidden');status('已取消导入，未写入记录。');});
    for(const dialog of [editor,device])dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(n=>n.getClientRects().length),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  }
  root.LifeHealthUI=Object.freeze({init,matches,route,render,renderHomeCard,snapshot,restore,chooseDate});
})(window);
