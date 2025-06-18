// Analytics Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.dataProcessor = new DataProcessor();
        this.charts = {};
        this.currentData = null;
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.filteredData = [];
        
        this.initializeElements();
        this.bindEvents();
        this.loadData();
    }

    initializeElements() {
        this.elements = {
            // Stats
            totalPosts: document.getElementById('totalPosts'),
            totalComments: document.getElementById('totalComments'),
            totalProfiles: document.getElementById('totalProfiles'),
            totalEngagement: document.getElementById('totalEngagement'),
            postsChange: document.getElementById('postsChange'),
            commentsChange: document.getElementById('commentsChange'),
            profilesChange: document.getElementById('profilesChange'),
            engagementRate: document.getElementById('engagementRate'),
            
            // Controls
            refreshData: document.getElementById('refreshData'),
            exportAll: document.getElementById('exportAll'),
            timeRange: document.getElementById('timeRange'),
            authorMetric: document.getElementById('authorMetric'),
            searchInput: document.getElementById('searchInput'),
            dataFilter: document.getElementById('dataFilter'),
            
            // Table and pagination
            dataTableBody: document.getElementById('dataTableBody'),
            pagination: document.getElementById('pagination'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            pageInfo: document.getElementById('pageInfo'),
            
            // Modal
            exportModal: document.getElementById('exportModal'),
            closeModal: document.getElementById('closeModal'),
            cancelExport: document.getElementById('cancelExport'),
            confirmExport: document.getElementById('confirmExport')
        };
    }

    bindEvents() {
        // Control events
        this.elements.refreshData.addEventListener('click', () => this.loadData());
        this.elements.exportAll.addEventListener('click', () => this.showExportModal());
        this.elements.timeRange.addEventListener('change', () => this.updateTimeChart());
        this.elements.authorMetric.addEventListener('change', () => this.updateAuthorsChart());
        
        // Search and filter
        this.elements.searchInput.addEventListener('input', () => this.filterData());
        this.elements.dataFilter.addEventListener('change', () => this.filterData());
        
        // Pagination
        this.elements.prevPage.addEventListener('click', () => this.changePage(-1));
        this.elements.nextPage.addEventListener('click', () => this.changePage(1));
        
        // Modal events
        this.elements.exportAll.addEventListener('click', () => this.showExportModal());
        this.elements.closeModal.addEventListener('click', () => this.hideExportModal());
        this.elements.cancelExport.addEventListener('click', () => this.hideExportModal());
        this.elements.confirmExport.addEventListener('click', () => this.performExport());
        
        // Close modal on outside click
        this.elements.exportModal.addEventListener('click', (e) => {
            if (e.target === this.elements.exportModal) {
                this.hideExportModal();
            }
        });
    }

    async loadData() {
        try {
            this.showLoading();
            
            this.currentData = await this.dataProcessor.loadData();
            const analytics = await this.dataProcessor.getAnalytics();
            
            this.updateStats(this.currentData, analytics);
            this.initializeCharts();
            this.filterData();
            
            this.hideLoading();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
            this.hideLoading();
        }
    }

    updateStats(data, analytics) {
        // Basic stats
        this.elements.totalPosts.textContent = data.posts.length.toLocaleString();
        this.elements.totalComments.textContent = data.comments.length.toLocaleString();
        this.elements.totalProfiles.textContent = data.profiles.length.toLocaleString();
        
        // Calculate total engagement
        const totalReactions = data.posts.reduce((sum, post) => sum + (post.reactions || 0), 0);
        const totalCommentsCount = data.posts.reduce((sum, post) => sum + (post.commentsCount || 0), 0);
        const totalShares = data.posts.reduce((sum, post) => sum + (post.sharesCount || 0), 0);
        const totalEngagement = totalReactions + totalCommentsCount + totalShares;
        
        this.elements.totalEngagement.textContent = totalEngagement.toLocaleString();
        
        // Calculate today's changes
        const today = new Date().toISOString().split('T')[0];
        const todayPosts = data.posts.filter(post => 
            post.scrapedAt && post.scrapedAt.startsWith(today)
        ).length;
        const todayComments = data.comments.filter(comment => 
            comment.scrapedAt && comment.scrapedAt.startsWith(today)
        ).length;
        const todayProfiles = data.profiles.filter(profile => 
            profile.scrapedAt && profile.scrapedAt.startsWith(today)
        ).length;
        
        this.elements.postsChange.textContent = `+${todayPosts} за сегодня`;
        this.elements.commentsChange.textContent = `+${todayComments} за сегодня`;
        this.elements.profilesChange.textContent = `+${todayProfiles} за сегодня`;
        
        // Engagement rate
        const avgEngagement = data.posts.length > 0 ? totalEngagement / data.posts.length : 0;
        this.elements.engagementRate.textContent = `${avgEngagement.toFixed(1)} средний`;
    }

    initializeCharts() {
        this.createTimeChart();
        this.createAuthorsChart();
        this.createEngagementChart();
        this.createCommentsChart();
    }

    createTimeChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');
        
        // Prepare data for the last 30 days
        const days = 30;
        const labels = [];
        const postsData = [];
        const commentsData = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            labels.push(date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
            
            const dayPosts = this.currentData.posts.filter(post => 
                post.scrapedAt && post.scrapedAt.startsWith(dateStr)
            ).length;
            
            const dayComments = this.currentData.comments.filter(comment => 
                comment.scrapedAt && comment.scrapedAt.startsWith(dateStr)
            ).length;
            
            postsData.push(dayPosts);
            commentsData.push(dayComments);
        }

        if (this.charts.timeChart) {
            this.charts.timeChart.destroy();
        }

        this.charts.timeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Посты',
                        data: postsData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Комментарии',
                        data: commentsData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    createAuthorsChart() {
        const ctx = document.getElementById('authorsChart').getContext('2d');
        
        // Calculate top authors
        const authorStats = {};
        this.currentData.posts.forEach(post => {
            const authorName = post.author?.name;
            if (authorName) {
                if (!authorStats[authorName]) {
                    authorStats[authorName] = { posts: 0, reactions: 0 };
                }
                authorStats[authorName].posts++;
                authorStats[authorName].reactions += post.reactions || 0;
            }
        });

        const topAuthors = Object.entries(authorStats)
            .sort(([,a], [,b]) => b.posts - a.posts)
            .slice(0, 10);

        const labels = topAuthors.map(([name]) => name.length > 15 ? name.substring(0, 15) + '...' : name);
        const data = topAuthors.map(([, stats]) => stats.posts);

        if (this.charts.authorsChart) {
            this.charts.authorsChart.destroy();
        }

        this.charts.authorsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Количество постов',
                    data: data,
                    backgroundColor: 'rgba(79, 70, 229, 0.8)',
                    borderColor: '#4f46e5',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    createEngagementChart() {
        const ctx = document.getElementById('engagementChart').getContext('2d');
        
        // Calculate engagement distribution
        const engagementRanges = {
            'Низкая (0-10)': 0,
            'Средняя (11-50)': 0,
            'Высокая (51-200)': 0,
            'Очень высокая (200+)': 0
        };

        this.currentData.posts.forEach(post => {
            const engagement = (post.reactions || 0) + (post.commentsCount || 0) + (post.sharesCount || 0);
            
            if (engagement <= 10) {
                engagementRanges['Низкая (0-10)']++;
            } else if (engagement <= 50) {
                engagementRanges['Средняя (11-50)']++;
            } else if (engagement <= 200) {
                engagementRanges['Высокая (51-200)']++;
            } else {
                engagementRanges['Очень высокая (200+)']++;
            }
        });

        if (this.charts.engagementChart) {
            this.charts.engagementChart.destroy();
        }

        this.charts.engagementChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(engagementRanges),
                datasets: [{
                    data: Object.values(engagementRanges),
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#10b981',
                        '#3b82f6'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createCommentsChart() {
        const ctx = document.getElementById('commentsChart').getContext('2d');
        
        // Calculate comments per post distribution
        const commentRanges = {
            'Без комментариев': 0,
            '1-5 комментариев': 0,
            '6-20 комментариев': 0,
            '20+ комментариев': 0
        };

        this.currentData.posts.forEach(post => {
            const commentsCount = post.commentsCount || 0;
            
            if (commentsCount === 0) {
                commentRanges['Без комментариев']++;
            } else if (commentsCount <= 5) {
                commentRanges['1-5 комментариев']++;
            } else if (commentsCount <= 20) {
                commentRanges['6-20 комментариев']++;
            } else {
                commentRanges['20+ комментариев']++;
            }
        });

        if (this.charts.commentsChart) {
            this.charts.commentsChart.destroy();
        }

        this.charts.commentsChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(commentRanges),
                datasets: [{
                    data: Object.values(commentRanges),
                    backgroundColor: [
                        '#6b7280',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    updateTimeChart() {
        // Recreate time chart with new range
        this.createTimeChart();
    }

    updateAuthorsChart() {
        // Recreate authors chart with new metric
        this.createAuthorsChart();
    }

    filterData() {
        const searchTerm = this.elements.searchInput.value.toLowerCase();
        const filterType = this.elements.dataFilter.value;
        
        let allData = [];
        
        // Combine all data types
        if (filterType === 'all' || filterType === 'posts') {
            allData = allData.concat(this.currentData.posts.map(item => ({
                ...item,
                type: 'post'
            })));
        }
        
        if (filterType === 'all' || filterType === 'comments') {
            allData = allData.concat(this.currentData.comments.map(item => ({
                ...item,
                type: 'comment'
            })));
        }
        
        if (filterType === 'all' || filterType === 'profiles') {
            allData = allData.concat(this.currentData.profiles.map(item => ({
                ...item,
                type: 'profile'
            })));
        }
        
        // Apply search filter
        if (searchTerm) {
            allData = allData.filter(item => {
                const searchableText = [
                    item.text || '',
                    item.name || '',
                    item.author?.name || ''
                ].join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }
        
        // Sort by scraped date (newest first)
        allData.sort((a, b) => {
            const dateA = new Date(a.scrapedAt || a.timestamp || 0);
            const dateB = new Date(b.scrapedAt || b.timestamp || 0);
            return dateB - dateA;
        });
        
        this.filteredData = allData;
        this.currentPage = 1;
        this.updateTable();
        this.updatePagination();
    }

    updateTable() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        this.elements.dataTableBody.innerHTML = '';
        
        pageData.forEach(item => {
            const row = this.createTableRow(item);
            this.elements.dataTableBody.appendChild(row);
        });
    }

    createTableRow(item) {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        // Type
        const typeCell = document.createElement('td');
        const typeSpan = document.createElement('span');
        typeSpan.className = `data-type ${item.type}`;
        typeSpan.textContent = item.type === 'post' ? 'Пост' : 
                              item.type === 'comment' ? 'Комментарий' : 'Профиль';
        typeCell.appendChild(typeSpan);
        
        // Content
        const contentCell = document.createElement('td');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content-preview';
        contentDiv.textContent = item.text || item.name || 'Нет содержания';
        contentDiv.title = item.text || item.name || '';
        contentCell.appendChild(contentDiv);
        
        // Author
        const authorCell = document.createElement('td');
        if (item.author?.name || item.name) {
            const authorDiv = document.createElement('div');
            authorDiv.className = 'author-info';
            
            const avatar = document.createElement('div');
            avatar.className = 'author-avatar';
            const authorName = item.author?.name || item.name || '';
            avatar.textContent = authorName.charAt(0).toUpperCase();
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = authorName;
            
            authorDiv.appendChild(avatar);
            authorDiv.appendChild(nameSpan);
            authorCell.appendChild(authorDiv);
        } else {
            authorCell.textContent = '-';
        }
        
        // Time
        const timeCell = document.createElement('td');
        const date = new Date(item.scrapedAt || item.timestamp || 0);
        timeCell.textContent = date.toLocaleDateString('ru-RU') + ' ' + 
                              date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        // Activity
        const activityCell = document.createElement('td');
        if (item.type === 'post') {
            const activityDiv = document.createElement('div');
            activityDiv.className = 'activity-stats';
            
            if (item.reactions) {
                const reactionsSpan = document.createElement('span');
                reactionsSpan.className = 'activity-stat reactions';
                reactionsSpan.innerHTML = `❤️ ${item.reactions}`;
                activityDiv.appendChild(reactionsSpan);
            }
            
            if (item.commentsCount) {
                const commentsSpan = document.createElement('span');
                commentsSpan.className = 'activity-stat comments';
                commentsSpan.innerHTML = `💬 ${item.commentsCount}`;
                activityDiv.appendChild(commentsSpan);
            }
            
            if (item.sharesCount) {
                const sharesSpan = document.createElement('span');
                sharesSpan.className = 'activity-stat shares';
                sharesSpan.innerHTML = `🔄 ${item.sharesCount}`;
                activityDiv.appendChild(sharesSpan);
            }
            
            activityCell.appendChild(activityDiv);
        } else {
            activityCell.textContent = '-';
        }
        
        // Actions
        const actionsCell = document.createElement('td');
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn btn-outline';
        viewBtn.style.padding = '4px 8px';
        viewBtn.style.fontSize = '12px';
        viewBtn.textContent = 'Просмотр';
        viewBtn.onclick = () => this.viewItem(item);
        actionsCell.appendChild(viewBtn);
        
        row.appendChild(typeCell);
        row.appendChild(contentCell);
        row.appendChild(authorCell);
        row.appendChild(timeCell);
        row.appendChild(activityCell);
        row.appendChild(actionsCell);
        
        return row;
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        
        this.elements.prevPage.disabled = this.currentPage <= 1;
        this.elements.nextPage.disabled = this.currentPage >= totalPages;
        this.elements.pageInfo.textContent = `Страница ${this.currentPage} из ${totalPages}`;
    }

    changePage(direction) {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        const newPage = this.currentPage + direction;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.currentPage = newPage;
            this.updateTable();
            this.updatePagination();
        }
    }

    viewItem(item) {
        // Create a detailed view modal or expand the row
        alert(`Детали элемента:\n\nТип: ${item.type}\nСодержание: ${item.text || item.name || 'Нет содержания'}\nАвтор: ${item.author?.name || item.name || 'Неизвестно'}`);
    }

    showExportModal() {
        this.elements.exportModal.classList.add('active');
    }

    hideExportModal() {
        this.elements.exportModal.classList.remove('active');
    }

    async performExport() {
        try {
            const format = document.querySelector('input[name="exportFormat"]:checked').value;
            const includePosts = document.getElementById('exportPosts').checked;
            const includeComments = document.getElementById('exportComments').checked;
            const includeProfiles = document.getElementById('exportProfiles').checked;
            
            let exportData;
            let filename;
            let mimeType;
            
            if (format === 'json') {
                exportData = await this.dataProcessor.exportToJSON();
                filename = `facebook_data_${new Date().toISOString().split('T')[0]}.json`;
                mimeType = 'application/json';
            } else {
                // CSV export - need to handle multiple files
                const csvData = {};
                
                if (includePosts) {
                    csvData.posts = await this.dataProcessor.exportToCSV('posts');
                }
                if (includeComments) {
                    csvData.comments = await this.dataProcessor.exportToCSV('comments');
                }
                if (includeProfiles) {
                    csvData.profiles = await this.dataProcessor.exportToCSV('profiles');
                }
                
                // For now, export posts CSV (could be enhanced to create a ZIP)
                exportData = csvData.posts || csvData.comments || csvData.profiles || '';
                filename = `facebook_data_${new Date().toISOString().split('T')[0]}.csv`;
                mimeType = 'text/csv';
            }
            
            // Download the file
            const blob = new Blob([exportData], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            URL.revokeObjectURL(url);
            this.hideExportModal();
            this.showNotification('Данные успешно экспортированы', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Ошибка при экспорте данных', 'error');
        }
    }

    showLoading() {
        document.body.classList.add('loading');
    }

    hideLoading() {
        document.body.classList.remove('loading');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        switch (type) {
            case 'success':
                notification.style.background = '#10b981';
                break;
            case 'error':
                notification.style.background = '#ef4444';
                break;
            default:
                notification.style.background = '#3b82f6';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AnalyticsDashboard();
});

