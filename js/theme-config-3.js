/**
 * Theme Configuration for Canvas Theme Integration
 * Defines the 4 additional themes: green, purple, orange, neon
 * (New color schemes, kept separate from theme-config.js)
 */

const THEME_CONFIG = {
    light: {
        // 生机森林绿 —— 清新自然（浅色）
        canvas: {
            bgColor: '#f1f7f2',
            lineColor: '#d5e8da',
            axisColor: '#7cbf94',
            highlightColor: '#2f7d54',
            blockColor: '#ffffff',
            highlightOpacity: 0.12
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #e9f6ed 0%, #cfe9d8 100%)',
            textColor: '#1b4332',
            cardBg: 'rgba(255, 255, 255, 0.95)',
            cardBorder: 'rgba(47, 125, 84, 0.18)',
            accentColor: '#2d8a5e',
            shadowColor: 'rgba(27, 67, 50, 0.25)', // Dark text shadow for light background
            statColor: '#1b4332',
            linkBg: 'linear-gradient(135deg, #52b788, #2d6a4f)',
            linkShadow: 'rgba(82, 183, 136, 0.35)'
        }
    },
    dark: {
        // 暮夜紫罗兰 —— 深邃神秘（深色）
        canvas: {
            bgColor: '#150f24',
            lineColor: '#2c2242',
            axisColor: '#6b5b95',
            highlightColor: '#c77dff',
            blockColor: '#c77dff',
            highlightOpacity: 0.18
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #1a1030 0%, #2b1b4d 100%)',
            textColor: '#ede7f6',
            cardBg: 'rgba(45, 30, 75, 0.35)',
            cardBorder: 'rgba(185, 140, 255, 0.22)',
            accentColor: '#b388ff',
            shadowColor: 'rgba(0, 0, 0, 0.7)', // Enhanced for text shadow
            statColor: '#ede7f6',
            linkBg: 'linear-gradient(135deg, #7c4dff, #4a2a8a)',
            linkShadow: 'rgba(124, 77, 255, 0.3)'
        }
    },
    pink: {
        // 暖阳落日橙 —— 温暖治愈（浅色）
        canvas: {
            bgColor: '#fff7ef',
            lineColor: '#ffe0c2',
            axisColor: '#ff9e57',
            highlightColor: '#d35400',
            blockColor: '#ffffff',
            highlightOpacity: 0.12
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #fff1e0 0%, #ffd9b3 100%)',
            textColor: '#6b3410',
            cardBg: 'rgba(255, 252, 247, 0.95)',
            cardBorder: 'rgba(211, 84, 0, 0.18)',
            accentColor: '#e8590c',
            shadowColor: 'rgba(107, 52, 16, 0.25)', // Dark text shadow for light background
            statColor: '#6b3410',
            linkBg: 'linear-gradient(135deg, #ff922b, #d9480f)',
            linkShadow: 'rgba(255, 146, 43, 0.35)'
        }
    },
    blue: {
        // 赛博霓虹 —— 高饱和青紫（深色）
        canvas: {
            bgColor: '#070d12',
            lineColor: '#13232e',
            axisColor: '#1f5c6b',
            highlightColor: '#00e5ff',
            blockColor: '#00e5ff',
            highlightOpacity: 0.22
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #05090f 0%, #0d2230 100%)',
            textColor: '#d6faff',
            cardBg: 'rgba(0, 229, 255, 0.1)',
            cardBorder: 'rgba(0, 229, 255, 0.3)',
            accentColor: '#00e5ff',
            shadowColor: 'rgba(0, 0, 0, 0.75)', // Enhanced for text shadow
            statColor: '#d6faff',
            linkBg: 'linear-gradient(135deg, #00e5ff, #7b2cbf)',
            linkShadow: 'rgba(0, 229, 255, 0.35)'
        }
    }
};

// Theme keys for easy iteration
const THEME_KEYS = ['green', 'purple', 'orange', 'neon'];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { THEME_CONFIG, THEME_KEYS };
}
