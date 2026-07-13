<script>
/* Принудительный сброс кэша приложения */
    document.getElementById('clearCacheBtn').onclick = function() {
        if (confirm('Приложение сбросит кэш и перезагрузится для загрузки последней версии. Продолжить?')) {
            if ('caches' in window) {
                // Находим и удаляем все кэш-хранилища, связанные с этим сайтом
                caches.keys().then(function(names) {
                    for (let name of names) caches.delete(name);
                }).then(function() {
                    // Принудительно очищаем sessionStorage и перезагружаем страницу
                    sessionStorage.clear();
                    location.reload(true);
                });
            } else {
                location.reload(true);
            }
        }
    };
    
    /* Функция переключения пресетов (режимов прогулки) */
    function setPreset(min, max, activeId) {
        if (state !== 'idle') return; // Блокируем переключение, если прогулка активна
        
        document.getElementById('minR').value = min;
        document.getElementById('maxR').value = max;
        
        updateUI(); // Принудительно обновляем внутреннее состояние интервалов
        
        // Меняем активный класс на кнопках
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(activeId).classList.add('active');
    }

    /* Данные фраз */
    const phrasesStart = ["Прогулка началась. Вдохновляйся моментом.", "Режим фотоохоты включен. Наблюдай за городом.", "Фотопрогулка активирована. Начинаем снимать.", "Город ждет твой лучший кадр. Погнали."];
    const phrasesShot = ["Внимание, снимай! У тебя минута.", "Лови момент! Время для кадра.", "Сделай этот кадр особенным. Пошел отсчет.", "Твой шанс! Делай максимально красивый снимок.", "Время пришло. В объективе — жизнь."];
    const phrasesWalk = ["Время вышло. Идем дальше.", "Кадр готов. Продолжаем прогулку.", "Снимок сделан? Отлично, ищем новый сюжет.", "Минута позади. Двигаемся к следующей точке.", "Заметь детали, которых никто не видит. Продолжаем прогулку.", "Меняй ракурс, ищи свет. Идем дальше.", "Не спеши, доверься интуиции. Продолжаем путь.", "Город — это твой холст. Идем дальше."];

    /* Переменные состояния */
    let audioCtx = null, backgroundNode = null, dummyAudio = null, state = 'idle', running = false;
    let isMinutes = true; 
    let lastBeepTime = 0; // Для отслеживания посекундного пикания в обратном отсчете
    const btn = document.getElementById('btn'), prog = document.getElementById('progress'), unitToggle = document.getElementById('unitToggle');

    /* Оптимизированный воркер таймера, устойчивый к блокировке */
    const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
            if (e.data.action === 'start') {
                clearInterval(timer);
                let endTime = e.data.endTime;
                
                // Высокая частота проверки (200мс) гарантирует точность. 
                timer = setInterval(() => {
                    let now = Date.now();
                    let timeLeft = Math.max(0, Math.round((endTime - now) / 1000));
                    self.postMessage({ action: 'tick', timeLeft: timeLeft, phase: e.data.phase });
                    if (timeLeft <= 0) clearInterval(timer);
                }, 200);
            } else if (e.data.action === 'stop') clearInterval(timer);
        };
    `;
    const worker = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));

    /* Инициализация аудио-замка (фоновый режим) с защитой от засыпания */
    function startBackgroundAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        audioCtx.onstatechange = function() {
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        };
        
        const destination = audioCtx.createMediaStreamDestination();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        
        osc.frequency.setValueAtTime(22, audioCtx.currentTime);
        
        let fMod = 0;
        setInterval(() => {
            if (audioCtx && osc) {
                fMod = fMod === 0 ? 2 : 0;
                osc.frequency.setValueAtTime(20 + fMod, audioCtx.currentTime);
            }
        }, 100);
        
        gain.gain.value = 0.001; 
        osc.connect(gain); 
        gain.connect(audioCtx.destination);
        gain.connect(destination);
        osc.start(); 
        backgroundNode = osc;
        
        if (!dummyAudio) { 
            dummyAudio = new Audio();
            dummyAudio.srcObject = destination.stream;
            dummyAudio.loop = true; 
        }
        dummyAudio.play().catch(() => {});
        
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: 'Фотопрогулка (активна)', artist: 'Олег Романов' });
            navigator.mediaSession.playbackState = "playing";
            navigator.mediaSession.setActionHandler('play', () => { if(dummyAudio) dummyAudio.play(); if(audioCtx) audioCtx.resume(); });
            navigator.mediaSession.setActionHandler('pause', () => { if(dummyAudio) dummyAudio.play(); });
        }
    }

    /* Вспомогательный метод одиночного пика */
    function createBeepNode(freq, duration, startTimeOffset) {
        if (!audioCtx) return;
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        
        osc.type = 'square'; 
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(2.0, audioCtx.currentTime + startTimeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTimeOffset + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + startTimeOffset);
        osc.stop(audioCtx.currentTime + startTimeOffset + duration);
    }

    /* Новая механика кодовых сигналов */
    function playSignal(type) {
        if (!audioCtx) return;
        
        if (type === 'start') {
            createBeepNode(600, 0.1, 0.0);
            createBeepNode(750, 0.1, 0.12);
            createBeepNode(900, 0.15, 0.24);
        } 
        else if (type === 'countdown') {
            createBeepNode(880, 0.08, 0.0);
        }
        else if (type === 'shot') {
            createBeepNode(1200, 0.6, 0.0);
        } 
        else if (type === 'walk') {
            createBeepNode(440, 0.2, 0.0);
            createBeepNode(440, 0.2, 0.35);
        }
    }

    /* Остановка аудио */
    function stopBackgroundAudio() {
        if (backgroundNode) { try { backgroundNode.stop(); } catch(e){} backgroundNode = null; }
        if (dummyAudio) { try { dummyAudio.pause(); dummyAudio.srcObject = null; dummyAudio = null; } catch(e){} }
        if (audioCtx) { try { audioCtx.close(); audioCtx = null; } catch(e){} }
    }

    /* Обработка таймера */
    worker.onmessage = function(e) {
        if (!running) return;
        let timeLeft = e.data.timeLeft, phase = e.data.phase;
        if (phase === 'walk') {
            let displayTime = isMinutes && timeLeft >= 60 ? `${Math.floor(timeLeft / 60)}м ${timeLeft % 60}с` : `${timeLeft}с`;
            document.getElementById('timerDisplay').textContent = `До сигнала: ${displayTime}`;
            
            if (timeLeft <= 4 && timeLeft > 0) {
                if (lastBeepTime !== timeLeft) {
                    lastBeepTime = timeLeft;
                    playSignal('countdown');
                }
            }
            
            if (timeLeft <= 0) { worker.postMessage({ action: 'stop' }); triggerShot(); }
        } else if (phase === 'shot') {
            document.getElementById('btnText').textContent = `КАДР СДЕЛАН (${timeLeft})`;
            if (timeLeft <= 0) { worker.postMessage({ action: 'stop' }); nextPhase(); }
        }
    };

    /* Интерфейс */
    function updateUI() {
        let min = document.getElementById('minR'), max = document.getElementById('maxR');
        let fill = document.getElementById('trackFill');
        if (+min.value > +max.value) min.value = max.value;
        document.getElementById('val').textContent = `${min.value} - ${max.value}`;
        let minP = (min.value - min.min) / (min.max - min.min) * 100;
        let maxP = (max.value - max.min) / (max.max - max.min) * 100;
        fill.style.left = minP + "%";
        fill.style.width = (maxP - minP) + "%";
    }

    document.getElementById('minR').oninput = document.getElementById('maxR').oninput = updateUI;
    unitToggle.onclick = () => { isMinutes = !isMinutes; unitToggle.textContent = isMinutes ? "Интервал (мин)" : "Интервал (сек)"; updateUI(); };
    updateUI();

    /* Кнопка старта */
    btn.onclick = () => {
        if (state === 'idle') {
            document.getElementById('modesBlock').style.opacity = "0.4";
            document.getElementById('modesBlock').style.pointerEvents = "none";
            
            state = 'walk'; running = true;
            btn.style.background = "#2e7d32";
            document.getElementById('btnText').textContent = "СТОП";
            startBackgroundAudio(); 
            playSignal('start');
            cycle();
        } else if (state === 'shot') { nextPhase(); }
    };

    /* Удержание кнопки стоп */
    let holdTimer;
    btn.onpointerdown = () => {
        if (state === 'idle') return;
        let start = Date.now();
        holdTimer = setInterval(() => {
            let elapsed = Date.now() - start;
            prog.style.width = Math.min(100, elapsed / 10) + "%";
            if (elapsed > 1000) { worker.postMessage({ action: 'stop' }); stopBackgroundAudio(); location.reload(); }
        }, 30);
    };
    btn.onpointerup = btn.onpointerleave = () => { clearInterval(holdTimer); prog.style.width = "0%"; };

    /* Логика фаз */
    function cycle() {
        if (!running) return;
        let minVal = +document.getElementById('minR').value, maxVal = +document.getElementById('maxR').value;
        let randomUnits = Math.floor(Math.random() * (maxVal - minVal + 1) + minVal);
        let endTime = Date.now() + randomUnits * (isMinutes ? 60 : 1) * 1000;
        document.getElementById('status').textContent = "Идёт прогулка";
        lastBeepTime = 0; 
        worker.postMessage({ action: 'start', endTime: endTime, phase: 'walk' });
    }

    function triggerShot() {
        state = 'shot';
        playSignal('shot');
        document.getElementById('status').textContent = "ДЕЛАЙ КАДР!";
        btn.style.background = "#fbc02d"; btn.style.color = "#000";
        worker.postMessage({ action: 'start', endTime: Date.now() + 60000, phase: 'shot' });
    }

    function nextPhase() {
        state = 'walk';
        playSignal('walk');
        btn.style.background = "#2e7d32"; btn.style.color = "#fff";
        document.getElementById('btnText').textContent = "СТОП";
        cycle();
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW error', err));
        });
    }
</script>
