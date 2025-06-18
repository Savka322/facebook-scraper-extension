// Content Script для извлечения данных с Facebook - Обновленная версия
class FacebookScraper {
    constructor() {
        this.isActive = false;
        this.settings = {};
        this.scrapedData = {
            posts: []
        };
        this.processedElements = new Set();
        this.scrollCount = 0;
        this.maxScrollAttempts = 50;
        this.currentPostIndex = 0;
        
        this.initializeSelectors();
        this.bindMessageListener();
        this.injectStyles();
    }

    initializeSelectors() {
        // Обновленные селекторы для Facebook
        this.selectors = {
            // Основные контейнеры постов
            posts: [
                'div[role="article"]',
                'div[data-pagelet^="FeedUnit_"]'
            ],
            
            // Ссылки для открытия полного поста (как на скриншоте)
            postLinks: [
                'a[href*="/posts/"]',
                'a[href*="/permalink/"]',
                'a[role="link"][href*="/groups/"][href*="/posts/"]',
                'span[dir="auto"] a[role="link"]'
            ],
            
            // Селекторы для полного поста (после открытия)
            fullPost: {
                container: 'div[role="main"]',
                content: [
                    'div[data-ad-preview="message"]',
                    'div[data-testid="post_message"]',
                    'div[dir="auto"]'
                ],
                author: {
                    name: 'h2 strong a[role="link"]',
                    link: 'h2 strong a[role="link"]'
                },
                timestamp: 'a[role="link"][href*="/posts/"] span',
                reactions: 'span[aria-label*="reactions"]',
                commentsCount: 'span[data-testid="UFI2CommentsCount/root"]'
            },
            
            // Комментарии и ответы
            comments: {
                container: 'div[aria-label="Comments"]',
                items: 'div[role="article"]',
                content: 'div[dir="auto"]',
                author: 'a[role="link"]',
                timestamp: 'a[role="link"] span',
                repliesButton: 'div[role="button"]:contains("replies")',
                showMoreButton: 'div[role="button"]:contains("View more")',
                replies: {
                    container: 'div[data-testid="UFI2Comment/replies"]',
                    items: 'div[role="article"]'
                }
            },
            // Селектор для кнопки закрытия модального окна поста
            closeButton: 'div[aria-label="Close"]'
        };
    }

    bindMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .scraper-highlight {
                border: 2px solid #007bff !important;
                box-shadow: 0 0 5px rgba(0, 123, 255, 0.5) !important;
            }
            .scraper-processed {
                opacity: 0.7;
            }
            .scraper-progress {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                z-index: 10000;
                font-family: Arial, sans-serif;
                font-size: 12px;
            }
        `;
        document.head.append(style);
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startScraping':
                this.isActive = true;
                this.settings = message.settings;
                this.scrapedData = { posts: [] };
                this.processedElements.clear();
                this.scrollCount = 0;
                this.currentPostIndex = 0;
                this.showProgress('Начинаем сбор данных...');
                this.startScrapingLoop();
                sendResponse({ status: 'Scraping started' });
                break;
            case 'stopScraping':
                this.isActive = false;
                this.hideProgress();
                sendResponse({ status: 'Scraping stopped' });
                break;
            case 'getScrapedData':
                sendResponse({ data: this.scrapedData });
                break;
        }
    }

    showProgress(text) {
        let progressDiv = document.querySelector('.scraper-progress');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.className = 'scraper-progress';
            document.body.appendChild(progressDiv);
        }
        progressDiv.textContent = text;
    }

    hideProgress() {
        const progressDiv = document.querySelector('.scraper-progress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }

    async startScrapingLoop() {
        if (!this.isActive) {
            return;
        }

        this.showProgress(`Обработано постов: ${this.scrapedData.posts.length}`);

        const initialPostCount = this.scrapedData.posts.length;
        await this.scrapeCurrentPage();
        const newPostCount = this.scrapedData.posts.length;

        // Проверяем, достигнуто ли максимальное количество постов
        if (this.settings.maxPosts && newPostCount >= this.settings.maxPosts) {
            this.isActive = false;
            this.sendDataToBackground();
            this.hideProgress();
            console.log('Scraping finished. Max posts reached. Data sent to extension.');
            return;
        }

        // Проверяем, если не было найдено новых постов после прокрутки
        if (this.scrollCount > 0 && newPostCount === initialPostCount) {
            this.isActive = false;
            this.sendDataToBackground();
            this.hideProgress();
            console.log('Scraping finished. No new posts found after scroll. Data sent to extension.');
            return;
        }

        // Прокрутка страницы для загрузки нового контента
        if (this.scrollCount < this.maxScrollAttempts) {
            window.scrollTo(0, document.body.scrollHeight);
            this.scrollCount++;
            // Ждем загрузки нового контента
            await new Promise(resolve => setTimeout(resolve, this.settings.scrollDelay || 2000));
            this.startScrapingLoop();
        } else {
            this.isActive = false;
            this.sendDataToBackground();
            this.hideProgress();
            console.log('Scraping finished. Max scroll attempts reached. Data sent to extension.');
        }
    }

    async scrapeCurrentPage() {
        const posts = document.querySelectorAll(this.selectors.posts.join(', '));
        
        for (const postElement of posts) {
            if (!this.processedElements.has(postElement) && this.isActive) {
                this.processedElements.add(postElement);
                
                // Ищем ссылку для открытия полного поста
                const postLink = this.findPostLink(postElement);
                if (postLink) {
                    this.highlightElement(postElement);
                    this.showProgress(`Обрабатываем пост ${this.currentPostIndex + 1}...`);
                    
                    const postData = await this.extractFullPostData(postLink, postElement);
                    if (postData) {
                        this.scrapedData.posts.push(postData);
                        this.currentPostIndex++;
                        
                        // Проверяем лимит постов
                        if (this.settings.maxPosts && this.scrapedData.posts.length >= this.settings.maxPosts) {
                            break;
                        }
                    }
                    
                    // Небольшая пауза между постами
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
    }

    findPostLink(postElement) {
        for (const selector of this.selectors.postLinks) {
            const link = postElement.querySelector(selector);
            if (link && link.href && (link.href.includes('/posts/') || link.href.includes('/permalink/'))) {
                return link;
            }
        }
        return null;
    }

    async extractFullPostData(postLink, originalElement) {
        try {
            // Получаем URL поста
            const postUrl = postLink.href;
            const postId = this.extractPostId(postUrl);
            
            this.showProgress(`Открываем полный пост...`);
            
            // Кликаем по ссылке, чтобы открыть модальное окно
            postLink.click();
            
            // Ждем загрузки модального окна
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Извлекаем данные с полной страницы поста (модального окна)
            const postData = await this.extractPostDataFromFullPage(postId, postUrl);
            
            // Закрываем модальное окно
            const closeButton = document.querySelector(this.selectors.closeButton);
            if (closeButton) {
                closeButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Небольшая пауза после закрытия
            } else {
                console.warn('Close button not found. Cannot close modal.');
            }
            
            return postData;
            
        } catch (error) {
            console.error('Error extracting full post data:', error);
            // Fallback: извлекаем данные из оригинального элемента
            return this.extractBasicPostData(originalElement, postLink.href);
        }
    }

    async extractPostDataFromFullPage(postId, postUrl) {
        const postData = {
            post_id: postId,
            author: {},
            content: {},
            metadata: {},
            comments: []
        };

        // Извлекаем автора
        const authorElement = document.querySelector(this.selectors.fullPost.author.name);
        if (authorElement) {
            postData.author = {
                name: authorElement.textContent.trim(),
                profile_url: authorElement.href,
                full_name: authorElement.textContent.trim()
            };
        }

        // Извлекаем контент поста
        const contentElement = document.querySelector(this.selectors.fullPost.content.join(', '));
        if (contentElement) {
            postData.content = {
                text: contentElement.textContent.trim()
            };
        }

        // Извлекаем метаданные
        const timestampElement = document.querySelector(this.selectors.fullPost.timestamp);
        if (timestampElement) {
            postData.metadata = {
                created_at: timestampElement.getAttribute('title') || timestampElement.textContent.trim(),
                post_url: postUrl
            };
        }

        // Извлекаем комментарии
        postData.comments = await this.extractAllComments();

        return postData;
    }

    async extractAllComments() {
        const comments = [];
        
        // Сначала раскрываем все комментарии
        await this.expandAllComments();
        
        const commentElements = document.querySelectorAll(this.selectors.comments.items);
        
        for (const commentElement of commentElements) {
            const comment = await this.extractCommentData(commentElement);
            if (comment) {
                comments.push(comment);
            }
        }
        
        return comments;
    }

    async expandAllComments() {
        // Нажимаем на все кнопки "View more comments"
        const showMoreButtons = document.querySelectorAll('div[role="button"]');
        for (const button of showMoreButtons) {
            if (button.textContent.includes('View more') || 
                button.textContent.includes('comments') ||
                button.textContent.includes('replies')) {
                button.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async extractCommentData(commentElement) {
        const comment = {
            comment_id: this.generateCommentId(),
            content: {},
            author: {},
            metadata: {},
            replies: []
        };

        // Извлекаем текст комментария
        const contentElement = commentElement.querySelector(this.selectors.comments.content);
        if (contentElement) {
            comment.content.text = contentElement.textContent.trim();
        }

        // Извлекаем автора комментария
        const authorElement = commentElement.querySelector(this.selectors.comments.author);
        if (authorElement) {
            comment.author = {
                name: authorElement.textContent.trim(),
                profile_url: authorElement.href,
                full_name: authorElement.textContent.trim()
            };
        }

        // Извлекаем время комментария
        const timestampElement = commentElement.querySelector(this.selectors.comments.timestamp);
        if (timestampElement) {
            comment.metadata.created_at = timestampElement.getAttribute('title') || timestampElement.textContent.trim();
        }

        // Извлекаем ответы на комментарий
        comment.replies = await this.extractCommentReplies(commentElement);

        return comment;
    }

    async extractCommentReplies(commentElement) {
        const replies = [];
        
        // Ищем контейнер с ответами
        const repliesContainer = commentElement.querySelector(this.selectors.comments.replies.container);
        if (repliesContainer) {
            const replyElements = repliesContainer.querySelectorAll(this.selectors.comments.replies.items);
            
            for (const replyElement of replyElements) {
                const reply = await this.extractCommentData(replyElement); // Рекурсивно
                if (reply) {
                    replies.push(reply);
                }
            }
        }
        
        return replies;
    }

    extractBasicPostData(postElement, postUrl) {
        // Fallback метод для извлечения базовых данных
        const postData = {
            post_id: this.extractPostId(postUrl),
            author: {},
            content: {},
            metadata: {
                post_url: postUrl
            },
            comments: []
        };

        // Пытаемся извлечь базовую информацию из элемента ленты
        const textElement = postElement.querySelector('div[dir="auto"]');
        if (textElement) {
            postData.content.text = textElement.textContent.trim();
        }

        return postData;
    }

    extractPostId(url) {
        const match = url.match(/\/posts\/(\d+)|\/permalink\/(\d+)/);
        return match ? (match[1] || match[2]) : `post_${Date.now()}`;
    }

    generateCommentId() {
        return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    highlightElement(element) {
        element.classList.add('scraper-highlight');
        setTimeout(() => {
            element.classList.remove('scraper-highlight');
            element.classList.add('scraper-processed');
        }, 1000);
    }

    sendDataToBackground() {
        // Используем DataProcessor для обработки данных перед отправкой
        const processor = new DataProcessor();
        const processedData = processor.processScrapedData(this.scrapedData);
        chrome.runtime.sendMessage({ action: 'scrapedData', data: processedData });
    }
}

const scraper = new FacebookScraper();



