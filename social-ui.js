/* Isolated front-end demonstration. No storage, network, authentication or backup writes. */
(function (root) {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const icon = name => root.LifeIcons.render(name);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const posts = [
    {id:'demo-focus',name:'专注实验室 · 演示',handle:'demo_focus',date:'2026-10-25T09:30:00+08:00',following:true,text:'把今天的大任务拆成一个可以开始的小动作。\n\n先专注 25 分钟，再停下来回顾：我学到了什么？下一步是什么？\n\n这是一条合成示例，不来自真实用户。'},
    {id:'demo-rhythm',name:'生活观察 · 演示',handle:'demo_life',date:'2026-10-25T08:15:00+08:00',following:false,text:'记录，行动，回顾。\n\n工具只需要帮助我们看清下一步，不必填满每一分钟。下图是本地绘制的演示插图。',image:'assets/social-demo.svg',alt:'演示插图：记录、行动、回顾三个步骤'},
    {id:'demo-budget',name:'日常账本 · 演示',handle:'demo_budget',date:'2026-10-24T20:00:00+08:00',following:true,text:'每次记账留一句简短备注，月末回顾时更容易理解当时的选择。\n\n这只是交互演示，不包含你的任何真实收支。'},
    {id:'demo-walk',name:'生活观察 · 演示',handle:'demo_life',date:'2026-10-24T17:20:00+08:00',following:false,text:'有时休息也是计划的一部分。\n\n放下屏幕走一走，回来后再决定今天最重要的一件事。'},
    {id:'demo-learning',name:'专注实验室 · 演示',handle:'demo_focus',date:'2026-10-24T12:00:00+08:00',following:true,text:'学习计划是预计投入，学习记录是实际发生。\n\n把两者分开，才能知道什么安排适合自己。'},
    {id:'demo-review',name:'日常账本 · 演示',handle:'demo_budget',date:'2026-10-23T19:00:00+08:00',following:true,text:'回顾这一周，可以先问三个问题：\n\n哪些事做得顺利？\n哪些事值得调整？\n下周只改变哪一个习惯？'},
    {id:'demo-space',name:'生活观察 · 演示',handle:'demo_life',date:'2026-10-23T10:00:00+08:00',following:false,text:'为生活留一点空白。\n\n这一页没有算法推荐或真实关注关系。“正在关注”只是用于验收切换与返回的示例分组。'},
    {id:'demo-small',name:'专注实验室 · 演示',handle:'demo_focus',date:'2026-10-22T08:00:00+08:00',following:true,text:'一个小小的开始，比一个尚未开始的完美计划更具体。\n\n你可以打开帖子试用回复、点赞和收藏；这些演示互动刷新后不会保留。'},
  ];
  const likes = new Set(), bookmarks = new Set(), reposts = new Set(), replies = new Map(), replyDrafts = new Map();
  let config, tab = 'recommended', positions = {recommended:0,following:0}, collapsed = false;
  let activeRoute = '', scrollAnchor = 0, frame = 0, holdUntil = 0, sequence = 0;
  let searchQuery = '', searchGeneration = 0;
  const matches = route => route === '#social' || route === '#social/search' || /^#social\/post\//.test(route || '');
  function findPost(route) {
    let id;
    try { id = decodeURIComponent(route.slice('#social/post/'.length)); }
    catch (error) { return null; }
    return posts.find(post => post.id === id) || null;
  }
  function dateText(date) {
    return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date));
  }
  function avatar(name) { return '<span class="social-avatar" aria-hidden="true">'+esc(Array.from(name)[0] || '我')+'</span>'; }
  function author(post) {
    return '<div class="social-author"><strong>'+esc(post.name)+'</strong><span>@'+esc(post.handle)+'</span><time datetime="'+post.date+'">'+esc(dateText(post.date))+'</time></div>';
  }
  function image(post) { return post.image ? '<img class="social-image" src="'+post.image+'" alt="'+esc(post.alt)+'" width="640" height="360" loading="lazy">' : ''; }
  function action(post, name, symbol, label, selected, count) {
    return '<button class="social-action" type="button" data-social-action="'+name+'" data-post-id="'+post.id+'" aria-label="'+label+'（本次演示）"'+(selected === null ? '' : ' aria-pressed="'+selected+'"')+'>'+icon(symbol)+(count === undefined ? '' : '<span>'+count+'</span>')+'</button>';
  }
  function actions(post) {
    return '<div class="social-actions" aria-label="仅本次页面有效的演示操作">'+
      action(post,'reply','comment','回复',null,(replies.get(post.id) || []).length)+
      action(post,'repost','repost','转发',reposts.has(post.id),reposts.has(post.id)?1:0)+
      action(post,'like','heart','点赞',likes.has(post.id),likes.has(post.id)?1:0)+
      action(post,'bookmark','bookmark','收藏',bookmarks.has(post.id))+
      action(post,'share','share','复制演示链接',null)+'</div>';
  }
  function card(post) {
    return '<article class="social-post" data-social-post="'+post.id+'">'+avatar(post.name)+'<div class="social-post-main"><a class="social-post-link" href="#social/post/'+post.id+'" data-social-open aria-label="查看'+esc(post.name)+'的演示帖子">'+author(post)+'<p class="social-text">'+esc(post.text)+'</p>'+image(post)+'</a>'+actions(post)+'</div></article>';
  }
  function setCollapsed(value) {
    collapsed = Boolean(value);
    const hidden = activeRoute === '#social' && collapsed;
    document.body.classList.toggle('social-nav-hidden',hidden);
    const nav = $('.mobile-bottom-nav');
    nav.inert = hidden && matchMedia('(max-width:760px)').matches;
    const header = $('#social-header');
    if (!header) return;
    header.classList.toggle('is-collapsed', collapsed);
    header.inert = collapsed;
  }
  function scrollPosition() {
    const limit = Math.max(0, document.scrollingElement.scrollHeight - window.innerHeight);
    return Math.min(limit, Math.max(0, window.scrollY));
  }
  function resetScrollTracking() {
    cancelAnimationFrame(frame); frame = 0;
    scrollAnchor = scrollPosition();
    holdUntil = performance.now()+350;
    // The shared router restores window position on its next animation frame.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if (activeRoute !== '#social') return;
      scrollAnchor = scrollPosition();
      if (scrollAnchor <= 12) setCollapsed(false);
    }));
  }
  function feed() {
    const profile = config.profile(), nickname = profile.nickname || '我';
    const selected = tab === 'following' ? posts.filter(post => post.following) : posts;
    $('#social-section').innerHTML = '<div id="social-feed-view"><header class="social-header" id="social-header"><div class="social-brand"><a class="social-profile" href="#personal" data-open-page aria-label="打开我的个人中心">'+avatar(nickname)+'</a><h2>社交</h2><a class="ui-icon-button social-search-open" href="#social/search" data-social-open aria-label="搜索社交内容">'+icon('search')+'</a></div><div class="social-tabs" role="tablist" aria-label="演示信息流"><button id="social-tab-recommended" role="tab" aria-controls="social-feed" type="button" data-social-tab="recommended" aria-selected="'+(tab === 'recommended')+'">为你推荐</button><button id="social-tab-following" role="tab" aria-controls="social-feed" type="button" data-social-tab="following" aria-selected="'+(tab === 'following')+'">正在关注</button></div></header><p class="social-demo-notice">本地交互演示 · 合成内容与示例分组，未连接社交服务。发布、回复及互动仅本次页面有效，刷新后清除，不进入生活备份。</p><div id="social-feed" role="tabpanel" aria-labelledby="social-tab-'+tab+'">'+selected.map(card).join('')+'</div><p class="social-end">已显示全部 '+selected.length+' 条演示帖子</p><button class="social-compose-fab" type="button" data-social-compose aria-label="新建演示帖子">'+icon('add')+'</button></div>';
    setCollapsed(collapsed);
    root.LifeUI.enhance();
  }
  function renderSearchResults() {
    const generation=++searchGeneration,results=$('#social-search-results'),status=$('#social-search-status');
    const query=searchQuery.trim().toLocaleLowerCase();
    if(!query){results.innerHTML='';results.removeAttribute('aria-busy');status.textContent='输入正文、作者昵称或用户名。仅搜索本地社交演示，不读取私人记录。';return;}
    results.setAttribute('aria-busy','true');status.textContent='正在检索本地演示内容…';
    requestAnimationFrame(()=>{
      if(generation!==searchGeneration || activeRoute!=='#social/search')return;
      try {
        const rows=posts.filter(post=>[post.text,post.name,post.handle].some(value=>value.toLocaleLowerCase().includes(query)));
        results.innerHTML=rows.map(card).join('');status.textContent=rows.length?'找到 '+rows.length+' 条本地演示帖子':'没有匹配的社交演示内容，可清空后重新搜索。';
        root.LifeUI.enhance();
      } catch(error) {
        results.innerHTML='';status.textContent='本地搜索失败，请清空后重试。';console.error('社交搜索失败',error);
      } finally {results.removeAttribute('aria-busy');}
    });
  }
  function search() {
    $('#social-section').innerHTML='<section class="social-search"><label for="social-search-input" class="sr-only">搜索本地社交内容</label><div class="social-search-field"><input id="social-search-input" type="search" maxlength="200" placeholder="搜索社交演示" value="'+esc(searchQuery)+'"><button type="button" class="text-button" data-social-clear>清空</button></div><p id="social-search-status" class="subtle-copy" role="status"></p><div id="social-search-results"></div></section>';
    renderSearchResults();
  }
  function detail(route) {
    const post = findPost(route);
    if (!post) {
      $('#social-section').innerHTML = '<div class="empty-state social-missing"><strong>这条演示帖子不存在</strong><p>链接可能无效，或帖子仅在上一次页面会话中存在。</p><button class="secondary-button" type="button" data-back-fallback="#social">返回社交信息流</button></div>';
      return;
    }
    const rows = replies.get(post.id) || [];
    $('#social-section').innerHTML = '<div class="social-detail" data-social-post="'+post.id+'"><p class="social-demo-notice">演示帖子 · 回复与互动刷新后清除，未发布到网络。</p><header class="social-detail-author">'+avatar(post.name)+author(post)+'</header><p class="social-text">'+esc(post.text)+'</p>'+image(post)+'<p class="social-detail-date">'+esc(dateText(post.date))+' · 本地演示</p>'+actions(post)+'<section class="social-replies" aria-labelledby="social-replies-title"><h3 id="social-replies-title">演示回复 · '+rows.length+'</h3>'+(rows.map(row=>'<article class="social-reply">'+avatar('我')+'<div><strong>我 · 本次演示</strong><p class="social-text">'+esc(row.text)+'</p></div></article>').join('') || '<p class="subtle-copy">暂无回复。输入后仅在本次页面中展示。</p>')+'</section><form id="social-reply-form" data-post-id="'+post.id+'"><label for="social-reply-input">写一条演示回复</label><textarea id="social-reply-input" maxlength="2000" rows="3" required placeholder="不会发布到网络">'+esc(replyDrafts.get(post.id) || '')+'</textarea><button class="primary-button" type="submit">添加演示回复</button><p class="subtle-copy">刷新后不会保留；真实记录请使用妙想。</p></form></div>';
    root.LifeUI.enhance();
  }
  function route(target) {
    const wasFeed = activeRoute === '#social';
    activeRoute = target;
    if(target !== '#social') {document.body.classList.remove('social-nav-hidden');$('.mobile-bottom-nav').inert=false;}
    resetScrollTracking();
    if ($('#social-compose-dialog').open && !matches(target)) root.LifeUI.closeSheet($('#social-compose-dialog'));
    if (target === '#social') {
      if (!wasFeed) collapsed = false;
      feed();
    } else if (target === '#social/search') search();
    else if (matches(target)) detail(target);
  }
  function snapshot() {
    return {tab,positions:{...positions},collapsed,searchQuery};
  }
  function restore(value) {
    if (!value || typeof value !== 'object') return;
    tab = value.tab === 'following' ? 'following' : 'recommended';
    for (const key of ['recommended','following']) positions[key] = Math.max(0,Number(value.positions?.[key]) || 0);
    collapsed = Boolean(value.collapsed);
    if(typeof value.searchQuery==='string')searchQuery=value.searchQuery.slice(0,200);
    if (activeRoute === '#social') feed();
    if (activeRoute === '#social/search') search();
    resetScrollTracking();
  }
  function updatePost(id) {
    const post = posts.find(row=>row.id===id), focused = document.activeElement?.dataset.socialAction;
    if (!post) return;
    if (activeRoute === '#social' || activeRoute === '#social/search') {
      const row = [...document.querySelectorAll('.social-post')].find(node=>node.dataset.socialPost===id);
      if (row) row.outerHTML=card(post);
    } else detail(activeRoute);
    if (focused) [...$('#social-section').querySelectorAll('[data-social-action]')].find(node=>node.dataset.socialAction===focused&&node.dataset.postId===id)?.focus({preventScroll:true});
  }
  async function interact(name, id) {
    const post = posts.find(row=>row.id===id);
    if (!post) { config.toast('演示帖子已不存在。',true); return; }
    if (name === 'reply') {
      if (activeRoute !== '#social/post/'+id) config.open('#social/post/'+id);
      requestAnimationFrame(()=>$('#social-reply-input')?.focus());
      return;
    }
    if (name === 'share') {
      if (!navigator.clipboard?.writeText) { config.toast('当前浏览器无法复制，请手动复制帖子地址。',true); return; }
      const url = new URL(location.href);url.hash='#social/post/'+id;
      try { await navigator.clipboard.writeText(url.href);config.toast('已复制演示链接；不会分享本次临时回复。'); }
      catch (error) { config.toast('浏览器未允许复制，请手动复制帖子地址。',true); }
      return;
    }
    const set = {like:likes,bookmark:bookmarks,repost:reposts}[name];
    if (!set) return;
    const selected = !set.has(id); if (selected) set.add(id); else set.delete(id);
    updatePost(id);
    config.toast((selected?'已':'已取消')+({like:'点赞',bookmark:'收藏',repost:'转发标记'})[name]+' · 仅本次演示');
  }
  function scroll() {
    if (activeRoute !== '#social' || frame) return;
    frame = requestAnimationFrame(()=>{
      frame = 0;
      if (activeRoute !== '#social') return;
      const y = scrollPosition();
      positions[tab]=y;
      if (y <= 12) {setCollapsed(false); scrollAnchor=y; return;}
      const header = $('#social-header');
      if (!header) return;
      if (performance.now()<holdUntil || document.querySelector('dialog[open]') || header.querySelector(':focus-visible') || $('.mobile-bottom-nav').querySelector(':focus-visible')) {scrollAnchor=y; return;}
      // Compare with the current high/low point: tiny steps accumulate, oscillation
      // does not. Clamping ignores Safari's elastic overscroll at either boundary.
      if (collapsed) {
        scrollAnchor = Math.max(scrollAnchor,y);
        if (scrollAnchor-y >= 20) {setCollapsed(false); scrollAnchor=y;}
      } else {
        scrollAnchor = Math.min(scrollAnchor,y);
        const flowBottom = $('#social-feed-view').getBoundingClientRect().top + window.scrollY + header.offsetHeight;
        // Its original flow position is already above the viewport. Transforming
        // the sticky surface releases screen space without reflow or scroll jumps.
        if (y-scrollAnchor >= 36 && y >= flowBottom) {setCollapsed(true); scrollAnchor=y;}
      }
    });
  }
  function init(options) {
    config = options;
    const dialog = document.createElement('dialog');dialog.id='social-compose-dialog';dialog.className='editor-dialog ui-sheet';dialog.setAttribute('aria-labelledby','social-compose-title');
    dialog.innerHTML='<header class="ui-sheet-header"><h2 id="social-compose-title">新建演示帖子</h2><button class="ui-icon-button" type="button" data-social-close aria-label="关闭演示输入">'+icon('close')+'</button></header><p class="subtle-copy">仅用于交互验收，不会发布到网络、保存到生活记录或导出备份。刷新后清除；关闭面板保留当前输入。</p><form id="social-compose-form" class="form-stack"><label for="social-compose-text">演示正文</label><textarea id="social-compose-text" rows="5" maxlength="2000" required placeholder="输入一段测试文字"></textarea><div class="form-row"><button class="secondary-button" type="button" data-social-close>暂存并关闭</button><button class="primary-button" type="submit">添加到演示信息流</button></div></form>';
    document.body.append(dialog);
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button:not(:disabled),textarea,input:not(:disabled),a[href]')].filter(node=>node.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    dialog.querySelectorAll('[data-social-close]').forEach(button=>button.addEventListener('click',()=>root.LifeUI.closeSheet(dialog)));
    $('#social-section').addEventListener('click',event=>{
      const clear=event.target.closest('[data-social-clear]');
      if(clear){searchQuery='';$('#social-search-input').value='';renderSearchResults();config.remember();$('#social-search-input').focus();return;}
      const control=event.target.closest('[data-social-tab],[data-social-open],[data-social-action],[data-social-compose]');
      if (control) {
        if (event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
        event.preventDefault();
        if (control.hasAttribute('data-social-open')) {config.open(control.getAttribute('href'));return;}
        if (control.hasAttribute('data-social-action')) {void interact(control.dataset.socialAction,control.dataset.postId);return;}
        if (control.hasAttribute('data-social-compose')) {dialog.showModal();return;}
        const next=control.dataset.socialTab;
        if(next===tab)return;
        positions[tab]=window.scrollY;tab=next;collapsed=false;feed();
        window.scrollTo({top:positions[tab],behavior:'instant'});resetScrollTracking();
        $('#social-tab-'+tab).focus({preventScroll:true});config.remember();
        return;
      }
      const post=event.target.closest('.social-post');
      if(post&&!event.target.closest('a,button,input,textarea')&&!getSelection()?.toString())config.open('#social/post/'+post.dataset.socialPost);
    });
    $('#social-section').addEventListener('keydown',event=>{
      if(!event.target.matches('[data-social-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const next=event.key==='Home'?'recommended':event.key==='End'?'following':tab==='recommended'?'following':'recommended';$('#social-tab-'+next).click();
    });
    $('#social-section').addEventListener('input',event=>{
      if(event.target.id==='social-search-input'){searchQuery=event.target.value;renderSearchResults();config.remember();}
      if(event.target.id==='social-reply-input')replyDrafts.set(event.target.closest('form').dataset.postId,event.target.value);
    });
    $('#social-section').addEventListener('submit',event=>{
      if(event.target.id!=='social-reply-form')return;
      event.preventDefault();const id=event.target.dataset.postId,text=$('#social-reply-input').value.trim();
      if(!text)return;
      const rows=replies.get(id)||[];rows.push({text});replies.set(id,rows);replyDrafts.delete(id);detail(activeRoute);$('#social-reply-input').focus({preventScroll:true});config.toast('已添加演示回复 · 刷新后清除');
    });
    $('#social-compose-form').addEventListener('submit',event=>{
      event.preventDefault();const text=$('#social-compose-text').value.trim();if(!text)return;
      sequence++;
      const id='session-'+Date.now().toString(36)+'-'+sequence;
      posts.unshift({id,name:(config.profile().nickname||'我')+' · 本次演示',handle:'local_demo',date:new Date().toISOString(),following:true,text});
      $('#social-compose-text').value='';
      root.LifeUI.closeSheet(dialog,()=>{tab='recommended';collapsed=false;feed();window.scrollTo({top:0,behavior:'instant'});resetScrollTracking();config.remember();config.toast('已添加演示帖子 · 未发布，刷新后清除');});
    });
    window.addEventListener('scroll',scroll,{passive:true});
    matchMedia('(max-width:760px)').addEventListener('change',()=>{ $('.mobile-bottom-nav').inert=activeRoute==='#social'&&collapsed&&matchMedia('(max-width:760px)').matches; });
    window.addEventListener('pagehide',()=>{if(activeRoute==='#social')config.remember();});
  }
  root.LifeSocialUI = Object.freeze({init,matches,route,snapshot,restore});
})(window);
