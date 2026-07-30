/*!
 * GearZombie Module: registry
 * 策略注册表：register / get / list / create / derive / registerDerived / unregister / generate
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

  var Strategy;
  if (typeof module === 'object' && module.exports) {
    Strategy = require('./strategy');
  } else {
    Strategy = (typeof globalThis !== 'undefined' ? globalThis : this).__GZ.Strategy;
  }

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

  if (typeof module === 'object' && module.exports) {
    module.exports = registry;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.registry = registry;
  }
})();
