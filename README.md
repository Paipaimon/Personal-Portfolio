# Personal Portfolio

一个静态个人作品集网站，汇集多个 Web 小应用、交互游戏与工具演示。项目采用纯 HTML / CSS / JavaScript 编写，无需构建工具，可直接在浏览器中打开或通过本地静态服务器访问。

主页标题为「个人电子垃圾」，以项目卡片形式展示各子项目，并配有可交互的 Canvas 无限网格背景与四套主题切换。

## 主要特性

- **作品集首页**：动态统计项目数量、技术栈与分类，卡片式浏览全部子项目
- **主题系统**：支持浅色、深色、粉色、蓝色四套主题，快捷键 `1`–`4` 切换，偏好持久化至本地存储
- **Canvas 背景**：主页嵌入可拖拽的无限网格 Canvas，与主题联动
- **独立子项目**：每个子目录自成一体，包含独立的 `index.html` 入口
- **响应式布局**：移动端友好，适配常见现代浏览器

## 子项目一览

| 项目 | 类型 | 路径 | 简介 |
|------|------|------|------|
| ABC 交互应用 | Tool | [ABC/](ABC/) | 查询英文缩写与网络用语，基于 Vue.js |
| ClickHere 游戏 | Game | [ClickHere/](ClickHere/) | 点击反应游戏，含音效与动画 |
| PinkBang 特效 | Animation | [PinkBang/](PinkBang/) | 纯 CSS3 视觉特效与粒子动画 |
| 计数器应用 | Game | [counter/](counter/) | 数字小球数量判断游戏，含 Node.js 后端 |
| CPS 测试器 | Tool | [cps/](cps/) | 点击速度（CPS）测试与统计 |
| 打字练习 | Education | [typing/](typing/) | 在线打字速度与准确性练习 |
| 错误选择 | Game | [error-choice/](error-choice/) | 交互式选择后果演示 |
| 收藏夹样式 | Tool | [favorites-style/](favorites-style/) | 浏览器书签美化样式工具 |
| 膨胀圆圈挑战 | Game | [fill-ring/](fill-ring/) | 高难度反应力 Canvas 游戏 |

此外，仓库中还包含 [pi-memory/](pi-memory/) 等实验页面，以及 [old/](old/) 目录下的历史版本备份。

## 技术栈

| 类别 | 说明 |
|------|------|
| 前端 | HTML5、CSS3（Flexbox / Grid、CSS 变量）、Vanilla JavaScript |
| 框架 | Vue.js（仅 ABC 项目使用压缩版） |
| 后端 | Node.js + Express + MongoDB（Counter 游戏，见 `old/counter/server/`） |
| 音频 | HTML5 Audio API（`.ogg` 格式） |
| 构建 | 无，静态站点直接部署 |

### 外部 API

- ABC 缩写查询：`https://lab.magiconch.com/nbnhhsh/`
- Counter 游戏后端：`https://api.jlands.cn/counter/`

## 快速开始

### 直接打开

在文件管理器中双击根目录的 [index.html](index.html)，或在命令行中执行：

```bash
start index.html
```

### 本地静态服务器（推荐）

部分功能（跨域请求、模块加载等）在本地服务器环境下更稳定：

```bash
# Python 3
python -m http.server 8000

# 访问 http://localhost:8000
```

## 项目结构

```
Personal-Portfolio/
├── index.html                          # 作品集主页
├── canvas.html                         # Canvas 无限网格独立演示页
├── js/
│   ├── theme-config.js                 # 四套主题配置
│   ├── theme-manager.js                # 主题管理与持久化
│   ├── canvas-background-controller.js
│   ├── homepage-theme-adapter.js
│   ├── projects-data.js                # 子项目元数据
│   ├── theme-system-controller.js
│   ├── project-display-controller.js
│   └── homepage-controller.js          # 主页总控制器
├── ABC/                                # 各子项目目录
├── ClickHere/
├── counter/
├── cps/
├── error-choice/
├── favorites-style/
├── fill-ring/
├── PinkBang/
├── typing/
├── pi-memory/
└── old/                                # 历史版本与旧实现
```

### 子项目约定

每个子项目通常遵循以下结构：

```
project-name/
├── index.html          # 入口页
├── js/                 # 脚本（如 script.js）
├── css/                # 样式（可选）
└── audio/              # 音效资源（可选，.ogg）
```

新增子项目时，在 [js/projects-data.js](js/projects-data.js) 中追加条目即可在主页展示。

## 开发与维护

- 无需安装依赖或编译，编辑 HTML / CSS / JS 后刷新浏览器即可预览
- 主题相关逻辑集中在 `js/` 目录，由 `HomepageController` 统一协调初始化
- 子项目设计为相互独立，可单独打开各目录下的 `index.html` 调试
- 建议使用 Git 进行版本管理

## 贡献

欢迎提交改进，包括但不限于：样式优化、可访问性增强、新示例项目、代码模块化重构等。

## 许可

仓库暂未包含 LICENSE 文件。如需开源或声明使用条款，请自行添加。

---

Copyright © 2028 Jlands. All rights reserved.
