// 收藏夹交互脚本

document.addEventListener('DOMContentLoaded', function() {
    // 添加搜索框
    addSearchBox();
    
    // 添加返回顶部按钮
    addBackToTopButton();
    
    // 为所有文件夹添加折叠/展开功能
    addFolderToggle();
    
    // 初始化图标显示
    enhanceIcons();
    
    // 添加主题切换按钮
    addThemeToggle();
    
    // 添加书签计数
    countBookmarks();
    
    // 添加文件夹全部展开/折叠按钮
    addExpandCollapseAllButtons();
});

/**
 * 添加搜索框到页面顶部
 */
function addSearchBox() {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-input';
    searchInput.placeholder = '搜索收藏夹...';
    
    // 添加清除按钮
    const clearButton = document.createElement('button');
    clearButton.id = 'clear-search';
    clearButton.innerHTML = '×';
    clearButton.style.display = 'none';
    clearButton.title = '清除搜索';
    clearButton.style.position = 'absolute';
    clearButton.style.right = '15%';
    clearButton.style.top = '50%';
    clearButton.style.transform = 'translateY(-50%)';
    clearButton.style.background = 'none';
    clearButton.style.border = 'none';
    clearButton.style.fontSize = '18px';
    clearButton.style.color = '#999';
    clearButton.style.cursor = 'pointer';
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearButton);
    
    // 插入到标题后面
    const title = document.querySelector('H1');
    title.parentNode.insertBefore(searchContainer, title.nextSibling);
    
    // 添加搜索功能
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        // 显示/隐藏清除按钮
        clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
        
        performSearch(searchTerm);
    });
    
    // 清除按钮功能
    clearButton.addEventListener('click', function() {
        searchInput.value = '';
        this.style.display = 'none';
        performSearch('');
        searchInput.focus();
    });
    
    // 添加快捷键支持
    document.addEventListener('keydown', function(e) {
        // Ctrl+F 或 Command+F (Mac) 聚焦到搜索框
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault(); // 阻止浏览器默认搜索
            searchInput.focus();
        }
        
        // Escape 清除搜索
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            clearButton.style.display = 'none';
            performSearch('');
        }
    });
}

/**
 * 执行搜索功能
 */
function performSearch(searchTerm) {
    const links = document.querySelectorAll('A');
    
    // 移除之前的高亮
    document.querySelectorAll('.highlight').forEach(el => {
        el.outerHTML = el.innerHTML;
    });
    
    if (searchTerm.length < 2) {
        // 如果搜索词太短，恢复所有链接显示
        links.forEach(link => {
            link.style.display = 'block';
            link.parentElement.style.display = 'block';
        });
        
        // 恢复文件夹的折叠状态
        document.querySelectorAll('.was-collapsed').forEach(folder => {
            folder.classList.add('collapsed');
            folder.classList.remove('was-collapsed');
        });
        
        return;
    }
    
    // 记录当前折叠状态
    document.querySelectorAll('.collapsed').forEach(folder => {
        folder.classList.add('was-collapsed');
    });
    
    // 隐藏所有链接，然后只显示匹配的
    let matchCount = 0;
    links.forEach(link => {
        const linkText = link.textContent.toLowerCase();
        const linkUrl = link.getAttribute('HREF')?.toLowerCase() || '';
        
        if (linkText.includes(searchTerm) || linkUrl.includes(searchTerm)) {
            // 显示匹配的链接
            link.style.display = 'block';
            link.parentElement.style.display = 'block';
            matchCount++;
            
            // 确保父文件夹可见
            let parent = link.parentElement;
            while (parent) {
                if (parent.tagName === 'DL' || parent.tagName === 'DT') {
                    parent.style.display = 'block';
                    // 展开折叠的文件夹
                    if (parent.previousElementSibling && 
                        parent.previousElementSibling.tagName === 'H3') {
                        parent.parentElement.classList.remove('collapsed');
                    }
                }
                parent = parent.parentElement;
            }
            
            // 高亮匹配文本
            const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            link.innerHTML = link.textContent.replace(regex, match => 
                `<span class="highlight">${match}</span>`);
        } else {
            // 隐藏不匹配的链接
            link.style.display = 'none';
        }
    });
    
    // 显示搜索结果计数
    showSearchResultCount(matchCount, searchTerm);
}

/**
 * 显示搜索结果计数
 */
