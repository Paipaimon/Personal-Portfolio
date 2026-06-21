/**
 * 项目数据配置
 * 包含所有项目的基本信息和元数据
 */

const PROJECTS_DATA = [
    {
        name: 'ABC',
        title: 'ABC 交互应用',
        type: 'Tool',
        description: '这是一个专门用于查询英文缩写和网络用语含义的Web应用工具，采用现代化的界面设计和交互体验。',
        tags: ['Vue.js', 'JavaScript', 'CSS3','API'],
        icon: 'A',
        folder: 'ABC'
    },
    {
        name: 'ClickHere',
        title: 'ClickHere 游戏',
        type: 'Game',
        description: '一个有趣的点击游戏，包含音效和动画效果，测试你的反应速度和准确性。',
        tags: ['HTML5', 'CSS3', 'Audio'],
        icon: '🎮',
        folder: 'ClickHere'
    },
    {
        name: 'PinkBang',
        title: 'PinkBang 特效',
        type: 'Animation',
        description: '炫酷的视觉特效展示，使用纯CSS3实现的动画效果和粒子系统。',
        tags: ['CSS3', 'Animation', 'Effects'],
        icon: '💥',
        folder: 'PinkBang'
    },
    {
        name: 'Counter',
        title: '计数器应用',
        type: 'Game',
        description: '是一个基于 Web 的数字小球判断游戏，玩家需要快速准确地判断屏幕上显示的小球数量。',
        tags: ['Node.js', 'Express', 'JavaScript','MongoDB'],
        icon: '📊',
        folder: 'counter'
    },
    {
        name: 'CPS',
        title: 'CPS 测试器',
        type: 'Tool',
        description: '点击速度测试工具，精确测量每秒点击次数，提供详细的统计数据。',
        tags: ['JavaScript', 'Performance', 'Testing'],
        icon: '⚡',
        folder: 'cps'
    },
    {
        name: 'Typing',
        title: '打字练习',
        type: 'Education',
        description: '在线打字练习工具，帮助提高打字速度和准确性，支持多种练习模式。',
        tags: ['JavaScript', 'Education', 'UI/UX'],
        icon: '⌨️',
        folder: 'typing'
    },
    {
        name: 'Error Choice',
        title: '错误选择',
        type: 'Game',
        description: '交互式选择游戏，通过有趣的方式展示不同选择的后果。',
        tags: ['HTML5', 'JavaScript', 'Interactive'],
        icon: '❓',
        folder: 'error-choice'
    },
    {
        name: 'Favorites Style',
        title: '收藏夹样式',
        type: 'Tool',
        description: '美化浏览器收藏夹的样式工具，提供现代化的书签管理界面。',
        tags: ['CSS3', 'Bookmarks', 'Styling'],
        icon: '⭐',
        folder: 'favorites-style'
    },
    {
        name: 'Expanding Circle Challenge',
        title: '膨胀圆圈挑战',
        type: 'Game',
        description: '一款极高难度的反应力挑战游戏。玩家需要根据中心颜色的切换快速反应按住对应的键来填充圆圈。',
        tags: ['Canvas', 'Game Loop', 'Reaction'],
        icon: '⭕',
        folder: 'fill-ring'
    }   
];

// 导出项目数据供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PROJECTS_DATA;
}