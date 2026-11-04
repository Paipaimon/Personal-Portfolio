/**
 * 个人信息配置：修改此文件后发布即可更新，页面不提供编辑或本地保存入口。
 * 这里的内容会公开给所有访客，请只填写愿意展示的信息。
 * avatar 可填站内图片路径（如 assets/avatar.png）或 HTTPS 图片地址。
 * links 的 url 留空时不显示该图标；支持 https://、mailto:、tel:。
 * icon 可选 github / bilibili / mail / link / phone / wechat / video。
 */
(function (root) {
    'use strict';

    const profile = {
        name: 'Jlands',
        title: '创意 / 技术 / 一些有趣的小项目',
        bio: '探索创意与技术的结合。\n在网格里，记录想法与日常。',
        location: '中国',
        avatar: '',
        snakeSeed: 'canvas-2026', // 自动贪吃蛇初始种子，可输入数字或文字。
        links: [
            { label: 'GitHub', icon: 'github', url: '' },
            { label: '哔哩哔哩', icon: 'bilibili', url: '' },
            { label: '个人网站', icon: 'link', url: '' },
            { label: '电子邮箱', icon: 'mail', url: '' }, // 例如 mailto:you@example.com
            { label: '联系电话', icon: 'phone', url: '' }, // 例如 tel:+8613800000000
            { label: '微信', icon: 'wechat', url: '' }, // 可填微信联系页或二维码图片页地址
            { label: '视频频道', icon: 'video', url: '' }
        ]
    };

    profile.links = Object.freeze(profile.links.map(link => Object.freeze(link)));
    root.PORTFOLIO_PROFILE = Object.freeze(profile);
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PORTFOLIO_PROFILE;
})(typeof globalThis !== 'undefined' ? globalThis : window);
