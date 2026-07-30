/*!
 * GearZombie 基础测试用例
 *
 * 运行方式: node test/test_basic.js
 *
 * 不依赖外部测试框架，自带简易断言。
 * 浏览器端相同逻辑可通过 test/browser-test.html 引入运行。
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

// ─────────────────────────────────────────────
// 1. 密码生成器 - 基础功能
// ─────────────────────────────────────────────
section('密码生成器 - bchrt 策略');

var pwd = GZ.generate('bchrt');
assert(pwd.length === 16, 'bchrt 默认长度为 16');
assert(/^[A-Za-z0-9!@#$%^&*=]+$/.test(pwd), 'bchrt 密码仅含允许字符');

// 排除相似字符 1lIioO0
assert(!/[1lIioO0]/.test(pwd), 'bchrt 不含相似字符 1lIioO0');

// 必含每类字符
assert(/[A-Z]/.test(pwd), 'bchrt 含大写字母');
assert(/[a-z]/.test(pwd), 'bchrt 含小写字母');
assert(/[2-9]/.test(pwd), 'bchrt 含数字');
assert(/[!@#$%^&*=]/.test(pwd), 'bchrt 含符号');

console.log('  样例: ' + pwd);

// ─────────────────────────────────────────────
// 2. 密码长度自定义
// ─────────────────────────────────────────────
section('密码长度自定义');

var shortPwd = GZ.generate('bchrt', { length: 8 });
assert(shortPwd.length === 8, '可自定义长度 8');

var longPwd = GZ.generate('bchrt', { length: 64 });
assert(longPwd.length === 64, '可自定义长度 64');

// ─────────────────────────────────────────────
// 3. 随机性 - 同一策略生成多个密码应不同（概率检验）
// ─────────────────────────────────────────────
section('随机性验证');

var passwords = {};
var collisions = 0;
for (var i = 0; i < 1000; i++) {
  var p = GZ.generate('bchrt', { length: 16 });
  if (passwords[p]) collisions++;
  passwords[p] = true;
}
assert(collisions === 0, '1000 次生成无碰撞');

// ─────────────────────────────────────────────
// 4. 自定义策略注册
// ─────────────────────────────────────────────
section('自定义策略注册');

GZ.registerStrategy({
  name: 'custom-test',
  description: '测试用自定义策略',
  charsets: {
    letters: 'XYZ',
    nums: '789'
  },
  required: ['letters', 'nums'],
  exclude: '',
  defaultLength: 8
});

var customPwd = GZ.generate('custom-test');
assert(customPwd.length === 8, '自定义策略默认长度 8');
assert(/^[XYZ789]+$/.test(customPwd), '自定义策略仅含指定字符');
assert(/[XYZ]/.test(customPwd), '自定义策略含 letters');
assert(/[789]/.test(customPwd), '自定义策略含 nums');
console.log('  样例: ' + customPwd);

assertThrows(function () { GZ.generate('nonexistent'); }, '未知策略应抛异常');

// ─────────────────────────────────────────────
// 5. 策略列表
// ─────────────────────────────────────────────
section('策略列表');

var list = GZ.listStrategies();
assert(list.length >= 3, '至少有 3 个内置策略');
assert(list.some(function (s) { return s.name === 'bchrt'; }), '列表含 bchrt');
assert(list.some(function (s) { return s.name === 'simple'; }), '列表含 simple');
assert(list.some(function (s) { return s.name === 'pin'; }), '列表含 pin');

// ─────────────────────────────────────────────
// 6. simple 策略（无符号）
// ─────────────────────────────────────────────
section('simple 策略');

var simplePwd = GZ.generate('simple');
assert(simplePwd.length === 12, 'simple 默认长度 12');
assert(/^[A-Za-z0-9]+$/.test(simplePwd), 'simple 不含符号');
assert(!/[!@#$%^&*=]/.test(simplePwd), 'simple 确认无符号');
console.log('  样例: ' + simplePwd);

// ─────────────────────────────────────────────
// 7. PIN 策略
// ─────────────────────────────────────────────
section('PIN 策略');

var pinPwd = GZ.generate('pin');
assert(pinPwd.length === 6, 'PIN 默认长度 6');
assert(/^[0-9]+$/.test(pinPwd), 'PIN 仅含数字');
console.log('  样例: ' + pinPwd);

// ─────────────────────────────────────────────
// 8. Vault - 创建空数据
// ─────────────────────────────────────────────
section('Vault - 创建与结构');

var vault = new GZ.Vault();
var data = GZ.createEmptyData();
assertEqual(data.version, 1, '数据版本为 1');
assert(Array.isArray(data.websites), 'websites 是数组');
assertEqual(data.websites.length, 0, '初始 websites 为空');

// ─────────────────────────────────────────────
// 9. Vault - 网站增删改查
// ─────────────────────────────────────────────
section('Vault - 网站增删改查');

var site = vault.addWebsite({ name: 'GitHub', url: 'https://github.com', strategy: 'bchrt' });
assert(!!site.id, '网站有 id');
assertEqual(site.name, 'GitHub', '网站名称正确');
assertEqual(site.url, 'https://github.com', '网站 URL 正确');
assertEqual(site.strategy, 'bchrt', '网站策略正确');
assert(Array.isArray(site.accounts), '网站含 accounts 数组');

// 查询
assertEqual(vault.listWebsites().length, 1, '列表含 1 个网站');
assertEqual(vault.getWebsite(site.id).name, 'GitHub', '可按 ID 查询网站');

// 更新
vault.updateWebsite(site.id, { name: 'GitHub Inc', strategy: 'simple' });
assertEqual(vault.getWebsite(site.id).name, 'GitHub Inc', '网站名称已更新');
assertEqual(vault.getWebsite(site.id).strategy, 'simple', '网站策略已更新');

// 删除
vault.deleteWebsite(site.id);
assertEqual(vault.listWebsites().length, 0, '删除后列表为空');
assertThrows(function () { vault.updateWebsite(site.id, {}); }, '删除后更新应抛异常');

// ─────────────────────────────────────────────
// 10. Vault - 账号增删改查
// ─────────────────────────────────────────────
section('Vault - 账号增删改查');

var s1 = vault.addWebsite({ name: 'GitLab', url: 'gitlab.com' });
var acc = vault.addAccount(s1.id, { username: 'user1', note: '主账号' });
assert(!!acc.id, '账号有 id');
assertEqual(acc.username, 'user1', '账号用户名正确');
assertEqual(acc.note, '主账号', '账号备注正确');
assertEqual(acc.currentPassword, '', '新账号当前密码为空');
assert(Array.isArray(acc.history), '账号含历史记录数组');
assertEqual(acc.history.length, 0, '新账号历史为空');

// 查询
var fetched = vault.getAccount(s1.id, acc.id);
assertEqual(fetched.username, 'user1', '可按 ID 查询账号');

// 更新
vault.updateAccount(s1.id, acc.id, { username: 'user1-updated' });
assertEqual(vault.getAccount(s1.id, acc.id).username, 'user1-updated', '账号用户名已更新');

// 删除
vault.deleteAccount(s1.id, acc.id);
assertEqual(vault.getAccount(s1.id, acc.id), null, '删除后查询返回 null');

// 操作不存在的网站/账号
assertThrows(function () { vault.addAccount('fake-id', {}); }, '对不存在网站添加账号应抛异常');
assertThrows(function () { vault.updateAccount('fake-id', 'fake-id', {}); }, '更新不存在账号应抛异常');

// ─────────────────────────────────────────────
// 11. Vault - 密码轮换与历史记录
// ─────────────────────────────────────────────
section('Vault - 密码轮换与历史记录');

var s2 = vault.addWebsite({ name: 'AWS', strategy: 'bchrt' });
var a2 = vault.addAccount(s2.id, { username: 'root' });

// 首次轮换（无旧密码，不产生历史）
var pwd1 = vault.rotatePassword(s2.id, a2.id);
var acc2 = vault.getAccount(s2.id, a2.id);
assertEqual(acc2.currentPassword, pwd1, '当前密码为新生成的');
assertEqual(acc2.history.length, 0, '首次轮换无历史记录');

// 第二次轮换，旧密码入历史
var pwd2 = vault.rotatePassword(s2.id, a2.id);
acc2 = vault.getAccount(s2.id, a2.id);
assertEqual(acc2.currentPassword, pwd2, '当前密码为最新生成的');
assertEqual(acc2.history.length, 1, '第二次轮换后历史有 1 条');
assertEqual(acc2.history[0].password, pwd1, '历史记录含旧密码');
assert(pwd1 !== pwd2, '两次生成的密码不同');

// 第三次轮换
var pwd3 = vault.rotatePassword(s2.id, a2.id);
acc2 = vault.getAccount(s2.id, a2.id);
assertEqual(acc2.history.length, 2, '第三次轮换后历史有 2 条');
assertEqual(acc2.history[1].password, pwd2, '历史记录含上一次密码');

// 使用指定长度
var pwd4 = vault.rotatePassword(s2.id, a2.id, { length: 32 });
assertEqual(pwd4.length, 32, '可指定轮换密码长度');

// 使用不同策略
var pwd5 = vault.rotatePassword(s2.id, a2.id, { strategy: 'pin' });
assert(/^[0-9]+$/.test(pwd5), '可指定策略轮换');

// ─────────────────────────────────────────────
// 12. Vault - 手动设置密码
// ─────────────────────────────────────────────
section('Vault - 手动设置密码');

var s3 = vault.addWebsite({ name: 'Manual' });
var a3 = vault.addAccount(s3.id, { username: 'user3' });

vault.setPassword(s3.id, a3.id, 'MyCustomPass!123');
assertEqual(vault.getAccount(s3.id, a3.id).currentPassword, 'MyCustomPass!123', '手动设置密码生效');

// 再设置不同密码，旧密码入历史
vault.setPassword(s3.id, a3.id, 'AnotherPass456');
assertEqual(vault.getAccount(s3.id, a3.id).currentPassword, 'AnotherPass456', '第二次手动设置生效');
assertEqual(vault.getAccount(s3.id, a3.id).history.length, 1, '旧密码入历史');
assertEqual(vault.getAccount(s3.id, a3.id).history[0].password, 'MyCustomPass!123', '历史含旧手动密码');

// 设置相同密码不产生历史
vault.setPassword(s3.id, a3.id, 'AnotherPass456');
assertEqual(vault.getAccount(s3.id, a3.id).history.length, 1, '设置相同密码不产生历史');

// ─────────────────────────────────────────────
// 13. Vault - 导入导出
// ─────────────────────────────────────────────
section('Vault - 导入导出');

var vault2 = new GZ.Vault();
vault2.addWebsite({ name: 'Exported', url: 'exported.com', strategy: 'pin' });
var site2 = vault2.listWebsites()[0];
vault2.addAccount(site2.id, { username: 'expuser' });
vault2.rotatePassword(site2.id, vault2.getWebsite(site2.id).accounts[0].id);
vault2.rotatePassword(site2.id, vault2.getWebsite(site2.id).accounts[0].id);

var jsonStr = vault2.exportData();
assert(typeof jsonStr === 'string', 'exportData 返回字符串');
var parsed = JSON.parse(jsonStr);
assertEqual(parsed.version, 1, '导出含 version');
assert(Array.isArray(parsed.websites), '导出含 websites');
assertEqual(parsed.websites[0].name, 'Exported', '导出数据正确');

// 导入
var vault3 = new GZ.Vault();
vault3.importData(jsonStr);
assertEqual(vault3.listWebsites().length, 1, '导入后含 1 个网站');
assertEqual(vault3.listWebsites()[0].name, 'Exported', '导入数据名称正确');
assertEqual(vault3.listWebsites()[0].accounts.length, 1, '导入后含账号');

// 导入对象也行
var vault4 = new GZ.Vault();
vault4.importObject(vault2.exportObject());
assertEqual(vault4.listWebsites().length, 1, 'importObject 正常工作');

// 无效导入
assertThrows(function () { vault3.importData('not json'); }, '无效 JSON 应抛异常');
assertThrows(function () { vault3.importData('{}'); }, '缺少 websites 应抛异常');

// ─────────────────────────────────────────────
// 14. Vault - 数据校验
// ─────────────────────────────────────────────
section('Vault - 数据校验');

var goodVault = new GZ.Vault();
goodVault.addWebsite({ name: 'OK', url: 'ok.com' });
var errs = goodVault.validate();
assertEqual(errs.length, 0, '正常数据校验无错误');

// 人工破坏数据
goodVault._data.websites[0].id = '';
errs = goodVault.validate();
assert(errs.length > 0, '缺少 id 时校验有错误');

goodVault._data.websites[0].name = '';
errs = goodVault.validate();
assert(errs.length > 0, '缺少 name 时校验有错误');

// ─────────────────────────────────────────────
// 15. Vault - 存储适配器（模拟 localStorage）
// ─────────────────────────────────────────────
section('Vault - 存储适配器');

var _store = {};
var mockStorage = {
  getItem: function (k) { return _store[k] !== undefined ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; }
};

var sv = new GZ.Vault({ storage: mockStorage, storageKey: 'test_vault' });
sv.addWebsite({ name: 'Stored' });
var sAcc = sv.addAccount(sv.listWebsites()[0].id, { username: 'storeduser' });
sv.rotatePassword(sv.listWebsites()[0].id, sAcc.id);
assert(sv.save(), 'save 返回 true');
assert(_store['test_vault'] !== undefined, '存储中已有数据');

// 新实例加载
var sv2 = new GZ.Vault({ storage: mockStorage, storageKey: 'test_vault' });
assert(sv2.load(), 'load 返回 true');
assertEqual(sv2.listWebsites().length, 1, '加载后含网站');
assertEqual(sv2.listWebsites()[0].name, 'Stored', '加载后数据正确');

// clear
sv2.clear();
assertEqual(sv2.listWebsites().length, 0, 'clear 后为空');
assert(!mockStorage.getItem('test_vault'), 'clear 后存储已清空');

// ─────────────────────────────────────────────
// 16. UUID 唯一性
// ─────────────────────────────────────────────
section('UUID 唯一性');

var ids = {};
var idCollisions = 0;
for (var j = 0; j < 10000; j++) {
  var id = GZ.uuid();
  if (ids[id]) idCollisions++;
  ids[id] = true;
}
assert(idCollisions === 0, '10000 个 UUID 无碰撞');
assert(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(GZ.uuid()), 'UUID 格式正确');

// ─────────────────────────────────────────────
// 17. secureShuffle 验证
// ─────────────────────────────────────────────
section('secureShuffle 验证');

var arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
GZ.secureShuffle(arr);
assertEqual(arr.length, 10, '洗牌后长度不变');

var original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var allPresent = original.every(function (v) { return arr.indexOf(v) !== -1; });
assert(allPresent, '洗牌后元素都在');

// ─────────────────────────────────────────────
// 18. charPresets 字符集预设
// ─────────────────────────────────────────────
section('charPresets 字符集预设');

assertEqual(GZ.charPresets.upperSafe, 'ABCDEFGHJKLMNPQRSTUVWXYZ', 'upperSafe 排除 I O');
assertEqual(GZ.charPresets.lowerSafe, 'abcdefghjkmnpqrstuvwxyz', 'lowerSafe 排除 i l o');
assertEqual(GZ.charPresets.digitsSafe, '23456789', 'digitsSafe 排除 0 1');
assertEqual(GZ.charPresets.symbols, '!@#$%^&*=', 'symbols 预设正确');
assertEqual(GZ.charPresets.hex, '0123456789abcdef', 'hex 预设正确');

// ─────────────────────────────────────────────
// 19. Strategy 类 - 创建与校验
// ─────────────────────────────────────────────
section('Strategy 类 - 创建与校验');

var s = GZ.Strategy.create ? null : new GZ.Strategy({ name: 't', charsets: { a: 'AB' }, required: ['a'] });
// 直接 new
var strat = new GZ.Strategy({
  name: 'test-strat',
  charsets: { letters: 'XYZ', nums: '789' },
  required: ['letters', 'nums'],
  defaultLength: 8
});
assertEqual(strat.name, 'test-strat', 'Strategy.name 正确');
assertEqual(strat.defaultLength, 8, 'Strategy.defaultLength 正确');
var errs = strat.validate();
assertEqual(errs.length, 0, '合法策略校验无错误');

// 非法策略校验
var badStrat = new GZ.Strategy({ name: 'bad', charsets: {}, defaultLength: 2 });
errs = badStrat.validate();
assert(errs.length > 0, '空 charsets 校验有错误');

var badStrat2 = new GZ.Strategy({
  name: 'bad2',
  charsets: { a: 'AB' },
  required: ['a', 'b'],
  defaultLength: 1
});
errs = badStrat2.validate();
assert(errs.length >= 2, 'required 引用不存在的 charset + 长度不足双重错误');

// ─────────────────────────────────────────────
// 20. Strategy.derive 派生
// ─────────────────────────────────────────────
section('Strategy.derive 派生');

var derived = strat.derive({ name: 'derived-test', defaultLength: 20 });
assertEqual(derived.name, 'derived-test', '派生策略 name 覆盖');
assertEqual(derived.defaultLength, 20, '派生策略 defaultLength 覆盖');
assertEqual(derived.charsets.letters, 'XYZ', '派生策略继承父类 charsets');
assertEqual(derived.required.length, 2, '派生策略继承父类 required');

// 派生时覆盖 charsets 子集
var derived2 = strat.derive({
  name: 'derived-2',
  charsets: { letters: 'XYZ', nums: '789', extra: '!@' },
  required: ['letters', 'nums', 'extra']
});
assertEqual(derived2.charsets.extra, '!@', '派生策略新增 charset');
assertEqual(derived2.required.length, 3, '派生策略 required 已扩展');
var dpw = derived2.generate();
assert(/^[XYZ789!@]+$/.test(dpw), '派生策略生成密码字符正确');
console.log('  样例: ' + dpw);

// ─────────────────────────────────────────────
// 21. registry 工厂与派生注册
// ─────────────────────────────────────────────
section('registry 工厂与派生注册');

// create 不注册
var unregistered = GZ.registry.create({
  name: 'ghost',
  charsets: { a: 'AB' },
  required: ['a'],
  defaultLength: 4
});
assertEqual(GZ.registry.get('ghost'), null, 'create 不自动注册');
var ghostPw = unregistered.generate();
assertEqual(ghostPw.length, 4, '未注册策略也能生成密码');

// registerDerived
GZ.registry.registerDerived('bchrt', {
  name: 'bchrt-long',
  description: 'bchrt 32位长密码',
  defaultLength: 32
});
var longPw = GZ.generate('bchrt-long');
assertEqual(longPw.length, 32, 'registerDerived 派生策略可生成');
assert(!/[1lIioO0]/.test(longPw), '派生策略继承 bchrt 排除规则');

// unregister
assert(GZ.registry.unregister('bchrt-long'), 'unregister 返回 true');
assertEqual(GZ.registry.get('bchrt-long'), null, '注销后查询返回 null');
assert(!GZ.registry.unregister('bchrt-long'), '重复注销返回 false');

// ─────────────────────────────────────────────
// 22. rulePresets 规则系统
// ─────────────────────────────────────────────
section('rulePresets 规则系统');

// noConsecutive 规则
assert(GZ.rulePresets.noConsecutive.validate('Ab3$Ef7'), '无连续重复通过');
assert(!GZ.rulePresets.noConsecutive.validate('ABB3$Ef7'), '应拒绝 BB 连续');
assert(!GZ.rulePresets.noConsecutive.validate('Aa33$Ef7'), '应拒绝 33 连续');

// noSequential 规则
assert(GZ.rulePresets.noSequential.validate('Ax9$kP2'), '无连续递增递减通过');
assert(!GZ.rulePresets.noSequential.validate('ABCx9$kP2'), '应拒绝 ABC 连续递增');
assert(!GZ.rulePresets.noSequential.validate('cba9$kP2'), '应拒绝 cba 连续递减');

// 实际使用：带规则的策略
GZ.registry.register({
  name: 'strict-no-repeat',
  description: 'bchrt + 禁止连续相同字符',
  charsets: {
    upper: GZ.charPresets.upperSafe,
    lower: GZ.charPresets.lowerSafe,
    digits: GZ.charPresets.digitsSafe,
    symbols: GZ.charPresets.symbols
  },
  required: ['upper', 'lower', 'digits', 'symbols'],
  defaultLength: 16,
  rules: [GZ.rulePresets.noConsecutive]
});

var strictPwd = GZ.generate('strict-no-repeat');
assertEqual(strictPwd.length, 16, '带规则策略长度正确');
assert(GZ.rulePresets.noConsecutive.validate(strictPwd), '生成的密码满足 noConsecutive 规则');
console.log('  样例: ' + strictPwd);
GZ.registry.unregister('strict-no-repeat');

// ─────────────────────────────────────────────
// 23. 自定义 generate 函数
// ─────────────────────────────────────────────
section('自定义 generate 函数');

GZ.registry.register({
  name: 'custom-gen',
  description: '全自定义生成逻辑',
  charsets: { dummy: 'X' },  // 必须有但实际不使用
  required: ['dummy'],
  defaultLength: 10,
  generate: function (options) {
    var len = (options && options.length) || this.defaultLength;
    var chars = 'MySpecialChars0123456789';
    var pw = '';
    for (var i = 0; i < len; i++) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return 'PREFIX-' + pw;
  }
});

var cgPw = GZ.generate('custom-gen');
assert(cgPw.indexOf('PREFIX-') === 0, '自定义 generate 添加前缀');
assertEqual(cgPw.length, 7 + 10, '自定义 generate 长度正确');
console.log('  样例: ' + cgPw);
GZ.registry.unregister('custom-gen');

// ─────────────────────────────────────────────
// 24. 注册校验拦截非法策略
// ─────────────────────────────────────────────
section('注册校验拦截非法策略');

assertThrows(function () {
  GZ.registerStrategy({ name: '', charsets: { a: 'X' }, required: ['a'] });
}, '空 name 应拒绝注册');

assertThrows(function () {
  GZ.registerStrategy({ name: 'empty-chars', charsets: {}, required: [] });
}, '空 charsets 应拒绝注册');

assertThrows(function () {
  GZ.registerStrategy({
    name: 'bad-required',
    charsets: { a: 'X' },
    required: ['a', 'missing'],  // missing 不在 charsets
    defaultLength: 4
  });
}, 'required 引用不存在 charset 应拒绝');

assertThrows(function () {
  GZ.registerStrategy({
    name: 'too-short',
    charsets: { a: 'X', b: 'Y', c: 'Z' },
    required: ['a', 'b', 'c'],
    defaultLength: 2  // < required.length(3)
  });
}, 'defaultLength < required 数应拒绝');

// ─────────────────────────────────────────────
// 25. 向后兼容 - 旧 API 仍可用
// ─────────────────────────────────────────────
section('向后兼容');

assertEqual(GZ.version, '2.0.0', '版本号已升级到 2.0.0');

// 旧 API：registerStrategy / listStrategies / getStrategy 仍可用
assert(GZ.listStrategies().length >= 3, 'listStrategies 兼容');
assert(!!GZ.getStrategy('bchrt'), 'getStrategy 兼容');
assert(!!GZ.getStrategy('bchrt').generate, 'getStrategy 返回对象有 generate');

// 旧 API：registerStrategy 注册仍工作
GZ.registerStrategy({
  name: 'compat-test',
  charsets: { a: 'AB' },
  required: ['a'],
  defaultLength: 5
});
assertEqual(GZ.generate('compat-test').length, 5, 'registerStrategy 兼容');
GZ.registry.unregister('compat-test');

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
