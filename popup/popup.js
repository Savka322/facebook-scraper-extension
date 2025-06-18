class PopupController {
    constructor() {
        this.isScrapingActive = false;
        this.scrapedData = {
            posts: [],
            comments: [],
            profiles: []
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadStoredData();
        this.updateUI();
    }

    initializeElements() {
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.querySelector('.status-text'),
            statusDot: document.querySelector('.status-dot'),
            
            collectPosts: document.getElementById('collectPosts'),
            collectComments: document.getElementById('collectComments'),
            collectProfiles: document.getElementById('collectProfiles'),
            
            postsCount: document.getElementById('postsCount'),
            commentsCount: document.getElementById('commentsCount'),
            profilesCount: document.getElementById('profilesCount'),
            
            scrollDelay: document.getElementById('scrollDelay'),
            maxPosts: document.getElementById('maxPosts'),
            
            startButton: document.getElementById('startScraping'),
            stopButton: document.getElementById('stopScraping'),
            openAnalytics: document.getElementById('openAnalytics'),
            exportButton: document.getElementById('exportData'),
            clearButton: document.getElementById('clearData'),
            
            progressSection: document.getElementById('progressSection'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText')
        };
    }

    bindEvents() {
        this.elements.startButton.addEventListener('click', () => this.startScraping());
        this.elements.stopButton.addEventListener('click', () => this.stopScraping());
        this.elements.openAnalytics.addEventListener('click', () => this.openAnalytics());
        this.elements.exportButton.addEventListener('click', () => this.exportData());
        this.elements.clearButton.addEventListener('click', () => this.clearData());
        
        // Сохранение настроек при изменении
        this.elements.scrollDelay.addEventListener('change', () => this.saveSettings());
        this.elements.maxPosts.addEventListener('change', () => this.saveSettings());
        this.elements.collectPosts.addEventListener('change', () => this.saveSettings());
        this.elements.collectComments.addEventListener('change', () => this.saveSettings());
        this.elements.collectProfiles.addEventListener('change', () => this.saveSettings());
    }

    async loadStoredData() {
        try {
            const result = await chrome.storage.local.get(['scrapedData', 'settings']);
            
            if (result.scrapedData) {
                this.scrapedData = result.scrapedData;
            }
            
            if (result.settings) {
                this.elements.scrollDelay.value = result.settings.scrollDelay || 2000;
                this.elements.maxPosts.value = result.settings.maxPosts || 50;
                this.elements.collectPosts.checked = result.settings.collectPosts !== false;
                this.elements.collectComments.checked = result.settings.collectComments !== false;
                this.elements.collectProfiles.checked = result.settings.collectProfiles !== false;
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    async saveSettings() {
        const settings = {
            scrollDelay: parseInt(this.elements.scrollDelay.value),
            maxPosts: parseInt(this.elements.maxPosts.value),
            collectPosts: this.elements.collectPosts.checked,
            collectComments: this.elements.collectComments.checked,
            collectProfiles: this.elements.collectProfiles.checked
        };
        
        await chrome.storage.local.set({ settings });
    }

    updateUI() {
        this.elements.postsCount.textContent = this.scrapedData.posts.length;
        this.elements.commentsCount.textContent = this.scrapedData.comments.length;
        this.elements.profilesCount.textContent = this.scrapedData.profiles.length;
        
        if (this.isScrapingActive) {
            this.elements.statusText.textContent = 'Сбор данных';
            this.elements.statusDot.style.background = '#f59e0b';
            this.elements.startButton.disabled = true;
            this.elements.stopButton.disabled = false;
            this.elements.progressSection.style.display = 'block';
        } else {
            this.elements.statusText.textContent = 'Готов';
            this.elements.statusDot.style.background = '#10b981';
            this.elements.startButton.disabled = false;
            this.elements.stopButton.disabled = true;
            this.elements.progressSection.style.display = 'none';
        }
    }

    async startScraping() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('facebook.com')) {
                this.showNotification('Откройте страницу Facebook для начала сбора данных', 'error');
                return;
            }

            this.isScrapingActive = true;
            this.updateUI();

            const settings = {
                scrollDelay: parseInt(this.elements.scrollDelay.value),
                maxPosts: parseInt(this.elements.maxPosts.value),
                collectPosts: this.elements.collectPosts.checked,
                collectComments: this.elements.collectComments.checked,
                collectProfiles: this.elements.collectProfiles.checked
            };

            // Отправляем сообщение content script для начала сбора
            // Если content script еще не запущен, инжектируем его
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'startScraping',
                settings: settings
            }).catch(() => null); // Ловим ошибку, если content script не отвечает

            if (!response) {
                // Content script не отвечает, инжектируем его и пробуем снова
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content.js']
                });
                // Даем время на инициализацию content script
                await new Promise(resolve => setTimeout(resolve, 500)); 
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'startScraping',
                    settings: settings
                });
            }

            this.showNotification('Сбор данных начат', 'success');
            
        } catch (error) {
            console.error('Ошибка запуска сбора:', error);
            this.showNotification('Ошибка запуска сбора данных', 'error');
            this.isScrapingActive = false;
            this.updateUI();
        }
    }

    async stopScraping() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'stopScraping'
            });

            this.isScrapingActive = false;
            this.updateUI();
            this.showNotification('Сбор данных остановлен', 'info');
            
        } catch (error) {
            console.error('Ошибка остановки сбора:', error);
            this.isScrapingActive = false;
            this.updateUI();
        }
    }

    async exportData() {
        try {
            const dataToExport = {
                timestamp: new Date().toISOString(),
                summary: {
                    posts: this.scrapedData.posts.length,
                    comments: this.scrapedData.comments.length,
                    profiles: this.scrapedData.profiles.length
                },
                data: this.scrapedData
            };

            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `facebook_data_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('Данные экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта данных', 'error');
        }
    }

    async clearData() {
        if (confirm('Вы уверены, что хотите очистить все собранные данные?')) {
            this.scrapedData = {
                posts: [],
                comments: [],
                profiles: []
            };
            
            await chrome.storage.local.set({ scrapedData: this.scrapedData });
            this.updateUI();
            this.showNotification('Данные очищены', 'info');
        }
    }

    openAnalytics() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup/analytics.html')
        });
    }

    updateProgress(progress, text) {
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressText.textContent = text;
    }

    showNotification(message, type = 'info') {
        // Создаем временное уведомление
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
            case 'info':
                notification.style.background = '#3b82f6';
                break;
            default:
                notification.style.background = '#6b7280';
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Слушаем сообщения от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateData') {
        popup.scrapedData = message.data;
        popup.updateUI();
        chrome.storage.local.set({ scrapedData: message.data });
    } else if (message.action === 'updateProgress') {
        popup.updateProgress(message.progress, message.text);
    } else if (message.action === 'scrapingComplete') {
        popup.isScrapingActive = false;
        popup.updateUI();
        popup.showNotification('Сбор данных завершен', 'success');
    }
});

// Инициализация при загрузке popup
let popup;
document.addEventListener('DOMContentLoaded', () => {
    popup = new PopupController();
});

