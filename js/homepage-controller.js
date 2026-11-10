/**
 * 主页面控制器
 * 协调所有子控制器，管理主页面的初始化和生命周期
 */

class HomepageController {
    constructor() {
        // 控制器实例
        this.themeSystemController = null;
        this.projectDisplayController = null;
        this.keyboardShortcutsEnabled = false;
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // 系统组件引用
        this.themeManager = null;
        this.canvasController = null;
        this.homepageAdapter = null;
        
        // 初始化状态
        this.isInitialized = false;
    }

    /**
     * 初始化主页面
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('主页面已经初始化');
            return;
        }

        try {
            console.log('开始初始化主页面...');

            // 1. 初始化主题系统
            await this.initializeThemeSystem();

            // 2. 初始化项目展示
            await this.initializeProjectDisplay();

            // 3. 初始化交互控制器
            await this.initializeInteractionControllers();

            // 4. 设置全局引用（画布和主题适配器各自处理窗口尺寸变化）
            this.setupGlobalReferences();

            this.isInitialized = true;
            console.log('主页面初始化完成');

        } catch (error) {
            console.error('主页面初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化主题系统
     */
    async initializeThemeSystem() {
        this.themeSystemController = new ThemeSystemController();
        const themeComponents = this.themeSystemController.initialize();
        
        this.themeManager = themeComponents.themeManager;
        this.canvasController = themeComponents.canvasController;
        this.homepageAdapter = themeComponents.homepageAdapter;
        
        console.log('主题系统初始化完成');
    }

    /**
     * 初始化项目展示
     */
    async initializeProjectDisplay() {
        this.projectDisplayController = new ProjectDisplayController(PROJECTS_DATA);
        this.projectDisplayController.initialize();
        
        // 设置滚动提示点击事件
        this.setupScrollHint();
        
        console.log('项目展示初始化完成');
    }

    /**
     * 设置滚动提示点击事件
     */
    setupScrollHint() {
        const scrollHint = document.querySelector('.scroll-hint');
        if (scrollHint) {
            scrollHint.addEventListener('click', () => {
                const projectCatalog = document.getElementById('projectCatalog');
                if (projectCatalog) {
                    projectCatalog.scrollIntoView({
                        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                        block: 'start'
                    });
                    
                    console.log('滚动提示被点击，滚动到项目列表');
                }
            });
            
            console.log('滚动提示点击事件已设置');
        }
    }

    /**
     * 初始化交互控制器
     */
    async initializeInteractionControllers() {
        document.addEventListener('keydown', this.handleKeyDown);
        this.keyboardShortcutsEnabled = true;
        console.log('交互控制器初始化完成');
    }

    /**
     * 数字键切换主题；编辑个人资料时保留正常输入行为。
     */
    handleKeyDown(event) {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
            return;
        }
        const target = event.target;
        if (target && (target.isContentEditable || target.closest?.('input, textarea, select, [contenteditable="true"]'))) {
            return;
        }
        if (/^[1-9]$/.test(event.key)) {
            const theme = this.getAvailableThemes()[Number(event.key) - 1];
            if (theme) {
                this.themeManager.setTheme(theme);
            }
        }
    }

    /**
     * 设置全局引用
     */
    setupGlobalReferences() {
        // 将主要控制器暴露到全局作用域，便于调试和外部访问
        window.homepageController = this;
        window.canvasController = this.canvasController;
        window.themeManager = this.themeManager;
        
        console.log('全局引用已设置');
    }

    /**
     * 获取主题管理器
     */
    getThemeManager() {
        return this.themeManager;
    }

    /**
     * 获取Canvas控制器
     */
    getCanvasController() {
        return this.canvasController;
    }

    /**
     * 获取项目展示控制器
     */
    getProjectDisplayController() {
        return this.projectDisplayController;
    }

    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            isMobile: window.innerWidth <= 768,
            touchSupported: 'ontouchstart' in window || navigator.maxTouchPoints > 0
        };
    }

    /**
     * 切换主题
     */
    switchTheme(themeName) {
        if (this.themeManager) {
            return this.themeManager.setTheme(themeName);
        }
        return false;
    }

    /**
     * 获取当前主题
     */
    getCurrentTheme() {
        return this.themeManager ? this.themeManager.getCurrentThemeKey() : null;
    }

    /**
     * 获取可用主题列表
     */
    getAvailableThemes() {
        return this.themeManager ? this.themeManager.getAvailableThemes() : [];
    }

    /**
     * 重新渲染项目列表
     */
    refreshProjectList() {
        if (this.projectDisplayController) {
            this.projectDisplayController.renderProjectList();
        }
    }

    /**
     * 搜索项目
     */
    searchProjects(query) {
        return this.projectDisplayController ? 
               this.projectDisplayController.searchProjects(query) : [];
    }

    /**
     * 获取系统状态
     */
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            themeSystem: !!this.themeSystemController,
            projectDisplay: !!this.projectDisplayController,
            keyboardShortcuts: this.keyboardShortcutsEnabled,
            touchGestures: !!this.canvasController,
            responsiveMonitor: !!this.homepageAdapter,
            currentTheme: this.getCurrentTheme(),
            deviceInfo: this.getDeviceInfo()
        };
    }

    /**
     * 销毁主页面控制器
     */
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        this.keyboardShortcutsEnabled = false;
        this.canvasController?.destroy();

        // 清理全局引用
        if (window.homepageController === this) {
            delete window.homepageController;
        }
        if (window.canvasController === this.canvasController) {
            delete window.canvasController;
        }
        if (window.themeManager === this.themeManager) {
            delete window.themeManager;
        }
        
        this.isInitialized = false;
        console.log('主页面控制器已销毁');
    }
}
