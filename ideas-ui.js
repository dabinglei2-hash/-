/* Ideas presentation and ephemeral History state. All writes stay in app.js. */
(function (root) {
  'use strict';
  let config, lastRoute='', pendingSort='', clearDraftOnReturn=false, savedNote=null;
  const state={sort:'newest',expanded:[],selected:[],menu:'root',recordId:''};
  const deletedFromMenu=new Set();
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>root.LifeIcons.render(n);
  const routes=new Set(['#daily-notes','#ideas/search','#ideas/menu','#ideas/select','#ideas/write']);
  const matches=route=>routes.has(route);
  const isIdeas=route=>matches(route)||route.startsWith('#note/');
  const timeText=n=>{const d=new Date(n);return Number.isFinite(d.getTime())?{iso:d.toISOString(),label:new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)}:{iso:'',label:'创建时间不可用'};};
  function snapshot(){return {...state,expanded:[...state.expanded],selected:[...state.selected],draft:config?.draft()||null};}
  function restore(value){
    if(!value||typeof value!=='object')return;
    if(['newest','oldest'].includes(value.sort))state.sort=value.sort;
    for(const field of ['expanded','selected'])if(Array.isArray(value[field]))state[field]=value[field].filter(x=>typeof x==='string');
    if(['root','sort','source','record'].includes(value.menu))state.menu=value.menu;
    state.recordId=typeof value.recordId==='string'?value.recordId:'';
    if(!clearDraftOnReturn&&!config.draft()?.dirty&&value.draft)config.restoreDraft(value.draft);
  }
  function finishNavigation(){
    if(pendingSort&&location.hash!=='#ideas/menu'){state.sort=pendingSort;pendingSort='';config.firstPage();config.refresh();config.remember();}
    if(clearDraftOnReturn&&location.hash!=='#ideas/write'){clearDraftOnReturn=false;config.resetDraft();if(savedNote?.isNew)config.reveal(savedNote.id);savedNote=null;config.refresh();config.remember();}
  }
  function entries(rows){return rows.slice().sort((a,b)=>(state.sort==='oldest'?1:-1)*(a.createdAt-b.createdAt)||a.id.localeCompare(b.id));}
  function card(note,tags,selection=false){
    const expanded=state.expanded.includes(note.id),long=note.content.length>140||note.content.split('\n').length>5;
    const stamp=timeText(note.createdAt),id=esc(note.id),selected=state.selected.includes(note.id);
    const copy='<span class="idea-card-copy">'+(note.title?'<strong class="idea-card-title">'+esc(note.title)+'</strong>':'')+'<span class="idea-card-content'+(long&&!expanded?' is-collapsed':'')+'">'+esc(long&&!expanded?note.content.slice(0,140)+'…':note.content)+'</span></span>';
    return '<article class="idea-record'+(selected?' is-selected':'')+'" data-idea-id="'+id+'"><header><time'+(stamp.iso?' datetime="'+stamp.iso+'"':'')+'>'+esc(stamp.label)+'</time>'+(selection?'':'<button class="ui-icon-button" type="button" data-idea-more="'+id+'" aria-label="更多操作：'+esc(note.title||note.date)+'">'+icon('more')+'</button>')+'</header>'+(selection?'<button type="button" class="idea-select-row" data-idea-select="'+id+'" aria-pressed="'+selected+'" aria-label="'+(selected?'取消选择':'选择')+'妙想：'+esc(note.title||note.content.slice(0,30))+'"><span class="idea-selection-check">'+(selected?icon('check'):'')+'</span>'+copy+'</button>':'<a class="note-row" href="#note/'+encodeURIComponent(note.id)+'" data-open-note="'+id+'" aria-label="查看妙想：'+esc(note.title||note.content.slice(0,30))+'">'+copy+'</a>')+(!selection&&long?'<button class="text-button idea-expand" type="button" data-idea-expand="'+id+'" aria-expanded="'+expanded+'">'+(expanded?'收起':'展开')+'</button>':'')+'<div class="idea-tags">'+tags.map(t=>'<span class="idea-tag">'+esc('#'+t)+'</span>').join('')+'</div><small class="idea-record-date">记录日期 '+esc(note.date)+'</small></article>';
  }
  function markup(rows,tags){return rows.map(note=>card(note,tags(note.id),location.hash==='#ideas/select')).join('');}
  function detail(note,tags){const stamp=timeText(note.createdAt);return '<div class="idea-detail-tools"><time'+(stamp.iso?' datetime="'+stamp.iso+'"':'')+'>'+esc(stamp.label)+'</time><button class="ui-icon-button" type="button" data-idea-more="'+esc(note.id)+'" aria-label="妙想更多操作">'+icon('more')+'</button></div><p class="subtle-copy">记录日期 '+esc(note.date)+'</p>'+(note.title?'<h2>'+esc(note.title)+'</h2>':'<h2 class="sr-only">妙想正文</h2>')+'<p class="note-detail-content">'+esc(note.content)+'</p><div class="idea-tags">'+tags.map(t=>'<span class="idea-tag">'+esc('#'+t)+'</span>').join('')+'</div><button class="secondary-button" type="button" data-edit-note="'+esc(note.id)+'">编辑妙想</button>';}
  function refresh(){
    if(!config)return;
    const valid=new Set(config.notes().map(n=>n.id));state.selected=state.selected.filter(id=>valid.has(id));state.expanded=state.expanded.filter(id=>valid.has(id));
    $('#ideas-selected-count').textContent='已选择 '+state.selected.length+' 条';$('#ideas-delete-selected').disabled=!state.selected.length;
    const pageIds=[...$('#diary-list').querySelectorAll('[data-idea-id]')].map(e=>e.dataset.ideaId);
    $('#ideas-select-page').textContent=pageIds.length&&pageIds.every(id=>state.selected.includes(id))?'取消本页':'选择本页';
    $('#ideas-selection-bar').classList.toggle('hidden',location.hash!=='#ideas/select');
    $('#ideas-scope').textContent=$('#idea-filter-summary').textContent;
    const filtered=Boolean($('#idea-query').value.trim()||$('#idea-tag-filter').value||$('#diary-filter').value==='date');
    $('#ideas-clear-inline').classList.toggle('hidden',!filtered);
    if(location.hash==='#ideas/menu')renderMenu();
  }
  function renderMenu(){
    const body=$('#ideas-menu-body'),heading=$('#ideas-menu-title');
    $('#ideas-menu-back').classList.toggle('hidden',state.menu==='root'||state.menu==='record');
    if(state.menu==='record'){
      const note=config.notes().find(n=>n.id===state.recordId);heading.textContent='妙想操作';
      body.innerHTML=note?'<button class="settings-row" type="button" data-idea-edit="'+esc(note.id)+'"><span>编辑妙想</span>'+icon('edit')+'</button><button class="settings-row" type="button" data-idea-delete="'+esc(note.id)+'"><span>删除妙想</span>'+icon('delete')+'</button>':'<p class="inline-empty">这条妙想已不存在。关闭面板可返回原页面。</p>';
    }else if(state.menu==='sort'){
      heading.textContent='排序方式';body.innerHTML=['newest','oldest'].map(v=>'<button class="settings-row" type="button" data-idea-sort="'+v+'" aria-pressed="'+((pendingSort||state.sort)===v)+'"><span>创建日期：'+(v==='newest'?'从新到旧':'从旧到新')+'</span>'+((pendingSort||state.sort)===v?icon('check'):'')+'</button>').join('');
    }else if(state.menu==='source'){
      heading.textContent='笔记来源';body.innerHTML='<p class="idea-source-state">未记录来源</p><p class="subtle-copy">现有记录没有来源字段，此版本暂不按来源筛选。不会推断历史笔记来自 AI、API 或手动输入。</p>';
    }else{
      heading.textContent='妙想菜单';body.innerHTML='<button class="settings-row" type="button" data-idea-mode="select"><span>'+icon('check')+'选择笔记</span>'+icon('chevronRight')+'</button><button class="settings-row" type="button" data-idea-mode="sort"><span>'+icon('calendar')+'排序方式</span><small>创建日期 · '+(state.sort==='newest'?'从新到旧':'从旧到新')+'</small></button><button class="settings-row" type="button" data-idea-mode="source"><span>'+icon('record')+'笔记来源</span><small>未记录</small></button><button class="settings-row" type="button" data-idea-mode="search"><span>'+icon('search')+'搜索、标签与日期</span>'+icon('chevronRight')+'</button>';
    }
  }
  function closeDialog(dialog){root.LifeUI.closeSheet(dialog,()=>config.back('#daily-notes'));}
  function route(target){
    if(!config)return;
    const active=isIdeas(target),list=matches(target),writing=target==='#ideas/write',menu=target==='#ideas/menu',search=target==='#ideas/search',select=target==='#ideas/select';
    document.body.classList.toggle('ideas-view',active);document.body.classList.toggle('ideas-search-view',search);
    $('#ideas-search-panel').classList.toggle('hidden',!search);$('#ideas-quickbar').classList.toggle('hidden',!list||search||select||menu||writing);
    (search?$('.idea-filter-actions'):$('.ideas-scope-bar')).append($('#diary-count'));
    $('#ideas-search-open').classList.toggle('hidden',!list||search||select);$('#ideas-select-page').classList.toggle('hidden',!select);
    if(list){$('#route-back-title').innerHTML=select?'选择妙想':search?'搜索妙想':'<button id="ideas-menu-open" class="text-button" type="button" aria-haspopup="dialog">妙想 '+icon('chevronDown')+'</button>';}
    if(menu){renderMenu();if(!$('#ideas-menu-dialog').open)$('#ideas-menu-dialog').showModal();}else if($('#ideas-menu-dialog').open)$('#ideas-menu-dialog').close();
    if(writing){$('#ideas-compose-title').textContent=config.draft()?.edit?'编辑妙想':'新建妙想';$('#diary-compose').open=true;if(!$('#ideas-compose-dialog').open)$('#ideas-compose-dialog').showModal();if(lastRoute!==target)requestAnimationFrame(()=>$('#diary-content-input').focus({preventScroll:true}));}
    else if($('#ideas-compose-dialog').open)$('#ideas-compose-dialog').close();
    if(search&&lastRoute!==target)requestAnimationFrame(()=>$('#idea-query').focus({preventScroll:true}));
    lastRoute=target;refresh();
  }
  function init(options){
    config=options;
    const section=$('#daily-notes-section'),panel=$('.diary-panel');
    const search=document.createElement('div');search.id='ideas-search-panel';search.className='hidden';search.append($('.idea-filters'),$('.idea-filter-actions'));panel.prepend(search);
    const scope=document.createElement('div');scope.className='ideas-scope-bar';scope.innerHTML='<span id="ideas-scope"></span><button class="text-button hidden" id="ideas-clear-inline" type="button">清除条件</button>';scope.append($('#diary-count'));search.after(scope);
    const selection=document.createElement('div');selection.id='ideas-selection-bar';selection.className='ideas-selection-bar hidden';selection.innerHTML='<span id="ideas-selected-count">已选择 0 条</span><button id="ideas-selection-exit" class="text-button" type="button">退出选择</button><button id="ideas-delete-selected" class="secondary-button" type="button" disabled>删除已选</button>';scope.after(selection);
    const composer=document.createElement('dialog');composer.id='ideas-compose-dialog';composer.className='ui-sheet ideas-compose-dialog';composer.setAttribute('aria-labelledby','ideas-compose-title');composer.innerHTML='<header class="ui-sheet-header"><h2 id="ideas-compose-title">新建妙想</h2><button class="ui-icon-button" type="button" id="ideas-compose-close" aria-label="关闭并保留妙想草稿">'+icon('close')+'</button></header>';
    composer.append($('#diary-compose'));document.body.append(composer);$('#diary-content-input').rows=5;
    $('#diary-title-input').placeholder='给这条妙想起个标题';$('#diary-content-input').placeholder='写下此刻的想法…';
    const close=document.createElement('button');close.id='ideas-compose-cancel';close.type='button';close.className='secondary-button';close.textContent='关闭并保留草稿';$('#idea-submit').before(close);
    const menu=document.createElement('dialog');menu.id='ideas-menu-dialog';menu.className='ui-sheet ideas-menu-dialog';menu.setAttribute('aria-labelledby','ideas-menu-title');menu.innerHTML='<header class="ui-sheet-header"><button class="ui-icon-button hidden" id="ideas-menu-back" type="button" aria-label="返回妙想菜单">'+icon('back')+'</button><h2 id="ideas-menu-title">妙想菜单</h2><button class="ui-icon-button" id="ideas-menu-close" type="button" aria-label="关闭妙想菜单">'+icon('close')+'</button></header><div id="ideas-menu-body"></div>';document.body.append(menu);
    const quick=document.createElement('div');quick.id='ideas-quickbar';quick.className='ideas-quickbar hidden';quick.innerHTML='<button id="ideas-compose-open" type="button" aria-label="新建文字妙想，当前暂不支持语音">'+icon('add')+'<span>点击输入或长按语音<small>当前仅支持文字，不会启动录音</small></span></button>';document.body.append(quick);
    const tools=$('#route-backbar>span:last-child');tools.removeAttribute('aria-hidden');tools.className='ideas-header-tools';tools.innerHTML='<button id="ideas-search-open" class="ui-icon-button hidden" type="button" aria-label="搜索妙想">'+icon('search')+'</button><button id="ideas-select-page" class="text-button hidden" type="button">选择本页</button>';
    $('#ideas-clear-inline').addEventListener('click',()=>$('#idea-clear').click());
    $('#ideas-compose-open').addEventListener('click',()=>config.open('#ideas/write'));
    for(const id of ['ideas-compose-close','ideas-compose-cancel'])$('#'+id).addEventListener('click',()=>closeDialog(composer));
    $('#ideas-menu-close').addEventListener('click',()=>closeDialog(menu));
    $('#ideas-menu-back').addEventListener('click',()=>{state.menu='root';renderMenu();config.remember();});
    $('#ideas-search-open').addEventListener('click',()=>config.open('#ideas/search'));
    $('#ideas-selection-exit').addEventListener('click',()=>config.back('#daily-notes'));
    $('#ideas-select-page').addEventListener('click',()=>{const ids=[...$('#diary-list').querySelectorAll('[data-idea-id]')].map(e=>e.dataset.ideaId);const all=ids.every(id=>state.selected.includes(id));state.selected=all?state.selected.filter(id=>!ids.includes(id)):[...new Set([...state.selected,...ids])];config.refresh();config.remember();});
    $('#ideas-delete-selected').addEventListener('click',async()=>{if(!state.selected.length)return;const ids=[...state.selected];if(await config.remove(ids)){state.selected=[];config.back('#daily-notes');}});
    window.addEventListener('cancel',event=>{if(event.target===composer||event.target===menu){event.preventDefault();event.stopPropagation();closeDialog(event.target);}},true);
    [composer,menu].forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);}}));
    document.addEventListener('click',event=>{
      if(event.target.closest('#idea-tag-add,#idea-tags-toggle,[data-remove-note-tag],[data-reuse-note-tag]'))queueMicrotask(config.remember);
      const open=event.target.closest('#ideas-menu-open');if(open){state.menu='root';state.recordId='';config.open('#ideas/menu');return;}
      const more=event.target.closest('[data-idea-more]');if(more){state.menu='record';state.recordId=more.dataset.ideaMore;config.open('#ideas/menu');return;}
      const expand=event.target.closest('[data-idea-expand]');if(expand){const id=expand.dataset.ideaExpand;state.expanded=state.expanded.includes(id)?state.expanded.filter(x=>x!==id):[...state.expanded,id];config.refresh();config.remember();return;}
      const select=event.target.closest('[data-idea-select]');if(select){const id=select.dataset.ideaSelect;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];config.refresh();config.remember();return;}
      const mode=event.target.closest('[data-idea-mode]');if(mode){if(mode.dataset.ideaMode==='select'||mode.dataset.ideaMode==='search'){state.selected=[];config.replace('#ideas/'+mode.dataset.ideaMode);}else{state.menu=mode.dataset.ideaMode;renderMenu();config.remember();}return;}
      const sort=event.target.closest('[data-idea-sort]');if(sort){state.sort=sort.dataset.ideaSort;pendingSort=state.sort;config.firstPage();config.refresh();renderMenu();config.remember();return;}
      const edit=event.target.closest('[data-idea-edit]');if(edit){config.edit(edit.dataset.ideaEdit);return;}
      const remove=event.target.closest('[data-idea-delete]');if(remove){const id=remove.dataset.ideaDelete;config.remove([id]).then(ok=>{if(ok){deletedFromMenu.add(id);config.back('#daily-notes');}});}
      const card=event.target.closest('.idea-record');
      if(card&&!event.target.closest('a,button')){
        if(location.hash==='#ideas/select')card.querySelector('[data-idea-select]').click();
        else config.open('#note/'+encodeURIComponent(card.dataset.ideaId));
      }
    });
    $('#diary-form').addEventListener('input',()=>config.remember());
    $('#idea-tag-input').addEventListener('keydown',event=>{if(event.key==='Enter')queueMicrotask(config.remember);});
    const keyboard=()=>{const vv=root.visualViewport;composer.style.setProperty('--ideas-viewport-height',(vv?.height||innerHeight)+'px');composer.style.setProperty('--ideas-keyboard-inset',Math.max(0,innerHeight-(vv?.height||innerHeight)-(vv?.offsetTop||0))+'px');};
    root.visualViewport?.addEventListener('resize',keyboard);root.visualViewport?.addEventListener('scroll',keyboard);root.addEventListener('resize',keyboard);keyboard();
    const initial=history.state?.viewSnapshot?.ideas||history.state?.ideaContext;if(initial)restore(initial);
  }
  root.LifeIdeasUI=Object.freeze({init,matches,isIdeas,entries,markup,detail,snapshot,restore,route,refresh,finishNavigation,
    consumeDeleted:id=>deletedFromMenu.delete(id),
    saved:(note,isNew)=>{savedNote={id:note.id,isNew};clearDraftOnReturn=true;config.back('#daily-notes');},
    discarded:()=>{clearDraftOnReturn=true;if(location.hash==='#ideas/write')config.back('#daily-notes');},
    openEditor:()=>location.hash==='#ideas/menu'?config.replace('#ideas/write'):config.open('#ideas/write')});
})(window);
