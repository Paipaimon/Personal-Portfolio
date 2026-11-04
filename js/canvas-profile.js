/** Render public profile configuration as text and locally defined SVG icons. */
(function (root) {
    'use strict';

    const ICONS = {
        github: [
            ['path', { d: 'M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .1-1.5-.5-2 3.3-.4 6.5-1.6 6.5-7A5.4 5.4 0 0 0 19.5 5c.2-1 .1-2-.4-3 0 0-1.2-.4-4.1 1.5a14 14 0 0 0-7 0C5.1 1.6 3.9 2 3.9 2c-.5 1-.6 2-.4 3A5.4 5.4 0 0 0 2 9c0 5.4 3.2 6.6 6.5 7-.5.4-.6 1-.5 2v4' }]
        ],
        bilibili: [
            ['rect', { x: '3', y: '6', width: '18', height: '14', rx: '3' }],
            ['path', { d: 'm7 2 3 4m7-4-3 4M8 11v3m8-3v3m-7 3 3 1 3-1' }]
        ],
        mail: [
            ['rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }],
            ['path', { d: 'm3 6 9 7 9-7' }]
        ],
        link: [
            ['path', { d: 'M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7 7l2-2' }]
        ],
        phone: [
            ['path', { d: 'M21 16v3a2 2 0 0 1-2.2 2 18 18 0 0 1-16-16A2 2 0 0 1 5 3h3l2 5-3 2a14 14 0 0 0 7 7l2-3 5 2Z' }]
        ],
        wechat: [
            ['path', { d: 'M14 12c0-4-3-7-7-7S0 8 0 12c0 2 1 4 3 5v3l3-2h2m15-3c0-3-3-5-6-5s-6 2-6 5 3 5 6 5h2l3 2v-3c1-1 1-2 1-4Z' }],
            ['path', { d: 'M5 10h.01M9 10h.01M15 15h.01M19 15h.01', 'stroke-width': '2.5' }]
        ],
        video: [
            ['rect', { x: '2', y: '5', width: '15', height: '14', rx: '2' }],
            ['path', { d: 'm17 10 5-3v10l-5-3' }]
        ],
        location: [
            ['path', { d: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z' }],
            ['circle', { cx: '12', cy: '10', r: '2.5' }]
        ]
    };

    function safeHref(value, base, image = false) {
        if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value)) return null;
        const raw = value.trim();
        try {
            const url = new URL(raw, base || 'https://portfolio.invalid/');
            if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
            if (!image && (url.protocol === 'mailto:' || url.protocol === 'tel:') && url.pathname) return url.href;
        } catch (_) { /* An invalid configured URL is simply omitted. */ }
        return null;
    }

    function icon(document, name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const attributes = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
        Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, value));
        for (const [tag, attributes] of ICONS[name] || ICONS.link) {
            const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
            Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
            svg.appendChild(shape);
        }
        return svg;
    }

    function render(element, config = {}) {
        const document = element.ownerDocument;
        const content = element.querySelector('[data-profile-content]') || element;
        content.replaceChildren();
        const text = (tag, className, value) => {
            const node = document.createElement(tag);
            node.className = className;
            node.textContent = typeof value === 'string' ? value : '';
            return node;
        };
        const name = typeof config.name === 'string' && config.name.trim() ? config.name : '关于我';
        content.appendChild(text('p', 'canvas-profile-eyebrow', '01 / 关于我'));
        const heading = document.createElement('div');
        heading.className = 'canvas-profile-heading';
        const initials = Array.from(name.trim()).slice(0, 2).join('').toUpperCase();
        const avatarUrl = safeHref(config.avatar, document.baseURI, true);
        let avatar = text('span', 'canvas-profile-avatar', initials);
        avatar.setAttribute('aria-hidden', 'true');
        if (avatarUrl) {
            const photo = document.createElement('img');
            photo.className = 'canvas-profile-avatar';
            photo.src = avatarUrl;
            photo.alt = '';
            photo.referrerPolicy = 'no-referrer';
            photo.addEventListener('error', () => photo.replaceWith(avatar), { once: true });
            heading.appendChild(photo);
        } else heading.appendChild(avatar);
        const identity = document.createElement('div');
        const title = text('h2', '', name);
        title.id = 'canvas-profile-title';
        identity.appendChild(title);
        if (config.title) identity.appendChild(text('p', 'canvas-profile-role', config.title));
        heading.appendChild(identity);
        content.appendChild(heading);
        if (config.bio) content.appendChild(text('p', 'canvas-profile-bio', config.bio));
        if (config.location) {
            const location = text('p', 'canvas-profile-location', '');
            location.appendChild(icon(document, 'location'));
            location.appendChild(text('span', '', config.location));
            content.appendChild(location);
        }
        const links = document.createElement('div');
        links.className = 'canvas-profile-links';
        for (const item of Array.isArray(config.links) ? config.links : []) {
            if (!item || typeof item !== 'object') continue;
            const href = safeHref(item.url, document.baseURI);
            if (!href) continue;
            const anchor = document.createElement('a');
            anchor.className = 'canvas-profile-link';
            anchor.href = href;
            const label = typeof item.label === 'string' && item.label.trim() ? item.label : '联系链接';
            anchor.title = label;
            anchor.setAttribute('aria-label', label);
            if (/^https?:/.test(href)) {
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
            }
            anchor.appendChild(icon(document, item.icon));
            links.appendChild(anchor);
        }
        if (links.childNodes.length) content.appendChild(links);
    }

    root.CanvasProfile = { render, safeHref };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CanvasProfile;
})(typeof globalThis !== 'undefined' ? globalThis : window);
