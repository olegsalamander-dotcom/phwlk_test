const CACHE_NAME = 'fotoprogulka-02.07.2026-v1.9.7'; // Увеличили версию!
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// 1. Установка и мгновенный пропуск ожидания
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Активация: чистим старый кэш и принудительно забираем управление вкладкой
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Удаляем старый кэш:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Принудительно обновляет страницу у пользователя
    );
});

// 3. Выдача файлов из кэша
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request).catch(() => caches.match('./index.html'));
        })
    );
});
