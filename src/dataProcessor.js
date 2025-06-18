// Модуль для обработки и хранения данных Facebook Scraper
class DataProcessor {
    constructor() {
        this.storageKey = 'facebook_scraper_data';
        this.settingsKey = 'facebook_scraper_settings';
    }

    // Обработка и структурирование данных согласно требуемому JSON формату
    processScrapedData(rawData) {
        const processedData = {
            posts: [],
            metadata: {
                scraping_session: {
                    timestamp: new Date().toISOString(),
                    total_posts: 0,
                    total_comments: 0,
                    total_replies: 0
                }
            }
        };

        if (rawData && rawData.posts) {
            processedData.posts = rawData.posts.map(post => this.processPost(post));
            
            // Подсчитываем статистику
            processedData.metadata.scraping_session.total_posts = processedData.posts.length;
            processedData.metadata.scraping_session.total_comments = this.countTotalComments(processedData.posts);
            processedData.metadata.scraping_session.total_replies = this.countTotalReplies(processedData.posts);
        }

        return processedData;
    }

    // Обработка отдельного поста
    processPost(rawPost) {
        const processedPost = {
            post_id: rawPost.post_id || this.generateId('post'),
            author: this.processAuthor(rawPost.author),
            content: this.processContent(rawPost.content),
            metadata: this.processPostMetadata(rawPost.metadata),
            comments: []
        };

        // Обрабатываем комментарии
        if (rawPost.comments && Array.isArray(rawPost.comments)) {
            processedPost.comments = rawPost.comments.map(comment => this.processComment(comment));
        }

        return processedPost;
    }

    // Обработка автора
    processAuthor(rawAuthor) {
        if (!rawAuthor) {
            return {
                name: "Unknown User",
                profile_url: "",
                full_name: "Unknown User"
            };
        }

        return {
            name: rawAuthor.name || "Unknown User",
            profile_url: rawAuthor.profile_url || rawAuthor.profileLink || "",
            full_name: rawAuthor.full_name || rawAuthor.name || "Unknown User"
        };
    }

    // Обработка контента
    processContent(rawContent) {
        if (!rawContent) {
            return { text: "" };
        }

        return {
            text: rawContent.text || rawContent || ""
        };
    }

    // Обработка метаданных поста
    processPostMetadata(rawMetadata) {
        const metadata = {
            created_at: "",
            post_url: ""
        };

        if (rawMetadata) {
            metadata.created_at = this.normalizeTimestamp(rawMetadata.created_at || rawMetadata.timestamp);
            metadata.post_url = rawMetadata.post_url || rawMetadata.postLink || "";
        }

        return metadata;
    }

    // Обработка комментария
    processComment(rawComment) {
        const processedComment = {
            comment_id: rawComment.comment_id || this.generateId('comment'),
            content: this.processContent(rawComment.content),
            author: this.processAuthor(rawComment.author),
            metadata: this.processCommentMetadata(rawComment.metadata),
            replies: []
        };

        // Обрабатываем ответы на комментарий
        if (rawComment.replies && Array.isArray(rawComment.replies)) {
            processedComment.replies = rawComment.replies.map(reply => this.processReply(reply));
        }

        return processedComment;
    }

    // Обработка ответа на комментарий
    processReply(rawReply) {
        const processedReply = {
            reply_id: rawReply.reply_id || rawReply.comment_id || this.generateId('reply'),
            content: this.processContent(rawReply.content),
            author: this.processAuthor(rawReply.author),
            metadata: this.processCommentMetadata(rawReply.metadata),
            replies: [] // Поддержка вложенных ответов
        };

        // Обрабатываем вложенные ответы
        if (rawReply.replies && Array.isArray(rawReply.replies)) {
            processedReply.replies = rawReply.replies.map(nestedReply => this.processReply(nestedReply));
        }

        return processedReply;
    }

    // Обработка метаданных комментария
    processCommentMetadata(rawMetadata) {
        const metadata = {
            created_at: ""
        };

        if (rawMetadata) {
            metadata.created_at = this.normalizeTimestamp(rawMetadata.created_at || rawMetadata.timestamp);
        }

        return metadata;
    }

