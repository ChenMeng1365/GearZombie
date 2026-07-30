/*!
 * GearZombie Module: vault
 * Vault 保险库类：网站/账号/密码的增删改查与历史记录
 * 存储层注入式设计，浏览器用 localStorage，Node 可自定义
 *
 * AGPL-3.0
 */
(function () {
  'use strict';

  var utils, registry;
  if (typeof module === 'object' && module.exports) {
    utils = require('./utils');
    registry = require('./registry');
  } else {
    var g = typeof globalThis !== 'undefined' ? globalThis : this;
    utils = g.__GZ.utils;
    registry = g.__GZ.registry;
  }

  var uuid = utils.uuid;
  var nowISO = utils.nowISO;
  var deepClone = utils.deepClone;

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

  var exports = {
    Vault: Vault,
    createEmptyData: createEmptyData,
    VAULT_VERSION: VAULT_VERSION
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = exports;
  } else {
    var g2 = typeof globalThis !== 'undefined' ? globalThis : this;
    g2.__GZ = g2.__GZ || {};
    g2.__GZ.vault = exports;
  }
})();
