# Personal Portfolio

一个静态个人作品集网站，汇集多个 Web 小应用、交互游戏与工具演示。项目采用纯 HTML / CSS / JavaScript 编写，无需构建工具，可直接在浏览器中打开或通过本地静态服务器访问。

主页标题为「个人电子垃圾」，以项目卡片形式展示各子项目，并配有可交互的 Canvas 无限网格背景与多套主题切换。

## 主要特性

- **作品集首页**：动态统计项目数量、技术栈与分类，卡片式浏览全部子项目
- **主题系统**：支持浅色、深色、粉色、蓝色、青色、橙色六套主题，快捷键 `1`–`6` 切换，偏好持久化至本地存储
- **Canvas 背景**：主页嵌入可拖拽的无限网格 Canvas，与主题联动，支持鼠标滚轮缩放和拖拽
- **独立子项目**：每个子目录自成一体，包含独立的 `index.html` 入口
- **响应式布局**：移动端友好，适配常见现代浏览器
- **模块化架构**：JavaScript 采用模块化设计，代码结构清晰，易于维护和扩展

## 子项目一览

| 项目 | 类型 | 路径 | 简介 |
|------|------|------|------|
| ABC 交互应用 | Tool | [projects/ABC/](projects/ABC/) | 查询英文缩写与网络用语，基于 Vue.js |
| ClickHere 游戏 | Game | [projects/ClickHere/](projects/ClickHere/) | 点击反应游戏，含音效与动画 |
| 计数器应用 | Game | [projects/counter/](projects/counter/) | 数字小球数量判断游戏，连接外部 API |
| CPS 测试器 | Tool | [projects/cps/](projects/cps/) | 点击速度（CPS）测试与统计 |
| 错误选择 | Game | [projects/error-choice/](projects/error-choice/) | 交互式选择后果演示 |
| 收藏夹样式 | Tool | [projects/favorites-style/](projects/favorites-style/) | 浏览器书签美化样式工具，支持文件上传与查看 |
| 膨胀圆圈挑战 | Game | [projects/fill-ring/](projects/fill-ring/) | 高难度反应力 Canvas 游戏 |
| 圆周率记忆 | Education | [projects/pi-memory/](projects/pi-memory/) | 圆周率背诵练习工具 |

### 项目分类

- **游戏类**：ClickHere、Counter、Error-choice、Fill-ring
- **工具类**：ABC、CPS、Favorites-style
- **教育类**：Pi-memory

旧版本实现保存在 [old/](old/) 目录下，包含早期迭代和实验性功能。

## 技术栈

| 类别 | 说明 |
|------|------|
| 前端核心 | HTML5、CSS3（Flexbox / Grid、CSS 自定义属性）、ES6+ Vanilla JavaScript |
| 框架 | Vue.js 2.x（仅 ABC 项目使用压缩版 vue.min.js） |
| Canvas | HTML5 Canvas API（背景网格、游戏渲染） |
| 音频 | HTML5 Audio API（`.ogg` 格式音效） |
| 存储 | LocalStorage（主题偏好、游戏数据持久化） |
| 构建 | 无需构建工具，纯静态站点 |
| 浏览器兼容 | 现代浏览器（Chrome、Firefox、Safari、Edge） |

### 架构设计

- **模块化 JavaScript**：采用控制器模式，核心模块包括：
  - `ThemeManager`：主题管理与持久化
  - `CanvasBackgroundController`：Canvas 网格背景控制
  - `ProjectDisplayController`：项目卡片展示
  - `HomepageController`：主页统一初始化
- **主题系统**：基于 CSS 自定义属性（CSS Variables），支持六套预设主题
- **响应式设计**：使用媒体查询和相对单位，适配多种屏幕尺寸

### 外部依赖

- ABC 缩写查询：`https://lab.magiconch.com/nbnhhsh/`
- Counter 游戏后端：`https://api.jlands.cn/counter/`

## 快速开始

### 在线访问

