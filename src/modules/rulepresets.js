/*!
 * GearZombie Module: rulepresets
 * 规则预设：可复用的密码后处理校验规则
 * 每条规则: { name, validate(password, options) -> bool }
 * 旧规则不读 options 即自动向后兼容
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

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

  if (typeof module === 'object' && module.exports) {
    module.exports = rulePresets;
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    g.__GZ = g.__GZ || {};
    g.__GZ.rulepresets = rulePresets;
  }
})();
