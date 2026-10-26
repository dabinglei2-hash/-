/* Read-only ledger presentation. Filtering, ordering and totals come from LifeHistory. */
(function (root) {
  'use strict';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function groupPage(items, allRecords, query) {
    const groups=new Map();
    for(const item of items){if(!groups.has(item.date))groups.set(item.date,[]);groups.get(item.date).push(item);}
    return [...groups].map(([date,records])=>({date,records,day:root.LifeHistory.select(allRecords,{type:'finance',range:'selected',anchor:date,query})}));
  }
  function markup(items, options) {
    const {allRecords,categories,query,money,iconFor}=options;
    const icon=name=>root.LifeIcons.render(name);
    return groupPage(items,allRecords,query).map(group=>{
      const {date,records,day}=group;
      const parsed=new Date(date+'T12:00:00Z');
      const weekday=new Intl.DateTimeFormat('zh-CN',{weekday:'short',timeZone:'UTC'}).format(parsed);
      const label=Number(date.slice(5,7))+'月'+Number(date.slice(8,10))+'日 '+weekday;
      const coverage=records.length<day.count?'本页 '+records.length+' 条 / 当日共 '+day.count+' 条':'';
      const scope=[String(query||'').trim()?'筛选后的当日合计':'',coverage].filter(Boolean).join(' · ');
      const heading='<tr class="ledger-day-row" data-finance-day="'+date+'"><td colspan="4"><div class="ledger-day-heading"><time datetime="'+date+'"><span>'+escapeHtml(label)+'</span><small>'+date.slice(0,4)+'年</small></time><div class="ledger-day-totals"><span>收入 <strong>'+money(day.totals.income/100)+'</strong></span><span>支出 <strong>'+money(day.totals.expense/100)+'</strong></span></div></div>'+(scope?'<p class="ledger-day-scope">'+escapeHtml(scope)+'</p>':'')+'</td></tr>';
      const rows=records.map(record=>{
        const incomeAssignment=root.LifeCategories.assignmentFor(categories,record.id,'income');
        const expenseAssignment=root.LifeCategories.assignmentFor(categories,record.id,'expense');
        const hasIncome=Number(record.income)>0||Boolean(incomeAssignment),hasExpense=Number(record.expense)>0||Boolean(expenseAssignment);
        const entry=(type,assignment)=>{
          const label=root.LifeCategories.categoryLabel(categories,record.id,type),name=type==='income'?'收入':'支出';
          return '<a class="ledger-line" href="#entry/finance/'+encodeURIComponent(record.id)+'" data-open-page aria-label="'+escapeHtml(date+' '+name+' '+label+' '+money(record[type]))+'"><span class="category-glyph">'+icon(iconFor(assignment?.categoryId))+'</span><span class="ledger-label"><strong>'+escapeHtml(label)+'</strong><small>'+name+'</small></span><strong class="ledger-amount">'+(type==='income'?'+':'−')+money(record[type])+'</strong></a>';
        };
        const neutral='<a class="ledger-line" href="#entry/finance/'+encodeURIComponent(record.id)+'" data-open-page><span class="category-glyph">'+icon('tag')+'</span><span class="ledger-label"><strong>未分类</strong><small>零金额记录</small></span><strong class="ledger-amount">'+money(0)+'</strong></a>';
        return '<tr class="ledger-entry '+(hasIncome&&hasExpense?'ledger-combined':'ledger-single')+(record.note?' ledger-has-note':'')+'" data-finance-record="'+escapeHtml(record.id)+'"><td><time class="cell-main" datetime="'+date+'">'+date+'</time>'+(record.note?'<span class="cell-sub">'+escapeHtml(record.note)+'</span>':'')+'</td><td class="'+(!hasIncome&&hasExpense?'bill-cell-empty':'')+'">'+(hasIncome?entry('income',incomeAssignment):!hasExpense?neutral:'')+'</td><td class="'+(!hasExpense?'bill-cell-empty':'')+'">'+(hasExpense?entry('expense',expenseAssignment):'')+'</td><td><details class="bill-row-more"><summary aria-label="账单更多操作：'+escapeHtml(record.note||date)+'">'+icon('more')+'</summary><div><button type="button" data-edit-finance="'+escapeHtml(record.id)+'" aria-label="编辑账单：'+escapeHtml(record.note||date)+'">编辑</button><button type="button" class="delete-button" data-delete-finance="'+escapeHtml(record.id)+'" aria-label="删除账单：'+escapeHtml(record.note||date)+'">删除</button></div></details></td></tr>';
      }).join('');
      return heading+rows;
    }).join('');
  }
  root.LifeFinanceLedger=Object.freeze({groupPage,markup});
})(window);