访问 [items.jlands.cn](https://items.jlands.cn) 查看在线演示。

### 本地运行

#### 方式一：直接打开（基础功能）

在文件管理器中双击根目录的 `index.html`，或在命令行中执行：

```powershell
# Windows PowerShell
start index.html
```

> **注意**：部分功能（如跨域请求）在 `file://` 协议下可能受限。

#### 方式二：本地静态服务器（推荐）

使用静态服务器可以完整体验所有功能：

```powershell
# Python 3
python -m http.server 8000

# Node.js (需安装 http-server)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

然后访问 [http://localhost:8000](http://localhost:8000)

### 主题切换

- **快捷键**：按键盘数字键 `1`–`6` 快速切换主题
- **鼠标操作**：点击页面左上角的主题切换按钮
- **主题列表**：
  1. 浅色主题（默认）
  2. 深色主题
  3. 粉色主题
  4. 蓝色主题
  5. 青色主题
  6. 橙色主题

### Canvas 背景操作

- **拖拽**：按住鼠标左键拖动网格
- **缩放**：鼠标滚轮放大/缩小
- **重置**：刷新页面恢复默认视图

## 项目结构

```
Personal-Portfolio/
├── index.html                          # 作品集主页入口
├── canvas.html                         # Canvas 无限网格独立演示页
├── assets/                             # 站点资源
│   ├── favicon.svg                     # 站点图标
│   ├── favicon.png
│   └── apple-touch-icon.png
├── js/                                 # 核心 JavaScript 模块
│   ├── theme-config.js                 # 主题配置定义（已弃用）
│   ├── theme-config-2.js               # 新版六套主题配置
│   ├── theme-manager.js                # 主题管理与持久化逻辑
│   ├── theme-system-controller.js      # 主题系统控制器
│   ├── canvas-background-controller.js # Canvas 背景交互控制
│   ├── homepage-theme-adapter.js       # 主页主题适配器
│   ├── projects-data.js                # 子项目元数据配置
│   ├── project-display-controller.js   # 项目卡片渲染控制
│   ├── homepage-controller.js          # 主页总控制器（初始化入口）
│   └── site-meta.js                    # 站点元信息
├── projects/                           # 子项目目录
│   ├── ABC/                            # 缩写查询工具
│   │   ├── index.html
│   │   └── js/
│   │       ├── script.js
│   │       └── vue.min.js
│   ├── ClickHere/                      # 点击游戏
│   │   ├── index.html
│   │   └── audio/
│   ├── counter/                        # 计数器游戏
│   │   ├── index.html
│   │   └── script.js
│   ├── cps/                            # CPS 测试器
│   ├── error-choice/                   # 选择游戏
│   ├── favorites-style/                # 书签样式工具
│   │   ├── index.html                  # 上传界面
│   │   ├── viewer.html                 # 查看器界面
│   │   ├── css/
│   │   └── js/
│   │       ├── favorites-script.js     # 核心脚本
│   │       ├── favorites-storage.js    # 存储管理
│   │       ├── favorites-upload.js     # 文件上传
│   │       └── favorites-viewer.js     # 查看器逻辑
│   ├── fill-ring/                      # 圆圈游戏
│   └── pi-memory/                      # 圆周率记忆
├── old/                                # 旧版本备份
│   ├── index.html                      # 旧版主页
│   ├── ABC/
│   ├── ClickHere/
│   ├── ClickHere2/
│   ├── counter/
│   │   └── server/                     # Node.js 后端实现（已废弃）
│   ├── cps/
│   ├── error-choice/
│   ├── oss/
│   ├── PinkBang/
│   └── typing/
└── .kiro/                              # Kiro 配置目录
    ├── steering/                       # 项目指导文档
    └── settings/                       # 设置文件
```

### 关键文件说明

- **`index.html`**：主页入口，加载所有核心模块
- **`js/homepage-controller.js`**：主页初始化总控，协调主题、Canvas、项目展示等模块
- **`js/projects-data.js`**：维护所有子项目的元数据（名称、路径、描述、标签等）
- **`js/theme-config-2.js`**：定义六套主题的颜色方案
- **`projects/*/index.html`**：各子项目的独立入口

### 子项目开发约定

每个子项目遵循统一结构，便于维护和扩展：

```
projects/project-name/
├── index.html          # 项目入口页面
├── js/                 # JavaScript 脚本
│   └── script.js       # 主逻辑文件
├── css/                # 样式表（可选，或内嵌在 HTML）
│   └── style.css
└── audio/              # 音效资源（可选）
    └── *.ogg           # 音频文件
```

**添加新项目的步骤：**

1. 在 `projects/` 目录下创建新的项目文件夹
2. 创建 `index.html` 作为入口文件
3. 在 `js/projects-data.js` 中添加项目元数据：
   ```javascript
   {
     name: '项目名称',
     path: 'projects/project-name/',
     description: '项目简介',
     tags: ['标签1', '标签2'],
     status: 'active'
   }
   ```
4. 刷新主页即可看到新项目卡片

## 开发指南

### 开发环境要求

- 现代浏览器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+）
- 文本编辑器或 IDE（推荐 VS Code）
- 可选：Python / Node.js / PHP（用于本地服务器）

### 开发流程

1. **克隆仓库**（或直接编辑文件）
   ```powershell
   git clone <repository-url>
   cd Personal-Portfolio
   ```

2. **启动本地服务器**
   ```powershell
   python -m http.server 8000
   ```

3. **编辑代码**
   - 修改 HTML / CSS / JavaScript 文件
   - 无需编译或构建步骤

4. **刷新浏览器**查看效果

5. **提交更改**
   ```powershell
   git add .
   git commit -m "描述更改内容"
   git push
   ```

### 代码风格指南

- **命名规范**：
  - 文件名：小写字母，连字符分隔（`theme-manager.js`）
  - 类名：大驼峰（`ThemeManager`）
  - 函数/变量：小驼峰（`getCurrentTheme`）
  - 常量：大写下划线（`DEFAULT_THEME`）
- **注释**：使用中文注释，关键逻辑必须添加说明
- **缩进**：2 个空格（JavaScript）或 4 个空格（HTML）
- **代码组织**：单一职责原则，模块间低耦合

### 主题开发

修改或添加主题需编辑 `js/theme-config-2.js`：

```javascript
const themes = [
  {
    id: 'new-theme',
    name: '新主题',
    colors: {
      background: '#ffffff',
      text: '#000000',
      // ... 其他颜色定义
    }
  }
];
```

### 调试技巧

- 使用浏览器开发者工具（F12）
- 检查 Console 输出的错误信息
- 使用 `debugger` 语句设置断点
- 检查 Network 面板查看 API 请求状态

## 部署

### 静态站点托管

项目是纯静态网站，可以部署到任何支持静态内容的平台：

- **GitHub Pages**：推送到 `gh-pages` 分支或配置 `main` 分支
- **Netlify / Vercel**：连接 Git 仓库自动部署
- **传统服务器**：上传所有文件到 Web 服务器根目录
- **对象存储**：阿里云 OSS、腾讯云 COS、AWS S3 等

### 部署注意事项

1. 确保 `index.html` 在根目录
2. 所有资源路径使用相对路径
3. 配置 CORS 策略（如果使用外部 API）
4. 建议启用 HTTPS
5. 设置适当的缓存策略（静态资源可长期缓存）

### 示例：GitHub Pages 部署

```powershell
# 推送到 gh-pages 分支
git checkout -b gh-pages
git push origin gh-pages

# 或配置 GitHub 仓库设置使用 main 分支
```

然后在 GitHub 仓库的 Settings → Pages 中启用站点。

## 性能优化建议

- **资源优化**：
  - 压缩 CSS/JS 文件（可选，当前为可读性保持未压缩）
  - 优化图片大小和格式
  - 使用 WebP 格式替代 PNG/JPG
- **加载优化**：
  - 使用 `defer` 或 `async` 加载非关键脚本
  - 实现懒加载（图片、项目卡片）
  - 减少首屏渲染时间
- **缓存策略**：
  - 设置静态资源的 Cache-Control 头
  - 使用浏览器缓存和 Service Worker
- **CDN 加速**：
  - 将静态资源托管到 CDN
  - 使用 CDN 加载第三方库

## 浏览器兼容性

| 浏览器 | 最低版本 | 备注 |
|--------|----------|------|
| Chrome | 90+ | 完全支持 |
| Firefox | 88+ | 完全支持 |
| Safari | 14+ | 完全支持 |
| Edge | 90+ | 完全支持 |
| 移动浏览器 | 现代版本 | 响应式布局 |

**所需特性：**
- CSS Grid / Flexbox
- CSS 自定义属性（CSS Variables）
- ES6+ JavaScript（箭头函数、类、模板字符串等）
- LocalStorage API
- Canvas API
- Fetch API

## 常见问题

### Q: 为什么某些项目链接无法访问？

A: 可能是以下原因：
- 项目文件不存在或路径错误
- 浏览器安全策略限制（使用本地服务器而非 `file://` 协议）
- 项目在 `projects-data.js` 中的 `status` 设为 `'inactive'`

### Q: 主题切换后刷新页面主题丢失？

A: 主题偏好保存在 LocalStorage 中，请检查：
- 浏览器是否启用了 LocalStorage
- 是否在隐私模式下浏览（隐私模式下 LocalStorage 可能受限）

### Q: Canvas 背景不显示或卡顿？

A: 可能的原因：
- 浏览器不支持 Canvas API
- 设备性能不足（可以在代码中调整网格密度）
- 浏览器硬件加速未启用

### Q: 如何添加新的主题？

A: 编辑 `js/theme-config-2.js`，在 `themes` 数组中添加新的主题对象，然后更新快捷键绑定。

### Q: 子项目可以单独运行吗？

A: 可以。每个子项目都是独立的，可以直接打开其 `index.html` 文件运行。

## 贡献指南

欢迎贡献！以下是一些贡献方式：

### 报告问题

- 使用 GitHub Issues 报告 bug
- 提供详细的重现步骤
- 附上截图或错误信息

### 提交改进

1. Fork 本仓库
2. 创建特性分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m '添加某个功能'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 发起 Pull Request

### 改进方向

- ✨ 新的子项目或工具
- 🎨 样式优化和视觉改进
- ♿ 可访问性增强（键盘导航、屏幕阅读器支持）
- 🚀 性能优化
- 📝 文档完善
- 🐛 Bug 修复
- 🧪 添加测试
- 🌐 国际化支持

### 代码审查标准

- 遵循项目现有代码风格
- 添加必要的注释
- 确保在多个浏览器中测试
- 不引入不必要的外部依赖
- 保持向后兼容性

## 许可证

本项目目前未指定许可证。如需使用或分发，请联系作者获取授权。

## 致谢

- **Vue.js**：ABC 项目使用的 MVVM 框架
- **外部 API**：感谢提供缩写查询和计数器游戏服务的 API
- **开源社区**：所有贡献者和使用者的反馈和支持

## 联系方式

- **网站**：[items.jlands.cn](https://items.jlands.cn)
- **作者**：Jlands
- **年份**：2025–2028

---

**Copyright © 2028 Jlands. All rights reserved.**

如有任何问题或建议，欢迎通过 GitHub Issues 联系。
