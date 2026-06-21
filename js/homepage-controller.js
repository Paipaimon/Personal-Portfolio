/**
 * 主页面控制器
 * 协调所有子控制器，管理主页面的初始化和生命周期
 */

class HomepageController {
    constructor() {
        // 控制器实例
        this.themeSystemController = null;
        this.projectDisplayController = null;
        this.keyboardShortcutsController = null;
        this.touchGesturesController = null;
        this.responsiveMonitorController = null;
        
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

            // 4. 初始化响应式监控
            await this.initializeResponsiveMonitoring();

            // 5. 设置全局引用
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
                const projectList = document.getElementById('projectList');
                if (projectList) {
                    // 平滑滚动到项目列表
                    projectList.scrollIntoView({
                        behavior: 'smooth',
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
        // 键盘快捷键
        this.keyboardShortcutsController = new KeyboardShortcutsController(this.themeManager);
        this.keyboardShortcutsController.initialize();

        // 触摸手势
        this.touchGesturesController = new TouchGesturesController(this.themeManager);
        this.touchGesturesController.initialize();
        
        console.log('交互控制器初始化完成');
    }

    /**
     * 初始化响应式监控
     */
    async initializeResponsiveMonitoring() {
        this.responsiveMonitorController = new ResponsiveMonitorController(
            this.canvasController, 
            this.themeManager
        );
        this.responsiveMonitorController.initialize();
        
        console.log('响应式监控初始化完成');
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
        return this.responsiveMonitorController ? 
               this.responsiveMonitorController.getDeviceInfo() : null;
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
            keyboardShortcuts: !!this.keyboardShortcutsController,
            touchGestures: !!this.touchGesturesController,
            responsiveMonitor: !!this.responsiveMonitorController,
            currentTheme: this.getCurrentTheme(),
            deviceInfo: this.getDeviceInfo()
        };
    }

    /**
     * 销毁主页面控制器
     */
    destroy() {
        // 销毁所有子控制器
        if (this.keyboardShortcutsController) {
            this.keyboardShortcutsController.destroy();
        }
        
        if (this.touchGesturesController) {
            this.touchGesturesController.destroy();
        }
        
        if (this.responsiveMonitorController) {
            this.responsiveMonitorController.destroy();
        }

        // 清理全局引用
        if (window.homepageController === this) {
            delete window.homepageController;
        }
        
        this.isInitialized = false;
        console.log('主页面控制器已销毁');
    }
}