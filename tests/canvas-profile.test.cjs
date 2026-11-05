const test = require('node:test');
const assert = require('node:assert/strict');
const CanvasProfile = require('../js/canvas-profile.js');
const config = require('../js/profile-config.js');

class Element {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName;
        this.ownerDocument = ownerDocument;
        this.childNodes = [];
        this.className = '';
        this.attributes = {};
        this._text = '';
        this.hidden = false;
        this.events = new Map();
        this.style = { setProperty(key, value) { this[key] = value; } };
        this.classList = {
            add: key => { this.className = [...new Set([...this.className.split(/\s+/), key])].join(' ').trim(); },
            remove: key => { this.className = this.className.split(/\s+/).filter(value => value !== key).join(' '); },
            contains: key => this.className.split(/\s+/).includes(key)
        };
    }
    set textContent(value) { this._text = String(value); this.childNodes = []; }
    get textContent() { return this._text + this.childNodes.map(node => node.textContent).join(''); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { if (!this.events.has(type)) this.events.set(type, []); this.events.get(type).push(callback); }
    dispatch(type, event = {}) { for (const callback of this.events.get(type) || []) callback(event); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 58, height: 58 }; }
    appendChild(node) { this.childNodes.push(node); return node; }
    replaceChildren(...children) { this._text = ''; this.childNodes = children; }
    querySelector(selector) {
        const matches = node => selector === '[data-profile-content]' ? node.attributes['data-profile-content'] !== undefined
            : selector.startsWith('.') ? node.className.split(/\s+/).includes(selector.slice(1))
                : selector.startsWith('#') ? node.id === selector.slice(1) : node.tagName === selector;
        for (const child of this.childNodes) {
            if (matches(child)) return child;
            const nested = child.querySelector(selector);
            if (nested) return nested;
        }
        return null;
    }
}

function fixture(reducedMotion = false) {
    const document = {
        defaultView: { matchMedia: () => ({ matches: reducedMotion }) },
        baseURI: 'https://portfolio.example/',
        createElement(tag) { return new Element(tag, this); },
        createElementNS(_, tag) { return this.createElement(tag); }
    };
    const profile = document.createElement('section');
    const content = document.createElement('div');
    content.setAttribute('data-profile-content', '');
    const navigation = document.createElement('nav');
    profile.appendChild(content);
    profile.appendChild(navigation);
    return { profile, content, navigation };
}

test('age advances at the birthday in Asia/Shanghai, independent of the UTC day', () => {
    assert.equal(CanvasProfile.getAge('2004-11-16', '2026-11-04T00:00:00Z'), 21);
    assert.equal(CanvasProfile.getAge('2004-11-16', '2026-11-15T15:59:59.999Z'), 21);
    assert.equal(CanvasProfile.getAge('2004-11-16', '2026-11-15T16:00:00Z'), 22);
    assert.equal(CanvasProfile.getAge('2004-11-16', '2026-11-16T16:00:00Z'), 22);
    assert.equal(CanvasProfile.getAge('2004-11-16', '2004-11-15T16:00:00Z'), 0);
    assert.equal(CanvasProfile.getAge('2004-11-16', '2004-11-15T15:59:59Z'), null);
    assert.equal(CanvasProfile.getAge('2004-02-30', '2026-11-04T00:00:00Z'), null);
    assert.equal(CanvasProfile.getAge('invalid', '2026-11-04T00:00:00Z'), null);
    assert.equal(CanvasProfile.getAge('2004-11-16', 'invalid'), null);
});

test('profile configuration contains the supplied identity and five exact public contact links', () => {
    assert.equal(config.name, 'AckerLi');
    assert.equal(config.birthDate, '2004-11-16');
    assert.deepEqual(config.links.map(({ icon, url }) => [icon, url]), [
        ['bilibili', 'https://space.bilibili.com/33230715'],
        ['netease', 'https://music.163.com/#/user/home?id=482756030'],
        ['qq', 'https://qm.qq.com/q/7s6vz9hfCE'],
        ['mail', 'mailto:1602294513@qq.com'],
        ['github', 'https://github.com/Paipaimon']
    ]);
});

