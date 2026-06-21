/**
 * Theme Configuration for Canvas Theme Integration
 * Defines the 4 supported themes: light, dark, pink, blue
 */

const THEME_CONFIG = {
    light: {
        // Canvas properties
        canvas: {
            bgColor: '#faf8f3',
            lineColor: '#e8e2d8',
            axisColor: '#cbbfae',
            highlightColor: '#8b7355',
            blockColor: '#ffffff',
            highlightOpacity: 0.1
        },
        // Homepage properties
        homepage: {
            bodyBg: 'linear-gradient(135deg, #fdfbf7 0%, #f2ece3 100%)',
            textColor: '#3d352d',
            cardBg: 'rgba(255, 253, 248, 0.95)',
            cardBorder: 'rgba(139, 115, 85, 0.12)',
            accentColor: '#a67c52',
            shadowColor: 'rgba(61, 53, 45, 0.25)',
            statColor: '#3d352d',
            linkBg: 'linear-gradient(135deg, #c8a97e, #8b7355)',
            linkShadow: 'rgba(166, 124, 82, 0.3)'
        }
    },

    dark: {
        canvas: {
            bgColor: '#121212',
            lineColor: '#2c2c2c',
            axisColor: '#5f5f5f',
            highlightColor: '#d4af37',
            blockColor: '#1e1e1e',
            highlightOpacity: 0.15
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
            textColor: '#f5f2e8',
            cardBg: 'rgba(35, 35, 35, 0.95)',
            cardBorder: 'rgba(212, 175, 55, 0.15)',
            accentColor: '#d4af37',
            shadowColor: 'rgba(0, 0, 0, 0.8)',
            statColor: '#f5f2e8',
            linkBg: 'linear-gradient(135deg, #d4af37, #8f6b1d)',
            linkShadow: 'rgba(212, 175, 55, 0.3)'
        }
    },

    pink: {
        canvas: {
            bgColor: '#f7f3ff',
            lineColor: '#d8c8ff',
            axisColor: '#b197fc',
            highlightColor: '#7b2cbf',
            blockColor: '#9d4edd',
            highlightOpacity: 0.15
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #f5f0ff 0%, #e9d8fd 100%)',
            textColor: '#4c1d95',
            cardBg: 'rgba(250, 245, 255, 0.95)',
            cardBorder: 'rgba(123, 44, 191, 0.18)',
            accentColor: '#9d4edd',
            shadowColor: 'rgba(255, 255, 255, 0.8)',
            statColor: '#4c1d95',
            linkBg: 'linear-gradient(135deg, #c77dff, #7b2cbf)',
            linkShadow: 'rgba(157, 78, 221, 0.3)'
        }
    },

    blue: {
        canvas: {
            bgColor: '#061a2b',
            lineColor: '#0f4c75',
            axisColor: '#4cc9f0',
            highlightColor: '#72efdd',
            blockColor: '#64dfdf',
            highlightOpacity: 0.2
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #0a2540 0%, #134074 100%)',
            textColor: '#e0fbfc',
            cardBg: 'rgba(23, 62, 99, 0.2)',
            cardBorder: 'rgba(76, 201, 240, 0.25)',
            accentColor: '#4cc9f0',
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            statColor: '#e0fbfc',
            linkBg: 'linear-gradient(135deg, #4cc9f0, #0077b6)',
            linkShadow: 'rgba(76, 201, 240, 0.3)'
        }
    }
};

// Theme keys for easy iteration
const THEME_KEYS = ['light', 'dark', 'pink', 'blue'];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { THEME_CONFIG, THEME_KEYS };
}