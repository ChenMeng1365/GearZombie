/*!
 * GearZombie Module: random
 * 安全随机数：secureRandomInt / secureShuffle / randomChoice
 * 自动适配浏览器 Web Crypto 与 Node crypto，降级 Math.random
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

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

  var exports = {
    secureRandomInt: secureRandomInt,
    secureShuffle: secureShuffle,
    randomChoice: randomChoice
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.random = exports;
  }
})();
