/*!
 * GearZombie 测试用例 - revise-02: srdcloud 密码策略
 *
 * 运行方式: node test/test_revise02.js
 *
 * 对应设计文档: docs/design/revise-02.md
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

// 辅助函数：检查密码中是否包含大写、小写、数字
function hasUpper(pw) { return /[A-Z]/.test(pw); }
function hasLower(pw) { return /[a-z]/.test(pw); }
function hasDigit(pw) { return /[0-9]/.test(pw); }

// srdcloud 特殊字符集
var SRD_SYMBOLS = "!#$%&'()*+,-./:;<=>?@[]^_\\`{|}~";

// ─────────────────────────────────────────────
// 1. srdcloud 策略 - 基础生成
// ─────────────────────────────────────────────
section('srdcloud 策略 - 基础生成');

// 策略已注册
assert(!!GZ.getStrategy('srdcloud'), 'srdcloud 策略已注册');
assert(GZ.listStrategies().some(function (s) { return s.name === 'srdcloud'; }), '策略列表含 srdcloud');

// 生成密码
var srdPwd = GZ.generate('srdcloud');
console.log('  样例: ' + srdPwd);
assert(srdPwd.length >= 9 && srdPwd.length <= 32, 'srdcloud 长度在 9-32 区间');

// ─────────────────────────────────────────────
// 2. srdcloud - 长度区间统计（1000 次）
// ─────────────────────────────────────────────
section('srdcloud - 长度区间统计');

var srdLengths = {};
var srdOutOfRange = 0;
for (var si = 0; si < 1000; si++) {
  var p = GZ.generate('srdcloud');
  if (p.length < 9 || p.length > 32) srdOutOfRange++;
  srdLengths[p.length] = (srdLengths[p.length] || 0) + 1;
}
assert(srdOutOfRange === 0, '1000 次生成长度全部在 9-32 区间');
console.log('  长度分布: ' + Object.keys(srdLengths).sort(function (a, b) { return a - b; }).map(function (k) { return k + ':' + srdLengths[k]; }).join(', '));

// 边界：指定 length=9 和 length=32 都能生成
assertEqual(GZ.generate('srdcloud', { length: 9 }).length, 9, '指定 length=9 正确');
assertEqual(GZ.generate('srdcloud', { length: 32 }).length, 32, '指定 length=32 正确');

// ─────────────────────────────────────────────
// 3. srdcloud - 必选字符类别
// ─────────────────────────────────────────────
section('srdcloud - 必选字符类别');

var srdCatFailures = 0;
for (var ci = 0; ci < 1000; ci++) {
  var cp = GZ.generate('srdcloud');
  if (!hasUpper(cp) || !hasLower(cp) || !hasDigit(cp)) srdCatFailures++;
}
assert(srdCatFailures === 0, '1000 次生成均包含大写+小写+数字');

// ─────────────────────────────────────────────
// 4. srdcloud - 字符集正确性
// ─────────────────────────────────────────────
section('srdcloud - 字符集正确性');

var srdCharsetRe = new RegExp('^[A-Za-z0-9' + SRD_SYMBOLS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+$');
assert(srdCharsetRe.test(srdPwd), 'srdcloud 仅含允许字符（大写/小写/数字/特殊字符集）');

// 1000 次生成全部字符合法
var srdCharsetFail = 0;
for (var chi = 0; chi < 1000; chi++) {
  if (!srdCharsetRe.test(GZ.generate('srdcloud'))) srdCharsetFail++;
}
assert(srdCharsetFail === 0, '1000 次生成字符集全部合法');

// 特殊字符集内容正确
assertEqual(GZ.charPresets.symbolsSrdcloud.length, 31, 'symbolsSrdcloud 有 31 个字符（含反斜杠和反引号）');
assert(GZ.charPresets.symbolsSrdcloud.indexOf('!') !== -1, 'symbolsSrdcloud 含 !');
assert(GZ.charPresets.symbolsSrdcloud.indexOf('~') !== -1, 'symbolsSrdcloud 含 ~');
assert(GZ.charPresets.symbolsSrdcloud.indexOf('`') !== -1, 'symbolsSrdcloud 含 `');
assert(GZ.charPresets.symbolsSrdcloud.indexOf('\\') !== -1, 'symbolsSrdcloud 含 \\');
assert(GZ.charPresets.symbolsSrdcloud.indexOf('@') !== -1, 'symbolsSrdcloud 含 @');

// ─────────────────────────────────────────────
// 5. noKeyboardDiagonal - 键盘斜线排序
// ─────────────────────────────────────────────
section('noKeyboardDiagonal - 键盘斜线排序');

var kd = GZ.rulePresets.noKeyboardDiagonal;
// 正向斜线（3 字符子串）
assert(!kd.validate('1qa9XkPz'), '含 1qa 被拒绝');
assert(!kd.validate('xKqaz9Pm'), '含 qaz 被拒绝');
assert(!kd.validate('2ws7Kp$vR'), '含 2ws 被拒绝');
assert(!kd.validate('7Kpwsx$vR'), '含 wsx 被拒绝');
assert(!kd.validate('3ed8Kp$vR'), '含 3ed 被拒绝');
assert(!kd.validate('4rf8Kp$vR'), '含 4rf 被拒绝');
assert(!kd.validate('5tg8Kp$vR'), '含 5tg 被拒绝');
assert(!kd.validate('6yh8Kp$vR'), '含 6yh 被拒绝');
assert(!kd.validate('7uj8Kp$vR'), '含 7uj 被拒绝');
assert(!kd.validate('8ik9Kp$vR'), '含 8ik 被拒绝');
// 反向斜线
assert(!kd.validate('zaq9XkPz'), '含 zaq（1qa 反向）被拒绝');
assert(!kd.validate('xsw9XkPz'), '含 xsw（2ws 反向）被拒绝');
assert(!kd.validate('cde9XkPz'), '含 cde（3ed 反向）被拒绝');
// 正常密码通过
assert(kd.validate('xK7#mQ9vR$pL'), '正常密码通过');
// 注意：aB3$cdEf7G 含 cde（3edc 的反向），会被拒绝
assert(kd.validate('xK7#mQ9vR$pL'), '正常密码通过（无斜线序列）');

// ─────────────────────────────────────────────
// 6. noTripleRepeat - 3 连重
// ─────────────────────────────────────────────
section('noTripleRepeat - 3 连重');

var tr = GZ.rulePresets.noTripleRepeat;
// 3 连重被拒绝
assert(!tr.validate('aaaBBc9'), 'aaa 被拒绝');
assert(!tr.validate('B111cDe'), '111 被拒绝');
assert(!tr.validate('abc###de'), '### 被拒绝');
assert(!tr.validate('ABCCCde'), 'CCC 被拒绝');
assert(!tr.validate('xx999yy'), '999 被拒绝');
// 2 连重允许
assert(tr.validate('aaBBc9'), 'aa 允许（2 连重）');
assert(tr.validate('B11cDe'), '11 允许（2 连重）');
assert(tr.validate('abc##de'), '## 允许（2 连重）');
// 无重复通过
assert(tr.validate('aB3cdEf7G'), '无重复通过');
assert(tr.validate('xK7mQ9vRpL'), '无重复通过');

// ─────────────────────────────────────────────
// 7. noUsernameSubstr - 用户名 3 位子串
// ─────────────────────────────────────────────
section('noUsernameSubstr - 用户名 3 位子串');

var us = GZ.rulePresets.noUsernameSubstr;
// 无 username 时通过
assert(us.validate('anything', {}), '无 username 时通过');
assert(us.validate('anything'), '无 options 时通过');
// username < 3 位时通过
assert(us.validate('abcdef', { username: 'ab' }), 'username <3 位时通过');
// 包含用户名任意 3 位连续子串被拒绝
assert(!us.validate('adm9XkPz', { username: 'admin' }), '含 adm（admin 的 3 位子串）被拒绝');
assert(!us.validate('xKdmi7Pz', { username: 'admin' }), '含 dmi 被拒绝');
assert(!us.validate('xKmin7Pz', { username: 'admin' }), '含 min 被拒绝');
assert(!us.validate('xKist7Pz', { username: 'existing' }), '含 ist（existing 的 3 位子串）被拒绝');
assert(!us.validate('xKstr7Pz', { username: 'administrator' }), '含 str（administrator 的子串）被拒绝');
// 大小写不敏感
assert(!us.validate('ADM9xKpz', { username: 'admin' }), 'ADM（大写）被拒绝');
assert(!us.validate('xKMin7Pz', { username: 'admin' }), 'Min（混合大小写）被拒绝');
// 不含子串则通过
assert(us.validate('xK7#mQ9vR$pL', { username: 'admin' }), '正常密码通过');
assert(us.validate('zB9$cEf3G7k', { username: 'administrator' }), '正常密码通过');

// ─────────────────────────────────────────────
// 8. srdcloud - 传入上下文生成
// ─────────────────────────────────────────────
section('srdcloud - 传入上下文生成');

var ctxPwd = GZ.generate('srdcloud', {
  username: 'admin',
  history: ['OldPw123!', 'Prev456#', 'Last789@']
});
console.log('  带上下文样例: ' + ctxPwd);
assert(ctxPwd.length >= 9 && ctxPwd.length <= 32, '带上下文密码长度正确');
assert(hasUpper(ctxPwd) && hasLower(ctxPwd) && hasDigit(ctxPwd), '带上下文密码含大写+小写+数字');
assert(ctxPwd !== 'OldPw123!' && ctxPwd !== 'Prev456#' && ctxPwd !== 'Last789@', '不等于历史密码');

// 用户名 3 位子串检查
var ctxUsername = 'admin';
var ctxHasSubstr = false;
for (var ui = 0; ui <= ctxUsername.length - 3; ui++) {
  if (ctxPwd.toLowerCase().indexOf(ctxUsername.substr(ui, 3)) !== -1) {
    ctxHasSubstr = true;
    break;
  }
}
assert(!ctxHasSubstr, '不含用户名 admin 的任意 3 位连续子串');

// 100 次生成均满足全部规则
var ctxFail = 0;
for (var cxi = 0; cxi < 100; cxi++) {
  var cp = GZ.generate('srdcloud', { username: 'testuser', history: ['Pw1!', 'Pw2#', 'Pw3$'] });
  // 不等于历史密码
  if (cp === 'Pw1!' || cp === 'Pw2#' || cp === 'Pw3$') ctxFail++;
  // 长度
  if (cp.length < 9 || cp.length > 32) ctxFail++;
  // 必选类别
  if (!hasUpper(cp) || !hasLower(cp) || !hasDigit(cp)) ctxFail++;
  // 用户名 3 位子串
  var uname = 'testuser';
  for (var uj = 0; uj <= uname.length - 3; uj++) {
    if (cp.toLowerCase().indexOf(uname.substr(uj, 3)) !== -1) { ctxFail++; break; }
  }
  // 3 连重
  for (var tk = 2; tk < cp.length; tk++) {
    if (cp[tk] === cp[tk-1] && cp[tk] === cp[tk-2]) { ctxFail++; break; }
  }
}
assert(ctxFail === 0, '100 次带上下文生成全部满足规则');

// ─────────────────────────────────────────────
// 9. srdcloud - Vault.rotatePassword 自动注入上下文
// ─────────────────────────────────────────────
section('srdcloud - Vault.rotatePassword 自动注入上下文');

var srdVault = new GZ.Vault();
var srdSite = srdVault.addWebsite({ name: 'SRDCloud', strategy: 'srdcloud' });
var srdAcc = srdVault.addAccount(srdSite.id, { username: 'administrator' });

// 首次轮换
var srdPwd1 = srdVault.rotatePassword(srdSite.id, srdAcc.id);
console.log('  Vault 生成样例: ' + srdPwd1);
assert(srdPwd1.length >= 9 && srdPwd1.length <= 32, 'Vault 首次生成长度正确');
assert(hasUpper(srdPwd1) && hasLower(srdPwd1) && hasDigit(srdPwd1), 'Vault 生成含大写+小写+数字');

// 验证不含用户名 3 位子串
var vaultUsername = 'administrator';
var vaultHasSubstr = false;
for (var vi = 0; vi <= vaultUsername.length - 3; vi++) {
  if (srdPwd1.toLowerCase().indexOf(vaultUsername.substr(vi, 3)) !== -1) {
    vaultHasSubstr = true;
    break;
  }
}
assert(!vaultHasSubstr, 'Vault 生成不含用户名 administrator 的任意 3 位子串');

// 多次轮换，验证不与前 3 次相同
var srdPwd2 = srdVault.rotatePassword(srdSite.id, srdAcc.id);
var srdPwd3 = srdVault.rotatePassword(srdSite.id, srdAcc.id);
var srdPwd4 = srdVault.rotatePassword(srdSite.id, srdAcc.id);

var srdAccData = srdVault.getAccount(srdSite.id, srdAcc.id);
assertEqual(srdAccData.history.length, 3, '轮换4次后历史有3条');
assert(srdPwd4 !== srdPwd3, '第4次不等于第3次');
assert(srdPwd4 !== srdPwd2, '第4次不等于第2次');
assert(srdPwd4 !== srdPwd1, '第4次不等于第1次');

// ─────────────────────────────────────────────
// 10. srdcloud - 指定 length 覆盖随机范围
// ─────────────────────────────────────────────
section('srdcloud - 指定 length 覆盖随机范围');

assertEqual(GZ.generate('srdcloud', { length: 12 }).length, 12, '指定 length=12');
assertEqual(GZ.generate('srdcloud', { length: 20, username: 'admin' }).length, 20, '指定 length=20 带上下文');
assertEqual(GZ.generate('srdcloud', { length: 32 }).length, 32, '指定 length=32（最大）');
assertEqual(GZ.generate('srdcloud', { length: 9 }).length, 9, '指定 length=9（最小）');

// 旧策略用 length 不受影响
assertEqual(GZ.generate('bchrt', { length: 20 }).length, 20, 'bchrt 仍支持自定义长度');

// ─────────────────────────────────────────────
// 11. srdcloud - Strategy 配置标志
// ─────────────────────────────────────────────
section('srdcloud - Strategy 配置标志');

var srdStrategy = GZ.getStrategy('srdcloud');
assertEqual(srdStrategy.needsContext, true, 'srdcloud needsContext=true');
assertEqual(srdStrategy.minLength, 9, 'srdcloud minLength=9');
assertEqual(srdStrategy.maxLength, 32, 'srdcloud maxLength=32');
assertEqual(srdStrategy.required.length, 3, 'srdcloud required 有 3 类（upper/lower/digits）');
assertEqual(srdStrategy.rules.length, 6, 'srdcloud 有 6 条规则');

// 验证 required 不含 symbols（符号可选）
assert(srdStrategy.required.indexOf('symbols') === -1, 'symbols 不在 required 中（可选）');
// 验证 charsets 含 symbols
assert(!!srdStrategy.charsets.symbols, 'charsets 含 symbols');

// ─────────────────────────────────────────────
// 12. srdcloud - 向后兼容（旧规则无 options 仍正常）
// ─────────────────────────────────────────────
section('srdcloud - 旧规则向后兼容');

// noKeyboardDiagonal / noTripleRepeat 不读 options，无需 options 也能工作
assert(!GZ.rulePresets.noKeyboardDiagonal.validate('1qaz9Xk'), 'noKeyboardDiagonal 无 options 正常');
assert(!GZ.rulePresets.noTripleRepeat.validate('aaa9XkPz'), 'noTripleRepeat 无 options 正常');
assert(GZ.rulePresets.noKeyboardDiagonal.validate('xK7mQ9vRpL'), 'noKeyboardDiagonal 正常密码通过');
assert(GZ.rulePresets.noTripleRepeat.validate('aB3cdEf7G'), 'noTripleRepeat 正常密码通过');

// noUsernameSubstr 需要 options
assert(GZ.rulePresets.noUsernameSubstr.validate('anything'), 'noUsernameSubstr 无 options 时通过');

// ─────────────────────────────────────────────
// 13. srdcloud - derive 派生
// ─────────────────────────────────────────────
section('srdcloud - derive 派生');

GZ.registry.registerDerived('srdcloud', {
  name: 'srdcloud-fixed20',
  description: 'srdcloud 派生：固定20位',
  minLength: 20,
  maxLength: 20
});
var fixedPwd = GZ.generate('srdcloud-fixed20', { username: 'admin' });
assertEqual(fixedPwd.length, 20, '派生策略固定20位');
assert(hasUpper(fixedPwd) && hasLower(fixedPwd) && hasDigit(fixedPwd), '派生策略含必选类别');
console.log('  派生策略样例: ' + fixedPwd);
GZ.registry.unregister('srdcloud-fixed20');

// ─────────────────────────────────────────────
// 14. srdcloud - 回滚机制
// ─────────────────────────────────────────────
section('srdcloud - 回滚机制');

assert(GZ.registry.unregister('srdcloud'), 'unregister srdcloud 返回 true');
assertEqual(GZ.registry.get('srdcloud'), null, '注销后查询返回 null');
assertThrows(function () { GZ.generate('srdcloud'); }, '注销后调用应抛异常');

// ─────────────────────────────────────────────
// 15. compact 版一致性验证
// ─────────────────────────────────────────────
section('srdcloud - compact 版一致性');

var GZc = require('../src/gearzombie.compact.js');
assert(!!GZc.getStrategy('srdcloud'), 'compact 版 srdcloud 策略已注册');
assert(GZc.listStrategies().some(function (s) { return s.name === 'srdcloud'; }), 'compact 版策略列表含 srdcloud');
assertEqual(GZc.charPresets.symbolsSrdcloud, GZ.charPresets.symbolsSrdcloud, 'compact 版 symbolsSrdcloud 一致');
assertEqual(GZc.rulePresets.noKeyboardDiagonal.name, 'noKeyboardDiagonal', 'compact 版含 noKeyboardDiagonal');
assertEqual(GZc.rulePresets.noTripleRepeat.name, 'noTripleRepeat', 'compact 版含 noTripleRepeat');
assertEqual(GZc.rulePresets.noUsernameSubstr.name, 'noUsernameSubstr', 'compact 版含 noUsernameSubstr');

var compactPwd = GZc.generate('srdcloud', { username: 'testuser', history: [] });
assert(compactPwd.length >= 9 && compactPwd.length <= 32, 'compact 版生成长度正确');
assert(hasUpper(compactPwd) && hasLower(compactPwd) && hasDigit(compactPwd), 'compact 版生成含必选类别');
console.log('  compact 版样例: ' + compactPwd);

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
