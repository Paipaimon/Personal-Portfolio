/**
 * 个人信息配置：修改此文件后发布即可更新，页面不提供编辑或本地保存入口。
 * 这里的内容会公开给所有访客，请只填写愿意展示的信息。
 * avatar 可填站内图片路径（如 assets/avatar.png）或 HTTPS 图片地址。
 * links 的 url 留空时不显示该图标；支持 https://、mailto:、tel:。
 * birthDate 使用 YYYY-MM-DD，年龄按上海时区的当前日期自动计算。
 * icon 可选 github / bilibili / netease / qq / mail / link / phone / wechat / video。
 */
(function (root) {
    'use strict';

    const profile = {
        name: 'AckerLi',
        birthDate: '2004-11-16',
        title: '创意 / 技术 / 一些有趣的小项目',
        bio: '探索创意与技术的结合。\n在网格里，记录想法与日常。',
        location: '中国',
        avatar: '',
        links: [
            { label: '哔哩哔哩', icon: 'bilibili', url: 'https://space.bilibili.com/33230715' },
            { label: '网易云音乐', icon: 'netease', url: 'https://music.163.com/#/user/home?id=482756030' },
            { label: 'QQ', icon: 'qq', url: 'https://qm.qq.com/q/7s6vz9hfCE' },
            { label: '电子邮箱', icon: 'mail', url: 'mailto:1602294513@qq.com' },
            { label: 'GitHub', icon: 'github', url: 'https://github.com/1602294513' }
        ]
    };

    profile.links = Object.freeze(profile.links.map(link => Object.freeze(link)));
    root.PORTFOLIO_PROFILE = Object.freeze(profile);
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PORTFOLIO_PROFILE;
})(typeof globalThis !== 'undefined' ? globalThis : window);
