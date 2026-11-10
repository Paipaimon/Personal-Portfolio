/**
 * 项目展示控制器
 * 管理项目列表的显示、统计和卡片创建
 */

class ProjectDisplayController {
    constructor(projectsData) {
        this.projects = projectsData || PROJECTS_DATA;
        this.activeType = null;
    }

    /**
     * 更新统计数据
     */
    updateStats() {
        const projectCount = this.projects.length;
        const allTags = this.projects.flatMap(p => p.tags);
        const uniqueTags = [...new Set(allTags)];
        const categories = [...new Set(this.projects.map(p => p.type))];

        const projectCountElement = document.getElementById('projectCount');
        const techCountElement = document.getElementById('techCount');
        const categoryCountElement = document.getElementById('categoryCount');

        if (projectCountElement) projectCountElement.textContent = projectCount;
        if (techCountElement) techCountElement.textContent = uniqueTags.length;
        if (categoryCountElement) categoryCountElement.textContent = categories.length;
    }

    /**
     * 解析项目入口链接
     * 优先使用 url（外部站点），否则使用本地 folder
     */
    getProjectLink(project) {
        if (project.url) {
            return {
                href: project.url,
                label: '访问网站',
                external: true
            };
        }

        return {
            href: `./${project.folder}`,
            label: '查看项目',
            external: false
        };
    }

    /**
     * 创建项目卡片
     */
    createProjectCard(project) {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'project-item';
        const link = this.getProjectLink(project);
        const extraAttrs = link.external
            ? ' target="_blank" rel="noopener noreferrer"'
            : '';

        projectDiv.innerHTML = `
            <div class="project-header">
                <div class="project-icon">${project.icon}</div>
                <div>
                    <div class="project-title">${project.title}</div>
                    <div class="project-type">${project.type}</div>
                </div>
            </div>
            <div class="project-description">${project.description}</div>
            <div class="project-tags">
                ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <a href="${link.href}" class="project-link"${extraAttrs}>${link.label}</a>
        `;

        return projectDiv;
    }

    /**
     * 渲染项目列表
     */
    renderProjectList() {
        const projectList = document.getElementById('projectList');
        
        if (!projectList) {
            console.error('项目列表容器未找到');
            return;
        }

        // 确保项目列表可见和可交互
        projectList.style.opacity = '1';
        projectList.style.transform = 'translateY(0) scale(1)';
        projectList.style.pointerEvents = 'auto';
        
        // 清空现有内容
        projectList.innerHTML = '';

        const counts = new Map();
        this.projects.forEach(({ type }) => counts.set(type, (counts.get(type) || 0) + 1));
        if (!counts.has(this.activeType)) this.activeType = null;

        // 添加项目卡片
        this.projects.forEach(project => {
            const projectCard = this.createProjectCard(project);
            projectCard.dataset.projectType = project.type;
            projectCard.hidden = this.activeType !== null && project.type !== this.activeType;
            projectList.appendChild(projectCard);
        });
        
        // 确保所有项目卡片都可见
        const projectItems = projectList.querySelectorAll('.project-item');
        projectItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
            item.style.pointerEvents = 'auto';
        });

        this.renderProjectFilters(projectList, counts);
        console.log(`已渲染 ${this.projects.length} 个项目`);
    }

    renderProjectFilters(projectList, counts) {
        const filters = document.getElementById('projectFilters');
        const resultCount = document.getElementById('projectResultCount');
        if (!filters || !resultCount) return;

        const labels = new Map([[null, '全部'], ['Game', '游戏'], ['Tool', '工具'], ['Animation', '动画']]);
        const buttons = [[null, this.projects.length], ...counts].map(([type, count]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'project-category';
            button.setAttribute('aria-pressed', String(this.activeType === type));
            button.setAttribute('aria-controls', projectList.id);

            const badge = document.createElement('span');
            badge.className = 'project-category-count';
            badge.textContent = count;
            button.append(labels.get(type) ?? type, badge);

            button.addEventListener('click', () => {
                if (this.activeType === type) return;
                filters.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
                button.setAttribute('aria-pressed', 'true');
                this.filterProjects(projectList, type);
                resultCount.textContent = `${count} 个项目`;
            });
            return button;
        });
        filters.replaceChildren(...buttons);
        resultCount.textContent = `${counts.get(this.activeType) ?? this.projects.length} 个项目`;
    }

    filterProjects(projectList, type) {
        this.activeType = type;
        const cards = [...projectList.children];
        const matchesType = card => type === null || card.dataset.projectType === type;
        const visibleCards = cards.filter(matchesType);
        const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        // Read the current positions before canceling any in-flight motion or changing the grid.
        const previousPositions = new Map();
        if (animate) {
            for (const card of visibleCards) {
                if (!card.hidden) previousPositions.set(card, card.getBoundingClientRect());
            }
        }
        for (const animation of projectList.getAnimations({ subtree: true })) {
            if (animation.id === 'project-filter') animation.cancel();
        }
        for (const card of cards) {
            card.hidden = !matchesType(card);
        }
        if (!animate) return;

        const positions = visibleCards.map(card => card.getBoundingClientRect());
        visibleCards.forEach((card, index) => {
            const previous = previousPositions.get(card);
            const current = positions[index];
            const timing = { id: 'project-filter', duration: 420, easing: 'cubic-bezier(.2, .75, .25, 1)' };
            if (previous) {
                const dx = previous.left - current.left;
                const dy = previous.top - current.top;
                if (dx || dy) card.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], timing);
            } else {
                card.animate([
                    { opacity: 0, translate: '0px 22px', scale: '0.97' },
                    { opacity: 1, translate: '0px 0px', scale: '1' }
                ], { ...timing, delay: Math.min(index, 7) * 36, fill: 'backwards' });
            }
        });
    }

    /**
     * 添加数字动画效果
     */
    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');
        statNumbers.forEach(stat => {
            const target = parseInt(stat.textContent);
            let current = 0;
            const increment = target / 30;
            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }
                stat.textContent = Math.floor(current);
            }, 50);
        });
    }

    /**
     * 初始化项目展示
     */
    initialize() {
        // 更新统计数据
        this.updateStats();
        
        // 渲染项目列表
        this.renderProjectList();
        
        // 添加数字动画效果
        this.animateStats();
        
        console.log('项目展示控制器已初始化');
    }

    /**
     * 获取项目数据
     */
    getProjects() {
        return this.projects;
    }

    /**
     * 根据类型筛选项目
     */
    getProjectsByType(type) {
        return this.projects.filter(project => project.type === type);
    }

    /**
     * 根据标签筛选项目
     */
    getProjectsByTag(tag) {
        return this.projects.filter(project => project.tags.includes(tag));
    }

    /**
     * 搜索项目
     */
    searchProjects(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.projects.filter(project => 
            project.title.toLowerCase().includes(lowercaseQuery) ||
            project.description.toLowerCase().includes(lowercaseQuery) ||
            project.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        );
    }
}
