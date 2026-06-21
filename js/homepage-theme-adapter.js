/**
 * Homepage Theme Adapter
 * Applies theme changes to homepage elements and maintains visual consistency
 */
class HomepageThemeAdapter {
    constructor(themeManager) {
        this.themeManager = themeManager;
        this.root = document.documentElement;
        this.isInitialized = false;
    }
    
    /**
     * Apply theme to homepage elements
     */
    applyTheme(themeKey) {
        const themeConfig = this.themeManager.themes[themeKey];
        if (!themeConfig || !themeConfig.homepage) {
            console.warn(`Theme config not found for theme: ${themeKey}`);
            return;
        }
        
        const homepageTheme = themeConfig.homepage;
        const canvasTheme = themeConfig.canvas;
        
        // Apply CSS custom properties for homepage
        this.root.style.setProperty('--homepage-body-bg', homepageTheme.bodyBg);
        this.root.style.setProperty('--homepage-text-color', homepageTheme.textColor);
        this.root.style.setProperty('--homepage-card-bg', homepageTheme.cardBg);
        this.root.style.setProperty('--homepage-card-border', homepageTheme.cardBorder);
        this.root.style.setProperty('--homepage-accent-color', homepageTheme.accentColor);
        this.root.style.setProperty('--homepage-shadow-color', homepageTheme.shadowColor);
        this.root.style.setProperty('--homepage-stat-color', homepageTheme.statColor);
        this.root.style.setProperty('--homepage-link-bg', homepageTheme.linkBg);
        this.root.style.setProperty('--homepage-link-shadow', homepageTheme.linkShadow);
        
        // Apply canvas properties to CSS variables for future use
        this.root.style.setProperty('--canvas-bg-color', canvasTheme.bgColor);
        this.root.style.setProperty('--canvas-line-color', canvasTheme.lineColor);
        this.root.style.setProperty('--canvas-axis-color', canvasTheme.axisColor);
        this.root.style.setProperty('--canvas-highlight-color', canvasTheme.highlightColor);
        this.root.style.setProperty('--canvas-block-color', canvasTheme.blockColor);
        this.root.style.setProperty('--canvas-highlight-opacity', canvasTheme.highlightOpacity);
        
        // Update specific elements
        this.updateProjectCards(themeConfig);
        this.updateHeader(themeConfig);
        this.updateStats(themeConfig);
        this.updateContainer(themeConfig);
        
        // Add theme class to body for additional styling
        this.updateBodyClass(themeKey);
        
        // Log theme application for debugging
        console.log(`Applied theme: ${themeKey}`);
    }
    
    /**
     * Update project cards styling with enhanced backgrounds for transparency
     */
    updateProjectCards(themeConfig) {
        const projectItems = document.querySelectorAll('.project-item');
        const homepageTheme = themeConfig.homepage;
        
        projectItems.forEach(item => {
            // Enhanced background for better readability on transparent container
            item.style.setProperty('--item-bg', homepageTheme.cardBg);
            item.style.setProperty('--item-border', homepageTheme.cardBorder);
            item.style.setProperty('--item-shadow', homepageTheme.shadowColor);
            
            // Ensure solid background for project cards
            item.style.background = homepageTheme.cardBg;
            item.style.border = `1px solid ${homepageTheme.cardBorder}`;
            item.style.boxShadow = `0 8px 32px ${homepageTheme.shadowColor}`;
            
            // 确保项目卡片可以交互（覆盖container的pointer-events: none）
            item.style.pointerEvents = 'auto';
            
            // Update text colors within cards
            const title = item.querySelector('.project-title');
            const description = item.querySelector('.project-description');
            const type = item.querySelector('.project-type');
            
            if (title) {
                title.style.color = homepageTheme.textColor;
            }
            if (description) {
                description.style.color = homepageTheme.textColor;
            }
            if (type) {
                type.style.color = homepageTheme.accentColor;
            }
        });
        
        // Update project links and tags with theme colors
        this.updateProjectLinks(homepageTheme);
        this.updateProjectTags(homepageTheme);
        this.updateProjectIcons(homepageTheme);
    }
    
