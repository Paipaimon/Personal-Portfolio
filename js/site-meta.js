/**
 * 全站站点元信息（标题、描述、图标）
 */
const SITE_META = {
    title: '个人电子垃圾 · Jlands',
    shortTitle: '个人电子垃圾',
    description: '探索创意与技术的结合 — Jlands 个人作品集与小项目集合',
    themeColor: '#667eea',
    icons: {
        svg: 'favicon.svg',
        png: 'favicon.png',
        apple: 'apple-touch-icon.png'
    }
};

/**
 * 根据 site-meta.js 位置解析 assets 资源路径
 * @param {string} filename
 * @returns {string}
 */
function getSiteAssetUrl(filename) {
    const script = document.querySelector('script[src*="site-meta.js"]');
    if (!script) {
        return `assets/${filename}`;
    }

    const scriptUrl = new URL(script.getAttribute('src'), window.location.href);
    return new URL(`../assets/${filename}`, scriptUrl).pathname;
}

/**
 * 注入 favicon 与 PWA 相关 link 标签
 */
function applySiteIcons() {
    const head = document.head;
    const links = [
        { rel: 'icon', href: getSiteAssetUrl(SITE_META.icons.svg), type: 'image/svg+xml' },
        { rel: 'icon', href: getSiteAssetUrl(SITE_META.icons.png), type: 'image/png', sizes: '512x512' },
        { rel: 'apple-touch-icon', href: getSiteAssetUrl(SITE_META.icons.apple), sizes: '180x180' }
    ];

    links.forEach(({ rel, href, type, sizes }) => {
        if (head.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
            return;
        }

        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        if (type) {
            link.type = type;
        }
        if (sizes) {
            link.sizes = sizes;
        }
        head.appendChild(link);
    });
}

/**
 * 设置页面标题与基础 meta
 * @param {string} [pageTitle] 子页面专用标题，不传则保留现有标题
 */
function applySiteMeta(pageTitle) {
    if (pageTitle) {
        document.title = pageTitle;
    } else {
        const currentTitle = document.querySelector('title')?.textContent?.trim();
        if (!currentTitle) {
            document.title = SITE_META.title;
        }
    }

    const setMeta = (name, content) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = name;
            document.head.appendChild(meta);
        }
        meta.content = content;
    };

    setMeta('description', SITE_META.description);
    setMeta('theme-color', SITE_META.themeColor);
    applySiteIcons();
}
