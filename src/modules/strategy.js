/*!
 * GearZombie Module: strategy
 * Strategy 类：封装策略配置 + 生成 + 校验 + 派生
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

  var random, utils;
  if (typeof module === 'object' && module.exports) {
    random = require('./random');
    utils = require('./utils');
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    random = g.__GZ.random;
    utils = g.__GZ.utils;
  }

  var secureShuffle = random.secureShuffle;
  var randomChoice = random.randomChoice;
  var deepClone = utils.deepClone;

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

  if (typeof module === 'object' && module.exports) {
    module.exports = Strategy;
  } else {
    var g2 = typeof globalThis !== 'undefined' ? globalThis : this;
    g2.__GZ = g2.__GZ || {};
    g2.__GZ.Strategy = Strategy;
  }
})();
