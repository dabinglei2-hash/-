/* Optional finance metadata. Never changes the canonical ledger or writes on read. */
(function (root) {
  'use strict';
  const key = 'my-life-dashboard-finance-meta-v1';
  const blank = () => ({ version: 1, categoryIcons: [], budgets: [], accounts: [] });
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const exact = (value, keys) => object(value) && Object.keys(value).sort().join('|') === keys.slice().sort().join('|');
  const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
  const cents = value => Number.isSafeInteger(value) && value >= 0;
  const stamp = value => Number.isFinite(value) && value >= 0;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  const month = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && date(value+'-01');
  const naturalBudgetKey = item => JSON.stringify([item.month,item.categoryId]);
  function validate(value, categories, iconNames) {
    if (!exact(value,['version','categoryIcons','budgets','accounts']) || value.version !== 1 || ['categoryIcons','budgets','accounts'].some(k=>!Array.isArray(value[k]))) return '财务扩展数据格式或版本无效。';
    const byCategory = categories ? new Map(categories.categories.map(c=>[c.id,c])) : null;
    const seenIcons = new Set(), seenBudgets = new Set(), budgetScopes = new Set(), seenAccounts = new Set();
    for (const item of value.categoryIcons) {
      if (!exact(item,['categoryId','icon']) || !id(item.categoryId) || !id(item.icon) || seenIcons.has(item.categoryId) || (byCategory && !byCategory.has(item.categoryId)) || (iconNames && !iconNames.includes(item.icon))) return '分类图标无效、重复或引用不存在。';
      seenIcons.add(item.categoryId);
    }
    for (const item of value.budgets) {
      if (!exact(item,['id','month','categoryId','amountCents','createdAt','updatedAt']) || !id(item.id) || seenBudgets.has(item.id) || !month(item.month) || !cents(item.amountCents) || !stamp(item.createdAt) || !stamp(item.updatedAt) || (item.categoryId !== null && (!id(item.categoryId) || (byCategory && byCategory.get(item.categoryId)?.type !== 'expense'))) || budgetScopes.has(naturalBudgetKey(item))) return '预算格式、金额、月份或分类无效，或同月份存在重复预算。';
      seenBudgets.add(item.id); budgetScopes.add(naturalBudgetKey(item));
    }
    for (const item of value.accounts) {
      if (!exact(item,['id','name','kind','balanceCents','asOf','archived','createdAt','updatedAt']) || !id(item.id) || seenAccounts.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 40 || !['asset','liability'].includes(item.kind) || !cents(item.balanceCents) || !date(item.asOf) || typeof item.archived !== 'boolean' || !stamp(item.createdAt) || !stamp(item.updatedAt)) return '资产账户的名称、类型、金额、日期或 ID 无效。';
      seenAccounts.add(item.id);
    }
    return '';
  }
  function read(storage, categories, iconNames) {
    try {
      const raw=storage.getItem(key),data=raw===null?blank():JSON.parse(raw);
      return { data, raw, error:validate(data,categories,iconNames) };
    } catch(error) { return {data:null,raw:null,error:'无法读取财务扩展数据；原数据保持不变。请先导出已有备份并检查浏览器存储。'}; }
  }
  function merge(current, incoming, categories, iconNames) {
    const error=validate(current,categories,iconNames)||validate(incoming,categories,iconNames);
    if(error)return {error,merged:null};
    const merged=clone(current);let additions=0,duplicates=0;
    for(const field of ['categoryIcons','budgets','accounts']) {
      const itemKey=item=>field==='categoryIcons'?item.categoryId:item.id;
      const byId=new Map(merged[field].map(item=>[itemKey(item),item]));
      for(const item of incoming[field]) {
        const existing=byId.get(itemKey(item));
        if(existing) {
          if(!Object.keys(item).every(k=>item[k]===existing[k]))return {error:'财务扩展合并冲突：相同分类图标、预算或账户 ID 的内容不同，已停止导入；现有数据未覆盖。',merged:null};
          duplicates++;continue;
        }
        if(field==='budgets' && merged.budgets.some(b=>naturalBudgetKey(b)===naturalBudgetKey(item)))return {error:'同一月份与分类存在不同 ID 的预算，无法安全合并；已停止导入。',merged:null};
        const added=clone(item);merged[field].push(added);byId.set(itemKey(added),added);additions++;
      }
    }
    return {error:validate(merged,categories,iconNames),merged,additions,duplicates};
  }
  function amount(text) {
    if(typeof text!=='string'||!text.trim())return null;
    const value=Number(text);
    return Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER/100&&Math.abs(value*100-Math.round(value*100))<1e-7?Math.round(value*100):null;
  }
  function sum(items,field) {let value=0;for(const item of items){if(!Number.isSafeInteger(value+item[field]))return null;value+=item[field];}return value;}
  function hasData(value) {return Boolean(value&&(value.categoryIcons.length||value.budgets.length||value.accounts.length));}
  const api={key,blank,validate,read,merge,amount,sum,hasData};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LifeFinanceMeta=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
