/* UI-only helpers. No storage access, IDs, record values or statistics are changed here. */
(function (root) {
  'use strict';
  let toastTimer, frame, previousDepth = Number(history.state?.uiDepth) || 0, previousRoute = '';
  const $ = (selector) => document.querySelector(selector);
  const icon = (name) => root.LifeIcons.render(name);
  const each = (selector, callback) => document.querySelectorAll(selector).forEach(callback);
  function motionDuration(kind = 'fast') {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-' + kind)) || 140;
  }
  function closeSheet(dialog, afterClose) {
    if (!dialog?.open || dialog.dataset.uiClosing) return;
    dialog.dataset.uiClosing = 'true';
    dialog.classList.add('is-closing');
    const finish = () => { dialog.close(); dialog.classList.remove('is-closing'); delete dialog.dataset.uiClosing; afterClose?.(); };
    if (!motionDuration()) finish(); else setTimeout(finish, motionDuration());
  }
  function dismissToast() { clearTimeout(toastTimer); $('#app-toast')?.classList.add('hidden'); }
  function toast(message, error = false) {
    const element = $('#app-toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.classList.toggle('is-error', error);
    element.classList.remove('hidden');
    toastTimer = setTimeout(() => element.classList.add('hidden'), error ? 5000 : 2800);
  }
  function setBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    if (busy) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
  }
  function decorateSheet(id, title, cancelSelector) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    dialog.classList.add('ui-sheet');
    if (dialog.querySelector(':scope>.ui-sheet-header')) return;
    const header = document.createElement('header');
    header.className = 'ui-sheet-header';
    const existing = dialog.querySelector(':scope>h2, :scope>.panel-heading') || (id === 'finance-editor' ? dialog.querySelector('.form-panel>.panel-heading') : null);
    if (existing) {
      if (existing.matches('.panel-heading')) header.append(...existing.children); else header.append(existing);
      if (existing.matches('.panel-heading')) existing.remove();
    } else {
      const heading=document.createElement('h2');heading.textContent=title;header.append(heading);
    }
    const close=document.createElement('button');close.type='button';close.className='ui-icon-button';
    close.setAttribute('aria-label','关闭'+title);close.innerHTML=icon('close');
    close.addEventListener('click',()=>{if(cancelSelector)$(cancelSelector).click();else closeSheet(dialog);});
    header.append(close);dialog.prepend(header);
  }
  function enhance() {
    $('#route-back-button')?.classList.add('nav-return-button');
    each('.primary-button,.secondary-button,.text-button,.history-reset,.task-step-button',e=>e.classList.add('ui-button'));
    each('.icon-button',button=>{
      const name=button.matches('.delete-button,[data-delete-goal],[data-delete-task],[data-delete-study],[data-delete-diary],[data-delete-habit],[data-delete-finance]')?'delete':'edit';
      if (!button.querySelector('.ui-icon')) {
        const label=button.getAttribute('aria-label')||button.textContent.trim();
        button.setAttribute('aria-label',label);button.title=label;button.innerHTML=icon(name);
      }
      button.classList.add('ui-icon-button');
    });
    each('.home-card',e=>e.classList.add('ui-metric-card'));
    each('.backup-panel,.backup-preview,.daily-record-panel,.insights-summary',e=>e.classList.add('ui-content-card'));
    each('#settings-section .settings-list',e=>e.classList.add('ui-group-card'));
    each('.record-hub-links>a,.record-secondary-links>a,.settings-row,.note-row,.search-result,.habit-detail-link,.goal-summary-item>a',e=>e.classList.add('ui-list-row'));
    each('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]),textarea',e=>e.classList.add('ui-input'));
    each('select',e=>e.classList.add('ui-select'));
    each('.segmented,.energy-options',e=>e.classList.add('ui-segmented'));
    each('input[type=search]',input=>{
      const field=input.closest('label');if(!field||field.classList.contains('ui-search-field'))return;
      field.classList.add('ui-search-field');field.insertAdjacentHTML('afterbegin',icon('search'));
    });
    each('details:not(.bill-row-more)>summary',summary=>{
      summary.parentElement.classList.add('ui-disclosure');
      if(!summary.querySelector(':scope>.ui-disclosure-icon'))summary.insertAdjacentHTML('beforeend','<span class="ui-disclosure-icon" aria-hidden="true">'+icon('chevronDown')+'</span>');
    });
    each('.bill-row-more>summary',e=>{if(!e.querySelector('.ui-icon'))e.innerHTML=icon('more');});
    each('.empty-state>span',e=>{if(!e.querySelector('.ui-icon'))e.innerHTML=icon('empty');e.setAttribute('aria-hidden','true');});
    each('.backup-includes li',e=>{if(!e.querySelector('.ui-icon'))e.insertAdjacentHTML('afterbegin',icon('check'));});
    each('.page-section .page-back,.page-section .record-return,.page-section .task-back-button,.section-heading>a[data-back-fallback]',e=>{
      if(!e.closest('#bill-section,dialog'))e.classList.add('ui-local-back');
    });
    each('.ui-secondary-page>.section-heading,.ui-secondary-page>.record-page-heading,#task-list-view>.section-heading',heading=>{
      heading.classList.add('ui-secondary-heading');
      const title=heading.querySelector('h2');if(title)title.classList.add('ui-secondary-title');
    });
    const profile=$('#personal-settings');
    if(profile)decorateSheet('personal-settings','个人资料','#personal-settings-cancel');
    if($('#finance-editor')){decorateSheet('finance-editor','编辑收支','[data-close-finance]');$('#finance-editor>[data-close-finance]')?.classList.add('ui-local-back');}
    if($('#home-date-dialog'))decorateSheet('home-date-dialog','查看日期');
    if($('#finance-month-dialog'))decorateSheet('finance-month-dialog','选择月份','#finance-month-cancel');
    if($('#finance-filter-dialog'))decorateSheet('finance-filter-dialog','筛选账单','#finance-filter-close');
    $('#quick-record-sheet')?.classList.add('ui-sheet');
    $('#confirm-dialog')?.classList.add('ui-modal');
    root.LifeIcons.mount();
  }
  function syncRoute(route, section) {
    if (route === '#bill/new' && previousRoute !== route) dismissToast();
    const primary=['#overview','#records','#finance','#monthly','#personal'].includes(route);
    const depth=Number(history.state?.uiDepth)||0;
    const direction=depth<previousDepth?'back':'forward';
    if(section){
      section.dataset.uiLevel=primary?'primary':'secondary';
      section.dataset.uiDirection=direction;
      section.classList.toggle('ui-secondary-page',!primary);
      section.dataset.uiTaskSwitch=previousRoute.startsWith('#task/')&&route.startsWith('#task/')?'true':'false';
    }
    previousDepth=depth;previousRoute=route;
    enhance();
  }
  root.LifeUI=Object.freeze({enhance,syncRoute,toast,dismissToast,closeSheet,setBusy,motionDuration});
  document.addEventListener('DOMContentLoaded',()=>{
    enhance();
    new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(enhance);}).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('cancel',event=>{
      if(event.target.matches('dialog.ui-sheet:not(#quick-record-sheet):not(#finance-month-dialog)')){event.preventDefault();closeSheet(event.target);}
    },true);
  });
})(window);