function showSearchResultCount(count, term) {
    let resultCount = document.getElementById('search-result-count');
    
    if (!resultCount) {
        resultCount = document.createElement('div');
        resultCount.id = 'search-result-count';
        resultCount.style.textAlign = 'center';
        resultCount.style.margin = '5px 0 15px';
        resultCount.style.fontSize = '14px';
        resultCount.style.color = '#666';
        
        const searchContainer = document.querySelector('.search-container');
        searchContainer.parentNode.insertBefore(resultCount, searchContainer.nextSibling);
    }
    
    if (term.length < 2) {
        resultCount.style.display = 'none';
        return;
    }
    
    resultCount.style.display = 'block';
    resultCount.textContent = `找到 ${count} 个匹配结果`;
}

/**
 * 为所有文件夹添加折叠/展开功能
 */
function addFolderToggle() {
    const folders = document.querySelectorAll('H3');
    
    folders.forEach(folder => {
        // 默认折叠非收藏夹栏的文件夹
        if (!folder.hasAttribute('PERSONAL_TOOLBAR_FOLDER')) {
            folder.parentElement.classList.add('collapsed');
        }
        
        folder.addEventListener('click', function(e) {
            // 阻止事件冒泡，避免点击文件夹时触发父文件夹的事件
            e.stopPropagation();
            
            const parent = this.parentElement;
            parent.classList.toggle('collapsed');
        });
    });
}

/**
 * 添加返回顶部按钮
 */
function addBackToTopButton() {
    const backToTop = document.createElement('div');
    backToTop.id = 'back-to-top';
    backToTop.innerHTML = '↑';
    backToTop.title = '返回顶部';
    
    document.body.appendChild(backToTop);
    
    // 滚动时显示/隐藏按钮
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            backToTop.style.display = 'block';
        } else {
            backToTop.style.display = 'none';
        }
    });
    
    // 点击返回顶部
    backToTop.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

/**
 * 优化图标显示
 */
function enhanceIcons() {
    const links = document.querySelectorAll('A[ICON]');
    
    links.forEach(link => {
        // 图标已经在HTML中通过ICON属性定义，这里只需确保样式正确
        const iconData = link.getAttribute('ICON');
        if (iconData && !link.querySelector('img.favicon')) {
            // 如果链接没有图标图片，尝试添加一个
            try {
                const img = document.createElement('img');
                img.className = 'favicon';
                img.src = iconData;
                img.style.width = '16px';
                img.style.height = '16px';
                img.style.marginRight = '8px';
                img.style.verticalAlign = 'middle';
                img.style.position = 'absolute';
                img.style.left = '8px';
                img.style.top = '50%';
                img.style.transform = 'translateY(-50%)';
                
                // 处理图片加载错误
                img.onerror = function() {
                    this.style.display = 'none';
                };
                
                link.insertBefore(img, link.firstChild);
            } catch (e) {
                console.error('Error enhancing icon:', e);
            }
        }
    });
}

/**
 * 添加主题切换按钮
 */
function addThemeToggle() {
    // 创建主题切换容器
    const themeContainer = document.createElement('div');
    themeContainer.id = 'theme-container';
    themeContainer.style.position = 'fixed';
    themeContainer.style.top = '20px';
    themeContainer.style.right = '20px';
    themeContainer.style.display = 'flex';
    themeContainer.style.flexDirection = 'column';
    themeContainer.style.gap = '10px';
    themeContainer.style.zIndex = '1000';
    
    // 创建粉色主题切换按钮
    const pinkThemeToggle = document.createElement('div');
    pinkThemeToggle.id = 'pink-theme-toggle';
    pinkThemeToggle.innerHTML = '🌸';
    pinkThemeToggle.title = '切换粉色主题';
    pinkThemeToggle.style.width = '40px';
    pinkThemeToggle.style.height = '40px';
    pinkThemeToggle.style.borderRadius = '50%';
    pinkThemeToggle.style.backgroundColor = '#ec407a';
    pinkThemeToggle.style.color = 'white';
    pinkThemeToggle.style.display = 'flex';
    pinkThemeToggle.style.justifyContent = 'center';
    pinkThemeToggle.style.alignItems = 'center';
    pinkThemeToggle.style.cursor = 'pointer';
    pinkThemeToggle.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    pinkThemeToggle.style.transition = 'all 0.3s ease';
    
    themeContainer.appendChild(pinkThemeToggle);
    document.body.appendChild(themeContainer);
    
    // 检查本地存储中的主题设置
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'pink') {
        document.body.classList.add('pink-theme');
        applyPinkTheme();
    } else {
        applyLightTheme();
    }
    
    // 粉色主题切换
    pinkThemeToggle.addEventListener('click', function() {
        // 检查当前是否为粉色主题
        const isPinkTheme = document.body.classList.contains('pink-theme');
        
        // 移除所有主题类
        document.body.classList.remove('pink-theme');
        
        if (!isPinkTheme) {
            // 如果不是粉色主题，切换到粉色主题
            document.body.classList.add('pink-theme');
            localStorage.setItem('theme', 'pink');
            applyPinkTheme();
        } else {
            // 如果是粉色主题，切换到亮色主题
            localStorage.setItem('theme', 'light');
            applyLightTheme();
        }
    });
    
    // 鼠标悬停效果
    pinkThemeToggle.addEventListener('mouseover', function() {
        this.style.transform = 'scale(1.1)';
    });
    
    pinkThemeToggle.addEventListener('mouseout', function() {
        this.style.transform = 'scale(1)';
    });
}

