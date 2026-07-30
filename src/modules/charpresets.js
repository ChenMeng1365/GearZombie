/*!
 * GearZombie Module: charpresets
 * 字符集预设：可复用的命名字符池，策略配置时按名引用
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

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

  if (typeof module === 'object' && module.exports) {
    module.exports = charPresets;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.charpresets = charPresets;
  }
})();
