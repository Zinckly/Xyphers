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
            updateControls();
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
    // Auth Link Logic
    const authContainer = document.getElementById('auth-link-container');
    if (authContainer) {
        if (UserSession.isLoggedIn()) {
            const username = UserSession.getCurrentUser();
            authContainer.innerHTML = `
                <div class="dropdown">
                    <button class="dropdown-btn">${username} &#9662;</button>
                    <div class="dropdown-content">
                        <a href="../profile/index.html">Statistics</a>
                        <a href="../leaderboard/index.html">Leaderboard</a>
                        <a href="#" onclick="UserSession.logout(); window.location.reload(); return false;">Logout</a>
                    </div>
                </div>
            `;
        } else {
            authContainer.innerHTML = `<a href="../login/index.html" class="btn secondary" style="text-decoration:none;">LOGIN</a>`;
        }
    }

    // Re-add Highlight Listener
    if (highlightToggle) {
        // Init state from settings
        highlightToggle.checked = gameState.settings.highlightSame;

        highlightToggle.addEventListener('change', (e) => {
            gameState.settings.highlightSame = e.target.checked;
            saveSettings();

            if (!gameState.settings.highlightSame) {
                // Clear existing highlights
                document.querySelectorAll('.input-letter').forEach(el => el.classList.remove('active-same-letter'));
            }
        });
    }

    updateControls(); // Check disable state on load
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

async function fetchQuote(limit = 30) {
    try {
        // Use global variable from quotes.js
        if (typeof LOCAL_QUOTES !== 'undefined' && Array.isArray(LOCAL_QUOTES)) {
            // Filter for quotes provided limit
            const shortQuotes = LOCAL_QUOTES.filter(q => q.quote.split(' ').length <= limit);

            if (shortQuotes.length > 0) {
                const randomQuote = shortQuotes[Math.floor(Math.random() * shortQuotes.length)];
                return {
                    quote: randomQuote.quote.toUpperCase(),
                    author: randomQuote.author
                };
            } else {
                console.warn(`No quotes <= ${limit} words found in local, trying generally short ones.`);
                // Fallback to slightly longer if very strict limit fails
                const retryLimit = limit + 5;
                const mediumQuotes = LOCAL_QUOTES.filter(q => q.quote.split(' ').length <= retryLimit);
                if (mediumQuotes.length > 0) {
                    const randomQuote = mediumQuotes[Math.floor(Math.random() * mediumQuotes.length)];
                    return { quote: randomQuote.quote.toUpperCase(), author: randomQuote.author };
                }
            }
        }
        // Last resort Fallback
        const fallbackQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        return { quote: fallbackQuote, author: 'UNKNOWN SIGNAL' };

    } catch (error) {
        console.warn('Error processing quotes, using local fallback:', error);
        const fallbackQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        return { quote: fallbackQuote, author: 'UNKNOWN SIGNAL' };
    }
}

async function initGame() {
    console.log("Initializing Game...");
    stopTimer();

    // Show Loading State
    const board = document.getElementById('game-board');
    board.innerHTML = '<div class="loading-state">ENCRYPTING TRANSMISSION...</div>';
    document.getElementById('freq-chart').innerHTML = ''; // Clear chart during load

    // Determine limit
    const limit = gameState.settings.cipherType === 'baconian' ? 10 : 30;

    // Fetch Quote
    const data = await fetchQuote(limit);

    gameState.originalQuote = data.quote;

    // Normalize Logic for Baconian (Classic 24-letter alphabet: I=J, U=V)
    if (gameState.settings.cipherType === 'baconian') {
        gameState.originalQuote = gameState.originalQuote.replace(/J/g, 'I').replace(/V/g, 'U');
    }

    gameState.author = data.author; // Store author
    gameState.cipherMap = generateCipher();
    gameState.userInputs = {};

    renderBoard(gameState.originalQuote, gameState.cipherMap);
    renderFrequencyChart(gameState.originalQuote, gameState.cipherMap);

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

    if (gameState.settings.cipherType === 'baconian') {
        // Classic Baconian Map (24-letter alphabet, I=J, U=V)
        // A=0 (AAAAA), B=1 (AAAAB)
        const classicMap = {
            'A': 'AAAAA', 'B': 'AAAAB', 'C': 'AAABA', 'D': 'AAABB', 'E': 'AABAA',
            'F': 'AABAB', 'G': 'AABBA', 'H': 'AABBB',
            'I': 'ABAAA', 'J': 'ABAAA', // I/J
            'K': 'ABAAB', 'L': 'ABABA', 'M': 'ABABB', 'N': 'ABBAA', 'O': 'ABBAB',
            'P': 'ABBBA', 'Q': 'ABBBB', 'R': 'BAAAA', 'S': 'BAAAB', 'T': 'BAABA',
            'U': 'BAABB', 'V': 'BAABB', // U/V
            'W': 'BABAA', 'X': 'BABAB', 'Y': 'BABBA', 'Z': 'BABBB'
        };
        return classicMap;
    } else if (gameState.settings.cipherType === 'atbash') {
        // Atbash: Reverse alphabet
        targetAlphabet = [...alphabet].reverse();
    } else {
        // Random Shuffle (Aristocrat / Patristocrat)
        targetAlphabet = [...alphabet].sort(() => Math.random() - 0.5);
    }

    if (gameState.settings.cipherType !== 'baconian') {
        const map = {};
        for (let i = 0; i < alphabet.length; i++) {
            map[alphabet[i]] = targetAlphabet[i];
        }
        return map;
    }
    return {}; // Should not reach here for baconian
}

