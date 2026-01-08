const QUOTES = [
    "THE ONLY WAY TO DO GREAT WORK IS TO LOVE WHAT YOU DO",
    "INNOVATION DISTINGUISHES BETWEEN A LEADER AND A FOLLOWER",
    "STAY HUNGRY STAY FOOLISH",
    "TECHNOLOGY IS BEST WHEN IT BRINGS PEOPLE TOGETHER!",
    "IT IS NOT A BUG IT IS A FEATURE",
    "HELLO WORLD WELCOME TO THE MATRIX",
    "CRYPTOGRAPHY IS THE ULTIMATE FORM OF NONVIOLENT DIRECT ACTION",
    "I MADE 100 DOLLARS TODAY YEAHH!!!!"
];

let gameState = {
    originalQuote: "",
    cipherMap: {},
    reverseMap: {},
    userInputs: {},
    isGameActive: false,
    settings: {
        highlightSame: true,
        autofill: true
    }
};

let timerInterval;
let startTime;

document.addEventListener('DOMContentLoaded', () => {
    // Load Settings from LocalStorage
    const savedSettings = localStorage.getItem('xyphers_settings');
    if (savedSettings) {
        gameState.settings = JSON.parse(savedSettings);
    }

    // Apply Settings to UI
    const highlightToggle = document.getElementById('toggle-highlight');
    const autofillToggle = document.getElementById('toggle-autofill');

    if (highlightToggle) highlightToggle.checked = gameState.settings.highlightSame;
    if (autofillToggle) autofillToggle.checked = gameState.settings.autofill;

    initGame();

    document.getElementById('new-game-btn').addEventListener('click', () => {
        initGame();
    });

    document.getElementById('check-btn').addEventListener('click', checkSolution);
    document.getElementById('clear-btn').addEventListener('click', clearBoard);

    // Modal Listeners
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('win-modal').classList.add('hidden');
    });

    document.getElementById('modal-next-btn').addEventListener('click', () => {
        document.getElementById('win-modal').classList.add('hidden');
        initGame();
    });

    // Settings Listeners
    document.getElementById('toggle-highlight').addEventListener('change', (e) => {
        gameState.settings.highlightSame = e.target.checked;
        saveSettings();

        if (!gameState.settings.highlightSame) {
            // Clear existing highlights
            document.querySelectorAll('.input-letter').forEach(el => el.classList.remove('active-same-letter'));
        }
    });

    document.getElementById('toggle-autofill').addEventListener('change', (e) => {
        gameState.settings.autofill = e.target.checked;
        saveSettings();
    });

    // Cipher Type Listener
    const cipherSelect = document.getElementById('cipher-type');
    if (cipherSelect) {
        // Initialize value
        if (!gameState.settings.cipherType) gameState.settings.cipherType = 'aristocrat';
        cipherSelect.value = gameState.settings.cipherType;

        cipherSelect.addEventListener('change', (e) => {
            gameState.settings.cipherType = e.target.value;
            saveSettings();
            initGame();
        });
    }

    // Global Keydown
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('win-modal');

        // Modal Enter -> Next Game
        if (e.key === 'Enter' && modal && !modal.classList.contains('hidden')) {
            e.preventDefault();
            modal.classList.add('hidden');
            initGame();
        }

        // Delete Key -> Clear Board
        else if (e.key === 'Delete') {
            // Only clear if game is active and not won (modal hidden)
            if (gameState.isGameActive && modal && modal.classList.contains('hidden')) {
                clearBoard();
            }
        }
    });
});

function saveSettings() {
    localStorage.setItem('xyphers_settings', JSON.stringify(gameState.settings));
}

function clearBoard() {
    gameState.userInputs = {};
    const inputs = document.querySelectorAll('.input-letter');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('matched', 'incorrect');
    });
    if (inputs.length > 0) inputs[0].focus();
    hideStatus();
}

