/*!
 * GearZombie Module: builtins
 * 注册内置策略：bchrt / simple / pin / am-cloud
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

  var registry, charPresets, rulePresets, random;
  if (typeof module === 'object' && module.exports) {
    registry = require('./registry');
    charPresets = require('./charpresets');
    rulePresets = require('./rulepresets');
    random = require('./random');
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    registry = g.__GZ.registry;
    charPresets = g.__GZ.charpresets;
    rulePresets = g.__GZ.rulepresets;
    random = g.__GZ.random;
  }

  var secureRandomInt = random.secureRandomInt;
  var secureShuffle = random.secureShuffle;
  var randomChoice = random.randomChoice;

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

  // ─────────────────────────────────────────────
  // srdcloud 策略：SRDCloud 平台通行字
  // 9-32 位可变长度，大写+小写+数字必选、特殊字符可选
  // 禁键盘横排/斜线/逻辑连续/3连重/用户名3位子串/前3次重复
  // ─────────────────────────────────────────────

  function _srdcloudGenerate(options) {
    options = options || {};
    var self = this;

    // 可变长度：优先用 options.length，否则在 minLength-maxLength 范围内随机
    var minLen = options.minLength || this.minLength || 9;
    var maxLen = options.maxLength || this.maxLength || 32;
    var length = options.length || (secureRandomInt(maxLen - minLen + 1) + minLen);

    var maxRetries = 50;

    // 构建所有字符池（包括非 required 的可选字符集）
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

      // 必选类别各取 1 个（大写、小写、数字）
      this.required.forEach(function (key) {
        if (pools[key].length > 0) {
          passwordChars.push(randomChoice(pools[key]));
        }
      });

      // 剩余长度从全字符池填充（含可选特殊字符）
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

    throw new Error('生成重试 ' + maxRetries + ' 次仍未满足 srdcloud 规则约束，请放宽规则或增加长度');
  }

  registry.register({
    name: 'srdcloud',
    description: 'SRDCloud：9-32位，大写+小写+数字必选/符号可选，禁键盘横排/斜线/逻辑连续/3连重/用户名3位子串/前3次重复',
    charsets: {
      upper: charPresets.upper,
      lower: charPresets.lower,
      digits: charPresets.digits,
      symbols: charPresets.symbolsSrdcloud
    },
    required: ['upper', 'lower', 'digits'],
    exclude: '',
    defaultLength: 16,
    rules: [
      rulePresets.noKeyboardSequence,
      rulePresets.noKeyboardDiagonal,
      rulePresets.noSequential,
      rulePresets.noTripleRepeat,
      rulePresets.noUsernameSubstr,
      rulePresets.noRecentHistory
    ],
    minLength: 9,
    maxLength: 32,
    needsContext: true,
    generate: _srdcloudGenerate
  });

  // 本模块为副作用型（注册策略），无导出
  if (typeof module === 'object' && module.exports) {
    module.exports = {};
  }
})();
