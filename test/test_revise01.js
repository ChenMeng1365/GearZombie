/*!
 * GearZombie 测试用例 - revise-01: am-cloud 密码策略
 *
 * 运行方式: node test/test_revise01.js
 *
 * 对应设计文档: docs/design/revise-01.md
 * 对应原始需求: docs/design/TODO.md
 *
 * 不依赖外部测试框架，自带简易断言。
 */
var GZ = require('../src/gearzombie.js');

var passed = 0;
var failed = 0;
var failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error('  FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  var ok = actual === expected;
  if (!ok) {
    message = (message || '') + ' (期望: ' + JSON.stringify(expected) + ', 实际: ' + JSON.stringify(actual) + ')';
  }
  assert(ok, message);
}

function assertThrows(fn, message) {
  var threw = false;
  try { fn(); } catch (e) { threw = true; }
  assert(threw, message || '应抛出异常');
}

function section(name) {
  console.log('\n── ' + name + ' ──');
}

// 辅助函数：统计密码中出现的字符类别数
function countCategories(pw) {
  var n = 0;
  if (/[a-z]/.test(pw)) n++;
  if (/[A-Z]/.test(pw)) n++;
  if (/[0-9]/.test(pw)) n++;
  if (/[!@#$%^&*=]/.test(pw)) n++;
  return n;
}

// ─────────────────────────────────────────────
// 1. am-cloud 策略 - 基础生成
// ─────────────────────────────────────────────
section('am-cloud 策略 - 基础生成');

// 策略已注册
assert(!!GZ.getStrategy('am-cloud'), 'am-cloud 策略已注册');
assert(GZ.listStrategies().some(function (s) { return s.name === 'am-cloud'; }), '策略列表含 am-cloud');

// 生成密码
var amPwd = GZ.generate('am-cloud');
console.log('  样例: ' + amPwd);
assert(amPwd.length >= 8 && amPwd.length <= 16, 'am-cloud 长度在 8-16 区间');

// ─────────────────────────────────────────────
// 2. am-cloud - 长度区间统计（1000 次）
// ─────────────────────────────────────────────
section('am-cloud - 长度区间统计');

var amLengths = {};
var amOutOfRange = 0;
for (var ai = 0; ai < 1000; ai++) {
  var p = GZ.generate('am-cloud');
  if (p.length < 8 || p.length > 16) amOutOfRange++;
  amLengths[p.length] = (amLengths[p.length] || 0) + 1;
}
assert(amOutOfRange === 0, '1000 次生成长度全部在 8-16 区间');
console.log('  长度分布: ' + Object.keys(amLengths).sort(function (a, b) { return a - b; }).map(function (k) { return k + ':' + amLengths[k]; }).join(', '));

// 边界：指定 length=8 和 length=16 都能生成
assertEqual(GZ.generate('am-cloud', { length: 8 }).length, 8, '指定 length=8 正确');
assertEqual(GZ.generate('am-cloud', { length: 16 }).length, 16, '指定 length=16 正确');

// ─────────────────────────────────────────────
// 3. am-cloud - 四类至少三类
// ─────────────────────────────────────────────
section('am-cloud - 四类至少三类');

var amCatFailures = 0;
for (var ci = 0; ci < 1000; ci++) {
  if (countCategories(GZ.generate('am-cloud')) < 3) amCatFailures++;
}
assert(amCatFailures === 0, '1000 次生成四类至少三类');

// ─────────────────────────────────────────────
// 4. am-cloud - 字符集正确性
// ─────────────────────────────────────────────
section('am-cloud - 字符集正确性');

assert(/^[A-Za-z0-9!@#$%^&*=]+$/.test(amPwd), 'am-cloud 仅含允许字符');
// 排除相似字符
assert(!/[1lIioO0]/.test(amPwd), 'am-cloud 不含相似字符 1lIioO0');

// ─────────────────────────────────────────────
// 5. noWeakDefault - 弱口令黑名单
// ─────────────────────────────────────────────
section('noWeakDefault - 弱口令黑名单');

var wd = GZ.rulePresets.noWeakDefault;
// 黑名单词应被拒绝
assert(!wd.validate('admin'), 'admin 被拒绝');
assert(!wd.validate('Admin'), 'Admin 被拒绝');
assert(!wd.validate('ADMIN'), 'ADMIN 被拒绝');
assert(!wd.validate('root'), 'root 被拒绝');
assert(!wd.validate('Password1!'), '含 password 被拒绝');
assert(!wd.validate('admin12345'), '含 admin 被拒绝');
assert(!wd.validate('123456'), '123456 被拒绝');
assert(!wd.validate('111111'), '111111 被拒绝');
assert(!wd.validate('huawei123'), '含 huawei 被拒绝');
assert(!wd.validate('cisco'), 'cisco 被拒绝');
assert(!wd.validate('guest'), 'guest 被拒绝');
// 正常密码通过
assert(wd.validate('xK7#mQ9vR$pL'), '正常密码通过');
assert(wd.validate('aB3$cdEf7G'), '正常密码通过（不含黑名单子串）');
assert(!wd.validate('administrator'), 'administrator 含 admin 子串被拒绝');

// ─────────────────────────────────────────────
// 6. noKeyboardSequence - 键盘排序
// ─────────────────────────────────────────────
section('noKeyboardSequence - 键盘排序');

var ks = GZ.rulePresets.noKeyboardSequence;
// 正向连续
assert(!ks.validate('qwerty123'), '含 qwerty 被拒绝');
assert(!ks.validate('abcqwe9XK'), '含 qwe 被拒绝');
assert(!ks.validate('asd7Kp$vR'), '含 asd 被拒绝');
assert(!ks.validate('zxcvbn'), '含 zxc 被拒绝');
assert(!ks.validate('test1234'), '含 123 被拒绝');
// 反向连续
assert(!ks.validate('abc654Kp'), '含 654 被拒绝');
assert(!ks.validate('ewq9XK$vR'), '含 ewq 被拒绝');
assert(!ks.validate('kjh7Pp$vR'), '含 kjh 被拒绝');
// 正常密码通过
assert(ks.validate('xK7#mQ9vR$pL'), '正常密码通过');
assert(ks.validate('aB3$cdEf7G'), '正常密码通过');

// ─────────────────────────────────────────────
// 7. noUsernameRelated - 用户名相关性
// ─────────────────────────────────────────────
section('noUsernameRelated - 用户名相关性');

var ur = GZ.rulePresets.noUsernameRelated;
// 无 username 时全部通过
assert(ur.validate('anything', {}), '无 username 时通过');
assert(ur.validate('anything'), '无 options 时通过');
// 包含用户名完整串
assert(!ur.validate('admin1234', { username: 'admin' }), '含 admin 被拒绝');
assert(!ur.validate('myAdmin999', { username: 'admin' }), '含 Admin 被拒绝');
assert(!ur.validate('ADMIN9999', { username: 'admin' }), '含 ADMIN 被拒绝');
// 形似变换（o→0, l→1, i→1, e→3, a→@, s→$）
assert(!ur.validate('r00t1234X', { username: 'root' }), 'r00t 是 root 的形似变换');
assert(!ur.validate('Adm1n999K', { username: 'admin' }), 'Adm1n 是 admin 的形似变换（i→1）');
assert(!ur.validate('p@ssw0rd', { username: 'password' }), 'p@ssw0rd 是 password 的形似变换');
assert(!ur.validate('t3st9XK', { username: 'test' }), 't3st 是 test 的形似变换（e→3）');
// 正常密码通过
assert(ur.validate('xK7#mQ9vR$pL', { username: 'admin' }), '正常密码通过');

// ─────────────────────────────────────────────
// 8. noRecentHistory - 历史 N 次不重复
// ─────────────────────────────────────────────
section('noRecentHistory - 历史不重复');

var rh = GZ.rulePresets.noRecentHistory;
// 无 history 时通过
assert(rh.validate('anything', {}), '无 history 时通过');
// 等于历史密码被拒绝
assert(!rh.validate('OldPw123!', { history: ['OldPw123!'] }), '等于历史密码被拒绝');
assert(!rh.validate('P3', { history: ['P1', 'P2', 'P3'] }), '等于最近第3条被拒绝');
// 与历史不同则通过
assert(rh.validate('NewPw999!', { history: ['OldPw123!', 'Prev456#'] }), '不等于历史密码通过');
// 超过 3 条只查最近 3 条
assert(rh.validate('P0', { history: ['P0', 'P1', 'P2', 'P3'] }), '超出最近3条的不查');

// ─────────────────────────────────────────────
// 9. am-cloud - 传入上下文生成
// ─────────────────────────────────────────────
section('am-cloud - 传入上下文生成');

var ctxPwd = GZ.generate('am-cloud', {
  username: 'admin',
  history: ['OldPw123!', 'Prev456#', 'Last789@']
});
console.log('  带上下文样例: ' + ctxPwd);
assert(ctxPwd.length >= 8 && ctxPwd.length <= 16, '带上下文密码长度正确');
assert(countCategories(ctxPwd) >= 3, '带上下文密码四类至少三类');
assert(ctxPwd !== 'OldPw123!' && ctxPwd !== 'Prev456#' && ctxPwd !== 'Last789@', '不等于历史密码');
// 用户名不包含
assert(ctxPwd.toLowerCase().indexOf('admin') === -1, '不含用户名 admin');

// 100 次生成均满足全部规则
var ctxFail = 0;
for (var cxi = 0; cxi < 100; cxi++) {
  var cp = GZ.generate('am-cloud', { username: 'admin', history: ['Pw1!', 'Pw2#', 'Pw3$'] });
  if (cp.toLowerCase().indexOf('admin') !== -1) ctxFail++;
  if (cp === 'Pw1!' || cp === 'Pw2#' || cp === 'Pw3$') ctxFail++;
  if (cp.length < 8 || cp.length > 16) ctxFail++;
  if (countCategories(cp) < 3) ctxFail++;
}
assert(ctxFail === 0, '100 次带上下文生成全部满足规则');

// ─────────────────────────────────────────────
// 10. am-cloud - Vault.rotatePassword 自动注入上下文
// ─────────────────────────────────────────────
section('am-cloud - Vault.rotatePassword 自动注入上下文');

var amVault = new GZ.Vault();
var amSite = amVault.addWebsite({ name: 'CloudPlatform', strategy: 'am-cloud' });
var amAcc = amVault.addAccount(amSite.id, { username: 'administrator' });

// 首次轮换
var amPwd1 = amVault.rotatePassword(amSite.id, amAcc.id);
console.log('  Vault 生成样例: ' + amPwd1);
assert(amPwd1.length >= 8 && amPwd1.length <= 16, 'Vault 首次生成长度正确');
assert(amPwd1.toLowerCase().indexOf('administrator') === -1, 'Vault 生成不含用户名');
assert(countCategories(amPwd1) >= 3, 'Vault 生成四类至少三类');

// 多次轮换，验证不与前3次相同
var amPwd2 = amVault.rotatePassword(amSite.id, amAcc.id);
var amPwd3 = amVault.rotatePassword(amSite.id, amAcc.id);
var amPwd4 = amVault.rotatePassword(amSite.id, amAcc.id);

var amAccData = amVault.getAccount(amSite.id, amAcc.id);
assertEqual(amAccData.history.length, 3, '轮换4次后历史有3条');
assert(amPwd4 !== amPwd3, '第4次不等于第3次');
assert(amPwd4 !== amPwd2, '第4次不等于第2次');
assert(amPwd4 !== amPwd1, '第4次不等于第1次');
assert(amPwd4.toLowerCase().indexOf('administrator') === -1, '第4次生成仍不含用户名');

// ─────────────────────────────────────────────
// 11. am-cloud - 指定 length 覆盖随机范围
// ─────────────────────────────────────────────
section('am-cloud - 指定 length 覆盖随机范围');

assertEqual(GZ.generate('am-cloud', { length: 10 }).length, 10, '指定 length=10');
assertEqual(GZ.generate('am-cloud', { length: 12, username: 'admin' }).length, 12, '指定 length=12 带上下文');

// 旧策略用 length 不受影响
assertEqual(GZ.generate('bchrt', { length: 20 }).length, 20, 'bchrt 仍支持自定义长度');

// ─────────────────────────────────────────────
// 12. 向后兼容 - 旧规则 validate(pw) 无 options 仍正常
// ─────────────────────────────────────────────
section('am-cloud - 旧规则向后兼容');

assert(GZ.rulePresets.noConsecutive.validate('Ab3$Ef7'), 'noConsecutive 无 options 仍正常');
assert(!GZ.rulePresets.noConsecutive.validate('ABB3$Ef7'), 'noConsecutive 无 options 仍拒绝重复');

// noWeakDefault / noKeyboardSequence 不读 options，无需 options 也能工作
assert(!GZ.rulePresets.noWeakDefault.validate('admin123'), 'noWeakDefault 无 options 正常');
assert(!GZ.rulePresets.noKeyboardSequence.validate('qwerty789'), 'noKeyboardSequence 无 options 正常');

// ─────────────────────────────────────────────
// 13. am-cloud - Strategy.needsContext 标志
// ─────────────────────────────────────────────
section('am-cloud - needsContext 标志');

var amStrategy = GZ.getStrategy('am-cloud');
assertEqual(amStrategy.needsContext, true, 'am-cloud needsContext=true');
assertEqual(amStrategy.minCategories, 3, 'am-cloud minCategories=3');
assertEqual(amStrategy.minLength, 8, 'am-cloud minLength=8');
assertEqual(amStrategy.maxLength, 16, 'am-cloud maxLength=16');
assertEqual(amStrategy.rules.length, 4, 'am-cloud 有4条规则');

// 旧策略无 needsContext
assert(!GZ.getStrategy('bchrt').needsContext, 'bchrt 无 needsContext');
assert(!GZ.getStrategy('pin').needsContext, 'pin 无 needsContext');

// ─────────────────────────────────────────────
// 14. am-cloud - derive 派生
// ─────────────────────────────────────────────
section('am-cloud - derive 派生');

GZ.registry.registerDerived('am-cloud', {
  name: 'am-cloud-strict',
  description: 'am-cloud 派生：固定16位',
  minLength: 16,
  maxLength: 16
});
var strictAmPwd = GZ.generate('am-cloud-strict', { username: 'admin' });
assertEqual(strictAmPwd.length, 16, '派生策略固定16位');
assert(countCategories(strictAmPwd) >= 3, '派生策略四类至少三类');
assert(strictAmPwd.toLowerCase().indexOf('admin') === -1, '派生策略不含用户名');
console.log('  派生策略样例: ' + strictAmPwd);
GZ.registry.unregister('am-cloud-strict');

// ─────────────────────────────────────────────
// 15. am-cloud - 回滚机制
// ─────────────────────────────────────────────
section('am-cloud - 回滚机制');

assert(GZ.registry.unregister('am-cloud'), 'unregister am-cloud 返回 true');
assertEqual(GZ.registry.get('am-cloud'), null, '注销后查询返回 null');
assertThrows(function () { GZ.generate('am-cloud'); }, '注销后调用应抛异常');

// ─────────────────────────────────────────────
// 结果汇总
// ─────────────────────────────────────────────
console.log('\n═════════════════════════════════════════');
console.log('  通过: ' + passed + ' | 失败: ' + failed);
console.log('═════════════════════════════════════════');
if (failed > 0) {
  console.log('\n失败项:');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
} else {
  console.log('\n全部测试通过 ✦');
  process.exit(0);
}
