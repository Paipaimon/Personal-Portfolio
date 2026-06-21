/**
 * 项目展示控制器
 * 管理项目列表的显示、统计和卡片创建
 */

class ProjectDisplayController {
    constructor(projectsData) {
        this.projects = projectsData || PROJECTS_DATA;
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
     * 创建项目卡片
     */
    createProjectCard(project) {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'project-item';

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
            <a href="./${project.folder}" class="project-link">查看项目</a>
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
        
        // 添加项目卡片
        this.projects.forEach(project => {
            const projectCard = this.createProjectCard(project);
            projectList.appendChild(projectCard);
        });
        
        // 确保所有项目卡片都可见
        const projectItems = projectList.querySelectorAll('.project-item');
        projectItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
            item.style.pointerEvents = 'auto';
        });

        console.log(`已渲染 ${this.projects.length} 个项目`);
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