/**
 * 应用亮色主题
 */
function applyLightTheme() {
    document.body.style.backgroundColor = '#f5f5f5';
    document.body.style.color = '#333';
    
    // 更新folder-controls按钮样式
    const folderButtons = document.querySelectorAll('.folder-controls button');
    folderButtons.forEach(btn => {
        btn.style.backgroundColor = '#3498db';
        btn.style.color = 'white';
    });
    
    // 更新bookmark-stats样式
    const bookmarkStats = document.getElementById('bookmark-stats');
    if (bookmarkStats) {
        bookmarkStats.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
        bookmarkStats.style.color = '#333';
        bookmarkStats.style.border = 'none';
    }
    
    // 恢复H3默认样式
    const h3Elements = document.querySelectorAll('H3');
    h3Elements.forEach(h3 => {
        if (!h3.hasAttribute('PERSONAL_TOOLBAR_FOLDER')) {
            h3.style.color = '#2980b9';
            h3.style.backgroundColor = '#ecf0f1';
        }
    });
}

/**
 * 应用粉色主题
 */
function applyPinkTheme() {
    document.body.style.backgroundColor = '#fff0f5';
    document.body.style.color = '#5a2d5a';
    
    // 更新folder-controls按钮样式
    const folderButtons = document.querySelectorAll('.folder-controls button');
    folderButtons.forEach(btn => {
        btn.style.backgroundColor = '#ec407a';
        btn.style.color = 'white';
    });
    
    // 更新bookmark-stats样式
    const bookmarkStats = document.getElementById('bookmark-stats');
    if (bookmarkStats) {
        bookmarkStats.style.backgroundColor = 'rgba(236, 64, 122, 0.1)';
        bookmarkStats.style.color = '#5a2d5a';
        bookmarkStats.style.border = '1px solid rgba(236, 64, 122, 0.2)';
    }
    
    // 更新H3样式
    const h3Elements = document.querySelectorAll('H3');
    h3Elements.forEach(h3 => {
        if (!h3.hasAttribute('PERSONAL_TOOLBAR_FOLDER')) {
            h3.style.color = '#c2185b';
            h3.style.backgroundColor = '#fce4ec';
        }
    });
}

/**
 * 统计书签数量
 */
