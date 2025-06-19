// Модуль для обработки и хранения данных
class DataProcessor {
    constructor() {
        this.storageKey = 'facebookScrapedData';
        this.settingsKey = 'facebookScraperSettings';
        this.analyticsKey = 'facebookScraperAnalytics';
    }

    // Сохранение данных
    async saveData(data) {
        try {
            const existingData = await this.loadData();
            const mergedData = this.mergeData(existingData, data);
            
            await chrome.storage.local.set({
                [this.storageKey]: mergedData,
                lastUpdated: new Date().toISOString()
            });
            
            // Обновляем аналитику
            await this.updateAnalytics(mergedData);
            
            return mergedData;
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    // Загрузка данных
    async loadData() {
        try {
            const result = await chrome.storage.local.get([this.storageKey]);
            return result[this.storageKey] || {
                posts: [],
                comments: [],
                profiles: []
            };
        } catch (error) {
            console.error('Error loading data:', error);
            return { posts: [], comments: [], profiles: [] };
        }
    }

    // Объединение новых данных с существующими
    mergeData(existingData, newData) {
        const merged = {
            posts: [...existingData.posts],
            comments: [...existingData.comments],
            profiles: [...existingData.profiles]
        };

        // Добавляем новые посты
        if (newData.posts) {
            newData.posts.forEach(post => {
                if (!merged.posts.find(p => p.id === post.id)) {
                    merged.posts.push(post);
                }
            });
        }

        // Добавляем новые комментарии
        if (newData.comments) {
            newData.comments.forEach(comment => {
                if (!merged.comments.find(c => c.id === comment.id)) {
                    merged.comments.push(comment);
                }
            });
        }

        // Добавляем новые профили
        if (newData.profiles) {
            newData.profiles.forEach(profile => {
                if (!merged.profiles.find(p => p.id === profile.id)) {
                    merged.profiles.push(profile);
                }
            });
        }

        return merged;
    }

    // Очистка данных
    async clearData() {
        try {
            await chrome.storage.local.set({
                [this.storageKey]: { posts: [], comments: [], profiles: [] },
                lastUpdated: new Date().toISOString()
            });
            
            await this.clearAnalytics();
        } catch (error) {
            console.error('Error clearing data:', error);
            throw error;
        }
    }

    // Экспорт данных в JSON
    async exportToJSON() {
        try {
            const data = await this.loadData();
            const analytics = await this.getAnalytics();
            
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    version: '1.0.0',
                    totalPosts: data.posts.length,
                    totalComments: data.comments.length,
                    totalProfiles: data.profiles.length
                },
                analytics: analytics,
                data: data
            };

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting to JSON:', error);
            throw error;
        }
    }

    // Экспорт данных в CSV
    async exportToCSV(dataType = 'posts') {
        try {
            const data = await this.loadData();
            let csvContent = '';

            switch (dataType) {
                case 'posts':
                    csvContent = this.postsToCSV(data.posts);
                    break;
                case 'comments':
                    csvContent = this.commentsToCSV(data.comments);
                    break;
                case 'profiles':
                    csvContent = this.profilesToCSV(data.profiles);
                    break;
                default:
                    throw new Error('Invalid data type for CSV export');
            }

            return csvContent;
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            throw error;
        }
    }

