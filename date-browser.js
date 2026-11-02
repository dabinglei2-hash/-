/* Shared calendar UI only. Dates are owned independently by each caller. */
(function (root) {
  'use strict';
  const dayNames = ['日','一','二','三','四','五','六'];
  const parse = value => new Date(value + 'T12:00:00Z');
  const format = date => date.toISOString().slice(0,10);
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(parse(value).getTime()) && format(parse(value)) === value;
  const add = (value, days) => { const date = parse(value); date.setUTCDate(date.getUTCDate() + days); return format(date); };
  function mount(node, options) {
    const name = options.label;
    node.classList.add('date-browser');
    node.innerHTML = '<div class="date-browser-heading"><strong data-date-weekday></strong><button type="button" class="text-button" data-date-month aria-label="选择'+name+'月份"></button></div><div class="date-browser-strip" role="group" aria-label="'+name+'日期"></div><div class="date-browser-actions"><button type="button" class="ui-icon-button" data-date-shift="-7" aria-label="'+name+'上一周">'+root.LifeIcons.render('back')+'</button><span data-date-caption role="status"></span><button type="button" class="text-button" data-date-today>今天</button><button type="button" class="ui-icon-button" data-date-shift="7" aria-label="'+name+'下一周">'+root.LifeIcons.render('chevronRight')+'</button></div>';
    const strip = node.querySelector('.date-browser-strip');
    const dialog = document.createElement('dialog');
    dialog.className = 'editor-dialog ui-sheet date-browser-dialog';
    dialog.setAttribute('aria-label', '选择'+name+'月份');
    dialog.innerHTML = '<form class="form-stack"><label>查看月份<input type="month" required min="0001-01" max="9999-12"></label><div class="form-row"><button type="button" class="secondary-button" data-date-cancel>取消</button><button type="submit" class="primary-button">查看</button></div></form>';
    document.body.append(dialog);
    let pointer = null, suppressClick = false;
    function choose(value, focus = false) {
      if (!valid(value) || value < '0001-01-01' || value > '9999-12-31') return;
      options.choose(value);
      if (focus) strip.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
    }
    node.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      if (suppressClick) { suppressClick = false; event.preventDefault(); return; }
      if (button.hasAttribute('data-date-value')) choose(button.dataset.dateValue);
      else if (button.hasAttribute('data-date-shift')) choose(add(options.date(), Number(button.dataset.dateShift)));
      else if (button.hasAttribute('data-date-today')) choose(options.today());
      else if (button.hasAttribute('data-date-month')) { dialog.querySelector('input').value = options.date().slice(0,7); dialog.showModal(); }
    });
    strip.addEventListener('keydown', event => {
      const date = options.date(), offset = (parse(date).getUTCDay()+6)%7;
      const offsets = {ArrowLeft:-1,ArrowRight:1,Home:-offset,End:6-offset,PageUp:-7,PageDown:7};
      if (!(event.key in offsets)) return;
      event.preventDefault(); suppressClick=false; choose(add(date,offsets[event.key]),true);
    });
    strip.addEventListener('pointerdown', event => { if(event.isPrimary && event.button === 0) {suppressClick=false;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};} });
    strip.addEventListener('pointercancel', () => {pointer=null;});
    strip.addEventListener('pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;pointer=null;
      if(Math.abs(dx)>=45 && Math.abs(dx)>Math.abs(dy)*1.4) {suppressClick=true;choose(add(options.date(),dx<0?7:-7));}
    });
    dialog.querySelector('[data-date-cancel]').addEventListener('click',()=>root.LifeUI.closeSheet(dialog));
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();const month=dialog.querySelector('input').value;
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
      const end=parse(month+'-01');end.setUTCMonth(end.getUTCMonth()+1,0);
      const value=month+'-'+String(Math.min(Number(options.date().slice(8)),end.getUTCDate())).padStart(2,'0');
      if(valid(value))root.LifeUI.closeSheet(dialog,()=>choose(value));
    });
    function render() {
      const value=options.date();if(!valid(value))return;
      const date=parse(value), start=add(value,-((date.getUTCDay()+6)%7));
      node.querySelector('[data-date-weekday]').textContent='星期'+dayNames[date.getUTCDay()];
      node.querySelector('[data-date-month]').innerHTML=Number(value.slice(0,4))+'年'+Number(value.slice(5,7))+'月 '+root.LifeIcons.render('chevronRight');
      const dates=Array.from({length:7},(_,i)=>add(start,i));
      // Keep buttons mounted during a date change, preserving pointer and keyboard focus.
      if(!strip.children.length)strip.innerHTML=dates.map(()=>'<button type="button"><small></small><span></span></button>').join('');
      [...strip.children].forEach((button,i)=>{
        const day=dates[i],isToday=day===options.today(),selected=day===value;
        button.disabled=!valid(day)||day<'0001-01-01'||day>'9999-12-31';
        if(button.disabled){button.removeAttribute('data-date-value');button.setAttribute('aria-label','超出日期范围');button.removeAttribute('aria-pressed');button.querySelector('small').textContent='';button.querySelector('span').textContent='';return;}
        button.dataset.dateValue=day;button.setAttribute('aria-label',day+' 星期'+dayNames[parse(day).getUTCDay()]+(isToday?' 今天':''));button.setAttribute('aria-pressed',String(selected));
        button.classList.toggle('is-today',isToday);button.tabIndex=selected?0:-1;
        button.querySelector('small').textContent='周'+dayNames[parse(day).getUTCDay()];button.querySelector('span').textContent=Number(day.slice(8));
      });
      node.querySelector('[data-date-caption]').textContent=value;
      node.querySelector('[data-date-shift="-7"]').disabled=!valid(add(value,-7))||add(value,-7)<'0001-01-01';
      node.querySelector('[data-date-shift="7"]').disabled=!valid(add(value,7))||add(value,7)>'9999-12-31';
    }
    return Object.freeze({render});
  }
  root.LifeDateBrowser=Object.freeze({mount});
})(window);
