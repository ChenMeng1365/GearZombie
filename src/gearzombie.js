/*!
 * GearZombie - 密码生成与账号保险库核心库
 *
 * 本文件是模块组合入口，不包含业务逻辑。
 * 各功能模块位于 src/modules/ 目录，按依赖顺序加载组装。
 *
 * Node 环境：通过 require() 加载各模块
 * 浏览器环境：需在引本文件之前以 <script> 标签按序引入各模块，
 *             模块会自动挂载到 globalThis.__GZ，本文件再做组装。
 *             若未预加载模块，可使用 gearzombie.bundle.js（打包版）。
 *
 * 对外 API 完全兼容旧版单体文件，测试和 index.html 引用路径不变：
 *   - Node:   require('../src/gearzombie.js')
 *   - 浏览器: <script src="src/gearzombie.js">
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

  // ─────────────────────────────────────────────
  // 按依赖顺序加载各模块
  // ─────────────────────────────────────────────

  var random, utils, charPresets, rulePresets, Strategy, registry, vault, storage;

  if (typeof require === 'function' && typeof module === 'object' && module.exports) {
    // Node 环境：直接 require
    random      = require('./modules/random');
    utils       = require('./modules/utils');
    charPresets = require('./modules/charpresets');
    rulePresets = require('./modules/rulepresets');
    Strategy    = require('./modules/strategy');
    registry    = require('./modules/registry');
    // builtins 模块有副作用：注册 bchrt/simple/pin/am-cloud 策略到 registry
    require('./modules/builtins');
    vault   = require('./modules/vault');
    storage = require('./modules/storage');
  } else {
    // 浏览器环境：从 globalThis.__GZ 取已加载的模块
    var __gz = (typeof globalThis !== 'undefined' ? globalThis : root).__GZ || {};
    random      = __gz.random;
    utils       = __gz.utils;
    charPresets = __gz.charpresets;
    rulePresets = __gz.rulepresets;
    Strategy    = __gz.Strategy;
    registry    = __gz.registry;
    vault       = __gz.vault;
    storage     = __gz.storage;
  }

  // ─────────────────────────────────────────────
  // 组装对外 API（与旧单体文件完全一致）
  // ─────────────────────────────────────────────

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
    secureRandomInt: random.secureRandomInt,
    secureShuffle: random.secureShuffle,
    uuid: utils.uuid,

    // Vault
    Vault: vault.Vault,
    createEmptyData: vault.createEmptyData,
    VAULT_VERSION: vault.VAULT_VERSION,

    // 存储
    createLocalStorageAdapter: storage.createLocalStorageAdapter,

    // 版本
    version: '2.0.0'
  };
}));