    // Конвертация постов в CSV
    postsToCSV(posts) {
        const headers = [
            'ID', 'Text', 'Author Name', 'Author Profile', 'Timestamp', 
            'Reactions', 'Comments Count', 'Shares Count', 'URL', 'Scraped At'
        ];

        const rows = posts.map(post => [
            this.escapeCSV(post.id),
            this.escapeCSV(post.text),
            this.escapeCSV(post.author?.name || ''),
            this.escapeCSV(post.author?.profileUrl || ''),
            this.escapeCSV(post.timestamp),
            post.reactions || 0,
            post.commentsCount || 0,
            post.sharesCount || 0,
            this.escapeCSV(post.url || ''),
            this.escapeCSV(post.scrapedAt)
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    // Конвертация комментариев в CSV
    commentsToCSV(comments) {
        const headers = [
            'ID', 'Post ID', 'Text', 'Author Name', 'Author Profile', 
            'Timestamp', 'Scraped At'
        ];

        const rows = comments.map(comment => [
            this.escapeCSV(comment.id),
            this.escapeCSV(comment.postId),
            this.escapeCSV(comment.text),
            this.escapeCSV(comment.author?.name || ''),
            this.escapeCSV(comment.author?.profileUrl || ''),
            this.escapeCSV(comment.timestamp),
            this.escapeCSV(comment.scrapedAt)
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    // Конвертация профилей в CSV
    profilesToCSV(profiles) {
        const headers = [
            'ID', 'Name', 'Profile URL', 'Scraped At'
        ];

        const rows = profiles.map(profile => [
            this.escapeCSV(profile.id),
            this.escapeCSV(profile.name),
            this.escapeCSV(profile.profileUrl),
            this.escapeCSV(profile.scrapedAt)
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    // Экранирование данных для CSV
    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    // Аналитика данных
    async updateAnalytics(data) {
        try {
            const analytics = {
                lastUpdated: new Date().toISOString(),
                totalPosts: data.posts.length,
                totalComments: data.comments.length,
                totalProfiles: data.profiles.length,
                
                // Статистика по времени
                timeStats: this.calculateTimeStats(data.posts),
                
                // Статистика по авторам
                authorStats: this.calculateAuthorStats(data.posts),
                
                // Статистика по активности
                activityStats: this.calculateActivityStats(data.posts),
                
                // Статистика по комментариям
                commentStats: this.calculateCommentStats(data.comments, data.posts)
            };

            await chrome.storage.local.set({
                [this.analyticsKey]: analytics
            });

            return analytics;
        } catch (error) {
            console.error('Error updating analytics:', error);
            throw error;
        }
    }

    // Получение аналитики
    async getAnalytics() {
        try {
            const result = await chrome.storage.local.get([this.analyticsKey]);
            return result[this.analyticsKey] || null;
        } catch (error) {
            console.error('Error getting analytics:', error);
            return null;
        }
    }

    // Очистка аналитики
    async clearAnalytics() {
        try {
            await chrome.storage.local.remove([this.analyticsKey]);
        } catch (error) {
            console.error('Error clearing analytics:', error);
        }
    }

    // Расчет статистики по времени
    calculateTimeStats(posts) {
        if (!posts.length) return {};

        const dates = posts.map(post => new Date(post.scrapedAt)).filter(date => !isNaN(date));
        if (!dates.length) return {};

        const sortedDates = dates.sort((a, b) => a - b);
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];

        // Группировка по дням
        const dayGroups = {};
        dates.forEach(date => {
            const dayKey = date.toISOString().split('T')[0];
            dayGroups[dayKey] = (dayGroups[dayKey] || 0) + 1;
        });

        return {
            firstPost: firstDate.toISOString(),
            lastPost: lastDate.toISOString(),
            totalDays: Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1,
            postsPerDay: dayGroups,
            averagePerDay: posts.length / Object.keys(dayGroups).length
        };
    }

    // Расчет статистики по авторам
    calculateAuthorStats(posts) {
        const authorCounts = {};
        const authorReactions = {};

        posts.forEach(post => {
            const authorName = post.author?.name;
            if (authorName) {
                authorCounts[authorName] = (authorCounts[authorName] || 0) + 1;
                authorReactions[authorName] = (authorReactions[authorName] || 0) + (post.reactions || 0);
            }
        });

        // Топ авторов по количеству постов
        const topAuthors = Object.entries(authorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, posts: count, reactions: authorReactions[name] || 0 }));

        return {
            totalAuthors: Object.keys(authorCounts).length,
            topAuthors: topAuthors,
            averagePostsPerAuthor: posts.length / Object.keys(authorCounts).length
        };
    }

    // Расчет статистики по активности
    calculateActivityStats(posts) {
        if (!posts.length) return {};

        const totalReactions = posts.reduce((sum, post) => sum + (post.reactions || 0), 0);
        const totalComments = posts.reduce((sum, post) => sum + (post.commentsCount || 0), 0);
        const totalShares = posts.reduce((sum, post) => sum + (post.sharesCount || 0), 0);

        const postsWithReactions = posts.filter(post => (post.reactions || 0) > 0);
        const postsWithComments = posts.filter(post => (post.commentsCount || 0) > 0);
        const postsWithShares = posts.filter(post => (post.sharesCount || 0) > 0);

        return {
            totalReactions: totalReactions,
            totalComments: totalComments,
            totalShares: totalShares,
            averageReactions: totalReactions / posts.length,
            averageComments: totalComments / posts.length,
            averageShares: totalShares / posts.length,
            engagementRate: {
                reactions: (postsWithReactions.length / posts.length) * 100,
                comments: (postsWithComments.length / posts.length) * 100,
                shares: (postsWithShares.length / posts.length) * 100
            }
        };
    }

    // Расчет статистики по комментариям
    calculateCommentStats(comments, posts) {
        if (!comments.length) return {};

        // Группировка комментариев по постам
        const commentsByPost = {};
        comments.forEach(comment => {
            const postId = comment.postId;
            if (!commentsByPost[postId]) {
                commentsByPost[postId] = [];
            }
            commentsByPost[postId].push(comment);
        });

        // Статистика по авторам комментариев
        const commentAuthors = {};
        comments.forEach(comment => {
            const authorName = comment.author?.name;
            if (authorName) {
                commentAuthors[authorName] = (commentAuthors[authorName] || 0) + 1;
            }
        });

        const topCommentators = Object.entries(commentAuthors)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([name, count]) => ({ name, comments: count }));

        return {
            totalComments: comments.length,
            postsWithComments: Object.keys(commentsByPost).length,
            averageCommentsPerPost: comments.length / posts.length,
            topCommentators: topCommentators,
            uniqueCommentators: Object.keys(commentAuthors).length
        };
    }

    // Поиск и фильтрация данных
    async searchData(query, filters = {}) {
        try {
            const data = await this.loadData();
            const results = {
                posts: [],
                comments: [],
                profiles: []
            };

            // Поиск в постах
            if (!filters.type || filters.type === 'posts') {
                results.posts = data.posts.filter(post => 
                    this.matchesQuery(post, query) && this.matchesFilters(post, filters)
                );
            }

            // Поиск в комментариях
            if (!filters.type || filters.type === 'comments') {
                results.comments = data.comments.filter(comment => 
                    this.matchesQuery(comment, query) && this.matchesFilters(comment, filters)
                );
            }

            // Поиск в профилях
            if (!filters.type || filters.type === 'profiles') {
                results.profiles = data.profiles.filter(profile => 
                    this.matchesQuery(profile, query) && this.matchesFilters(profile, filters)
                );
            }

            return results;
        } catch (error) {
            console.error('Error searching data:', error);
            throw error;
        }
    }

    // Проверка соответствия запросу
    matchesQuery(item, query) {
        if (!query) return true;
        
        const searchText = query.toLowerCase();
        const itemText = JSON.stringify(item).toLowerCase();
        
        return itemText.includes(searchText);
    }

    // Проверка соответствия фильтрам
    matchesFilters(item, filters) {
        // Фильтр по дате
        if (filters.dateFrom || filters.dateTo) {
            const itemDate = new Date(item.scrapedAt || item.timestamp);
            if (filters.dateFrom && itemDate < new Date(filters.dateFrom)) return false;
            if (filters.dateTo && itemDate > new Date(filters.dateTo)) return false;
        }

        // Фильтр по автору
        if (filters.author) {
            const authorName = item.author?.name?.toLowerCase() || '';
            if (!authorName.includes(filters.author.toLowerCase())) return false;
        }

        // Фильтр по минимальным реакциям
        if (filters.minReactions && (item.reactions || 0) < filters.minReactions) {
            return false;
        }

        return true;
    }

    // Получение статистики хранилища
    async getStorageStats() {
        try {
            const data = await this.loadData();
            const dataSize = JSON.stringify(data).length;
            
            return {
                totalItems: data.posts.length + data.comments.length + data.profiles.length,
                posts: data.posts.length,
                comments: data.comments.length,
                profiles: data.profiles.length,
                estimatedSize: `${(dataSize / 1024).toFixed(2)} KB`,
                lastUpdated: (await chrome.storage.local.get(['lastUpdated'])).lastUpdated
            };
        } catch (error) {
            console.error('Error getting storage stats:', error);
            return null;
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
} else if (typeof window !== 'undefined') {
    window.DataProcessor = DataProcessor;
}

