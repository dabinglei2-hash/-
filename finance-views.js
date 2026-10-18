/* Shared finance presentation. Canonical records are supplied read-only by app.js. */
(function (root) {
  'use strict';
  const $=s=>document.querySelector(s),icon=name=>root.LifeIcons.render(name);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
  const day=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  const validDay=d=>root.LifeInsights.range('month',d).error==='';
  const defaultIcons={'income-delivery':'delivery','income-part-time':'work','income-other':'finance','expense-food':'food','expense-transport':'transport','expense-study':'study','expense-living':'home','expense-other':'tag'};
  const iconGroups=[['日常',['food','shopping','transport','home','phone','health','work','coffee','gift','finance']],['成长与休闲',['study','code','language','goal','fun','music','camera','sport','travel','idea']],['生活与资产',['family','pet','tools','shirt','plant','wallet','card','savings','delivery','tag']]];
  let config=null,billStep='category',editingBudget=null,editingAccount=null,metaBusy=false;
  const drafts=new Map();
  function draftKind(){const info=match(location.hash);return info?.kind==='budget'?'budget':info?.kind==='assets'?'account':null;}
  function rememberDraft(form){const kind=form.id==='meta-budget-form'?'budget':'account';drafts.set(kind,{values:[...form.querySelectorAll('input,select')].map(e=>[e.id,e.value]),expected:kind==='budget'?editingBudget:editingAccount});}
  function restoreDraft(kind){const draft=drafts.get(kind);if(!draft)return;for(const [id,value]of draft.values){const field=document.getElementById(id);if(field)field.value=value;}$('#'+kind+'-compose').open=true;if(kind==='budget')editingBudget=draft.expected;else editingAccount=draft.expected;}
  function get(){return config.read();}
  function categoryIcon(id){const state=get();return state.meta?.categoryIcons.find(i=>i.categoryId===id)?.icon||defaultIcons[id]||'tag';}
  function categoryLink(id,type,period,anchor){return '#statistics/category/'+type+'/'+encodeURIComponent(JSON.stringify(id))+'?period='+period+'&date='+anchor;}
  function match(route) {
    const [path,query='']=route.split('?'),params=new URLSearchParams(query);
    if(['#finance/income','#finance/expense','#finance/bills','#finance/budget','#finance/assets'].includes(path))return {kind:path.split('/')[1],params,primary:'#finance',fallback:'#finance',title:({'income':'收入','expense':'支出','bills':'账单','budget':'预算','assets':'资产管家'})[path.split('/')[1]]};
    const found=path.match(/^#statistics\/category\/(income|expense)\/(.+)$/);
    if(!found)return null;
    let categoryId;try{categoryId=JSON.parse(decodeURIComponent(found[2]));}catch(error){return {error:'分类链接无效。',fallback:'#monthly'};}
    if(categoryId!==null&&typeof categoryId!=='string')return {error:'分类链接无效。',fallback:'#monthly'};
    return {kind:'category',type:found[1],categoryId,params,primary:'#monthly',fallback:'#monthly',title:'分类统计'};
  }
  function chart(element,caption,result,metric,title,options={}) {
    if(result.error||!result.hasFinancialRecords){element.innerHTML='<div class="empty-state"><strong>'+esc(result.error||'暂无收支记录')+'</strong><p>所选范围内没有可显示的账单。</p></div>';element.setAttribute('aria-label',result.error||'暂无收支记录');caption.textContent='';return;}
    const values=result.buckets.map(b=>b[metric+'Cents']/100),min=Math.min(0,...values),max=Math.max(0,...values),spread=max-min||1;
    const compact=options.compact===true;
    const x=i=>(compact?10:60)+i/Math.max(1,values.length-1)*(compact?340:286),y=v=>(compact?124:164)-(v-min)/spread*(compact?104:144);
    const points=values.map((v,i)=>x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
    const axis=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(v);
    const marks=compact?(result.period==='week'?values.map((_,i)=>i):[0,...(result.period==='year'?[2,5,8]:[7,14,21]),values.length-1]):[0,Math.floor((values.length-1)/2),values.length-1];
    const tickLabel=i=>compact&&result.period==='week'?(result.buckets[i].key===options.today?'今天':result.buckets[i].key.slice(5)):result.buckets[i].label;
    const axes=compact?'<line x1="10" x2="350" y1="20" y2="20" stroke="currentColor" opacity=".18"/><line x1="10" x2="350" y1="72" y2="72" stroke="currentColor" opacity=".18" stroke-dasharray="4 5"/><line x1="10" x2="350" y1="124" y2="124" stroke="currentColor" opacity=".18"/><text x="350" y="13" text-anchor="end">'+esc(axis(max))+'</text>'+(min<0?'<text x="10" y="120">'+esc(axis(min))+'</text>':''):'<line x1="60" x2="346" y1="'+y(0)+'" y2="'+y(0)+'" stroke="currentColor" opacity=".12"/><text x="52" y="24" text-anchor="end">'+esc(axis(max))+'</text><text x="52" y="168" text-anchor="end">'+esc(axis(min))+'</text>';
    element.innerHTML='<svg viewBox="0 0 360 '+(compact?'150':'200')+'" aria-hidden="true" focusable="false">'+axes+'<polyline points="'+points+'" fill="none" stroke="currentColor" stroke-width="'+(compact?'1':'2')+'" vector-effect="non-scaling-stroke"/>'+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.5" fill="var(--surface)" stroke="currentColor"/>').join('')+[...new Set(marks)].filter(i=>i<values.length).map(i=>'<text x="'+x(i)+'" y="'+(compact?'144':'190')+'" text-anchor="'+(compact&&i===0?'start':compact&&i===values.length-1?'end':'middle')+'">'+esc(tickLabel(i))+'</text>').join('')+'</svg>';
    element.setAttribute('aria-label',title+'，最低 '+money(Math.round(Math.min(...values)*100))+'，最高 '+money(Math.round(Math.max(...values)*100)));
    caption.textContent='最低 '+money(Math.round(Math.min(...values)*100))+' · 最高 '+money(Math.round(Math.max(...values)*100));
  }
  function transactions(state,type,start,end,categoryId,filterCategory=false){
    return state.data.finances.filter(r=>r.date>=start&&r.date<=end&&(Number(r[type])>0||root.LifeCategories.assignmentFor(state.categories,r.id,type))).filter(r=>!filterCategory||(root.LifeCategories.assignmentFor(state.categories,r.id,type)?.categoryId||null)===categoryId);
  }
  function routeParams(patch){const [path,query='']=location.hash.split('?'),params=new URLSearchParams(query);for(const [k,v]of Object.entries(patch))params.set(k,String(v));history.replaceState(history.state,'',location.pathname+location.search+path+'?'+params.toString());const view=renderRoute(location.hash);if(view)$('#route-back-title').textContent=view.title;root.LifeUI.enhance();}
  function periodControls(period,anchor){return '<div class="insights-toolbar"><div class="segmented" role="group" aria-label="详情统计周期">'+[['week','周'],['month','月'],['year','年']].map(([p,t])=>'<button type="button" data-finance-detail-period="'+p+'" aria-pressed="'+(period===p)+'">'+t+'</button>').join('')+'</div><label><span class="sr-only">详情参考日期</span><input id="finance-detail-anchor" type="date" value="'+anchor+'"></label></div>';}
  function rowList(records,type,sort,page,total){
    const sorted=records.slice().sort((a,b)=>sort==='amount'?Math.round(Number(b[type])*100)-Math.round(Number(a[type])*100)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id):b.date.localeCompare(a.date)||(b.createdAt-a.createdAt)||a.id.localeCompare(b.id));
    const pages=Math.max(1,Math.ceil(sorted.length/10)),current=Math.min(pages,Math.max(1,page));
    const rows=sorted.slice((current-1)*10,current*10).map(r=>{const label=root.LifeCategories.categoryLabel(get().categories,r.id,type),cents=Math.round(Number(r[type])*100);return '<a class="ui-list-row finance-detail-row" href="#entry/finance/'+encodeURIComponent(r.id)+'" data-open-page><span class="category-glyph">'+icon(categoryIcon(root.LifeCategories.assignmentFor(get().categories,r.id,type)?.categoryId))+'</span><span><strong>'+esc(label)+'</strong><small>'+esc(r.date)+(r.note?' · '+esc(r.note):'')+'</small><span class="rank-bar"><span style="width:'+Math.min(100,total?cents/total*100:0)+'%"></span></span></span><strong>'+money(cents)+'</strong></a>';}).join('');
    return '<div class="finance-detail-list" id="finance-detail-list">'+(rows||'<div class="empty-state"><strong>暂无'+(type==='income'?'收入':'支出')+'记录</strong><p>换个日期范围再查看。</p></div>')+'</div><nav class="history-pagination" aria-label="流水分页"><button type="button" class="secondary-button" data-finance-detail-page="'+(current-1)+'" '+(current<=1?'disabled':'')+'>上一页</button><span>'+current+' / '+pages+'</span><button type="button" class="secondary-button" data-finance-detail-page="'+(current+1)+'" '+(current>=pages?'disabled':'')+'>下一页</button></nav>';
  }
  function renderRoute(route){
    if(!config)return null;
    const info=match(route);if(!info||info.error)return info;
    const state=get(),host=$('#finance-detail-section'),params=info.params;
    const month=/^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('month')||'')?params.get('month'):state.month;
    if(info.kind==='budget'){renderBudgets(host,month);return info;}
    if(info.kind==='assets'){renderAccounts(host);return info;}
    if(info.kind==='bills') {
      const year=/^\d{4}$/.test(params.get('year')||'')?params.get('year'):month.slice(0,4),result=root.LifeInsights.summarize(state.data,'year',year+'-01-01');
      host.innerHTML='<label class="statement-year">年份<input id="statement-year" type="number" min="1" max="9999" value="'+year+'"></label><article class="ui-content-card finance-hero"><span>'+year+' 年结余 · USD</span><strong>'+ (result.hasFinancialRecords?money(result.totals.balanceCents):'—')+'</strong><div><span>收入 '+(result.hasFinancialRecords?money(result.totals.incomeCents):'—')+'</span><span>支出 '+(result.hasFinancialRecords?money(result.totals.expenseCents):'—')+'</span></div></article><div class="finance-detail-list" id="finance-detail-list">'+(result.error?'<p role="alert">'+esc(result.error)+'</p>':result.buckets.slice().reverse().map(b=>'<button class="settings-row" type="button" data-statement-month="'+b.key+'"><span>'+esc(b.label)+'</span><span class="statement-numbers"><small>收入 '+(b.financeCount?money(b.incomeCents):'—')+'</small><small>支出 '+(b.financeCount?money(b.expenseCents):'—')+'</small><strong>结余 '+(b.financeCount?money(b.balanceCents):'—')+'</strong>'+icon('chevronRight')+'</span></button>').join(''))+'</div>';
      return info;
    }
    const isCategory=info.kind==='category',type=isCategory?info.type:info.kind;
    const period=isCategory&&['week','month','year'].includes(params.get('period'))?params.get('period'):'month';
    const anchor=isCategory&&validDay(params.get('date')||'')?params.get('date'):month+'-01';
    const range=root.LifeInsights.range(period,anchor),category=isCategory&&state.categories.categories.find(c=>c.id===info.categoryId);
    if(isCategory&&info.categoryId!==null&&(!category||category.type!==type))return {...info,error:'分类已不存在或收支类型不符，请重新选择。'};
    const label=isCategory?(category?.name||'未分类'):(type==='income'?'收入':'支出');info.title=label+(isCategory?' · 分类统计':'');
    const records=transactions(state,type,range.start,range.end,info.categoryId,isCategory);
    // Build an in-memory direction-only view; original ledger records stay untouched.
    const source=records.map(r=>({...r,[type==='income'?'expense':'income']:''}));
    const result=root.LifeInsights.summarize({studies:[],tasks:[],finances:source},period,anchor),total=result.totals[type+'Cents'];
    const sort=params.get('sort')==='time'?'time':'amount',page=Math.max(1,Number(params.get('page'))||1);
    host.innerHTML=(isCategory?periodControls(period,anchor):'<button class="text-button" type="button" data-detail-month>'+icon('calendar')+' '+esc(month)+'</button>')+'<p class="subtle-copy">'+esc(range.label)+' · USD</p><article class="ui-content-card finance-hero"><span>'+esc(label)+'合计</span><strong>'+(records.length?money(total):'—')+'</strong><small>'+records.length+' 笔记录</small></article>'+(isCategory?'<section class="trend-section"><h3>'+esc(label)+(type==='income'?'收入':'支出')+'趋势</h3><div id="finance-detail-chart" class="trend-chart" role="img"></div><p id="finance-detail-caption" class="subtle-copy"></p></section>':'')+'<div class="panel-heading"><h3>单笔'+(type==='income'?'收入':'支出')+'</h3><div class="segmented" role="group" aria-label="流水排序"><button type="button" data-finance-detail-sort="amount" aria-pressed="'+(sort==='amount')+'">按金额</button><button type="button" data-finance-detail-sort="time" aria-pressed="'+(sort==='time')+'">按时间</button></div></div>'+rowList(records,type,sort,page,total);
    if(isCategory)chart($('#finance-detail-chart'),$('#finance-detail-caption'),result,type,label);
    return info;
  }
  function refreshHome(){if(!config)return;const month=get().month;$('#finance-month-label').innerHTML='<small>'+Number(month.slice(0,4))+'年</small><span>'+Number(month.slice(5,7))+'<small>月</small></span>';$('#finance-month-open').setAttribute('aria-label','选择月份，当前 '+month);document.querySelectorAll('[data-finance-view]').forEach(link=>link.href='#finance/'+link.dataset.financeView+'?month='+month);}
  function renderBillChoices(){
    if(!config)return;
    const type=$('input[name="bill-type"]:checked')?.value||'income',categories=get().categories.categories.filter(c=>c.type===type&&c.active);
    $('#bill-category-grid').innerHTML=categories.map(c=>'<button type="button" class="category-choice" data-bill-category="'+esc(c.id)+'"><span class="category-glyph">'+icon(categoryIcon(c.id))+'</span><span>'+esc(c.name)+'</span></button>').join('')||'<p class="inline-empty">还没有可用分类，请先管理分类。</p>';
    $('#bill-category-step').classList.toggle('hidden',billStep!=='category');$('#bill-entry-step').classList.toggle('hidden',billStep!=='entry');
    $('#bill-entry-step').querySelectorAll('input,select').forEach(field=>{field.disabled=billStep!=='entry';});
    if(billStep==='category')$('#bill-submit').disabled=true;
  }
  function resetBillStep(){billStep='category';renderBillChoices();}
  function billFocus(){return billStep==='category'?$('#bill-category-grid button'):$('#bill-amount');}
  function iconPicker(selected){return '<details class="compose-details category-icon-picker"><summary><span class="category-glyph" id="category-icon-preview">'+icon(selected)+'</span> 分类图标</summary>'+iconGroups.map(([label,names])=>'<fieldset><legend>'+label+'</legend><div class="category-icon-grid">'+names.map(name=>'<label title="'+esc(root.LifeIcons.label(name))+'"><input type="radio" name="category-icon" value="'+name+'" '+(name===selected?'checked':'')+'><span>'+icon(name)+'<small>'+esc(root.LifeIcons.label(name))+'</small></span></label>').join('')+'</div></fieldset>').join('')+'</details>';}
  function selectCategoryIcon(id){const name=id?categoryIcon(id):'tag';$('#category-icon-slot').innerHTML=iconPicker(name);}
  function budgetForm(month){return '<details class="compose-details" id="budget-compose"><summary>'+icon('add')+' 设置预算</summary><form id="meta-budget-form" class="form-stack"><input id="budget-id" type="hidden"><label>月份<input id="budget-month" type="month" value="'+month+'" required></label><label>预算范围<select id="budget-category"><option value="">整月总预算</option>'+get().categories.categories.filter(c=>c.type==='expense').map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+(c.active?'':'（已停用）')+'</option>').join('')+'</select></label><label>预算金额 · USD<input id="budget-amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="未设置" required></label><div class="form-row"><button class="primary-button" type="submit">保存预算</button><button class="secondary-button" type="button" data-reset-budget>取消</button></div></form></details>';}
  function renderBudgets(host,month){
    const state=get(),result=root.LifeInsights.summarize(state.data,'month',month+'-01'),budget=state.meta?.budgets.find(b=>b.month===month&&b.categoryId===null),spent=result.totals.expenseCents;
    if(result.error){host.innerHTML='<div class="empty-state" role="alert"><strong>'+esc(result.error)+'</strong><p>原记录未修改，请缩小范围后重试。</p></div>';return;}
    const ranks=root.LifeCategories.summarize(state.data.finances.filter(r=>r.date.slice(0,7)===month),state.categories,'expense');
    const rows=(state.meta?.budgets||[]).filter(b=>b.month===month).map(b=>{const category=state.categories.categories.find(c=>c.id===b.categoryId),actual=b.categoryId===null?spent:ranks.find(r=>r.categoryId===b.categoryId)?.cents||0;return '<div class="settings-row meta-row"><span><strong>'+esc(category?.name||'总预算')+'</strong><small>预算 '+money(b.amountCents)+' · 已用 '+money(actual)+'</small><small>剩余 '+money(b.amountCents-actual)+'</small></span><span><button class="ui-icon-button" type="button" data-edit-budget="'+esc(b.id)+'" aria-label="编辑'+esc(category?.name||'总预算')+'">'+icon('edit')+'</button><button class="ui-icon-button" type="button" data-delete-budget="'+esc(b.id)+'" aria-label="删除'+esc(category?.name||'总预算')+'">'+icon('delete')+'</button></span></div>';}).join('');
    host.innerHTML='<label class="compact-field">预算月份<input id="budget-view-month" type="month" value="'+month+'"></label><article class="ui-content-card finance-hero"><span>剩余预算 · USD</span><strong>'+(budget?money(budget.amountCents-spent):'未设置')+'</strong><div><span>本月预算 '+(budget?money(budget.amountCents):'—')+'</span><span>本月支出 '+(result.hasFinancialRecords?money(spent):'—')+'</span></div>'+(budget?'<p class="subtle-copy">'+(spent>budget.amountCents?'已超支':budget.amountCents?'已使用 '+Math.round(spent/budget.amountCents*100)+'%':'预算为 $0.00')+'</p>':'')+'</article><div id="meta-status" class="record-form-status" role="status">'+esc(state.metaError||'')+'</div>'+budgetForm(month)+'<div class="finance-detail-list" id="finance-detail-list">'+(rows||'<div class="empty-state"><strong>尚未设置预算</strong><p>设置总预算或某个支出分类的预算。</p></div>')+'</div>';
    editingBudget=null;restoreDraft('budget');
  }
  function renderAccounts(host){
    const state=get(),accounts=state.meta?.accounts||[],active=accounts.filter(a=>!a.archived),assets=root.LifeFinanceMeta.sum(active.filter(a=>a.kind==='asset'),'balanceCents'),debt=root.LifeFinanceMeta.sum(active.filter(a=>a.kind==='liability'),'balanceCents');
    const row=a=>'<div class="settings-row meta-row"><span><strong>'+esc(a.name)+'</strong><small>'+(a.kind==='asset'?'资产':'负债')+' · '+esc(a.asOf)+(a.archived?' · 已归档':'')+'</small><strong>'+money(a.balanceCents)+'</strong></span><span><button class="ui-icon-button" type="button" data-edit-account="'+esc(a.id)+'" aria-label="编辑'+esc(a.name)+'">'+icon('edit')+'</button><button class="text-button" type="button" data-archive-account="'+esc(a.id)+'">'+(a.archived?'恢复':'归档')+'</button></span></div>';
    host.innerHTML='<article class="ui-content-card finance-hero"><span>净资产 · USD</span><strong>'+(assets===null||debt===null?'超出统计范围':active.length?money(assets-debt):'—')+'</strong><div><span>资产 '+(active.length&&assets!==null?money(assets):'—')+'</span><span>负债 '+(active.length&&debt!==null?money(debt):'—')+'</span></div></article><p class="subtle-copy">手动余额快照，与收支流水分开；不自动记账。</p><div id="meta-status" class="record-form-status" role="status">'+esc(state.metaError||'')+'</div><details class="compose-details" id="account-compose"><summary>'+icon('add')+' 添加账户</summary><form id="meta-account-form" class="form-stack"><input id="account-id" type="hidden"><label>名称<input id="account-name" type="text" maxlength="40" required></label><div class="form-row"><label>类型<select id="account-kind"><option value="asset">资产</option><option value="liability">负债</option></select></label><label>更新日期<input id="account-date" type="date" value="'+day()+'" required></label></div><label>余额 · USD<input id="account-amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="未填写" required></label><div class="form-row"><button class="primary-button" type="submit">保存余额</button><button class="secondary-button" type="button" data-reset-account>取消</button></div></form></details><div class="finance-detail-list" id="finance-detail-list">'+(active.map(row).join('')||'<div class="empty-state"><strong>尚无资产账户</strong><p>添加一项手动余额。</p></div>')+'</div><details class="compose-details"><summary>归档账户 · '+accounts.filter(a=>a.archived).length+'</summary>'+accounts.filter(a=>a.archived).map(row).join('')+'</details>';
    editingAccount=null;restoreDraft('account');
  }
  function showError(message){$('#meta-status').textContent=message;root.LifeUI.toast(message,true);}
  function saveMeta(mutator,success,finishDraft=false){const result=config.saveMeta(mutator);if(result){showError(result);return false;}if(finishDraft){const kind=draftKind();drafts.delete(kind);config.clearDraft('meta-'+kind+'-form');}renderRoute(location.hash);root.LifeUI.toast(success);return true;}
  function configure(options){
    config=options;selectCategoryIcon();
    document.addEventListener('input',event=>{const form=event.target.closest('#meta-budget-form,#meta-account-form');if(form)rememberDraft(form);});
    window.addEventListener('beforeunload',event=>{if(drafts.size){event.preventDefault();event.returnValue='';}});
    $('#bill-form').addEventListener('reset',()=>requestAnimationFrame(resetBillStep));
    document.querySelectorAll('input[name="bill-type"]').forEach(input=>input.addEventListener('change',resetBillStep));
    document.addEventListener('change',event=>{
      const form=event.target.closest('#meta-budget-form,#meta-account-form');if(form)rememberDraft(form);
      if(event.target.id==='finance-detail-anchor'&&validDay(event.target.value))routeParams({date:event.target.value,page:1});
      if(event.target.id==='budget-view-month'&&event.target.value)routeParams({month:event.target.value});
      if(event.target.id==='statement-year'&&/^\d{1,4}$/.test(event.target.value)&&Number(event.target.value)>0)routeParams({year:event.target.value.padStart(4,'0')});
      if(event.target.name==='category-icon')$('#category-icon-preview').innerHTML=icon(event.target.value);
    });
    document.addEventListener('click',async event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-bill-category')){const select=$('#bill-category');select.value=button.dataset.billCategory;if(select.value){billStep='entry';config.refreshBill();$('#bill-amount').focus({preventScroll:true});}}
      if(button.id==='bill-categories-back'){billStep='category';renderBillChoices();$('#bill-category-grid button')?.focus({preventScroll:true});}
      if(button.dataset.financeDetailPeriod)routeParams({period:button.dataset.financeDetailPeriod,page:1});
      if(button.dataset.financeDetailSort)routeParams({sort:button.dataset.financeDetailSort,page:1});
      if(button.hasAttribute('data-finance-detail-page'))routeParams({page:button.dataset.financeDetailPage});
      if(button.dataset.statementMonth){config.showFinanceMonth(button.dataset.statementMonth);config.open('#finance');}
      if(button.hasAttribute('data-detail-month'))config.chooseMonth();
      if(button.dataset.editBudget){const b=get().meta.budgets.find(b=>b.id===button.dataset.editBudget);if(!b)return;editingBudget=JSON.stringify(b);$('#budget-compose').open=true;$('#budget-id').value=b.id;$('#budget-month').value=b.month;$('#budget-category').value=b.categoryId||'';$('#budget-amount').value=(b.amountCents/100).toFixed(2);$('#budget-amount').focus();}
      if(button.dataset.deleteBudget){const b=get().meta.budgets.find(b=>b.id===button.dataset.deleteBudget);if(!b||!await config.confirm('删除此预算设置？账单记录不会删除。','删除预算','确认删除'))return;saveMeta(fresh=>{const current=fresh.budgets.find(i=>i.id===b.id);if(JSON.stringify(current)!==JSON.stringify(b))return '预算已发生变化，请刷新后再操作。';fresh.budgets=fresh.budgets.filter(i=>i.id!==b.id);return fresh;},'预算已删除');}
      if(button.dataset.editAccount){const a=get().meta.accounts.find(a=>a.id===button.dataset.editAccount);if(!a)return;editingAccount=JSON.stringify(a);$('#account-compose').open=true;$('#account-id').value=a.id;$('#account-name').value=a.name;$('#account-kind').value=a.kind;$('#account-date').value=a.asOf;$('#account-amount').value=(a.balanceCents/100).toFixed(2);$('#account-name').focus();}
      if(button.dataset.archiveAccount){const a=get().meta.accounts.find(a=>a.id===button.dataset.archiveAccount);if(!a||!await config.confirm((a.archived?'恢复':'归档')+'此账户？原余额仍会保留。',a.archived?'恢复账户':'归档账户','确认'))return;saveMeta(fresh=>{const current=fresh.accounts.find(i=>i.id===a.id);if(JSON.stringify(current)!==JSON.stringify(a))return '账户已发生变化，请重新打开。';current.archived=!current.archived;current.updatedAt=Date.now();return fresh;},a.archived?'账户已恢复':'账户已归档');}
      if(button.hasAttribute('data-reset-budget')||button.hasAttribute('data-reset-account')){const kind=draftKind();drafts.delete(kind);config.clearDraft('meta-'+kind+'-form');renderRoute(location.hash);}
    });
    document.addEventListener('submit',event=>{
      if(!['meta-budget-form','meta-account-form'].includes(event.target.id))return;event.preventDefault();if(metaBusy)return;metaBusy=true;
      const form=event.target,submit=form.querySelector('[type=submit]');root.LifeUI.setBusy(submit,true);
      try {
        if(form.id==='meta-budget-form'){
          const amount=root.LifeFinanceMeta.amount($('#budget-amount').value),id=$('#budget-id').value,month=$('#budget-month').value,categoryId=$('#budget-category').value||null;
          if(amount===null){showError('请输入有效的预算金额，最多两位小数。');return;}
          saveMeta(fresh=>{const old=fresh.budgets.find(b=>b.id===id);if(id&&JSON.stringify(old)!==editingBudget)return '预算已发生变化，请重新打开。';if(fresh.budgets.some(b=>b.id!==id&&b.month===month&&b.categoryId===categoryId))return '该月份已设置此预算，请编辑已有预算。';const record={id:id||config.makeId(),month,categoryId,amountCents:amount,createdAt:old?.createdAt??Date.now(),updatedAt:Date.now()};fresh.budgets=id?fresh.budgets.map(b=>b.id===id?record:b):fresh.budgets.concat(record);return fresh;},'预算已保存',true);
        } else {
          const amount=root.LifeFinanceMeta.amount($('#account-amount').value),id=$('#account-id').value,name=$('#account-name').value.trim(),kind=$('#account-kind').value,asOf=$('#account-date').value;
          if(amount===null||!name){showError('请填写账户名称与有效余额，最多两位小数。');return;}
          saveMeta(fresh=>{const old=fresh.accounts.find(a=>a.id===id);if(id&&JSON.stringify(old)!==editingAccount)return '账户已发生变化，请重新打开。';const record={id:id||config.makeId(),name,kind,balanceCents:amount,asOf,archived:old?.archived??false,createdAt:old?.createdAt??Date.now(),updatedAt:Date.now()};fresh.accounts=id?fresh.accounts.map(a=>a.id===id?record:a):fresh.accounts.concat(record);return fresh;},'账户余额已保存，未新增账单',true);
        }
      } finally {metaBusy=false;root.LifeUI.setBusy(submit,false);}
    });
  }
  root.LifeFinanceViews=Object.freeze({configure,match,renderRoute,refreshHome,chart,categoryLink,categoryIcon,renderBillChoices,resetBillStep,billFocus,selectCategoryIcon});
})(window);
