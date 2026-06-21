/**
 * Theme Configuration for Canvas Theme Integration
 * Defines the 4 supported themes: light, dark, pink, blue
 */

const THEME_CONFIG = {
    light: {
        // Canvas properties
        canvas: {
            bgColor: '#f7f7f7',
            lineColor: '#e0e0e0',
            axisColor: '#bbbbbb',
            highlightColor: '#000000',
            blockColor: '#ffffff',
            highlightOpacity: 0.1
        },
        // Homepage properties
        homepage: {
            bodyBg: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            textColor: '#212529',
            cardBg: 'rgba(255, 255, 255, 0.95)',
            cardBorder: 'rgba(0, 0, 0, 0.1)',
            accentColor: '#6c757d',
            shadowColor: 'rgba(0, 0, 0, 0.4)', // Enhanced for text shadow
            statColor: '#212529', // Changed to textColor for consistency
            linkBg: 'linear-gradient(135deg, #667eea, #764ba2)',
            linkShadow: 'rgba(102, 126, 234, 0.3)'
        }
    },
    dark: {
        canvas: {
            bgColor: '#0f0f0f',
            lineColor: '#2a2a2a',
            axisColor: '#444444',
            highlightColor: '#ffffff',
            blockColor: '#000000',
            highlightOpacity: 0.15
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
            textColor: '#f8f9fa',
            cardBg: 'rgba(40, 40, 40, 0.95)',
            cardBorder: 'rgba(255, 255, 255, 0.1)',
            accentColor: '#6c757d',
            shadowColor: 'rgba(0, 0, 0, 0.8)', // Enhanced for text shadow
            statColor: '#f8f9fa',
            linkBg: 'linear-gradient(135deg, #4a5568, #2d3748)',
            linkShadow: 'rgba(74, 85, 104, 0.3)'
        }
    },
    pink: {
        canvas: {
            bgColor: '#fff0f5',
            lineColor: '#ffc0cb',
            axisColor: '#ff69b4',
            highlightColor: '#d6336c',
            blockColor: '#d6336c',
            highlightOpacity: 0.15
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
            textColor: '#880e4f',
            cardBg: 'rgba(255, 240, 245, 0.95)',
            cardBorder: 'rgba(216, 27, 96, 0.2)',
            accentColor: '#ad1457',
            shadowColor: 'rgba(255, 255, 255, 0.8)', // Light shadow for dark text on light background
            statColor: '#880e4f',
            linkBg: 'linear-gradient(135deg, #e91e63, #ad1457)',
            linkShadow: 'rgba(233, 30, 99, 0.3)'
        }
    },
    blue: {
        canvas: {
            bgColor: '#001f3f',
            lineColor: '#0074d9',
            axisColor: '#7fdbff',
            highlightColor: '#39cccc',
            blockColor: '#39cccc',
            highlightOpacity: 0.2
        },
        homepage: {
            bodyBg: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)',
            textColor: '#e3f2fd',
            cardBg: 'rgba(25, 118, 210, 0.15)',
            cardBorder: 'rgba(100, 181, 246, 0.3)',
            accentColor: '#42a5f5',
            shadowColor: 'rgba(0, 0, 0, 0.6)', // Enhanced for text shadow
            statColor: '#e3f2fd',
            linkBg: 'linear-gradient(135deg, #1976d2, #0d47a1)',
            linkShadow: 'rgba(25, 118, 210, 0.3)'
        }
    }
};

// Theme keys for easy iteration
const THEME_KEYS = ['light', 'dark', 'pink', 'blue'];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { THEME_CONFIG, THEME_KEYS };
}