    // Нормализация временных меток
    normalizeTimestamp(timestamp) {
        if (!timestamp) return "";

        try {
            // Если это уже ISO строка
            if (timestamp.includes('T') && timestamp.includes('Z')) {
                return timestamp;
            }

            // Если это относительное время (например, "2h", "5 min ago")
            if (this.isRelativeTime(timestamp)) {
                return this.convertRelativeTime(timestamp);
            }

            // Пытаемся парсить как дату
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.toISOString();
            }

            return timestamp; // Возвращаем как есть, если не можем обработать
        } catch (error) {
            console.warn('Error normalizing timestamp:', timestamp, error);
            return timestamp;
        }
    }

    // Проверка, является ли время относительным
    isRelativeTime(timestamp) {
        const relativePatterns = [
            /\d+\s*(h|hour|hours|hr|hrs)/i,
            /\d+\s*(m|min|mins|minute|minutes)/i,
            /\d+\s*(s|sec|secs|second|seconds)/i,
            /\d+\s*(d|day|days)/i,
            /\d+\s*(w|week|weeks)/i,
            /just now/i,
            /ago/i
        ];

        return relativePatterns.some(pattern => pattern.test(timestamp));
    }

    // Конвертация относительного времени в абсолютное
    convertRelativeTime(relativeTime) {
        const now = new Date();
        const timeString = relativeTime.toLowerCase();

        // Извлекаем число
        const numberMatch = timeString.match(/\d+/);
        const number = numberMatch ? parseInt(numberMatch[0]) : 0;

        if (timeString.includes('h') || timeString.includes('hour')) {
            now.setHours(now.getHours() - number);
        } else if (timeString.includes('m') || timeString.includes('min')) {
            now.setMinutes(now.getMinutes() - number);
        } else if (timeString.includes('s') || timeString.includes('sec')) {
            now.setSeconds(now.getSeconds() - number);
        } else if (timeString.includes('d') || timeString.includes('day')) {
            now.setDate(now.getDate() - number);
        } else if (timeString.includes('w') || timeString.includes('week')) {
            now.setDate(now.getDate() - (number * 7));
        }

        return now.toISOString();
    }

    // Генерация уникальных ID
    generateId(prefix = 'item') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }

    // Подсчет общего количества комментариев
    countTotalComments(posts) {
        return posts.reduce((total, post) => {
            return total + (post.comments ? post.comments.length : 0);
        }, 0);
    }

    // Подсчет общего количества ответов
    countTotalReplies(posts) {
        let total = 0;
        
        posts.forEach(post => {
            if (post.comments) {
                post.comments.forEach(comment => {
                    total += this.countRepliesRecursive(comment);
                });
            }
        });
        
        return total;
    }

    // Рекурсивный подсчет ответов
    countRepliesRecursive(comment) {
        let count = comment.replies ? comment.replies.length : 0;
        
        if (comment.replies) {
            comment.replies.forEach(reply => {
                count += this.countRepliesRecursive(reply);
            });
        }
        
        return count;
    }

    // Экспорт данных в JSON
    exportToJSON(data) {
        const processedData = this.processScrapedData(data);
        const jsonString = JSON.stringify(processedData, null, 2);
        
        // Создаем blob и ссылку для скачивания
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `facebook_data_${timestamp}.json`;
        
        // Создаем временную ссылку для скачивания
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return filename;
    }

    // Экспорт данных в CSV
    exportToCSV(data) {
        const processedData = this.processScrapedData(data);
        const csvData = this.convertToCSV(processedData);
        
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `facebook_data_${timestamp}.csv`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return filename;
    }

    // Конвертация в CSV формат
    convertToCSV(data) {
        const headers = [
            'Post ID',
            'Post Author',
            'Post Content',
            'Post Date',
            'Post URL',
            'Comment ID',
            'Comment Author',
            'Comment Content',
            'Comment Date',
            'Reply ID',
            'Reply Author',
            'Reply Content',
            'Reply Date'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        data.posts.forEach(post => {
            if (post.comments && post.comments.length > 0) {
                post.comments.forEach(comment => {
                    if (comment.replies && comment.replies.length > 0) {
                        comment.replies.forEach(reply => {
                            csvContent += this.formatCSVRow([
                                post.post_id,
                                post.author.name,
                                this.escapeCSV(post.content.text),
                                post.metadata.created_at,
                                post.metadata.post_url,
                                comment.comment_id,
                                comment.author.name,
                                this.escapeCSV(comment.content.text),
                                comment.metadata.created_at,
                                reply.reply_id,
                                reply.author.name,
                                this.escapeCSV(reply.content.text),
                                reply.metadata.created_at
                            ]) + '\n';
                        });
                    } else {
                        csvContent += this.formatCSVRow([
                            post.post_id,
                            post.author.name,
                            this.escapeCSV(post.content.text),
                            post.metadata.created_at,
                            post.metadata.post_url,
                            comment.comment_id,
                            comment.author.name,
                            this.escapeCSV(comment.content.text),
                            comment.metadata.created_at,
                            '', '', '', ''
                        ]) + '\n';
                    }
                });
            } else {
                csvContent += this.formatCSVRow([
                    post.post_id,
                    post.author.name,
                    this.escapeCSV(post.content.text),
                    post.metadata.created_at,
                    post.metadata.post_url,
                    '', '', '', '', '', '', '', ''
                ]) + '\n';
            }
        });
        
        return csvContent;
    }

    // Экранирование CSV значений
    escapeCSV(value) {
        if (typeof value !== 'string') return '';
        
        // Заменяем переносы строк и экранируем кавычки
        return '"' + value.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ') + '"';
    }

    // Форматирование строки CSV
    formatCSVRow(values) {
        return values.map(value => value || '').join(',');
    }

    // Сохранение данных в Chrome Storage
    async saveToStorage(data) {
        try {
            const processedData = this.processScrapedData(data);
            await chrome.storage.local.set({
                [this.storageKey]: processedData,
                lastSaveTime: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    // Загрузка данных из Chrome Storage
    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get([this.storageKey]);
            return result[this.storageKey] || { posts: [] };
        } catch (error) {
            console.error('Error loading from storage:', error);
            return { posts: [] };
        }
    }

    // Очистка данных
    async clearStorage() {
        try {
            await chrome.storage.local.remove([this.storageKey]);
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }

    // Получение статистики
    getStatistics(data) {
        const processedData = this.processScrapedData(data);
        
        return {
            totalPosts: processedData.posts.length,
            totalComments: this.countTotalComments(processedData.posts),
            totalReplies: this.countTotalReplies(processedData.posts),
            lastUpdate: new Date().toISOString()
        };
    }
}

// Экспорт для использования в других частях расширения
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
} else if (typeof window !== 'undefined') {
    window.DataProcessor = DataProcessor;
}

