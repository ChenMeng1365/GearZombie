
# GearZombie

密码生成与账号保险库。

## 功能

- **密码生成器**：可插拔策略架构，内置 4 种策略
  - `bchrt`：大小写字母 + 数字 + 符号，排除相似字符 (1lIioO0)
  - `simple`：大小写字母 + 数字（无符号）
  - `pin`：纯数字 PIN 码
  - `am-cloud`：天翼云管控密码策略，含形似变换规避与上下文感知轮换
- **账号保险库 (Vault)**：网站 → 账号 → 密码的层级管理
  - 密码轮换时旧密码自动进入历史记录
  - 支持手动设置密码
  - 数据校验
- **双环境支持**：
  - 浏览器：HTML 页面加载 `src/gearzombie.js` + `app.js`
  - Node.js：`require('./src/gearzombie.js')`
- **本地存储**：浏览器自动用 localStorage 持久化，数据不出本机
- **导入导出**：JSON 格式，可保存到文件或从文件恢复
- **无外部依赖**：纯 JavaScript 实现

## 快速开始

### 浏览器

直接在浏览器中打开 `index.html`。

### Node.js

```javascript
var GZ = require('./src/gearzombie.js');

// 生成密码
var pwd = GZ.generate('bchrt', { length: 20 });
console.log(pwd);

// 使用保险库
var vault = new GZ.Vault();
var site = vault.addWebsite({ name: 'GitHub', url: 'github.com', strategy: 'bchrt' });
var acc = vault.addAccount(site.id, { username: 'myuser' });
vault.rotatePassword(site.id, acc.id, { length: 16 });

console.log(vault.exportData());
```

## 自定义策略

```javascript
GZ.registerStrategy({
  name: 'my-policy',
  description: '自定义策略',
  charsets: {
    hex: '0123456789abcdef'
  },
  required: ['hex'],
  defaultLength: 32
});

var pwd = GZ.generate('my-policy'); // 32位 hex 密码
```

## 测试

```bash
npm test
```

或直接运行：

```bash
node test/test_basic.js && node test/test_revise01.js
```

## 项目结构

```
GearZombie/
├── docs/
│   └── design/
│       ├── Engineer.md       # 工程化设计说明(模板)
│       ├── TODO.md           # 待办清单(实例)
│       ├── requirement.md    # 基本需求，程序骨架，默认 bchrt 策略
│       └── revise-01.md      # am-cloud 策略需求
├── src/
│   ├── gearzombie.js         # 核心库入口 (UMD: 浏览器 + Node)
│   ├── gearzombie.compact.js # 合并单文件版 (无模块依赖，便于嵌入)
│   └── modules/              # 模块化源码 (9 个职责单一模块)
│       ├── random.js         # 安全随机数 + 形似变换
│       ├── utils.js          # 通用工具函数
│       ├── charpresets.js    # 内置字符集预设
│       ├── rulepresets.js    # 内置规则预设 (校验/排除/相似度)
│       ├── strategy.js       # Strategy 类 + derive + generate
│       ├── registry.js       # 策略注册表
│       ├── builtins.js       # 内置 4 种策略 (bchrt/simple/pin/am-cloud)
│       ├── vault.js          # 保险库 (网站→账号→密码层级管理)
│       └── storage.js        # 浏览器 localStorage 持久化
├── test/
│   ├── test_basic.js         # 基础测试 (131 项)
│   └── test_revise01.js      # am-cloud 策略测试 (81 项)
├── index.html                # 浏览器 UI 页面
├── app.js                    # 浏览器 UI 逻辑
├── package.json              # Node.js 模块配置
└── LICENSE                   # AGPL-3.0
```

## License

AGPL-3.0
