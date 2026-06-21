/**
 * ThemeManager - Central theme coordination system
 * Manages theme state and synchronization between canvas and homepage
 */

class ThemeManager {
    constructor(themes = THEME_CONFIG, initialTheme = 'light') {
        this.themes = themes;
        this.changeCallbacks = [];
        
        // Load persisted theme or use initial theme
        this.currentThemeKey = this.loadPersistedTheme() || initialTheme;
        
        // Initialize CSS custom properties
        this.initializeCSSProperties();
        
        // Apply initial theme
        this.applyTheme(this.currentThemeKey);
    }

    /**
     * Initialize CSS custom properties for dynamic theme application
     */
    initializeCSSProperties() {
        const root = document.documentElement;
        
        // Set up CSS custom properties for each theme property
        const sampleTheme = this.themes[this.currentThemeKey];
        
        // Canvas properties
        if (sampleTheme.canvas) {
            Object.keys(sampleTheme.canvas).forEach(key => {
                root.style.setProperty(`--canvas-${this.kebabCase(key)}`, sampleTheme.canvas[key]);
            });
        }
        
        // Homepage properties
        if (sampleTheme.homepage) {
            Object.keys(sampleTheme.homepage).forEach(key => {
                root.style.setProperty(`--homepage-${this.kebabCase(key)}`, sampleTheme.homepage[key]);
            });
        }
    }

    /**
     * Convert camelCase to kebab-case for CSS custom properties
     */
    kebabCase(str) {
        return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * Get the current theme configuration
     */
    getCurrentTheme() {
        return this.themes[this.currentThemeKey];
    }

    /**
     * Get the current theme key
     */
    getCurrentThemeKey() {
        return this.currentThemeKey;
    }

    /**
     * Set the active theme
     * @param {string} themeKey - The theme key to activate
     */
    setTheme(themeKey) {
        if (!this.themes[themeKey]) {
            console.warn(`Theme '${themeKey}' not found. Available themes:`, Object.keys(this.themes));
            return false;
        }

        if (themeKey === this.currentThemeKey) {
            return true; // Already active
        }

        const oldTheme = this.currentThemeKey;
        this.currentThemeKey = themeKey;

        // Persist theme choice
        this.persistTheme(themeKey);

        // Apply the theme
        this.applyTheme(themeKey);

        // Notify callbacks
        this.notifyThemeChange(themeKey, oldTheme);

        return true;
    }

    /**
     * Apply theme to both homepage and canvas
     * @param {string} themeKey - The theme key to apply
     */
    applyTheme(themeKey) {
        const theme = this.themes[themeKey];
        if (!theme) return;

        // Apply to homepage
        this.applyThemeToHomepage(theme);
        
        // Apply to canvas (will be handled by canvas controller)
        this.applyThemeToCanvas(theme);
        
        // Update body class for additional styling
        this.updateBodyClass(themeKey);
    }

    /**
     * Apply theme to homepage elements
     * @param {Object} theme - The theme configuration object
     */
    applyThemeToHomepage(theme) {
        const root = document.documentElement;
        
        if (theme.homepage) {
            // Update CSS custom properties
            Object.entries(theme.homepage).forEach(([key, value]) => {
                root.style.setProperty(`--homepage-${this.kebabCase(key)}`, value);
            });
            
            // Apply to body background
            if (theme.homepage.bodyBg) {
                document.body.style.background = theme.homepage.bodyBg;
            }
            
            // Apply text color
            if (theme.homepage.textColor) {
                document.body.style.color = theme.homepage.textColor;
            }
        }
    }

    /**
     * Apply theme to canvas (updates CSS custom properties for canvas use)
     * @param {Object} theme - The theme configuration object
     */
    applyThemeToCanvas(theme) {
        const root = document.documentElement;
        
        if (theme.canvas) {
            // Update CSS custom properties for canvas
            Object.entries(theme.canvas).forEach(([key, value]) => {
                root.style.setProperty(`--canvas-${this.kebabCase(key)}`, value);
            });
        }
    }

    /**
     * Update body class for theme-specific styling
     * @param {string} themeKey - The theme key
     */
    updateBodyClass(themeKey) {
        // Remove all theme classes
        Object.keys(this.themes).forEach(key => {
            document.body.classList.remove(`theme-${key}`);
        });
        
        // Add current theme class
        document.body.classList.add(`theme-${themeKey}`);
    }

    /**
     * Register a callback for theme changes
     * @param {Function} callback - Function to call when theme changes
     */
    onThemeChange(callback) {
        if (typeof callback === 'function') {
            this.changeCallbacks.push(callback);
        }
    }

    /**
     * Remove a theme change callback
     * @param {Function} callback - The callback to remove
     */
    offThemeChange(callback) {
        const index = this.changeCallbacks.indexOf(callback);
        if (index > -1) {
            this.changeCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify all callbacks of theme change
     * @param {string} newTheme - The new theme key
     * @param {string} oldTheme - The previous theme key
     */
    notifyThemeChange(newTheme, oldTheme) {
        this.changeCallbacks.forEach(callback => {
            try {
                callback(newTheme, oldTheme, this.getCurrentTheme());
            } catch (error) {
                console.error('Error in theme change callback:', error);
            }
        });
    }

    /**
     * Get all available theme keys
     */
    getAvailableThemes() {
        return Object.keys(this.themes);
    }

    /**
     * Check if a theme exists
     * @param {string} themeKey - The theme key to check
     */
    hasTheme(themeKey) {
        return this.themes.hasOwnProperty(themeKey);
    }

    /**
     * Get theme configuration for a specific theme
     * @param {string} themeKey - The theme key
     * @returns {Object|null} Theme configuration object or null if not found
     */
    getThemeConfig(themeKey) {
        return this.themes[themeKey] || null;
    }

    /**
     * Load persisted theme from localStorage
     * @returns {string|null} Persisted theme key or null if not found
     */
    loadPersistedTheme() {
        try {
            const persistedTheme = localStorage.getItem('canvas-theme-integration-theme');
            if (persistedTheme && this.themes[persistedTheme]) {
                console.log(`Loaded persisted theme: ${persistedTheme}`);
                return persistedTheme;
            }
        } catch (error) {
            console.warn('Failed to load persisted theme:', error);
        }
        return null;
    }

    /**
     * Persist theme choice to localStorage
     * @param {string} themeKey - The theme key to persist
     */
    persistTheme(themeKey) {
        try {
            localStorage.setItem('canvas-theme-integration-theme', themeKey);
            console.log(`Persisted theme: ${themeKey}`);
        } catch (error) {
            console.warn('Failed to persist theme:', error);
        }
    }

    /**
     * Clear persisted theme from localStorage
     */
    clearPersistedTheme() {
        try {
            localStorage.removeItem('canvas-theme-integration-theme');
            console.log('Cleared persisted theme');
        } catch (error) {
            console.warn('Failed to clear persisted theme:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}