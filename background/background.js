
// Background script для Facebook Data Scraper
class BackgroundService {
    constructor() {
        this.initializeListeners();
        this.scrapingState = {
            isActive: false,
            tabId: null,
            startTime: null
        };
    }

    initializeListeners() {
        // Обработка нажатия на иконку расширения для открытия боковой панели
        chrome.action.onClicked.addListener(async (tab) => {
            await chrome.sidePanel.open({ tabId: tab.id });
        });

        // Слушаем сообщения от popup и content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Указывает, что ответ будет асинхронным
        });

        // Слушаем обновления вкладок
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Слушаем закрытие вкладок
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.handleTabRemoved(tabId);
        });

        // Обработка установки расширения
        chrome.runtime.onInstalled.addListener(() => {
            this.handleInstall();
        });
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'startScraping':
                    await this.startScraping(sender.tab.id, message.settings);
                    sendResponse({ success: true });
                    break;

                case 'stopScraping':
                    await this.stopScraping();
                    sendResponse({ success: true });
                    break;

                case 'getScrapingState':
                    sendResponse({ state: this.scrapingState });
                    break;

                case 'updateProgress':
                    await this.updateProgress(message.progress, message.text);
                    sendResponse({ success: true });
                    break;

                case 'scrapedData':
                    await this.saveScrapedData(message.data);
                    sendResponse({ success: true });
                    break;

                case 'logError':
                    console.error('Content Script Error:', message.error);
                    sendResponse({ success: true });
                    break;

                case 'injectScript':
                    // Внедряем content script принудительно
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: sender.tab.id },
                            files: ['src/content.js']
                        });
                        sendResponse({ status: 'Script injected' });
                    } catch (error) {
                        console.error('Ошибка внедрения скрипта:', error);
                        sendResponse({ status: 'Error injecting script', error: error.message });
                    }
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async startScraping(tabId, settings) {
        this.scrapingState = {
            isActive: true,
            tabId: tabId,
            startTime: Date.now(),
            settings: settings
        };

        // Сохраняем состояние
        await chrome.storage.local.set({ scrapingState: this.scrapingState });

        // Уведомляем popup об изменении состояния
        this.notifyPopup('scrapingStarted', { tabId, settings });

        console.log('Scraping started on tab:', tabId);
    }

    async stopScraping() {
        if (this.scrapingState.isActive && this.scrapingState.tabId) {
            try {
                // Отправляем сообщение content script для остановки
                await chrome.tabs.sendMessage(this.scrapingState.tabId, {
                    action: 'stopScraping'
                });
            } catch (error) {
                console.log('Tab may be closed or content script not available');
            }
        }

        this.scrapingState.isActive = false;
        await chrome.storage.local.set({ scrapingState: this.scrapingState });

        this.notifyPopup('scrapingStopped');
        console.log('Scraping stopped');
    }

    async updateProgress(progress, text) {
        // Передаем прогресс в popup если он открыт
        this.notifyPopup('updateProgress', { progress, text });
    }

    async saveScrapedData(data) {
        try {
            // Получаем существующие данные
            const result = await chrome.storage.local.get(['scrapedData']);
            const existingData = result.scrapedData || { posts: [], comments: [], profiles: [] };

            // Объединяем новые данные с существующими
            const mergedData = {
                posts: [...existingData.posts, ...data.posts],
                comments: [...existingData.comments, ...data.comments],
                profiles: [...existingData.profiles, ...data.profiles]
            };

            // Удаляем дубликаты
            mergedData.posts = this.removeDuplicates(mergedData.posts, 'id');
            mergedData.comments = this.removeDuplicates(mergedData.comments, 'id');
            mergedData.profiles = this.removeDuplicates(mergedData.profiles, 'id');

            // Сохраняем обновленные данные
            await chrome.storage.local.set({ 
                scrapedData: mergedData,
                lastScrapeTime: new Date().toISOString()
            });

            // Уведомляем popup об обновлении данных
            this.notifyPopup('updateData', mergedData);

            console.log('Data saved:', {
                posts: mergedData.posts.length,
                comments: mergedData.comments.length,
                profiles: mergedData.profiles.length
            });

        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    removeDuplicates(array, key) {
        const seen = new Set();
        return array.filter(item => {
            const identifier = item[key] || JSON.stringify(item);
            if (seen.has(identifier)) {
                return false;
            }
            seen.add(identifier);
            return true;
        });
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Если вкладка со сбором данных была обновлена/перезагружена
        if (this.scrapingState.isActive && this.scrapingState.tabId === tabId) {
            if (changeInfo.status === 'complete' && tab.url && tab.url.includes('facebook.com')) {
                // Переинжектируем content script если необходимо
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['src/content.js']
                    });
                } catch (error) {
                    console.log('Content script already injected or error:', error);
                }
            }
        }
    }

    handleTabRemoved(tabId) {
        // Если закрыта вкладка со сбором данных
        if (this.scrapingState.isActive && this.scrapingState.tabId === tabId) {
            this.stopScraping();
        }
    }

    async handleInstall() {
        console.log('Facebook Data Scraper installed');
        
        // Инициализируем хранилище
        await chrome.storage.local.set({
            scrapedData: { posts: [], comments: [], profiles: [] },
            settings: {
                scrollDelay: 2000,
                maxPosts: 50,
                collectPosts: true,
                collectComments: true,
                collectProfiles: true
            }
        });
    }

    async notifyPopup(action, data = {}) {
        try {
            // Отправляем сообщение всем открытым popup
            await chrome.runtime.sendMessage({
                action: action,
                data: data
            });
        } catch (error) {
            // Popup может быть закрыт, это нормально
            console.log('Popup not available for notification');
        }
    }

    // Утилиты для работы с данными
    async getStoredData() {
        const result = await chrome.storage.local.get(['scrapedData']);
        return result.scrapedData || { posts: [], comments: [], profiles: [] };
    }

    async clearStoredData() {
        await chrome.storage.local.set({
            scrapedData: { posts: [], comments: [], profiles: [] }
        });
    }

    // Статистика использования
    async getUsageStats() {
        const data = await this.getStoredData();
        return {
            totalPosts: data.posts.length,
            totalComments: data.comments.length,
            totalProfiles: data.profiles.length,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Инициализация background service
const backgroundService = new BackgroundService();

// Экспорт для использования в других частях расширения
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackgroundService;
}

