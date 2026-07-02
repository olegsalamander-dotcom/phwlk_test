// Изменили версию на v1.6. Теперь телефон поймет, что файлы обновились!
const CACHE_NAME = 'fotoprogulka-02.07.2026-v3.2'; 
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Кусок кода (остался без изменений) - установка и кэширование
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Кусок кода (ЗАМЕНЕННЫЙ) - автоматическая очистка старого кэша
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Удаляем старый кэш:', cache);
                        return caches.delete(cache); // Стираем версию v1.5 из памяти телефона
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Кусок кода (остался без изменений) - выдача файлов из кэша
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});
