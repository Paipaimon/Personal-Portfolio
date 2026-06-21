/**
 * 主题系统控制器
 * 管理主题初始化、同步和验证
 */

class ThemeSystemController {
    constructor() {
        this.themeManager = null;
        this.canvasController = null;
        this.homepageAdapter = null;
    }

    /**
     * 初始化主题系统
     */
    initialize() {
        // Initialize theme manager with persistence
        this.themeManager = new ThemeManager(THEME_CONFIG, 'light');
        console.log('ThemeManager initialized with current theme:', this.themeManager.getCurrentThemeKey());
        
        // Initialize homepage theme adapter
        this.homepageAdapter = new HomepageThemeAdapter(this.themeManager);
        this.homepageAdapter.initialize();
        console.log('HomepageThemeAdapter initialized');
        
        // Initialize canvas background
        const canvasElement = document.getElementById('gridCanvas');
        this.canvasController = new CanvasBackgroundController(canvasElement, this.themeManager);
        this.canvasController.initialize();
        console.log('CanvasBackgroundController initialized');
        
        // Set up canvas-homepage theme synchronization
        this.setupThemeSynchronization();
        
        // Log theme system initialization
        console.log('Theme system fully initialized with themes:', this.themeManager.getAvailableThemes());
        
        return {
            themeManager: this.themeManager,
            canvasController: this.canvasController,
            homepageAdapter: this.homepageAdapter
        };
    }

    /**
     * 设置主题同步
     */
    setupThemeSynchronization() {
        // Set up canvas block click handler for theme switching
        this.canvasController.onBlockClick((targetTheme) => {
            console.log(`Block clicked with target theme: ${targetTheme}`);
            
            // Synchronize theme change across both systems
            const success = this.themeManager.setTheme(targetTheme);
            if (success) {
                console.log(`Theme synchronized successfully to: ${targetTheme}`);
            } else {
                console.error(`Failed to synchronize theme to: ${targetTheme}`);
            }
        });
        
        // Set up theme change listener for comprehensive logging and validation
        this.themeManager.onThemeChange((newTheme, oldTheme, themeConfig) => {
            console.log(`Theme synchronization: ${oldTheme} → ${newTheme}`);
            
            // Update theme indicator
            this.updateThemeIndicator(newTheme);
            
            // Validate that both canvas and homepage are using the new theme
            this.validateThemeSynchronization(newTheme, themeConfig);
        });
        
        // Set up theme indicator click handlers
        this.setupThemeIndicator();
        
        // Set up periodic synchronization check (for debugging)
        if (window.location.search.includes('debug=true')) {
            setInterval(() => {
                const currentTheme = this.themeManager.getCurrentThemeKey();
                console.log(`Theme sync check: Current theme is ${currentTheme}`);
            }, 5000);
        }
    }

    /**
     * 设置主题指示器功能
     */
    setupThemeIndicator() {
        const themeButtons = document.querySelectorAll('.theme-button');
        
        themeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTheme = button.getAttribute('data-theme');
                console.log(`Theme indicator clicked: switching to ${targetTheme}`);
                this.themeManager.setTheme(targetTheme);
            });
        });
        
        // Initialize indicator with current theme
        this.updateThemeIndicator(this.themeManager.getCurrentThemeKey());
    }

    /**
     * 更新主题指示器显示
     */
    updateThemeIndicator(activeTheme) {
        const themeButtons = document.querySelectorAll('.theme-button');
        
        themeButtons.forEach(button => {
            const buttonTheme = button.getAttribute('data-theme');
            if (buttonTheme === activeTheme) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    /**
     * 验证主题同步是否正确工作
     */
    validateThemeSynchronization(expectedTheme, themeConfig) {
        // Check if CSS custom properties are correctly set
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        // Validate homepage theme properties
        const homepageTextColor = computedStyle.getPropertyValue('--homepage-text-color').trim();
        const expectedTextColor = themeConfig.homepage.textColor;
        
        if (homepageTextColor === expectedTextColor) {
            console.log(`✓ Homepage theme synchronized correctly: ${expectedTheme}`);
        } else {
            console.warn(`⚠ Homepage theme sync issue: expected ${expectedTextColor}, got ${homepageTextColor}`);
        }
        
        // Validate canvas theme properties
        const canvasBgColor = computedStyle.getPropertyValue('--canvas-bg-color').trim();
        const expectedBgColor = themeConfig.canvas.bgColor;
        
        if (canvasBgColor === expectedBgColor) {
            console.log(`✓ Canvas theme synchronized correctly: ${expectedTheme}`);
        } else {
            console.warn(`⚠ Canvas theme sync issue: expected ${expectedBgColor}, got ${canvasBgColor}`);
        }
    }

    /**
     * 获取主题管理器实例
     */
    getThemeManager() {
        return this.themeManager;
    }

    /**
     * 获取Canvas控制器实例
     */
    getCanvasController() {
        return this.canvasController;
    }
}