function renderBoard(quote, cipherMap) {
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    let words = [];

    if (gameState.settings.cipherType === 'patristocrat') {
        const raw = quote.replace(/ /g, '');
        for (let i = 0; i < raw.length; i += 5) {
            words.push(raw.slice(i, i + 5));
        }
    } else {
        words = quote.split(' ');
    }

    words.forEach(word => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word';
        for (let char of word) {
            if (/[A-Z]/.test(char)) {

                const col = document.createElement('div');
                col.className = 'letter-column';

                let cipherDisplay = "";
                let inputMaxLength = 1;

                if (gameState.settings.cipherType === 'baconian') {
                    // Baconian: Cipher is 5 chars long (00000)
                    cipherDisplay = cipherMap[char];

                    const cipherDiv = document.createElement('div');
                    cipherDiv.className = 'cipher-letter';
                    cipherDiv.style.fontSize = '0.8rem'; // Smaller font for 5 chars
                    cipherDiv.style.letterSpacing = '1px';
                    cipherDiv.textContent = cipherDisplay;
                    col.appendChild(cipherDiv);
                } else {
                    cipherDisplay = cipherMap[char];
                    const cipherDiv = document.createElement('div');
                    cipherDiv.className = 'cipher-letter';
                    cipherDiv.textContent = cipherDisplay;
                    col.appendChild(cipherDiv);
                }

                const input = document.createElement('input');
                input.className = 'input-letter';

                if (gameState.settings.cipherType === 'baconian') {
                    input.style.width = '60px'; // Wider input for Baconian alignment
                    input.style.fontSize = '1.2rem';
                }

                input.maxLength = 1;
                input.dataset.cipher = cipherMap[char]; // For Baconian, this is the binary string
                input.dataset.original = char;

                input.addEventListener('input', handleInput);
                input.addEventListener('focus', handleFocus);
                input.addEventListener('keydown', handleKeydown);

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

    // Hide for Atbash AND Baconian
    if (gameState.settings.cipherType === 'atbash' || gameState.settings.cipherType === 'baconian') {
        const typeName = gameState.settings.cipherType.charAt(0).toUpperCase() + gameState.settings.cipherType.slice(1);
        chart.innerHTML = `<div style="padding:1rem; color:var(--text-secondary); text-align:center; font-style:italic; opacity:0.7;">Frequency analysis disabled for ${typeName}</div>`;
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
    const cipherChar = input.dataset.cipher; // Unique ID (char or binary string)

    input.value = val;
    gameState.userInputs[cipherChar] = val;

    // Autofill Logic
    if (gameState.settings.autofill) {
        // Selector must handle binary strings which might contain special chars? No, 0/1 are fine.
        // CSS.escape might be needed if using querySelector with raw strings starting with digit?
        // data-cipher="00000" -> selector [data-cipher="00000"] works fine
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

function updateControls() {
    const type = gameState.settings.cipherType;
    const highlightToggle = document.getElementById('toggle-highlight');

    if (highlightToggle) {
        if (type === 'atbash' || type === 'baconian') {
            highlightToggle.checked = false;
            highlightToggle.disabled = true;
            // Force setting to false so game logic respects it
            gameState.settings.highlightSame = false;

            // Clean up any existing highlights immediately
            const inputs = document.querySelectorAll('.input-letter');
            inputs.forEach(el => el.classList.remove('active-same-letter'));

        } else {
            highlightToggle.disabled = false;
        }
    }
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
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Track Stats
        if (typeof UserSession !== 'undefined' && UserSession.isLoggedIn()) {
            UserSession.updateStats(gameState.settings.cipherType, elapsed);
        }

        const timerText = document.getElementById('timer').textContent;
        const finalTimeEl = document.getElementById('final-time');
        if (finalTimeEl) finalTimeEl.textContent = timerText;
        const modal = document.getElementById('win-modal');
        if (modal) {
            const authorEl = document.getElementById('win-author');
            if (authorEl) authorEl.textContent = "Author: " + gameState.author;
            modal.classList.remove('hidden');
        }
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
