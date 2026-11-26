const test = require('node:test');
const assert = require('node:assert/strict');
const { seed, change, localDate } = require('../workflow');
const now = new Date(2026,10,26,10);
const lend = {type:'lend', actor:'甲', borrower:'校报', due:localDate(now)};
const run = (k,a) => change(k,a,now);
const camera = () => seed(now)[0];
const receive = (counts) => ({type:'receive',actor:'乙',counts});
const review = (counts) => ({type:'review',actor:'丙',counts,note:'交接时复点'});
test('首次建档展示可借、逾期借出和缺件三种案例', () => {
  const [a,b,c] = seed(now);
  assert.deepEqual([a.state,b.state,c.state],['ready','out','review']);
  assert.ok(b.loan.due < localDate(now));
  assert.deepEqual(c.received,[2,2,1]);
});
test('整套归还后可再次借出，保留前一借用团队与清点记录', () => {
  const returned = run(run(camera(),lend),receive([1,1,2,1]));
  assert.equal(returned.state,'ready'); assert.equal(returned.loan,null);
  assert.match(returned.events.at(-1).detail,/校报.*电池 2\/2/);
  assert.equal(run(returned,lend).events.length,4);
});
test('缺卡进入待复核，拒绝再借，补齐后完成并保留初次缺口', () => {
  const pending = run(run(camera(),lend),receive([1,1,2,0]));
  assert.equal(pending.state,'review'); assert.throws(()=>run(pending,lend));
  const done = run(pending,review([1,1,2,1]));
  assert.equal(done.state,'ready'); assert.match(done.events.at(-2).detail,/SD 存储卡 × 1/);
  assert.match(done.events.at(-1).detail,/交接时复点/); assert.equal(pending.state,'review');
});
test('部分补件仍需复核，累计实收不允许倒退', () => {
  const pending = run(run(camera(),lend),receive([1,1,0,0]));
  const partial = run(pending,review([1,1,1,0]));
  assert.equal(partial.state,'review');
  assert.throws(()=>run(partial,review([1,1,0,0])));
});
test('拒绝遗漏、负数、超额和小数清点值', () => {
  for (const counts of [[1,1],[1,1,2,-1],[1,1,2,2],[1,1,1.5,1]]) assert.throws(()=>run(run(camera(),lend),receive(counts)));
});
test('拒绝过期与无效日期、空团队、空经办人', () => {
  for (const edits of [{due:'2026-11-25'},{due:'2027-02-30'},{due:''},{borrower:' '},{actor:''}]) assert.throws(()=>run(camera(),{...lend,...edits}));
});
test('拒绝重复借出、重复归还和缺少复核依据', () => {
  const out = run(camera(),lend), pending=run(out,receive([1,1,2,0]));
  assert.throws(()=>run(out,lend)); assert.throws(()=>run(pending,receive([1,1,2,1])));
  assert.throws(()=>run(pending,{...review([1,1,2,1]),note:' '}));
});
