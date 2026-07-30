/*!
 * GearZombie Module: storage
 * 浏览器存储适配器（自动检测 localStorage）
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

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

  var exports = {
    createLocalStorageAdapter: createLocalStorageAdapter
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.storage = exports;
  }
})();