    /**
     * 确保项目卡片和相关元素保持交互性
     */
    updateProjectCardsInteraction() {
        // 项目列表容器需要恢复交互
        const projectList = document.querySelector('.project-list');
        if (projectList) {
            projectList.style.pointerEvents = 'auto';
        }
        
        // 确保所有项目卡片可以交互
        const projectItems = document.querySelectorAll('.project-item');
        projectItems.forEach(item => {
            item.style.pointerEvents = 'auto';
            
            // 确保卡片内的所有交互元素都可用
            const interactiveElements = item.querySelectorAll('a, button, .project-link');
            interactiveElements.forEach(element => {
                element.style.pointerEvents = 'auto';
            });
        });
        
        // 确保项目链接可以点击
        const projectLinks = document.querySelectorAll('.project-link');
        projectLinks.forEach(link => {
            link.style.pointerEvents = 'auto';
        });
        
        // 确保标签可以交互（如果有点击功能）
        const tags = document.querySelectorAll('.tag');
        tags.forEach(tag => {
            tag.style.pointerEvents = 'auto';
        });
    }
    
    /**
     * Update project links styling
     */
    updateProjectLinks(homepageTheme) {
        const projectLinks = document.querySelectorAll('.project-link');
        
        projectLinks.forEach(link => {
            // Apply theme-specific gradient
            link.style.background = homepageTheme.linkBg;
            link.style.boxShadow = `0 4px 15px ${homepageTheme.linkShadow}`;
            
            // Update hover effects
            link.addEventListener('mouseenter', () => {
                link.style.boxShadow = `0 8px 25px ${homepageTheme.linkShadow}`;
            });
            
            link.addEventListener('mouseleave', () => {
                link.style.boxShadow = `0 4px 15px ${homepageTheme.linkShadow}`;
            });
        });
    }
    
    /**
     * Update project tags styling
     */
    updateProjectTags(homepageTheme) {
        const tags = document.querySelectorAll('.tag');
        
        tags.forEach(tag => {
            // Apply theme-specific background
            tag.style.background = homepageTheme.linkBg;
            tag.style.color = 'white';
        });
    }
    
    /**
     * Update project icons styling
     */
    updateProjectIcons(homepageTheme) {
        const icons = document.querySelectorAll('.project-icon');
        
        icons.forEach(icon => {
            // Apply theme-specific gradient
            icon.style.background = homepageTheme.linkBg;
            icon.style.color = 'white';
        });
    }
    
    /**
     * Update header styling with complete transparency for perfect canvas interaction
     * 取消子元素的块级特性，实现完美的canvas点击穿透
     */
    updateHeader(themeConfig) {
        const header = document.querySelector('.header');
        const homepageTheme = themeConfig.homepage;
        
        if (header) {
            // Complete transparency for full canvas interaction
            header.style.background = 'transparent';
            header.style.borderRadius = 'none';
            header.style.padding = '30px';
            header.style.margin = '0 0 40px 0';
            header.style.boxShadow = 'none';
            header.style.border = 'none';
            // 确保header不阻挡canvas交互
            header.style.pointerEvents = 'none';
            
            // Update header text with complete transparency - no boxes or backgrounds
            const headerTitle = header.querySelector('h1');
            const headerDesc = header.querySelector('p');
            
            if (headerTitle) {
                headerTitle.style.color = homepageTheme.textColor;
                // Enhanced text shadow for better readability on canvas
                headerTitle.style.textShadow = `
                    0 0 10px ${homepageTheme.shadowColor},
                    0 2px 4px ${homepageTheme.shadowColor},
                    0 4px 8px ${homepageTheme.shadowColor}
                `;
                headerTitle.style.fontWeight = '700';
                
                // 关键修改：取消块级元素特性，允许canvas点击穿透
                headerTitle.style.pointerEvents = 'none';
                headerTitle.style.display = 'inline';
                headerTitle.style.position = 'relative';
                headerTitle.style.zIndex = '1';
                
                // 完全移除任何可能的框或背景
                headerTitle.style.background = 'transparent';
                headerTitle.style.border = 'none';
                headerTitle.style.outline = 'none';
                headerTitle.style.boxShadow = 'none';
                headerTitle.style.padding = '0';
                headerTitle.style.margin = '0';
                headerTitle.style.borderRadius = '0';
                headerTitle.style.backdropFilter = 'none';
            }
            
            if (headerDesc) {
                headerDesc.style.color = homepageTheme.textColor;
                headerDesc.style.textShadow = `
                    0 0 8px ${homepageTheme.shadowColor},
                    0 2px 4px ${homepageTheme.shadowColor}
                `;
                headerDesc.style.opacity = '0.95';
                headerDesc.style.fontWeight = '500';
                
                // 关键修改：取消块级元素特性，允许canvas点击穿透
                headerDesc.style.pointerEvents = 'none';
                headerDesc.style.display = 'inline';
                headerDesc.style.position = 'relative';
                headerDesc.style.zIndex = '1';
                
                // 完全移除任何可能的框或背景
                headerDesc.style.background = 'transparent';
                headerDesc.style.border = 'none';
                headerDesc.style.outline = 'none';
                headerDesc.style.boxShadow = 'none';
                headerDesc.style.padding = '0';
                headerDesc.style.margin = '0';
                headerDesc.style.borderRadius = '0';
                headerDesc.style.backdropFilter = 'none';
            }
        }
    }
    
