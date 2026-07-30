/*!
 * GearZombie Module: utils
 * 通用工具：uuid / nowISO / deepClone
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

  var random;
  if (typeof module === 'object' && module.exports) {
    random = require('./random');
  } else {
    random = (typeof globalThis !== 'undefined' ? globalThis : this).__GZ.random;
  }

  var HAS_CRYPTO = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function';

  function uuid() {
    if (HAS_CRYPTO) return crypto.randomUUID();
    // RFC4122 v4 降级实现
    var chars = '0123456789abcdef';
    var s = new Array(36);
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) { s[i] = '-'; continue; }
      if (i === 14) { s[i] = '4'; continue; }
      if (i === 19) { s[i] = chars[(random.secureRandomInt(4)) + 8]; continue; }
      s[i] = chars[random.secureRandomInt(16)];
    }
    return s.join('');
  }

  function nowISO() { return new Date().toISOString(); }

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  var exports = {
    uuid: uuid,
    nowISO: nowISO,
    deepClone: deepClone
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.utils = exports;
  }
})();
