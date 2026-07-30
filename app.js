/*!
 * GearZombie 浏览器 UI 逻辑
 *
 * 依赖：GearZombie 核心库（src/gearzombie.js）
 * 数据存储在浏览器 localStorage，页面刷新后自动恢复。
 */
(function () {
  'use strict';

  var GZ = window.GearZombie;
  var vault;
  var _currentWebsiteId = null; // 用于添加账号 modal

  // ─────────────────────────────────────────────
  // 初始化
  // ─────────────────────────────────────────────
  function init() {
    var storage = GZ.createLocalStorageAdapter();
    vault = new GZ.Vault({ storage: storage, storageKey: 'gearzombie_vault' });
    vault.load(); // 加载已有数据

    // 初始化策略下拉
    populateStrategySelect('w-strategy');

    // 导入文件事件
    var fileInput = document.getElementById('import-file-input');
    fileInput.addEventListener('change', handleFileImport);

    render();
  }

  function populateStrategySelect(selectId) {
    var select = document.getElementById(selectId);
    var list = GZ.listStrategies();
    select.innerHTML = '';
    list.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name + (s.description ? ' - ' + s.description : '');
      select.appendChild(opt);
    });
  }

  // ─────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────
  function render() {
    var container = document.getElementById('website-list');
    var emptyState = document.getElementById('empty-state');
    var sites = vault.listWebsites();

    if (sites.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = sites.map(renderWebsite).join('');
    bindCardEvents();
  }

  function renderWebsite(site) {
    var strategyOptions = GZ.listStrategies().map(function (s) {
      var sel = s.name === site.strategy ? 'selected' : '';
      return '<option value="' + s.name + '" ' + sel + '>' + s.name + '</option>';
    }).join('');

    var accountsHtml = '';
    if (site.accounts && site.accounts.length > 0) {
      accountsHtml = site.accounts.map(function (acc) {
        return renderAccount(site.id, acc);
      }).join('');
    } else {
      accountsHtml = '<div class="account-row" style="color:var(--text-dim);font-size:0.8rem;font-style:italic">暂无账号</div>';
    }

    return [
      '<div class="website-card" data-site-id="' + site.id + '">',
      '  <div class="website-header">',
      '    <span class="website-name">' + escapeHtml(site.name) + '</span>',
      site.url ? '    <a class="website-url" href="' + escapeHtml(site.url) + '" target="_blank">' + escapeHtml(site.url) + '</a>' : '',
      '    <div class="strategy-select">',
      '      <label>策略:</label>',
      '      <select onchange="UI.changeStrategy(\'' + site.id + '\', this.value)">' + strategyOptions + '</select>',
      '    </div>',
      '    <div class="website-actions">',
      '      <button class="btn btn-small btn-primary" onclick="UI.showAddAccountModal(\'' + site.id + '\')">+ 账号</button>',
      '      <button class="btn btn-small btn-danger" onclick="UI.deleteWebsite(\'' + site.id + '\')">删除</button>',
      '    </div>',
      '  </div>',
      '  <div class="account-list">' + accountsHtml + '</div>',
      '</div>'
    ].join('');
  }

  function renderAccount(siteId, acc) {
    var pwdDisplay;
    if (acc.currentPassword) {
      pwdDisplay = '<span class="password-display masked" data-pw="' + escapeHtml(acc.currentPassword) + '">'
                 + '●'.repeat(Math.min(acc.currentPassword.length, 20))
                 + '</span>';
    } else {
      pwdDisplay = '<span class="password-empty">暂无密码</span>';
    }

    // 眼睛按钮
    var eyeBtn = '<button class="btn btn-icon" onclick="UI.togglePassword(this)" title="显示/隐藏密码">👁</button>';

    // 生成/轮换密码按钮
    var genBtn = '<button class="btn btn-small btn-primary" onclick="UI.rotatePassword(\'' + siteId + '\',\'' + acc.id + '\')">'
               + (acc.currentPassword ? '轮换' : '生成') + '</button>';

    // 长度输入
    var lenInput = '<input type="number" class="pw-length-input" value="16" min="4" max="128" title="密码长度">';

    // 复制按钮
    var copyBtn = '<button class="btn btn-icon" onclick="UI.copyPassword(\'' + siteId + '\',\'' + acc.id + '\')" title="复制密码">📋</button>';

    // 历史记录
    var historyHtml = '';
    if (acc.history && acc.history.length > 0) {
      var historyItems = acc.history.slice().reverse().map(function (h) {
        return '<div class="history-item">'
             + '<span class="history-time">' + formatTime(h.changedAt) + '</span>'
             + '<span class="history-pw">' + escapeHtml(h.password) + '</span>'
             + '</div>';
      }).join('');
      historyHtml = '<div class="history-toggle" onclick="UI.toggleHistory(this)">'
                  + '历史 (' + acc.history.length + ') ▾</div>'
                  + '<div class="history-list">' + historyItems + '</div>';
    }

    return [
      '<div class="account-row" data-acc-id="' + acc.id + '">',
      '  <span class="account-username">' + escapeHtml(acc.username) + '</span>',
      '  <div class="password-field">' + pwdDisplay + eyeBtn + '</div>',
      '  ' + lenInput,
      '  <div class="account-actions">' + genBtn + copyBtn
      + ' <button class="btn btn-small btn-danger" onclick="UI.deleteAccount(\'' + siteId + '\',\'' + acc.id + '\')">删除</button>'
      + '</div>',
      '  ' + historyHtml,
      '</div>'
    ].join('');
  }

  // ─────────────────────────────────────────────
  // 事件绑定（用事件委托减少 DOM 查询）
  // ─────────────────────────────────────────────
  function bindCardEvents() {
    // 当前用 inline onclick，无需额外绑定
  }

  // ─────────────────────────────────────────────
  // Modal 操作
  // ─────────────────────────────────────────────
  function showAddWebsiteModal() {
    document.getElementById('w-name').value = '';
    document.getElementById('w-url').value = '';
    document.getElementById('w-strategy').value = 'bchrt';
    openModal('modal-website');
    setTimeout(function () { document.getElementById('w-name').focus(); }, 50);
  }

  function showAddAccountModal(siteId) {
    _currentWebsiteId = siteId;
    document.getElementById('a-username').value = '';
    document.getElementById('a-note').value = '';
    openModal('modal-account');
    setTimeout(function () { document.getElementById('a-username').focus(); }, 50);
  }

  function confirmAddWebsite() {
    var name = document.getElementById('w-name').value.trim();
    var url = document.getElementById('w-url').value.trim();
    var strategy = document.getElementById('w-strategy').value;
    if (!name) { toast('请输入网站名称', 'error'); return; }
    vault.addWebsite({ name: name, url: url, strategy: strategy });
    vault.save();
    closeModal('modal-website');
    render();
    toast('网站已添加', 'success');
  }

  function confirmAddAccount() {
    var username = document.getElementById('a-username').value.trim();
    var note = document.getElementById('a-note').value.trim();
    if (!username) { toast('请输入用户名', 'error'); return; }
    vault.addAccount(_currentWebsiteId, { username: username, note: note });
    vault.save();
    closeModal('modal-account');
    render();
    toast('账号已添加', 'success');
  }

  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  // ─────────────────────────────────────────────
  // 网站操作
  // ─────────────────────────────────────────────
  function changeStrategy(siteId, strategy) {
    vault.updateWebsite(siteId, { strategy: strategy });
    vault.save();
    toast('策略已切换为 ' + strategy, 'success');
  }

  function deleteWebsite(siteId) {
    var site = vault.getWebsite(siteId);
    if (!site) return;
    if (!confirm('确认删除网站「' + site.name + '」及其所有账号？')) return;
    vault.deleteWebsite(siteId);
    vault.save();
    render();
    toast('网站已删除', 'success');
  }

  // ─────────────────────────────────────────────
  // 账号操作
  // ─────────────────────────────────────────────
  function rotatePassword(siteId, accId) {
    var card = document.querySelector('[data-site-id="' + siteId + '"]');
    var lenInput = card.querySelector('[data-acc-id="' + accId + '"] .pw-length-input');
    var length = parseInt(lenInput.value, 10) || 16;
    try {
      var newPw = vault.rotatePassword(siteId, accId, { length: length });
      vault.save();
      render();
      toast('密码已' + (vault.getAccount(siteId, accId).history.length > 0 ? '轮换' : '生成') + ': ' + newPw, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function togglePassword(btn) {
    var display = btn.parentElement.querySelector('.password-display');
    if (!display || !display.dataset.pw) return;
    if (display.classList.contains('masked')) {
      display.textContent = display.dataset.pw;
      display.classList.remove('masked');
      btn.textContent = '🙈';
    } else {
      display.textContent = '●'.repeat(Math.min(display.dataset.pw.length, 20));
      display.classList.add('masked');
      btn.textContent = '👁';
    }
  }

  function copyPassword(siteId, accId) {
    var acc = vault.getAccount(siteId, accId);
    if (!acc || !acc.currentPassword) { toast('暂无密码可复制', 'error'); return; }
    navigator.clipboard.writeText(acc.currentPassword).then(function () {
      toast('密码已复制到剪贴板', 'success');
    }).catch(function () {
      toast('复制失败，请手动复制', 'error');
    });
  }

  function deleteAccount(siteId, accId) {
    var acc = vault.getAccount(siteId, accId);
    if (!acc) return;
    if (!confirm('确认删除账号「' + acc.username + '」？')) return;
    vault.deleteAccount(siteId, accId);
    vault.save();
    render();
    toast('账号已删除', 'success');
  }

  function toggleHistory(el) {
    var list = el.nextElementSibling;
    if (list.classList.contains('open')) {
      list.classList.remove('open');
      el.innerHTML = el.innerHTML.replace('▴', '▾');
    } else {
      list.classList.add('open');
      el.innerHTML = el.innerHTML.replace('▾', '▴');
    }
  }

  // ─────────────────────────────────────────────
  // 导入导出
  // ─────────────────────────────────────────────
  function exportToFile() {
    var json = vault.exportData();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'gearzombie-vault-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('已导出到文件', 'success');
  }

  function importFromFile() {
    document.getElementById('import-file-input').click();
  }

  function handleFileImport(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        vault.importData(ev.target.result);
        vault.save();
        render();
        toast('导入成功', 'success');
      } catch (err) {
        toast('导入失败: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // 重置以便重复选择同一文件
  }

  function clearAll() {
    if (!confirm('确认清空全部数据？此操作不可撤消。')) return;
    vault.clear();
    vault.save();
    render();
    toast('已清空全部数据', 'success');
  }

  // ─────────────────────────────────────────────
  // 工具
  // ─────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(iso) {
    try {
      var d = new Date(iso);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
           + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) { return iso; }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  var _toastTimer = null;
  function toast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      el.className = 'toast';
    }, 2500);
  }

  // ─────────────────────────────────────────────
  // 对外暴露
  // ─────────────────────────────────────────────
  window.UI = {
    init: init,
    showAddWebsiteModal: showAddWebsiteModal,
    showAddAccountModal: showAddAccountModal,
    confirmAddWebsite: confirmAddWebsite,
    confirmAddAccount: confirmAddAccount,
    closeModal: closeModal,
    changeStrategy: changeStrategy,
    deleteWebsite: deleteWebsite,
    rotatePassword: rotatePassword,
    togglePassword: togglePassword,
    copyPassword: copyPassword,
    deleteAccount: deleteAccount,
    toggleHistory: toggleHistory,
    exportToFile: exportToFile,
    importFromFile: importFromFile,
    clearAll: clearAll
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
