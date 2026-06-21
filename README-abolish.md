# Personal-Portfolio

这是一个静态个人作品集网站，包含多个示例页面、交互组件和演示项目。项目由若干独立子目录组成，使用纯 HTML/CSS/JS 编写，适合直接在浏览器中打开或通过本地静态服务器托管。

**主要功能**

- 多个示例页面（画布、计数器、书签样式、音频示例等）。
- 使用 Vanilla JS 和少量第三方库（如 Vue 的压缩版）实现交互。
- 组织清晰的脚本与样式目录，便于扩展和复用。

**快速上手**

- 直接在浏览器中打开主页：

```bash
# Windows / 直接打开
# 在文件管理器中双击打开 README 所在目录的 index.html：
start index.html
```

- 或使用一个简单的静态服务器（推荐用于跨域或模块加载场景）：

```bash
# 使用 Python 3（当前目录为仓库根目录）
python -m http.server 8000
# 然后访问 http://localhost:8000
```

**项目结构（重要文件）**

- [index.html](index.html) — 根主页。
- [canvas.html](canvas.html) — 画布示例页面。
- [js/](js/) — 全局脚本目录，包含主题、项目展示控制器等（例如 [js/project-display-controller.js](js/project-display-controller.js)）。
- [old/index.html](old/index.html) — 旧版集合，包含历史实现与备份。
- [favorites-style/index.html](favorites-style/index.html) — 书签/收藏样式演示页面。
- [counter/index.html](counter/index.html) — 计数器示例页面。

仓库中还有若干独立子文件夹（每个文件夹下可能含有自己的 `index.html`、`js`、`css`、`audio` 等），便于按示例浏览：

- `ABC/`, `ClickHere/`, `counter/`, `cps/`, `error-choice/`, `fill-ring/`, `pi-memory/`, `PinkBang/`, `typing/` 等。

**开发与维护**

- 这是一个静态站点项目，不依赖构建工具。直接编辑 HTML/JS/CSS 并在浏览器中查看效果即可。
- 推荐使用版本控制（例如 Git）跟踪更改。

**贡献**

欢迎提交改进：样式优化、可访问性增强、示例补充或重构为模块化结构。

**许可**

默认未添加许可证，请根据需要添加 `LICENSE` 文件以声明许可条款。

---

如果你希望我为 README 添加更详细的示例截图、分类目录索引或把某个子项目单独写成说明，告诉我需要的深度和格式。