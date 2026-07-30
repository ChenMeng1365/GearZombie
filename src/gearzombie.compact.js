/*!
 * GearZombie - 密码生成与账号保险库核心库（合并版）
 *
 * 本文件是 src/modules/ 下 9 个模块 + src/gearzombie.js 组合入口的合并产物。
 * 功能与拆分版完全一致，单个 <script> 或 require 即可使用，无需预加载模块。
 *
 *   - Node:     var GZ = require('./src/gearzombie.compact.js')
 *   - 浏览器:   <script src="src/gearzombie.compact.js"></script>
 *   - AMD:      define(['./src/gearzombie.compact.js'], function(GZ){ ... })
 *
 * 若修改了 src/modules/ 下的模块代码，需同步更新本文件。
 *
 * AGPL-3.0
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GearZombie = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // 模块: random — 安全随机数
  // ═══════════════════════════════════════════════════════════

  var _randomInt = null;

  function _initRandom() {
    // 浏览器 Web Crypto
    var wc = (typeof globalThis !== 'undefined' && globalThis.crypto)
          || (typeof self !== 'undefined' && self.crypto);
    if (wc && typeof wc.getRandomValues === 'function') {
      _randomInt = function (maxExclusive) {
        if (maxExclusive <= 0) throw new Error('max must be positive');
        // 拒绝采样消除模偏差
        var limit = Math.floor(0xFFFFFFFF / maxExclusive) * maxExclusive;
        var buf = new Uint32Array(1);
        do {
          wc.getRandomValues(buf);
        } while (buf[0] >= limit);
        return buf[0] % maxExclusive;
      };
      return;
    }
    // Node crypto
    if (typeof require === 'function') {
      try {
        var nodeCrypto = require('crypto');
        _randomInt = function (maxExclusive) {
          return nodeCrypto.randomInt(0, maxExclusive);
        };
        return;
      } catch (e) { /* fall through */ }
    }
    // 降级（不推荐用于生产安全场景）
    _randomInt = function (maxExclusive) {
      return Math.floor(Math.random() * maxExclusive);
    };
  }

  _initRandom();

  function secureRandomInt(maxExclusive) {
    return _randomInt(maxExclusive);
  }

  // Fisher-Yates 安全洗牌
  function secureShuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = secureRandomInt(i + 1);
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function randomChoice(str) {
    return str.charAt(secureRandomInt(str.length));
  }

  // ═══════════════════════════════════════════════════════════
  // 模块: utils — 通用工具
  // ═══════════════════════════════════════════════════════════

  var HAS_CRYPTO = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

  function uuid() {
    if (HAS_CRYPTO) return crypto.randomUUID();
    // RFC4122 v4 降级实现
    var chars = '0123456789abcdef';
    var s = new Array(36);
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) { s[i] = '-'; continue; }
      if (i === 14) { s[i] = '4'; continue; }
      if (i === 19) { s[i] = chars[(secureRandomInt(4)) + 8]; continue; }
      s[i] = chars[secureRandomInt(16)];
    }
    return s.join('');
  }

  function nowISO() { return new Date().toISOString(); }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // ═══════════════════════════════════════════════════════════
  // 模块: charpresets — 字符集预设
  // ═══════════════════════════════════════════════════════════

  var charPresets = {
    upper:        'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower:        'abcdefghijklmnopqrstuvwxyz',
    digits:       '0123456789',
    symbols:      '!@#$%^&*=',
    symbolsExt:   '!@#$%^&*=-_+?',
    upperSafe:    'ABCDEFGHJKLMNPQRSTUVWXYZ',  // 排除 I O
    lowerSafe:    'abcdefghjkmnpqrstuvwxyz',   // 排除 i l o
    digitsSafe:   '23456789',                  // 排除 0 1
    hex:          '0123456789abcdef',
    hexUpper:     '0123456789ABCDEF'
  };

  // ═══════════════════════════════════════════════════════════
  // 模块: rulepresets — 规则预设
  // ═══════════════════════════════════════════════════════════

  // 弱口令黑名单（等保常见默认弱口令）
  var WEAK_DEFAULTS = [
    'admin', 'root', 'huawei', 'cisco', '123456', '111111',
    'password', 'pass', 'guest', 'default', 'test', 'user',
    'operator', 'admin123'
  ];

  // 键盘行序列（用于检测键盘排序密码）
  var KEYBOARD_ROWS = [
    'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'
  ];

  // 形似变换映射表
  var LEET_MAP = { 'o': '0', 'l': '1', 'i': '1', 'e': '3', 'a': '@', 's': '$' };
  // 反向映射：把形似字符还原回字母（用于密码反向形似检测）
  var LEET_REVERSE = { '0': 'o', '1': 'l', '@': 'a', '3': 'e', '$': 's' };

  function _lower(s) { return s.toLowerCase(); }

  // 将密码中的形似字符还原回字母，用于检测含部分形似变换的用户名
  function _unleet(pw) {
    var result = '';
    for (var i = 0; i < pw.length; i++) {
      result += LEET_REVERSE[pw[i]] || pw[i];
    }
    return result;
  }

  // 生成 username 的所有大小写变位子串集合（截断防爆）
  function _usernameVariants(username) {
    var variants = [];
    if (!username) return variants;
    var u = _lower(username);
    variants.push(u);
    // 大小写变位：生成常见变体（全大写、首字母大写）
    variants.push(u.toUpperCase());
    if (u.length > 0) {
      variants.push(u.charAt(0).toUpperCase() + u.slice(1));
    }
    // 形似变换：全量替换
    var leeted = '';
    for (var i = 0; i < u.length; i++) {
      leeted += LEET_MAP[u[i]] || u[i];
    }
    if (leeted !== u) variants.push(leeted);
    // 形似变换：逐字符单替换（防御部分变形攻击）
    for (var j = 0; j < u.length; j++) {
      if (LEET_MAP[u[j]]) {
        var partial = u.slice(0, j) + LEET_MAP[u[j]] + u.slice(j + 1);
        if (partial !== u) variants.push(partial);
      }
    }
    return variants;
  }

  var rulePresets = {
    noConsecutive: {
      name: 'noConsecutive',
      validate: function (pw) {
        for (var i = 1; i < pw.length; i++) {
          if (pw[i] === pw[i - 1]) return false;
        }
        return true;
      }
    },
    noSequential: {
      name: 'noSequential',
      validate: function (pw) {
        for (var i = 2; i < pw.length; i++) {
          var a = pw.charCodeAt(i - 2), b = pw.charCodeAt(i - 1), c = pw.charCodeAt(i);
          if (c - b === 1 && b - a === 1) return false;
          if (a - b === 1 && b - c === 1) return false;
        }
        return true;
      }
    },
    noSymbolAtEdges: {
      name: 'noSymbolAtEdges',
      validate: function (pw) {
        var sym = '!@#$%^&*=-_+?';
        return sym.indexOf(pw[0]) === -1 && sym.indexOf(pw[pw.length - 1]) === -1;
      }
    },

    // ── am-cloud 新增规则 ──

    // 弱口令黑名单：不等于且不包含黑名单词（大小写不敏感）
    noWeakDefault: {
      name: 'noWeakDefault',
      validate: function (pw) {
        var lp = _lower(pw);
        for (var i = 0; i < WEAK_DEFAULTS.length; i++) {
          if (lp.indexOf(WEAK_DEFAULTS[i]) !== -1) return false;
        }
        return true;
      }
    },

    // 键盘排序：不含任意键盘行内 ≥3 字符的正向/反向连续子串
    noKeyboardSequence: {
      name: 'noKeyboardSequence',
      validate: function (pw) {
        var lp = _lower(pw);
        for (var r = 0; r < KEYBOARD_ROWS.length; r++) {
          var row = KEYBOARD_ROWS[r];
          for (var i = 0; i <= row.length - 3; i++) {
            var fwd = row.substr(i, 3);
            var rev = fwd.split('').reverse().join('');
            if (lp.indexOf(fwd) !== -1 || lp.indexOf(rev) !== -1) return false;
          }
        }
        return true;
      }
    },

    // 用户名相关性：不含用户名完整串、大小写变位、形似变换
    noUsernameRelated: {
      name: 'noUsernameRelated',
      validate: function (pw, options) {
        var username = (options && options.username) || '';
        if (!username) return true;
        var lp = _lower(pw);
        var u = _lower(username);
        // 1. 直接匹配 + 大小写变位 + 全量/单字符形似变换
        var variants = _usernameVariants(username);
        for (var i = 0; i < variants.length; i++) {
          if (variants[i] && lp.indexOf(_lower(variants[i])) !== -1) return false;
        }
        // 2. 反向形似还原：把密码中的 0→o, 1→l, @→a, 3→e, $→s 后检查是否含用户名
        var unleeted = _unleet(lp);
        if (unleeted !== lp && unleeted.indexOf(u) !== -1) return false;
        return true;
      }
    },

    // 历史 N 次不重复：不等于最近 N 次历史密码
    noRecentHistory: {
      name: 'noRecentHistory',
      validate: function (pw, options) {
        var history = (options && options.history) || [];
        var check = history.slice(-3);
        for (var i = 0; i < check.length; i++) {
          if (pw === check[i]) return false;
        }
        return true;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 模块: strategy — Strategy 类
  // ═══════════════════════════════════════════════════════════

  function Strategy(config) {
    config = config || {};
    this.name = config.name || '';
    this.description = config.description || '';
    this.charsets = config.charsets || {};
    this.required = config.required || Object.keys(this.charsets);
    this.exclude = config.exclude || '';
    this.defaultLength = config.defaultLength || 16;
    this.rules = config.rules || [];
    this._customGenerate = config.generate || null;
    // am-cloud 扩展字段
    this.minCategories = config.minCategories || 0;   // 四类中至少 N 类（0 表示用 required）
    this.minLength = config.minLength || 0;            // 可变长度下限
    this.maxLength = config.maxLength || 0;            // 可变长度上限
    this.needsContext = config.needsContext || false;  // 是否需要 username/history 上下文
  }

  // 默认生成算法：各 required 池取 1 → 随机填充 → 洗牌 → 规则校验（最多重试 50 次）
  Strategy.prototype._defaultGenerate = function (options) {
    options = options || {};
    var length = options.length || this.defaultLength;
    var maxRetries = 50;
    var self = this;

    for (var attempt = 0; attempt < maxRetries; attempt++) {
      // 构建过滤后的字符池
      var pools = {};
      var allPoolChars = '';

      this.required.forEach(function (key) {
        var raw = self.charsets[key] || '';
        var filtered = '';
        for (var i = 0; i < raw.length; i++) {
          if (self.exclude.indexOf(raw[i]) === -1) filtered += raw[i];
        }
        pools[key] = filtered;
        allPoolChars += filtered;
      });

      if (allPoolChars.length === 0) {
        throw new Error('字符池为空，请检查策略配置');
      }

      var passwordChars = [];

      // 每个必选字符集至少出现 1 次
      this.required.forEach(function (key) {
        if (pools[key].length > 0) {
          passwordChars.push(randomChoice(pools[key]));
        }
      });

      // 填充剩余长度
      while (passwordChars.length < length) {
        passwordChars.push(randomChoice(allPoolChars));
      }

      // 洗牌打乱
      secureShuffle(passwordChars);
      var password = passwordChars.join('');

      // 无规则直接返回
      if (this.rules.length === 0) return password;

      // 规则校验：全部通过才返回，否则重试
      var allPassed = true;
      for (var r = 0; r < this.rules.length; r++) {
        if (!this.rules[r].validate(password, options)) { allPassed = false; break; }
      }
      if (allPassed) return password;
    }

    throw new Error('生成重试 ' + maxRetries + ' 次仍未满足规则约束，请放宽规则或增加长度');
  };

  Strategy.prototype.generate = function (options) {
    if (this._customGenerate) return this._customGenerate.call(this, options);
    return this._defaultGenerate(options);
  };

  // 策略自校验：返回错误信息数组，空数组表示合法
  Strategy.prototype.validate = function () {
    var errors = [];
    var self = this;
    if (!this.name) errors.push('缺少 name');
    if (Object.keys(this.charsets).length === 0) errors.push('charsets 为空');
    this.required.forEach(function (key) {
      if (!self.charsets[key]) errors.push('required 中的 "' + key + '" 不在 charsets 中');
    });
    if (this.defaultLength < this.required.length) {
      errors.push('defaultLength(' + this.defaultLength + ') 小于 required 类数(' + this.required.length + ')');
    }
    return errors;
  };

  // 从当前策略派生新策略：只传需要覆盖的字段
  Strategy.prototype.derive = function (overrides) {
    overrides = overrides || {};
    return new Strategy({
      name: overrides.name || '',
      description: overrides.description || this.description,
      charsets: overrides.charsets || deepClone(this.charsets),
      required: overrides.required || this.required.slice(),
      exclude: overrides.exclude || this.exclude,
      defaultLength: overrides.defaultLength || this.defaultLength,
      rules: overrides.rules || this.rules.slice(),
      generate: overrides.generate || this._customGenerate,
      minCategories: overrides.minCategories || this.minCategories,
      minLength: overrides.minLength || this.minLength,
      maxLength: overrides.maxLength || this.maxLength,
      needsContext: overrides.needsContext !== undefined ? overrides.needsContext : this.needsContext
    });
  };

  // ═══════════════════════════════════════════════════════════
  // 模块: registry — 策略注册表
  // ═══════════════════════════════════════════════════════════

  var registry = {
    _strategies: {},
    _order: [],

    // 注册策略（传入 config 对象或 Strategy 实例）
    register: function (config) {
      var strategy = (config instanceof Strategy) ? config : new Strategy(config);
      var errors = strategy.validate();
      if (errors.length > 0) {
        throw new Error('策略校验失败: ' + errors.join('; '));
      }
      if (!this._strategies[strategy.name]) {
        this._order.push(strategy.name);
      }
      this._strategies[strategy.name] = strategy;
      return strategy;
    },

    get: function (name) {
      return this._strategies[name] || null;
    },

    list: function () {
      var store = this._strategies;
      return this._order.map(function (name) {
        var s = store[name];
        return { name: s.name, description: s.description };
      });
    },

    // 工厂方法：创建但不注册
    create: function (config) {
      return new Strategy(config);
    },

    // 从已注册策略派生（不自动注册）
    derive: function (parentName, overrides) {
      var parent = this.get(parentName);
      if (!parent) throw new Error('父策略不存在: ' + parentName);
      return parent.derive(overrides);
    },

    // 派生并注册
    registerDerived: function (parentName, overrides) {
      return this.register(this.derive(parentName, overrides));
    },

    unregister: function (name) {
      if (!this._strategies[name]) return false;
      delete this._strategies[name];
      var idx = this._order.indexOf(name);
      if (idx !== -1) this._order.splice(idx, 1);
      return true;
    },

    // 顶层生成函数
    generate: function (strategyName, options) {
      var s = this.get(strategyName);
      if (!s) throw new Error('未知的密码策略: ' + strategyName);
      return s.generate(options);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 模块: builtins — 注册内置策略
  // ═══════════════════════════════════════════════════════════

  // ── bchrt ──
  registry.register({
    name: 'bchrt',
    description: '大小写字母 + 数字 + 符号，排除相似字符 (1lIioO0)',
    charsets: {
      upper: charPresets.upperSafe,
      lower: charPresets.lowerSafe,
      digits: charPresets.digitsSafe,
      symbols: charPresets.symbols
    },
    required: ['upper', 'lower', 'digits', 'symbols'],
    defaultLength: 16
  });

  // ── simple ──
  registry.register({
    name: 'simple',
    description: '大小写字母 + 数字（无符号）',
    charsets: {
      upper: charPresets.upperSafe,
      lower: charPresets.lowerSafe,
      digits: charPresets.digitsSafe
    },
    required: ['upper', 'lower', 'digits'],
    defaultLength: 12
  });

  // ── pin ──
  registry.register({
    name: 'pin',
    description: '纯数字 PIN 码',
    charsets: { digits: charPresets.digits },
    required: ['digits'],
    defaultLength: 6
  });

  // ─────────────────────────────────────────────
  // am-cloud 策略：等保合规通行字
  // 8-16 位可变长度，四类字符至少三类，禁弱口令/键盘序/用户名相关/前3次重复
  // ─────────────────────────────────────────────

  function _amCloudGenerate(options) {
    options = options || {};
    var self = this;

    // 可变长度：优先用 options.length，否则在 minLength-maxLength 范围内随机
    var minLen = options.minLength || this.minLength || 8;
    var maxLen = options.maxLength || this.maxLength || 16;
    var length = options.length || (secureRandomInt(maxLen - minLen + 1) + minLen);

    var maxRetries = 50;

    // 四类字符池
    var allKeys = Object.keys(this.charsets);
    var pools = {};
    var allPoolChars = '';
    allKeys.forEach(function (key) {
      var filtered = '';
      var raw = self.charsets[key];
      for (var i = 0; i < raw.length; i++) {
        if (self.exclude.indexOf(raw[i]) === -1) filtered += raw[i];
      }
      pools[key] = filtered;
      allPoolChars += filtered;
    });

    for (var attempt = 0; attempt < maxRetries; attempt++) {
      var passwordChars = [];

      // 从 N 类中随机选 minCategories 类，各取 1 个
      var shuffledKeys = secureShuffle(allKeys.slice());
      var requiredKeys = shuffledKeys.slice(0, this.minCategories);
      requiredKeys.forEach(function (key) {
        if (pools[key].length > 0) {
          passwordChars.push(randomChoice(pools[key]));
        }
      });

      // 剩余长度从合并池填充
      while (passwordChars.length < length) {
        passwordChars.push(randomChoice(allPoolChars));
      }

      // 洗牌
      secureShuffle(passwordChars);
      var password = passwordChars.join('');

      // 规则校验
      var allPassed = true;
      for (var r = 0; r < this.rules.length; r++) {
        if (!this.rules[r].validate(password, options)) { allPassed = false; break; }
      }
      if (allPassed) return password;
    }

    throw new Error('生成重试 ' + maxRetries + ' 次仍未满足 am-cloud 规则约束，请放宽规则或增加长度');
  }

  registry.register({
    name: 'am-cloud',
    description: '等保合规：8-16位，四类至少三类，禁弱口令/键盘序/用户名相关/前3次重复',
    charsets: {
      upper: charPresets.upperSafe,
      lower: charPresets.lowerSafe,
      digits: charPresets.digitsSafe,
      symbols: charPresets.symbols
    },
    required: ['upper', 'lower', 'digits', 'symbols'],
    exclude: '',
    defaultLength: 12,
    rules: [
      rulePresets.noWeakDefault,
      rulePresets.noKeyboardSequence,
      rulePresets.noUsernameRelated,
      rulePresets.noRecentHistory
    ],
    minCategories: 3,
    minLength: 8,
    maxLength: 16,
    needsContext: true,
    generate: _amCloudGenerate
  });

  // ═══════════════════════════════════════════════════════════
  // 模块: vault — Vault 保险库类
  // ═══════════════════════════════════════════════════════════

  var VAULT_VERSION = 1;

  /**
   * 创建空保险库数据结构
   */
  function createEmptyData() {
    return {
      version: VAULT_VERSION,
      websites: []
    };
  }

  function Vault(options) {
    options = options || {};
    this._data = createEmptyData();
    this._storage = options.storage || null; // 注入式存储适配器
    this._storageKey = options.storageKey || 'gearzombie_vault';
  }

  Vault.prototype._findWebsite = function (id) {
    for (var i = 0; i < this._data.websites.length; i++) {
      if (this._data.websites[i].id === id) return i;
    }
    return -1;
  };

  Vault.prototype._findAccount = function (websiteId, accountId) {
    var wi = this._findWebsite(websiteId);
    if (wi === -1) return { wi: -1, ai: -1 };
    var accounts = this._data.websites[wi].accounts || [];
    for (var i = 0; i < accounts.length; i++) {
      if (accounts[i].id === accountId) return { wi: wi, ai: i };
    }
    return { wi: wi, ai: -1 };
  };

  // ── 网站操作 ──

  Vault.prototype.addWebsite = function (info) {
    info = info || {};
    var site = {
      id: uuid(),
      name: info.name || '',
      url: info.url || '',
      strategy: info.strategy || 'bchrt',
      accounts: [],
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    this._data.websites.push(site);
    return site;
  };

  Vault.prototype.updateWebsite = function (id, patch) {
    var idx = this._findWebsite(id);
    if (idx === -1) throw new Error('网站不存在: ' + id);
    var site = this._data.websites[idx];
    if (patch.name !== undefined) site.name = patch.name;
    if (patch.url !== undefined) site.url = patch.url;
    if (patch.strategy !== undefined) site.strategy = patch.strategy;
    site.updatedAt = nowISO();
    return site;
  };

  Vault.prototype.deleteWebsite = function (id) {
    var idx = this._findWebsite(id);
    if (idx === -1) return false;
    this._data.websites.splice(idx, 1);
    return true;
  };

  Vault.prototype.getWebsite = function (id) {
    var idx = this._findWebsite(id);
    if (idx === -1) return null;
    return this._data.websites[idx];
  };

  Vault.prototype.listWebsites = function () {
    return this._data.websites;
  };

  // ── 账号操作 ──

  Vault.prototype.addAccount = function (websiteId, info) {
    var idx = this._findWebsite(websiteId);
    if (idx === -1) throw new Error('网站不存在: ' + websiteId);
    info = info || {};
    var account = {
      id: uuid(),
      username: info.username || '',
      currentPassword: info.currentPassword || '',
      history: [],
      note: info.note || '',
      createdAt: nowISO(),
      updatedAt: nowISO()
    };
    this._data.websites[idx].accounts.push(account);
    this._data.websites[idx].updatedAt = nowISO();
    return account;
  };

  Vault.prototype.updateAccount = function (websiteId, accountId, patch) {
    var pos = this._findAccount(websiteId, accountId);
    if (pos.ai === -1) throw new Error('账号不存在');
    var account = this._data.websites[pos.wi].accounts[pos.ai];
    if (patch.username !== undefined) account.username = patch.username;
    if (patch.note !== undefined) account.note = patch.note;
    account.updatedAt = nowISO();
    return account;
  };

  /**
   * 轮换密码：旧密码进入历史记录，生成新密码
   * @param {string} websiteId
   * @param {string} accountId
   * @param {object} [options] - { length, strategy, username, history, minLength, maxLength }
   * @returns {string} 新密码
   */
  Vault.prototype.rotatePassword = function (websiteId, accountId, options) {
    options = options || {};
    var pos = this._findAccount(websiteId, accountId);
    if (pos.ai === -1) throw new Error('账号不存在');
    var website = this._data.websites[pos.wi];
    var account = website.accounts[pos.ai];

    // 策略优先用 options，其次网站配置
    var strategyName = options.strategy || website.strategy || 'bchrt';

    // 旧密码入历史
    if (account.currentPassword) {
      account.history.push({
        password: account.currentPassword,
        changedAt: account.updatedAt || nowISO()
      });
    }

    // 构建生成参数
    var genOptions = { length: options.length };

    // 策略需要上下文时，自动注入 username 和 history
    var strategy = registry.get(strategyName);
    var needsContext = (strategy && strategy.needsContext) || options.username || options.history;
    if (needsContext) {
      genOptions.username = options.username || account.username || '';
      genOptions.history = options.history
        || account.history.slice(-3).map(function (h) { return h.password; });
    }

    // 透传长度范围参数（am-cloud 等策略使用）
    if (options.minLength !== undefined) genOptions.minLength = options.minLength;
    if (options.maxLength !== undefined) genOptions.maxLength = options.maxLength;

    // 生成新密码
    var newPassword = registry.generate(strategyName, genOptions);
    account.currentPassword = newPassword;
    account.updatedAt = nowISO();
    website.updatedAt = nowISO();
    return newPassword;
  };

  /**
   * 手动设置密码（不经过生成器）
   */
  Vault.prototype.setPassword = function (websiteId, accountId, password) {
    var pos = this._findAccount(websiteId, accountId);
    if (pos.ai === -1) throw new Error('账号不存在');
    var account = this._data.websites[pos.wi].accounts[pos.ai];
    if (account.currentPassword && account.currentPassword !== password) {
      account.history.push({
        password: account.currentPassword,
        changedAt: account.updatedAt || nowISO()
      });
    }
    account.currentPassword = password;
    account.updatedAt = nowISO();
  };

  Vault.prototype.deleteAccount = function (websiteId, accountId) {
    var pos = this._findAccount(websiteId, accountId);
    if (pos.ai === -1) return false;
    this._data.websites[pos.wi].accounts.splice(pos.ai, 1);
    this._data.websites[pos.wi].updatedAt = nowISO();
    return true;
  };

  Vault.prototype.getAccount = function (websiteId, accountId) {
    var pos = this._findAccount(websiteId, accountId);
    if (pos.ai === -1) return null;
    return this._data.websites[pos.wi].accounts[pos.ai];
  };

  // ── 导入导出 ──

  Vault.prototype.exportData = function () {
    return JSON.stringify(this._data, null, 2);
  };

  Vault.prototype.exportObject = function () {
    return deepClone(this._data);
  };

  Vault.prototype.importData = function (jsonStr) {
    var parsed;
    if (typeof jsonStr === 'string') {
      parsed = JSON.parse(jsonStr);
    } else {
      parsed = jsonStr;
    }
    if (!parsed || !Array.isArray(parsed.websites)) {
      throw new Error('导入数据格式无效：缺少 websites 数组');
    }
    if (!parsed.version) parsed.version = VAULT_VERSION;
    this._data = parsed;
    return this._data;
  };

  Vault.prototype.importObject = function (obj) {
    return this.importData(obj);
  };

  // ── 持久化（注入式存储适配器）──

  Vault.prototype.save = function () {
    if (!this._storage) return false;
    this._storage.setItem(this._storageKey, this.exportData());
    return true;
  };

  Vault.prototype.load = function () {
    if (!this._storage) return false;
    var raw = this._storage.getItem(this._storageKey);
    if (raw) {
      this._data = JSON.parse(raw);
      return true;
    }
    return false;
  };

  Vault.prototype.clear = function () {
    this._data = createEmptyData();
    if (this._storage) this._storage.removeItem(this._storageKey);
  };

  // ── 校验 ──

  Vault.prototype.validate = function () {
    var errors = [];
    if (!this._data || !Array.isArray(this._data.websites)) {
      errors.push('数据结构无效：缺少 websites');
      return errors;
    }
    var seenIds = {};
    this._data.websites.forEach(function (site, si) {
      var prefix = '网站[' + si + ']';
      if (!site.id) errors.push(prefix + ' 缺少 id');
      else if (seenIds[site.id]) errors.push(prefix + ' id 重复');
      else seenIds[site.id] = true;

      if (!site.name) errors.push(prefix + ' 缺少 name');
      if (!Array.isArray(site.accounts)) {
        errors.push(prefix + ' accounts 不是数组');
        return;
      }
      site.accounts.forEach(function (acc, ai) {
        var aprefix = prefix + '.账号[' + ai + ']';
        if (!acc.id) errors.push(aprefix + ' 缺少 id');
        if (!acc.username) errors.push(aprefix + ' 缺少 username');
        if (!Array.isArray(acc.history)) errors.push(aprefix + ' history 不是数组');
      });
    });
    return errors;
  };

  // ═══════════════════════════════════════════════════════════
  // 模块: storage — 浏览器存储适配器
  // ═══════════════════════════════════════════════════════════

  function createLocalStorageAdapter() {
    try {
      var ls = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!ls) return null;
      // 测试 localStorage 可用性
      ls.setItem('__gz_test__', '1');
      ls.removeItem('__gz_test__');
      return {
        getItem: function (key) { return ls.getItem(key); },
        setItem: function (key, value) { ls.setItem(key, value); },
        removeItem: function (key) { ls.removeItem(key); }
      };
    } catch (e) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 对外 API
  // ═══════════════════════════════════════════════════════════

  return {
    // 密码生成器（向后兼容别名）
    generate: function (strategyName, options) {
      return registry.generate(strategyName, options);
    },
    registerStrategy: function (config) { return registry.register(config); },
    getStrategy: function (name) { return registry.get(name); },
    listStrategies: function () { return registry.list(); },
    defaultGenerate: function (strategy, options) { return strategy._defaultGenerate(options); },

    // 策略层 API
    Strategy: Strategy,
    registry: registry,
    charPresets: charPresets,
    rulePresets: rulePresets,

    // 工具
    secureRandomInt: secureRandomInt,
    secureShuffle: secureShuffle,
    uuid: uuid,

    // Vault
    Vault: Vault,
    createEmptyData: createEmptyData,
    VAULT_VERSION: VAULT_VERSION,

    // 存储
    createLocalStorageAdapter: createLocalStorageAdapter,

    // 版本
    version: '2.0.0'
  };
}));