    /**
     * Update stats section styling with full transparency for canvas interaction
     * 取消stats子元素的块级特性，实现完美的canvas点击穿透
     */
    updateStats(themeConfig) {
        const statsContainer = document.querySelector('.stats');
        const statNumbers = document.querySelectorAll('.stat-number');
        const statLabels = document.querySelectorAll('.stat-label');
        const homepageTheme = themeConfig.homepage;
        
        // Remove background from stats container for full transparency and canvas interaction
        if (statsContainer) {
            statsContainer.style.background = 'transparent';
            statsContainer.style.borderRadius = 'none';
            statsContainer.style.padding = '20px';
            statsContainer.style.margin = '20px 0';
            statsContainer.style.boxShadow = 'none';
            statsContainer.style.border = 'none';
            // 确保stats不阻挡canvas交互
            statsContainer.style.pointerEvents = 'none';
        }
        
        // 处理stat-item元素，取消块级特性
        const statItems = document.querySelectorAll('.stat-item');
        statItems.forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.display = 'inline-block';
            item.style.position = 'relative';
            item.style.zIndex = '1';
        });
        
        statNumbers.forEach(stat => {
            stat.style.color = homepageTheme.textColor;
            stat.style.fontWeight = 'bold';
            // Enhanced text shadow for better visibility on canvas
            stat.style.textShadow = `
                0 0 8px ${homepageTheme.shadowColor},
                0 2px 4px ${homepageTheme.shadowColor}
            `;
            // 取消块级特性，允许canvas点击穿透
            stat.style.pointerEvents = 'none';
            stat.style.display = 'inline';
            stat.style.position = 'relative';
            stat.style.zIndex = '1';
        });
        
        statLabels.forEach(label => {
            label.style.color = homepageTheme.textColor;
            label.style.opacity = '0.9';
            label.style.fontWeight = '500';
            // Enhanced text shadow for better visibility on canvas
            label.style.textShadow = `
                0 0 6px ${homepageTheme.shadowColor},
                0 1px 3px ${homepageTheme.shadowColor}
            `;
            // 取消块级特性，允许canvas点击穿透
            label.style.pointerEvents = 'none';
            label.style.display = 'inline';
            label.style.position = 'relative';
            label.style.zIndex = '1';
        });
    }
    
    /**
     * Update container and body styling with transparent background and canvas interaction
     * Requirements 5.1, 5.2: Mobile theme functionality and responsive adaptation
     */
    updateContainer(themeConfig) {
        const body = document.body;
        const homepageTheme = themeConfig.homepage;
        const isMobile = window.innerWidth <= 768;
        
        // Apply body background (since canvas is background, we need overlay)
        if (homepageTheme.bodyBg) {
            // Keep body transparent to show canvas background
            body.style.background = 'transparent';
            body.style.color = homepageTheme.textColor;
            
            // Make container completely transparent for canvas interaction
            const container = document.querySelector('.container');
            if (container) {
                // Remove all background effects for full transparency
                container.style.backdropFilter = 'none';
                container.style.background = 'transparent';
                
                // Keep layout properties but remove visual background
                container.style.borderRadius = isMobile ? '15px' : '20px';
                container.style.padding = isMobile ? '15px' : '20px';
                
                // Remove box shadow for cleaner look
                container.style.boxShadow = 'none';
                
                // 允许canvas交互穿透container
                container.style.pointerEvents = 'none';
                
                // Add responsive margin for mobile
                if (isMobile) {
                    container.style.margin = '10px';
                    container.style.maxWidth = 'calc(100vw - 20px)';
                }
            }
            
            // 确保项目卡片仍然可以交互
            this.updateProjectCardsInteraction();
        }
        
        // Responsive theme indicator positioning
        this.updateThemeIndicatorResponsive(homepageTheme);
    }
    
    /**
     * Update theme indicator for responsive design with enhanced visibility
     * Requirements 5.1: Mobile theme functionality
     */
    updateThemeIndicatorResponsive(homepageTheme) {
        const themeIndicator = document.querySelector('.theme-indicator');
        if (!themeIndicator) return;
        
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;
        
        // Adjust theme indicator styling based on screen size
        if (isSmallMobile) {
            themeIndicator.style.top = '8px';
            themeIndicator.style.right = '8px';
            themeIndicator.style.padding = '6px';
            themeIndicator.style.gap = '4px';
        } else if (isMobile) {
            themeIndicator.style.top = '10px';
            themeIndicator.style.right = '10px';
            themeIndicator.style.padding = '8px';
            themeIndicator.style.gap = '6px';
        } else {
            themeIndicator.style.top = '20px';
            themeIndicator.style.right = '20px';
            themeIndicator.style.padding = '12px';
            themeIndicator.style.gap = '8px';
        }
        
        // Enhanced theme indicator background for better visibility on transparent container
        themeIndicator.style.background = homepageTheme.cardBg;
        themeIndicator.style.borderColor = homepageTheme.cardBorder;
        themeIndicator.style.boxShadow = `0 4px 20px ${homepageTheme.shadowColor}`;
        themeIndicator.style.border = `1px solid ${homepageTheme.cardBorder}`;
    }
    
    /**
     * Update body class for theme-specific styling
     */
    updateBodyClass(themeKey) {
        const body = document.body;
        
        // Remove existing theme classes
        const existingThemeClasses = Array.from(body.classList).filter(cls => cls.startsWith('theme-'));
        existingThemeClasses.forEach(cls => body.classList.remove(cls));
        
        // Add new theme class
        body.classList.add(`theme-${themeKey}`);
        
        // Add data attribute for CSS targeting
        body.setAttribute('data-theme', themeKey);
    }
    
    /**
     * Initialize theme adapter with responsive support
     * Requirements 5.1, 5.2: Mobile theme functionality and responsive adaptation
     */
    initialize() {
        if (this.isInitialized) {
            return;
        }
        
        // Listen for theme changes
        this.themeManager.onThemeChange((newTheme) => {
            this.applyTheme(newTheme);
        });
        
        // Apply initial theme
        const currentThemeKey = this.themeManager.getCurrentThemeKey();
        this.applyTheme(currentThemeKey);
        
        // Set up smooth transitions for all theme-related elements
        this.setupSmoothTransitions();
        
        // Set up responsive listeners
        this.setupResponsiveListeners();
        
        this.isInitialized = true;
        console.log('HomepageThemeAdapter initialized with responsive support');
    }
    
    /**
     * Set up responsive event listeners
     * Requirements 5.2: Responsive theme synchronization
     */
    setupResponsiveListeners() {
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResponsiveChange();
            }, 100); // Small delay to ensure orientation change is complete
        });
        
        // Listen for resize events with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResponsiveChange();
            }, 150);
        });
        
        // Listen for viewport changes (mobile browsers)
        if ('visualViewport' in window) {
            window.visualViewport.addEventListener('resize', () => {
                this.handleResponsiveChange();
            });
        }
    }
    
    /**
     * Handle responsive changes and re-apply theme
     * Requirements 5.2: Responsive theme synchronization
     */
    handleResponsiveChange() {
        const currentThemeKey = this.themeManager.getCurrentThemeKey();
        console.log(`Responsive change detected, re-applying theme: ${currentThemeKey}`);
        
        // Re-apply current theme to adjust for new screen size
        this.applyTheme(currentThemeKey);
        
        // Trigger canvas resize if canvas controller is available
        if (window.canvasController && typeof window.canvasController.resize === 'function') {
            window.canvasController.resize();
        }
    }
    
    /**
     * Set up smooth CSS transitions for theme changes
     */
    setupSmoothTransitions() {
        // Add transition styles to document head
        const transitionStyles = `
            <style id="theme-transitions">
                /* Smooth transitions for theme changes */
                *, *::before, *::after {
                    transition: 
                        background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        border-color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        text-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Specific transitions for project cards */
                .project-item {
                    transition: 
                        all 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Transitions for links and buttons */
                .project-link, .tag, .project-icon {
                    transition: 
                        all 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        background 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Container transitions */
                .container {
                    transition: 
                        background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Header transitions */
                .header h1, .header p {
                    transition: 
                        color 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                        text-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
                
                /* Stats transitions */
                .stat-number, .stat-label {
                    transition: color 0.5s cubic-bezier(0.4, 0, 0.2, 1) !important;
                }
            </style>
        `;
        
        // Remove existing transition styles
        const existingStyles = document.getElementById('theme-transitions');
        if (existingStyles) {
            existingStyles.remove();
        }
        
        // Add new transition styles
        document.head.insertAdjacentHTML('beforeend', transitionStyles);
    }
    
    /**
     * Get theme configuration for a specific theme
     */
    getThemeConfig(themeKey) {
        return this.themeManager.themes[themeKey];
    }
    
    /**
     * Check if adapter is initialized
     */
    isReady() {
        return this.isInitialized;
    }
}