function countBookmarks() {
    const links = document.querySelectorAll('A');
    const folders = document.querySelectorAll('H3');
    
    // 计算更多统计信息
    const personalToolbarFolder = document.querySelector('H3[PERSONAL_TOOLBAR_FOLDER]');
    const toolbarLinks = personalToolbarFolder ? 
        personalToolbarFolder.closest('DT').querySelectorAll('A').length : 0;
    
    // 创建统计信息容器
    const statsContainer = document.createElement('div');
    statsContainer.id = 'bookmark-stats';
    statsContainer.style.textAlign = 'center';
    statsContainer.style.margin = '20px 0';
    statsContainer.style.padding = '10px';
    statsContainer.style.borderRadius = '5px';
    statsContainer.style.fontSize = '14px';
    statsContainer.style.transition = 'all 0.3s ease';
    
    // 根据当前主题设置样式
    if (document.body.classList.contains('pink-theme')) {
        statsContainer.style.backgroundColor = 'rgba(236, 64, 122, 0.1)';
        statsContainer.style.color = '#5a2d5a';
        statsContainer.style.border = '1px solid rgba(236, 64, 122, 0.2)';
    } else {
        statsContainer.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
        statsContainer.style.color = '#333';
    }
    
    statsContainer.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">书签统计信息</div>
        <div>总书签数: ${links.length}</div>
        <div>总文件夹数: ${folders.length}</div>
        <div>书签栏书签数: ${toolbarLinks}</div>
        <div style="font-size: 12px; margin-top: 5px; opacity: 0.8;">最后更新时间: ${new Date().toLocaleString()}</div>
    `;
    
    // 添加到页面底部
    document.body.appendChild(statsContainer);
    
    // 添加点击事件以刷新统计信息
    statsContainer.style.cursor = 'pointer';
    statsContainer.title = '点击刷新统计信息';
    statsContainer.addEventListener('click', function() {
        this.remove();
        countBookmarks();
    });
}

/**
 * 添加全部展开/折叠按钮
 */
function addExpandCollapseAllButtons() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'folder-controls';
    controlsContainer.style.textAlign = 'center';
    controlsContainer.style.margin = '10px 0';
    controlsContainer.style.padding = '5px';
    controlsContainer.style.borderRadius = '5px';
    controlsContainer.style.transition = 'all 0.3s ease';
    
    // 创建展开所有按钮
    const expandAllBtn = document.createElement('button');
    expandAllBtn.textContent = '展开所有文件夹';
    expandAllBtn.style.margin = '0 5px';
    expandAllBtn.style.padding = '5px 10px';
    expandAllBtn.style.border = 'none';
    expandAllBtn.style.borderRadius = '3px';
    expandAllBtn.style.cursor = 'pointer';
    expandAllBtn.style.transition = 'all 0.2s ease';
    
    // 创建折叠所有按钮
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.textContent = '折叠所有文件夹';
    collapseAllBtn.style.margin = '0 5px';
    collapseAllBtn.style.padding = '5px 10px';
    collapseAllBtn.style.border = 'none';
    collapseAllBtn.style.borderRadius = '3px';
    collapseAllBtn.style.cursor = 'pointer';
    collapseAllBtn.style.transition = 'all 0.2s ease';
    
    // 创建切换按钮
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.textContent = '切换所有文件夹';
    toggleAllBtn.style.margin = '0 5px';
    toggleAllBtn.style.padding = '5px 10px';
    toggleAllBtn.style.border = 'none';
    toggleAllBtn.style.borderRadius = '3px';
    toggleAllBtn.style.cursor = 'pointer';
    toggleAllBtn.style.transition = 'all 0.2s ease';
    
    // 根据当前主题设置按钮样式
    const applyButtonTheme = () => {
        const buttons = [expandAllBtn, collapseAllBtn, toggleAllBtn];
        
        if (document.body.classList.contains('pink-theme')) {
            buttons.forEach(btn => {
                btn.style.backgroundColor = '#ec407a';
                btn.style.color = 'white';
            });
        } else {
            buttons.forEach(btn => {
                btn.style.backgroundColor = '#3498db';
                btn.style.color = 'white';
            });
        }
    };
    
    // 初始应用主题
    applyButtonTheme();
    
    // 添加按钮到容器
    controlsContainer.appendChild(expandAllBtn);
    controlsContainer.appendChild(collapseAllBtn);
    controlsContainer.appendChild(toggleAllBtn);
    
    // 插入到搜索框下方
    const searchContainer = document.querySelector('.search-container');
    searchContainer.parentNode.insertBefore(controlsContainer, searchContainer.nextSibling);
    
    // 展开所有文件夹
    expandAllBtn.addEventListener('click', function() {
        document.querySelectorAll('DT').forEach(item => {
            item.parentElement.classList.remove('collapsed');
        });
    });
    
    // 折叠所有文件夹
    collapseAllBtn.addEventListener('click', function() {
        document.querySelectorAll('H3').forEach(folder => {
            if (!folder.hasAttribute('PERSONAL_TOOLBAR_FOLDER')) {
                folder.parentElement.classList.add('collapsed');
            }
        });
    });
    
    // 切换所有文件夹状态
    toggleAllBtn.addEventListener('click', function() {
        const folders = document.querySelectorAll('H3');
        let collapsedCount = 0;
        
        // 计算当前折叠的文件夹数量
        folders.forEach(folder => {
            if (folder.parentElement && folder.parentElement.classList.contains('collapsed')) {
                collapsedCount++;
            }
        });
        
        // 如果大部分文件夹是折叠的，则全部展开；否则全部折叠
        if (collapsedCount > folders.length / 2) {
            expandAllBtn.click();
        } else {
            collapseAllBtn.click();
        }
    });
    
    // 监听主题变化，更新按钮样式
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'class') {
                applyButtonTheme();
            }
        });
    });
    
    observer.observe(document.body, { attributes: true });
    
    // 鼠标悬停效果
    [expandAllBtn, collapseAllBtn, toggleAllBtn].forEach(btn => {
        btn.addEventListener('mouseover', function() {
            if (document.body.classList.contains('pink-theme')) {
                this.style.backgroundColor = '#d81b60';
            } else {
                this.style.backgroundColor = '#2980b9';
            }
            this.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseout', function() {
            if (document.body.classList.contains('pink-theme')) {
                this.style.backgroundColor = '#ec407a';
            } else {
                this.style.backgroundColor = '#3498db';
            }
            this.style.transform = 'translateY(0)';
        });
    });
}