test('configured avatar tilts on pointer movement, waves on click and respects reduced motion', () => {
    const { profile } = fixture();
    CanvasProfile.render(profile, config);
    const avatar = profile.querySelector('.canvas-profile-avatar-button');
    assert.equal(avatar.type, 'button');
    assert.equal(avatar.attributes['aria-label'], '与 AckerLi 的头像互动');
    assert.equal(profile.querySelector('img').src, 'https://portfolio.example/assets/profile.png');
    avatar.dispatch('pointermove', { clientX: 58, clientY: 0, pointerType: 'mouse' });
    assert.equal(avatar.style['--avatar-rx'], '12deg');
    assert.equal(avatar.style['--avatar-ry'], '12deg');
    avatar.dispatch('pointerleave');
    assert.equal(avatar.style['--avatar-rx'], '0deg');
    avatar.dispatch('click');
    assert.ok(avatar.classList.contains('is-waving'));
    avatar.dispatch('animationend');
    assert.equal(avatar.classList.contains('is-waving'), false);
    const reduced = fixture(true).profile;
    CanvasProfile.render(reduced, config);
    const still = reduced.querySelector('.canvas-profile-avatar-button');
    still.dispatch('click');
    assert.equal(still.classList.contains('is-waving'), false);
});

test('rendered media icons stay at the bottom of profile content and age refresh preserves links and navigation', () => {
    const { profile, content, navigation } = fixture();
    CanvasProfile.render(profile, config);
    assert.equal(profile.querySelector('#canvas-profile-title').textContent, 'AckerLi');
    const links = profile.querySelector('.canvas-profile-links');
    assert.equal(content.childNodes.at(-1), links);
    assert.equal(links.childNodes.length, 5);
    for (const [index, anchor] of links.childNodes.entries()) {
        assert.equal(anchor.href, config.links[index].url);
        assert.equal(anchor.target, '_blank');
        assert.equal(anchor.rel, 'noopener noreferrer');
        assert.ok(anchor.className.split(' ').includes(config.links[index].icon));
        assert.equal(anchor.attributes['aria-label'], config.links[index].label);
        assert.equal(anchor.childNodes[0].tagName, 'svg');
        assert.ok(anchor.childNodes[0].childNodes.length > 0);
    }
    assert.equal(profile.childNodes.at(-1), navigation);
    assert.equal(CanvasProfile.updateAge(profile, config.birthDate, '2026-11-15T15:59:59Z'), 21);
    assert.equal(profile.querySelector('.canvas-profile-age').textContent, '年龄 21 岁');
    assert.equal(CanvasProfile.updateAge(profile, config.birthDate, '2026-11-15T16:00:00Z'), 22);
    assert.equal(profile.querySelector('.canvas-profile-age').textContent, '年龄 22 岁');
    assert.equal(profile.querySelector('.canvas-profile-links'), links);
    assert.equal(profile.childNodes.at(-1), navigation);
});

test('profile text remains text and unsafe configured links or image URLs are omitted', () => {
    const { profile } = fixture();
    const title = '<img src=x onerror=alert(1)>';
    CanvasProfile.render(profile, {
        name: title,
        avatar: 'javascript:alert(1)',
        links: [
            { label: 'Unsafe', icon: 'qq', url: 'javascript:alert(1)' },
            { label: 'Unsafe', icon: 'netease', url: 'data:text/html,<script>alert(1)</script>' },
            { label: 'Empty', icon: 'github', url: '' },
            { label: 'Email', icon: 'mail', url: 'mailto:public@example.test' }
        ]
    });
    assert.equal(profile.querySelector('#canvas-profile-title').textContent, title);
    assert.equal(profile.querySelector('img'), null);
    assert.equal(profile.querySelector('.canvas-profile-links').childNodes.length, 1);
    assert.equal(CanvasProfile.safeHref('https://example.test/', 'https://portfolio.example/'), 'https://example.test/');
    assert.equal(CanvasProfile.safeHref('https://example.test/\npath', 'https://portfolio.example/'), null);
});
