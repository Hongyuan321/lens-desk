'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {labels, localDate} = LensDesk;
let db, kits = [], selected = 'CAM-01';

function openLedger() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('lens-desk-classroom', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('kits', {keyPath:'id'});
      for (const kit of LensDesk.seed()) store.add(kit);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function saveAction(id, version, action) {
  return new Promise((resolve,reject) => {
    const tx = db.transaction('kits','readwrite');
    const store = tx.objectStore('kits');
    const req = store.get(id);
    let reason;
    req.onsuccess = () => {
      try {
        if (!req.result || req.result.events.length !== version) throw Error('记录已被更新，请查看最新状态后再提交');
        store.put(LensDesk.change(req.result,action));
      } catch (error) { reason = error; tx.abort(); }
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(reason || tx.error || Error('保存中断'));
  });
}
async function refresh() {
  kits = await new Promise((resolve,reject) => {
    const req = db.transaction('kits').objectStore('kits').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  draw();
}
function badge(k) { return '<span class="badge '+k.state+'">'+labels[k.state]+'</span>'; }
function dueInfo(k) {
  if (!k.loan) return '按清单齐套，可登记借出';
  const overdue = k.state === 'out' && k.loan.due < localDate(new Date());
  return escapeHtml(k.loan.borrower) + ' · 应还 ' + escapeHtml(k.loan.due) + (overdue ? ' · 已逾期' : '');
}
function field(label,name,attrs='') {
  return '<label>'+label+'<input required name="'+name+'" '+attrs+'></label>';
}
function form(k) {
  const lend = k.state === 'ready', review = k.state === 'review';
  const title = lend ? '借出登记' : review ? '缺件复核' : '归还清点';
  let fields = field('经办人','actor','maxlength="80" placeholder="姓名或值班代号"');
  if (lend) {
    fields += field('借用团队','borrower','maxlength="80" placeholder="如：校报摄影组"')+
      field('应还日期','due','type="date" min="'+localDate(new Date())+'"');
  } else {
    fields += k.parts.map((p,i) => field(escapeHtml(p.name)+'（应有 '+p.qty+'）','count'+i,
      'type="number" step="1" min="'+(k.received?.[i] ?? 0)+'" max="'+p.qty+'" '+(review?'value="'+k.received[i]+'"':'placeholder="实收数量"'))).join('');
    if (review) fields += field('复核依据','note','maxlength="80" placeholder="如：已在收纳袋中找回并复点"');
  }
  return '<form class="actionbox" id="action"><h3>'+title+'</h3>'+
    (review?'<p class="notice">填写累计实收数。所有配件点齐后，套装才会恢复可借。</p>':'')+
    '<div class="fields">'+fields+'</div><button class="primary" type="submit">保存'+title+'</button></form>';
}
function detail(k) {
  const parts = k.parts.map((p,i) => '<li class="row"><span>'+escapeHtml(p.name)+'</span><span>'+
    (k.received ? '实收 '+k.received[i]+' / 应有 '+p.qty : '× '+p.qty)+'</span></li>').join('');
  const events = [...k.events].reverse().map(e => '<li><strong>'+escapeHtml(e.title)+'</strong><small>'+
    escapeHtml(new Date(e.time).toLocaleString('zh-CN',{hour12:false}))+' · '+escapeHtml(e.actor)+'</small><p>'+escapeHtml(e.detail)+'</p></li>').join('');
  return '<div class="row"><div><div class="code">'+k.id+' / '+escapeHtml(k.category)+'</div><h2>'+escapeHtml(k.name)+
    '</h2></div>'+badge(k)+'</div><p class="meta">'+dueInfo(k)+'</p><h3>套装清单</h3><ul class="parts">'+parts+
    '</ul>'+form(k)+'<h3>交接记录</h3><ol class="events">'+events+'</ol>';
}
function draw() {
  $('metrics').innerHTML = Object.entries(labels).map(([state,label]) => '<div class="metric '+state+'"><div class="statsline"><span>'+
    label+'</span><b>'+kits.filter(k=>k.state===state).length+'</b></div></div>').join('');
  const visible = kits.filter(k => !$('filter').value || k.state === $('filter').value);
  const k = visible.find(item=>item.id===selected) || visible[0];
  selected = k?.id;
  $('list').innerHTML = visible.map(item => '<button type="button" class="card" data-kit="'+item.id+'" aria-pressed="'+
    (item.id===selected)+'"><span class="row"><span class="code">'+item.id+'</span>'+badge(item)+'</span><strong>'+
    escapeHtml(item.name)+'</strong><br><small>'+dueInfo(item)+'</small></button>').join('') || '<p class="empty">当前状态下没有套装。</p>';
  $('detail').innerHTML = k ? detail(k) : '<p class="empty">选择其他状态查看器材。</p>';
  if (k) $('action').addEventListener('submit', async event => {
    event.preventDefault();
    const f = event.currentTarget, values = new FormData(f);
    const action = Object.fromEntries(values);
    action.type = {ready:'lend',out:'receive',review:'review'}[k.state];
    if (k.state !== 'ready') action.counts = k.parts.map((_,i) => Number(values.get('count'+i)));
    f.querySelector('button').disabled = true;
    try {
      await saveAction(k.id,k.events.length,action);
      $('message').textContent = k.id+' 交接记录已保存。';
    } catch(error) { $('message').textContent = error.message; }
    finally {
      f.querySelector('button').disabled = false;
      await refresh().catch(error => { $('message').textContent = '重新读取失败：'+error.message; });
    }
  });
}
$('filter').addEventListener('change',draw);
$('list').addEventListener('click',event => {
  const item = event.target.closest('[data-kit]');
  if (item) { selected=item.dataset.kit; $('message').textContent=''; draw(); }
});
(async () => {
  try { db = await openLedger(); await refresh(); }
  catch(error) { $('message').textContent = '无法打开本地台账，请允许浏览器保存站点数据，或按 README 使用本地服务打开。'; }
})();