async function fetchQuote() {
    try {
        let attempts = 0;
        while (attempts < 5) {
            const response = await fetch('https://dummyjson.com/quotes/random');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();

            // Check word count limit
            if (data.quote.split(' ').length <= 30) {
                return data.quote.toUpperCase();
            }
            console.log(`Quote too long (${data.quote.split(' ').length} words), retrying...`);
            attempts++;
        }
        // If we fail to find a short one after 5 retries, fallback or just take the last one.
        // Let's fallback to local to be safe/fast.
        console.warn('Could not find short quote from API, using local fallback.');
        return QUOTES[Math.floor(Math.random() * QUOTES.length)];

    } catch (error) {
        console.warn('API Fetch failed, using local fallback:', error);
        return QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
}

async function initGame() {
    console.log("Initializing Game...");
    stopTimer();

    // Show Loading State
    const board = document.getElementById('game-board');
    board.innerHTML = '<div class="loading-state">ENCRYPTING TRANSMISSION...</div>';
    document.getElementById('freq-chart').innerHTML = ''; // Clear chart during load

    // Fetch Quote
    const quote = await fetchQuote();

    gameState.originalQuote = quote;
    gameState.cipherMap = generateCipher();
    gameState.userInputs = {};

    renderBoard(quote, gameState.cipherMap);
    renderFrequencyChart(quote, gameState.cipherMap);

    gameState.isGameActive = true;
    hideStatus();
    startTimer();

    // Auto-focus first input
    const firstInput = document.querySelector('.input-letter');
    if (firstInput) {
        firstInput.focus();
    }
}

function startTimer() {
    startTime = Date.now();
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = "00:00";

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        if (timerEl) timerEl.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function generateCipher() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    let targetAlphabet;

    if (gameState.settings.cipherType === 'atbash') {
        // Atbash: Reverse alphabet
        targetAlphabet = [...alphabet].reverse();
    } else {
        // Random Shuffle (Aristocrat / Patristocrat)
        targetAlphabet = [...alphabet].sort(() => Math.random() - 0.5);
    }

    const map = {};
    for (let i = 0; i < alphabet.length; i++) {
        map[alphabet[i]] = targetAlphabet[i];
    }
    return map;
}

function renderBoard(quote, cipherMap) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    let words = [];

    if (gameState.settings.cipherType === 'patristocrat') {
        // Remove spaces, keep punctuation/numbers
        const raw = quote.replace(/ /g, '');
        // Chunk into 5s
        for (let i = 0; i < raw.length; i += 5) {
            words.push(raw.slice(i, i + 5));
        }
    } else {
        // Aristocrat: Standard split by space
        words = quote.split(' ');
    }

    words.forEach(word => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word';
        for (let char of word) {
            if (/[A-Z]/.test(char)) {
                const cipherChar = cipherMap[char];
                const col = document.createElement('div');
                col.className = 'letter-column';

                const cipherDiv = document.createElement('div');
                cipherDiv.className = 'cipher-letter';
                cipherDiv.textContent = cipherChar;

                const input = document.createElement('input');
                input.className = 'input-letter';
                input.maxLength = 1;
                input.dataset.cipher = cipherChar;
                input.dataset.original = char;

                input.addEventListener('input', handleInput);
                input.addEventListener('focus', handleFocus);
                input.addEventListener('keydown', handleKeydown);

                col.appendChild(cipherDiv);
                col.appendChild(input);
                wordDiv.appendChild(col);
            } else {
                const col = document.createElement('div');
                col.className = 'letter-column';
                col.style.justifyContent = 'flex-end';
                col.style.paddingBottom = '5px';
                col.innerHTML = `<span style="font-size:2rem; color:var(--text-secondary);">${char}</span>`;
                wordDiv.appendChild(col);
            }
        }
        board.appendChild(wordDiv);
    });
}

function renderFrequencyChart(quote, cipherMap) {
    const chart = document.getElementById('freq-chart');
    if (!chart) return;
    chart.innerHTML = '';

    // Hide for Atbash
    if (gameState.settings.cipherType === 'atbash') {
        chart.innerHTML = '<div style="padding:1rem; color:var(--text-secondary); text-align:center; font-style:italic; opacity:0.7;">Frequency analysis disabled for Atbash</div>';
        return;
    }

    // Count frequencies of CIPHER characters
    const counts = {};
    let total = 0;

    for (let char of quote) {
        if (/[A-Z]/.test(char)) {
            const cipherChar = cipherMap[char];
            counts[cipherChar] = (counts[cipherChar] || 0) + 1;
            total++;
        }
    }

    // Convert to array and sort by frequency (descending)
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

    sorted.forEach(([letter, count]) => {
        const percentage = (count / maxCount) * 100;

        const row = document.createElement('div');
        row.className = 'freq-row';
        row.innerHTML = `
            <div class="freq-letter">${letter}</div>
            <div class="freq-bar-container">
                <div class="freq-bar" style="width: ${percentage}%"></div>
            </div>
            <div class="freq-count">${count}</div>
        `;
        chart.appendChild(row);
    });
}

