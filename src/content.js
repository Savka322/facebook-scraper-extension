// Content Script для извлечения данных с Facebook
class FacebookScraper {
    constructor() {
        this.isActive = false;
        this.settings = {};
        this.scrapedData = {
            posts: [],
            comments: [],
            profiles: []
        };
        this.processedElements = new Set();
        this.scrollCount = 0;
        this.maxScrollAttempts = 50;
        
        this.initializeSelectors();
        this.bindMessageListener();
        this.injectStyles();
    }

    initializeSelectors() {
        // Селекторы для различных элементов Facebook (могут изменяться)
        this.selectors = {
            // Посты (более общие и специфичные селекторы)
            posts: [
                // Селекторы для постов в ленте новостей и группах
                'div[role="feed"] > div[data-pagelet^="FeedUnit_"]',
                'div[role="article"]'
            ],
            
            // Текст поста (разные варианты, включая скрытый текст)
            postText: [
                'div[data-ad-preview="message"]',
                'div[data-testid="post_message"]',
                'div[dir="auto"]',
                'span[dir="auto"]'
            ],
            
            // Автор поста
            postAuthor: [
                'strong > span > a[role="link"]',
                'h2 strong > span > a[role="link"]',
                'a[role="link"][tabindex="0"][href*="facebook.com/"]'
            ],
            
            // Время публикации
            postTime: [
                'span.x4k7w5x.x1h91t0o.x1h9r5lt.x1jfb8zj.x87ps6o.x14atkfc.x1d52u69.x1s65kcs.x1lq5wgf.xgqcy7u.x30kzoy.x9jhf4c.x1lliihq > a[role="link"]',
                'a[role="link"][tabindex="0"][href*="/posts/"]',
                'a[role="link"][tabindex="0"][href*="/permalink/"]'
            ],
            
            // Реакции
            reactions: [
                'span.xrbpyxo.x6ikm8r.x10wlt62.xlyipyv.x1exxlbk[role="button"] span.x1e558r4',
                'div[aria-label*="reactions"]'
            ],
            
            // Комментарии (количество)
            commentsCount: [
                'div[role="article"] div[data-testid="UFI2CommentsCount/root"]',
                'span[data-testid="UFI2CommentsCount/root"]',
                'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xo1l8bm.xzsf02u'
            ],
            
            // Репосты (количество)
            sharesCount: [
                'div[role="article"] div[data-testid="UFI2SharesCount/root"]',
                'span[data-testid="UFI2SharesCount/root"]',
                'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xo1l8bm.xzsf02u'
            ],
            
            // Контейнер комментариев
            commentsContainer: [
                'div.x78zum5.xdt5ytf.x1n2onr6.x1ja2u2z',
                'div[role="feed"][aria-label="Comments"]'
            ],

            // Отдельный комментарий
            comments: [
                'div.x78zum5.xdt5ytf.x1n2onr6.x1ja2u2z > div[role="article"]',
                'div[role="article"][data-testid="UFI2Comment/root"]'
            ],
            
            // Текст комментария
            commentText: [
                'div.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x1vvkbs span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xo1l8bm.xzsf02u.x1yc453h[dir="auto"]',
                'div[data-testid="comment-content"] span[dir="auto"]'
            ],
            
            // Автор комментария
            commentAuthor: [
                'span.xt0psk2.xt0b8zv.x1jx94hy.x12nagc.x1mh8g0r.x85a59c.x47corl.xurb0ha.x1s85apg.x1tlxs6b.x1g8q02w.x1s65kcs.x1q0q8m5.x1qjc9v5.x78zum5.x1q0g3np.x1a2a7pz[role="link"]',
                'a[data-testid="comment-author-link"]'
            ],

            // Ссылка на пост (для получения ID)
            postLink: [
                'a[href*="/posts/"]',
                'a[href*="/permalink/"]'
            ],

            // Кнопка "Показать ответы" или "View more replies"
            viewRepliesButton: [
                'div[role="button"][tabindex="0"][aria-label*="View"]',
                'div[role="button"][tabindex="0"][aria-label*="replies"]',
                'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xo1l8bm.xzsf02u[role="button"]'
            ],

            // Отдельный ответ на комментарий (аналогично комментарию)
            replies: [
                'div.x78zum5.xdt5ytf.x1n2onr6.x1ja2u2z > div[role="article"]',
                'div[role="article"][data-testid="UFI2Comment/root"]'
            ],

            // Кнопка Comments для открытия полного поста
            commentsButton: [
                'div[role="button"][aria-label*="comment"]',
                'div[role="button"][aria-label*="Comment"]',
                'a[role="link"][href*="/posts/"]',
                'a[role="link"][href*="/permalink/"]'
            ],

            // Модальное окно поста
            postModal: [
                'div[role="dialog"]',
                'div[aria-modal="true"]'
            ],

            // Кнопка закрытия модального окна
            closeButton: [
                'div[aria-label="Close"]',
                'div[aria-label="Закрыть"]',
                'div[role="button"][aria-label*="Close"]',
                'div[role="button"][aria-label*="Закрыть"]'
            ],

            // Кнопки для загрузки дополнительных комментариев
            viewMoreCommentsButton: [
                'div[role="button"][aria-label*="View more comments"]',
                'div[role="button"][aria-label*="more comments"]',
                'div[role="button"][aria-label*="View previous comments"]'
            ]
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
                border: 2px solid #007bff;
                box-shadow: 0 0 5px rgba(0, 123, 255, 0.5);
            }
            .scraper-processed {
                opacity: 0.7;
            }
        `;
        document.head.append(style);
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startScraping':
                this.isActive = true;
                this.settings = message.settings;
                this.scrapedData = {
                    posts: [],
                    comments: [],
                    profiles: []
                };
                this.processedElements.clear();
                this.scrollCount = 0;
                this.startScrapingLoop();
                sendResponse({ status: 'Scraping started' });
                break;
            case 'stopScraping':
                this.isActive = false;
                sendResponse({ status: 'Scraping stopped' });
                break;
            case 'getScrapedData':
                sendResponse({ data: this.scrapedData });
                break;
            case 'injectScript':
                // Этот случай обрабатывается в background.js, но здесь для полноты
                sendResponse({ status: 'Script already injected or injection attempted' });
                break;
        }
    }

    async startScrapingLoop() {
        if (!this.isActive) {
            return;
        }

        const initialPostCount = this.scrapedData.posts.length;
        await this.scrapeCurrentPage();
        const newPostCount = this.scrapedData.posts.length;

        // Проверяем, достигнуто ли максимальное количество постов
        if (this.settings.maxPosts && newPostCount >= this.settings.maxPosts) {
            this.isActive = false;
            this.sendDataToBackground();
            console.log('Scraping finished. Max posts reached. Data sent to extension.');
            return;
        }

        // Проверяем, если не было найдено новых постов после прокрутки, и лимит постов не достигнут
        // Это предотвращает бесконечную прокрутку, если больше нет контента
        if (this.scrollCount > 0 && newPostCount === initialPostCount) {
            this.isActive = false;
            this.sendDataToBackground();
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
            console.log('Scraping finished. Max scroll attempts reached. Data sent to extension.');
        }
    }

    async scrapeCurrentPage() {
        const posts = document.querySelectorAll(this.selectors.posts.join(', '));
        for (const postElement of posts) {
            if (!this.processedElements.has(postElement)) {
                this.processedElements.add(postElement);
                
                // Новая логика: сначала нажимаем кнопку Comments
                const commentsButton = await this.findCommentsButton(postElement);
                if (commentsButton) {
                    try {
                        // Нажимаем кнопку Comments для открытия полного поста
                        commentsButton.click();
                        
                        // Ждем загрузки полного поста
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Теперь собираем данные из открытого поста
                        const postData = await this.extractPostDataFromModal();
                        if (postData) {
                            this.scrapedData.posts.push(postData);
                            this.highlightElement(postElement);
                        }
                        
                        // Закрываем модальное окно поста
                        await this.closePostModal();
                        
                    } catch (error) {
                        console.log('Error processing post:', error);
                        // Если что-то пошло не так, пробуем закрыть модальное окно
                        await this.closePostModal();
                    }
                } else {
                    // Если кнопка Comments не найдена, используем старый метод
                    const postData = await this.extractPostData(postElement);
                    if (postData) {
                        this.scrapedData.posts.push(postData);
                        this.highlightElement(postElement);
                    }
                }
            }
        }
    }

    async extractPostData(postElement) {
        const post = {};

        // Текст поста
        post.text = await this.extractFullPostText(postElement);
        // Автор поста
        const authorLinkElement = postElement.querySelector(this.selectors.postAuthor.join(', '));
        if (authorLinkElement) {
            post.author = {
                name: authorLinkElement.textContent.trim(),
                profileLink: authorLinkElement.href
            };
        }

        // Дата и время публикации
        const timeElement = postElement.querySelector(this.selectors.postTime.join(', '));
        if (timeElement) {
            post.timestamp = timeElement.getAttribute('title') || timeElement.textContent.trim();
        }

        // Количество реакций
        const reactionsElement = postElement.querySelector(this.selectors.reactions.join(', '));
        if (reactionsElement) {
            post.reactions = reactionsElement.textContent.trim();
        }

        // Количество комментариев
        const commentsCountElement = postElement.querySelector(this.selectors.commentsCount.join(', '));
        if (commentsCountElement) {
            post.commentsCount = commentsCountElement.textContent.trim();
        }

        // Количество репостов
        const sharesCountElement = postElement.querySelector(this.selectors.sharesCount.join(', '));
        if (sharesCountElement) {
            post.sharesCount = sharesCountElement.textContent.trim();
        }

        // Комментарии
        post.comments = await this.extractComments(postElement);

        // Ссылка на пост (для получения ID)
        const postLinkElement = postElement.querySelector(this.selectors.postLink.join(', '));
        if (postLinkElement) {
            post.postLink = postLinkElement.href;
            const postIdMatch = postLinkElement.href.match(/\/posts\/(\d+)|\/permalink\/(\d+)/);
            if (postIdMatch) {
                post.id = postIdMatch[1] || postIdMatch[2];
            }
        }

        return post;
    }

    async extractComments(postElement) {
        const comments = [];
        const commentsContainer = postElement.querySelector(this.selectors.commentsContainer.join(', '));
        if (commentsContainer) {
            const commentElements = commentsContainer.querySelectorAll(this.selectors.comments.join(', '));
            for (const commentElement of commentElements) {
                const comment = {};
                comment.text = this.extractText(commentElement, this.selectors.commentText);
                
                const authorLinkElement = commentElement.querySelector(this.selectors.commentAuthor.join(', '));
                if (authorLinkElement) {
                    comment.author = {
                        name: authorLinkElement.textContent.trim(),
                        profileLink: authorLinkElement.href
                    };
                }

                const timeElement = commentElement.querySelector(this.selectors.postTime.join(', ')); // Используем тот же селектор времени, что и для поста
                if (timeElement) {
                    comment.timestamp = timeElement.getAttribute('title') || timeElement.textContent.trim();
                }

                // TODO: Добавить логику для вложенных комментариев
                comment.replies = await this.extractReplies(commentElement);
                comments.push(comment);
            }
        }
        return comments;
    }

    highlightElement(element) {
        element.classList.add('scraper-highlight');
        setTimeout(() => {
            element.classList.remove('scraper-highlight');
            element.classList.add('scraper-processed');
        }, 1000);
    }

    sendDataToBackground() {
        chrome.runtime.sendMessage({ action: 'scrapedData', data: this.scrapedData });
    }

    async extractFullPostText(postElement) {
        let fullText = this.extractText(postElement, this.selectors.postText);
        const seeMoreButton = postElement.querySelector('div[role="button"][tabindex="0"][aria-label*="See more"]');
        if (seeMoreButton) {
            seeMoreButton.click();
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for content to expand
            fullText = this.extractText(postElement, this.selectors.postText);
        }
        return fullText;
    }

    extractText(element, selectors) {
        for (const selector of selectors) {
            const el = element.querySelector(selector);
            if (el) {
                return el.textContent.trim();
            }
        }
        return '';
    }

    async findCommentsButton(postElement) {
        // Поиск кнопки Comments
        for (const selector of this.selectors.commentsButton) {
            const button = postElement.querySelector(selector);
            if (button) {
                // Дополнительная проверка текста кнопки, если селектор слишком общий
                if (button.textContent.toLowerCase().includes('comment') || button.getAttribute('aria-label')?.toLowerCase().includes('comment')) {
                    return button;
                }
            }
        }
        return null;
    }

    async extractPostDataFromModal() {
        // Селекторы для элементов внутри модального окна
        const modal = document.querySelector(this.selectors.postModal.join(', '));
        if (!modal) {
            return null;
        }

        const post = {};

        // Автор поста
        const authorLinkElement = modal.querySelector(this.selectors.postAuthor.join(', '));
        if (authorLinkElement) {
            post.author = {
                name: authorLinkElement.textContent.trim(),
                profileLink: authorLinkElement.href
            };
        }

        // Текст поста
        post.text = await this.extractFullPostText(modal);

        // Дата и время публикации
        const timeElement = modal.querySelector(this.selectors.postTime.join(', '));
        if (timeElement) {
            post.timestamp = timeElement.getAttribute('title') || timeElement.textContent.trim();
        }

        // Количество реакций
        const reactionsElement = modal.querySelector(this.selectors.reactions.join(', '));
        if (reactionsElement) {
            post.reactions = reactionsElement.textContent.trim();
        }

        // Количество комментариев
        const commentsCountElement = modal.querySelector(this.selectors.commentsCount.join(', '));
        if (commentsCountElement) {
            post.commentsCount = commentsCountElement.textContent.trim();
        }

        // Количество репостов
        const sharesCountElement = modal.querySelector(this.selectors.sharesCount.join(', '));
        if (sharesCountElement) {
            post.sharesCount = sharesCountElement.textContent.trim();
        }

        // Комментарии из модального окна
        post.comments = await this.extractCommentsFromModal(modal);

        // Ссылка на пост (для получения ID)
        const postLinkElement = modal.querySelector(this.selectors.postLink.join(', '));
        if (postLinkElement) {
            post.postLink = postLinkElement.href;
            const postIdMatch = postLinkElement.href.match(/\/posts\/(\d+)|\/permalink\/(\d+)/);
            if (postIdMatch) {
                post.id = postIdMatch[1] || postIdMatch[2];
            }
        }

        return post;
    }

    async extractCommentsFromModal(modalElement) {
        const comments = [];
        await this.loadAllComments(modalElement); // Загружаем все комментарии перед извлечением

        const commentsContainer = modalElement.querySelector(this.selectors.commentsContainer.join(', '));
        if (commentsContainer) {
            const commentElements = commentsContainer.querySelectorAll(this.selectors.comments.join(', '));
            for (const commentElement of commentElements) {
                const comment = {};
                comment.text = this.extractText(commentElement, this.selectors.commentText);
                
                const authorLinkElement = commentElement.querySelector(this.selectors.commentAuthor.join(', '));
                if (authorLinkElement) {
                    comment.author = {
                        name: authorLinkElement.textContent.trim(),
                        profileLink: authorLinkElement.href
                    };
                }

                const timeElement = commentElement.querySelector(this.selectors.postTime.join(', '));
                if (timeElement) {
                    comment.timestamp = timeElement.getAttribute('title') || timeElement.textContent.trim();
                }

                comment.replies = await this.extractReplies(commentElement);
                comments.push(comment);
            }
        }
        return comments;
    }

        async closePostModal() {
        const closeButton = document.querySelector(this.selectors.closeButton.join(', '));
        if (closeButton) {
            closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 500)); // Ждем закрытия модального окна
        }
    }

    async loadAllComments(modalElement) {
        let loadedAll = false;
        let attempts = 0;
        const maxAttempts = 10; // Ограничиваем количество попыток загрузки

        while (!loadedAll && attempts < maxAttempts) {
            let foundButton = false;
            // Ищем кнопки "View more comments" или "View previous comments"
            const viewMoreButtons = modalElement.querySelectorAll(this.selectors.viewMoreCommentsButton.join(', '));
            for (const button of viewMoreButtons) {
                if (button.offsetParent !== null) { // Проверяем, что кнопка видима
                    button.click();
                    foundButton = true;
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем загрузки комментариев
                    break; // Нажимаем только одну кнопку за раз
                }
            }

            // Ищем кнопки "View replies" для всех комментариев
            const viewRepliesButtons = modalElement.querySelectorAll(this.selectors.viewRepliesButton.join(', '));
            for (const button of viewRepliesButtons) {
                if (button.offsetParent !== null) { // Проверяем, что кнопка видима
                    button.click();
                    foundButton = true;
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем загрузки ответов
                    // Не используем break, чтобы раскрыть все ответы сразу
                }
            }

            if (!foundButton) {
                loadedAll = true; // Если кнопок больше нет, значит, все загружено
            }
            attempts++;
        }
    }

    async extractReplies(commentElement) {
        const replies = [];
        // Ищем кнопку "View replies" внутри элемента комментария
        const viewRepliesButton = commentElement.querySelector(this.selectors.viewRepliesButton.join(', '));
        if (viewRepliesButton) {
            try {
                viewRepliesButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Ждем загрузки ответов
            } catch (error) {
                console.warn("Could not click view replies button:", error);
            }
        }

        const replyElements = commentElement.querySelectorAll(this.selectors.replies.join(', '));
        for (const replyElement of replyElements) {
            const reply = {};
            reply.text = this.extractText(replyElement, this.selectors.commentText);

            const authorLinkElement = replyElement.querySelector(this.selectors.commentAuthor.join(', '));
            if (authorLinkElement) {
                reply.author = {
                    name: authorLinkElement.textContent.trim(),
                    profileLink: authorLinkElement.href
                };
            }

            const timeElement = replyElement.querySelector(this.selectors.postTime.join(', '));
            if (timeElement) {
                reply.timestamp = timeElement.getAttribute('title') || timeElement.textContent.trim();
            }
            replies.push(reply);
        }
        return replies;
    }
}

const scraper = new FacebookScraper();

        
