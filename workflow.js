/* Shared by the browser and the Node.js acceptance checks. */
const LensDesk = (() => {
  const labels = { ready: '可借', out: '借出中', review: '待复核' };
  const kits = [
    ['CAM-01', '活动摄影套装', '微单相机', [['相机机身', 1], ['标准变焦镜头', 1], ['电池', 2], ['SD 存储卡', 1]]],
    ['AUD-02', '采访收音套装', '音频器材', [['录音机', 1], ['领夹麦克风', 2], ['监听耳机', 1]]],
    ['LGT-03', '便携补光套装', '灯光器材', [['LED 灯', 2], ['灯架', 2], ['电源适配器', 2]]]
  ];
  function text(value, name) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
      throw Error('请填写' + name + '（1 至 80 个字符）');
    }
    return value.trim();
  }
  function localDate(time) {
    const d = new Date(time);
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function seed(now = new Date()) {
    const initial = kits.map(([id, name, category, parts]) => ({
      id, name, category, parts: parts.map(([name, qty]) => ({ name, qty })),
      state: 'ready', loan: null, received: null,
      events: [{ time: now.toISOString(), title: '建档盘点', actor: '示例值班员', detail: '按套装清单点齐入库' }]
    }));
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate()-1);
    for (const kit of initial.slice(1)) kit.events[0].time = yesterday.toISOString();
    initial[1] = change(initial[1], { type:'lend', actor:'示例值班员', borrower:'校刊采访组', due:localDate(yesterday) }, yesterday);
    initial[2] = change(initial[2], { type:'lend', actor:'示例值班员', borrower:'学生影像社', due:localDate(now) }, yesterday);
    initial[2] = change(initial[2], { type:'receive', actor:'示例值班员', counts:[2,2,1] }, now);
    return initial;
  }
  function change(original, action, now = new Date()) {
    const kit = JSON.parse(JSON.stringify(original));
    const time = now.toISOString();
    const actor = text(action.actor, '经办人');
    const log = (title, detail) => kit.events.push({time, actor, title, detail});
    if (action.type === 'lend' && kit.state === 'ready') {
      const borrower = text(action.borrower, '借用团队');
      const due = String(action.due || '');
      const date = new Date(due + 'T12:00:00');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(date) || localDate(date) !== due || due < localDate(now)) throw Error('归还日期须为今天或之后的有效日期');
      kit.loan = { borrower, due, started: time };
      kit.state = 'out';
      log('借出登记', borrower + ' · 应还 ' + due);
    } else if ((action.type === 'receive' && kit.state === 'out') || (action.type === 'review' && kit.state === 'review')) {
      const counts = action.counts;
      if (!Array.isArray(counts) || counts.length !== kit.parts.length) throw Error('请逐项清点配件');
      for (const [i, part] of kit.parts.entries()) {
        if (!Number.isInteger(counts[i]) || counts[i] < (kit.received?.[i] ?? 0) || counts[i] > part.qty) throw Error(part.name + '的累计实收数量无效');
      }
      const note = action.type === 'review' ? text(action.note, '复核依据') : '';
      const missing = kit.parts.map((p,i) => p.qty > counts[i] ? p.name + ' × ' + (p.qty-counts[i]) : '').filter(Boolean);
      const summary = kit.parts.map((p,i) => p.name + ' ' + counts[i] + '/' + p.qty).join('，');
      log(action.type === 'review' ? '缺件复核' : '归还清点', kit.loan.borrower + ' · ' + summary + (note ? ' · ' + note : '') + (missing.length ? ' · 待补：' + missing.join('、') : ' · 齐套入库'));
      kit.state = missing.length ? 'review' : 'ready';
      kit.received = missing.length ? [...counts] : null;
      if (!missing.length) kit.loan = null;
    } else {
      throw Error('当前状态无法执行此操作，请核对最新记录');
    }
    return kit;
  }
  return { seed, change, labels, localDate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LensDesk;