function handleInput(e) {
    const input = e.target;
    const val = input.value.toUpperCase();
    const cipherChar = input.dataset.cipher;

    input.value = val;
    gameState.userInputs[cipherChar] = val;

    // Autofill Logic
    if (gameState.settings.autofill) {
        const allInputs = document.querySelectorAll(`.input-letter[data-cipher="${cipherChar}"]`);
        allInputs.forEach(el => {
            el.value = val;
        });
    }

    if (val) {
        const inputs = Array.from(document.querySelectorAll('.input-letter'));
        const currentIndex = inputs.indexOf(input);
        for (let i = currentIndex + 1; i < inputs.length; i++) {
            if (inputs[i].value === '') {
                inputs[i].focus();
                break;
            }
        }
    }
    // Note: No checkWinCondition here, per request check is manual or Enter
}

function handleFocus(e) {
    if (!gameState.settings.highlightSame) return;

    const cipherChar = e.target.dataset.cipher;
    document.querySelectorAll('.input-letter').forEach(el => {
        el.classList.remove('active-same-letter');
    });
    document.querySelectorAll(`.input-letter[data-cipher="${cipherChar}"]`).forEach(el => {
        el.classList.add('active-same-letter');
    });
}

function handleKeydown(e) {
    const input = e.target;

    // Alpha characters (Overwrite)
    if (/^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        input.value = e.key.toUpperCase();
        // Trigger input event manually to run handleInput logic
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
        return;
    }

    // Basic navigation logic (Arrow keys)
    if (e.key === "ArrowRight") {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.input-letter'));
        const currentIndex = inputs.indexOf(input);
        const nextIndex = (currentIndex + 1) % inputs.length;
        inputs[nextIndex].focus();
    } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const inputs = Array.from(document.querySelectorAll('.input-letter'));
        const currentIndex = inputs.indexOf(input);
        const prevIndex = (currentIndex - 1 + inputs.length) % inputs.length;
        inputs[prevIndex].focus();
    } else if (e.key === "Backspace") {
        e.preventDefault(); // Take full control

        // 1. Delete current content (if any)
        if (input.value !== "") {
            input.value = "";
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        }

        // 2. Always move back (if possible)
        const inputs = Array.from(document.querySelectorAll('.input-letter'));
        const currentIndex = inputs.indexOf(input);
        if (currentIndex > 0) {
            inputs[currentIndex - 1].focus();
        }
    } else if (e.key === "Enter") {
        e.stopPropagation(); // Prevent this from bubbling to the global listener
        checkSolution();
    }
}

function checkSolution() {
    let allCorrect = true;
    const inputs = document.querySelectorAll('.input-letter');

    // Check correctness without revealing hints
    inputs.forEach(input => {
        const correctChar = input.dataset.original;
        if (input.value !== correctChar) {
            allCorrect = false;
        }
    });

    if (allCorrect) {
        if (document.activeElement) document.activeElement.blur();

        // Apply success style to all inputs
        inputs.forEach(input => {
            input.classList.remove('active-same-letter');
            input.classList.add('matched');
        });

        stopTimer();
        const timerText = document.getElementById('timer').textContent;
        const finalTimeEl = document.getElementById('final-time');
        if (finalTimeEl) finalTimeEl.textContent = timerText;
        const modal = document.getElementById('win-modal');
        if (modal) modal.classList.remove('hidden');
    } else {
        // Shake all textboxes
        inputs.forEach(input => {
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 400);
        });
        showStatus("DECRYPTION FAILED", false);
    }
}

function showStatus(msg, isSuccess) {
    const el = document.getElementById('status-message');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.borderColor = isSuccess ? 'var(--accent-success)' : 'var(--accent-error)';
    el.style.color = isSuccess ? 'var(--accent-success)' : 'var(--accent-error)';
    el.style.background = isSuccess ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 0, 85, 0.1)';
}

function hideStatus() {
    const el = document.getElementById('status-message');
    if (el) el.classList.add('hidden');
}
