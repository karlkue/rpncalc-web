/**
 * RPN Calculator UI Controller (Responsive & Mobile-Adaptive)
 * Handles segmented controls, touch & haptics, keyboard hotkeys, and PWA registration.
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = new RPNCalculatorEngine();

    // DOM Elements
    const stackBox = document.getElementById('stackBox');
    const stackContainer = document.getElementById('stackContainer');
    const inputDisplay = document.getElementById('display');
    const statusBarText = document.getElementById('statusBarText');
    const hypBtn = document.getElementById('hypBtn');

    // Modals
    const logModal = document.getElementById('logModal');
    const logTableBody = document.getElementById('logTableBody');
    const decimalModal = document.getElementById('decimalModal');
    const decimalInput = document.getElementById('decimalPlacesInput');
    const aboutModal = document.getElementById('aboutModal');

    // Menu Checkmark Elements
    const menuDisplayStandard = document.getElementById('menuDisplayStandard');
    const menuDisplayFixed = document.getElementById('menuDisplayFixed');
    const menuDisplayScientific = document.getElementById('menuDisplayScientific');
    const menuDisplayGrouped = document.getElementById('menuDisplayGrouped');

    let errorTimeout = null;

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration skipped:', err);
        });
    }

    function triggerHaptic() {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(8);
            } catch (e) {
                // Ignore vibration restrictions
            }
        }
    }

    let currentTheme = 'dark';

    function setTheme(theme) {
        if (!['dark', 'light', 'classic'].includes(theme)) theme = 'dark';
        currentTheme = theme;
        if (theme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        try {
            localStorage.setItem('rpn_theme', theme);
        } catch (e) {}

        const themeMenuDark = document.getElementById('themeMenuDark');
        const themeMenuLight = document.getElementById('themeMenuLight');
        const themeMenuClassic = document.getElementById('themeMenuClassic');

        if (themeMenuDark) themeMenuDark.textContent = 'Theme: Dark Pro' + (theme === 'dark' ? ' ✓' : '');
        if (themeMenuLight) themeMenuLight.textContent = 'Theme: HP 48 Heritage' + (theme === 'light' ? ' ✓' : '');
        if (themeMenuClassic) themeMenuClassic.textContent = 'Theme: Classic 2008' + (theme === 'classic' ? ' ✓' : '');
    }

    function toggleTheme() {
        const order = ['dark', 'light', 'classic'];
        const next = order[(order.indexOf(currentTheme) + 1) % order.length];
        setTheme(next);
        const nameMap = { dark: 'Dark Pro', light: 'HP 48 Heritage', classic: 'Classic 2008' };
        showStatus(`Theme: ${nameMap[next]}`);
    }

    function loadSettings() {
        try {
            const savedBase = localStorage.getItem('rpn_base');
            const savedAngle = localStorage.getItem('rpn_angle');
            const savedDisplay = localStorage.getItem('rpn_display');
            const savedDecimals = localStorage.getItem('rpn_decimals');
            const savedTheme = localStorage.getItem('rpn_theme');

            if (savedBase && ['DEC', 'HEX', 'BIN', 'OCT'].includes(savedBase)) engine.numberBase = savedBase;
            if (savedAngle && ['DEG', 'RAD', 'GRAD'].includes(savedAngle)) engine.angleUnit = savedAngle;
            if (savedDisplay && ['Standard', 'Fixed', 'Scientific', 'Grouped'].includes(savedDisplay)) engine.displayType = savedDisplay;
            if (savedDecimals) {
                const dec = parseInt(savedDecimals, 10);
                if (!isNaN(dec) && dec >= 0 && dec <= 15) engine.decimalPlaces = dec;
            }
            setTheme(savedTheme || 'dark');
        } catch (e) {
            setTheme('dark');
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem('rpn_base', engine.numberBase);
            localStorage.setItem('rpn_angle', engine.angleUnit);
            localStorage.setItem('rpn_display', engine.displayType);
            localStorage.setItem('rpn_decimals', engine.decimalPlaces.toString());
        } catch (e) {
            // ignore
        }
    }

    let activeMobileTab = 'basic';

    function setMobileKeypadTab(tabName) {
        activeMobileTab = tabName;
        document.querySelectorAll('.mobile-keypad-tabs .k-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.ktab === tabName);
        });

        const keypadFull = document.getElementById('keypadFull');
        const keypadBasic = document.getElementById('keypadBasic');
        const keypadSci = document.getElementById('keypadSci');
        const keypadHex = document.getElementById('keypadHex');

        if (keypadFull) keypadFull.classList.toggle('active', tabName === 'full');
        if (keypadBasic) keypadBasic.classList.toggle('active', tabName === 'basic');
        if (keypadSci) keypadSci.classList.toggle('active', tabName === 'sci');
        if (keypadHex) keypadHex.classList.toggle('active', tabName === 'hex');
    }

    function init() {
        loadSettings();
        setupEventListeners();
        setupResizeGrip();
        setMobileKeypadTab('basic');
        updateUI();
        
        // Auto-scroll stack to bottom when window or container is resized
        if (window.ResizeObserver && stackContainer) {
            const ro = new ResizeObserver(() => {
                stackContainer.scrollTop = stackContainer.scrollHeight;
            });
            ro.observe(stackContainer);
        }

        inputDisplay.focus();
    }

    function setupResizeGrip() {
        const card = document.querySelector('.calculator-card');
        const grip = document.querySelector('.resize-grip');
        if (!card || !grip) return;

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        // Restore custom height on desktop
        const savedH = localStorage.getItem('rpn_card_height');
        if (savedH && window.innerWidth >= 600) {
            const parsed = parseInt(savedH, 10);
            if (!isNaN(parsed) && parsed >= 550) {
                const maxH = Math.floor(window.innerHeight * 0.96);
                card.style.height = `${Math.min(maxH, parsed)}px`;
            } else {
                card.style.height = '560px';
            }
        } else if (window.innerWidth >= 600) {
            card.style.height = '560px';
        }

        function onPointerDown(e) {
            if (window.innerWidth < 600) return;
            isDragging = true;
            startY = e.clientY || (e.touches && e.touches[0].clientY);
            startHeight = card.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('touchmove', onPointerMove);
            window.addEventListener('touchend', onPointerUp);
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
            if (clientY === undefined) return;
            const delta = clientY - startY;
            const maxH = Math.floor(window.innerHeight * 0.96);
            const newH = Math.max(550, Math.min(maxH, startHeight + delta));
            card.style.height = `${newH}px`;
            if (stackContainer) {
                stackContainer.scrollTop = stackContainer.scrollHeight;
            }
        }

        function onPointerUp() {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('touchmove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp);
                localStorage.setItem('rpn_card_height', card.offsetHeight.toString());
            }
        }

        grip.addEventListener('pointerdown', onPointerDown);
        grip.addEventListener('touchstart', onPointerDown, { passive: true });
    }

    function updateUI() {
        // 1. Render Stack Box with Level Indicators
        stackBox.innerHTML = '';
        const count = engine.stack.count;

        if (count === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.style.cssText = 'color: #999; font-size: 13px; text-align: center; margin: auto; font-style: italic; font-weight: normal;';
            emptyEl.textContent = 'Stack is empty';
            stackBox.appendChild(emptyEl);
        } else {
            for (let i = 0; i < count; i++) {
                const rowEl = document.createElement('div');
                rowEl.className = 'stack-row';

                const idxEl = document.createElement('span');
                idxEl.className = 'stack-idx';
                const posFromTop = count - i;
                idxEl.textContent = `${posFromTop}:`;

                const valEl = document.createElement('span');
                valEl.className = 'stack-val';
                valEl.textContent = engine.formatNumber(engine.stack.get(i));

                rowEl.appendChild(idxEl);
                rowEl.appendChild(valEl);
                stackBox.appendChild(rowEl);
            }
        }

        // Auto-scroll stack to bottom so top of stack is visible
        if (stackContainer) {
            stackContainer.scrollTop = stackContainer.scrollHeight;
        }

        // 2. Segmented Controls State
        document.querySelectorAll('#baseSegmented .segment-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.base === engine.numberBase);
        });

        document.querySelectorAll('#angleSegmented .segment-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.angle === engine.angleUnit);
        });

        // 3. Hyp Button State
        if (hypBtn) {
            hypBtn.classList.toggle('checked', engine.isHyperbolic);
        }

        // 4. Menu Checkmarks
        if (menuDisplayStandard) menuDisplayStandard.textContent = 'Standard' + (engine.displayType === 'Standard' ? ' ✓' : '');
        if (menuDisplayFixed) menuDisplayFixed.textContent = 'Fixed digits' + (engine.displayType === 'Fixed' ? ' ✓' : '');
        if (menuDisplayScientific) menuDisplayScientific.textContent = 'Scientific' + (engine.displayType === 'Scientific' ? ' ✓' : '');
        if (menuDisplayGrouped) menuDisplayGrouped.textContent = 'Grouped' + (engine.displayType === 'Grouped' ? ' ✓' : '');

        // 5. Update Keypad States
        updateKeypadState();
    }

    function updateKeypadState() {
        // Hex buttons A-F
        document.querySelectorAll('.btn-hex').forEach(btn => {
            btn.disabled = (engine.numberBase !== 'HEX');
        });

        // Numeric buttons depending on base
        document.querySelectorAll('.btn-num').forEach(btn => {
            const digit = parseInt(btn.dataset.val, 10);
            if (engine.numberBase === 'BIN') {
                btn.disabled = (digit > 1);
            } else if (engine.numberBase === 'OCT') {
                btn.disabled = (digit > 7);
            } else {
                if (!btn.classList.contains('btn-hex')) {
                    btn.disabled = false;
                }
            }
        });

        // Hyp button state on all keypads
        document.querySelectorAll('.hyp-toggle-btn').forEach(btn => {
            btn.classList.toggle('checked', engine.isHyperbolic);
        });

        // Trig button labels for Hyperbolic mode across all active keypads
        document.querySelectorAll('.trig-sin').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'sinh' : 'sin'; });
        document.querySelectorAll('.trig-cos').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'cosh' : 'cos'; });
        document.querySelectorAll('.trig-tan').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'tanh' : 'tan'; });
        document.querySelectorAll('.trig-asin').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'arsinh' : 'asin'; });
        document.querySelectorAll('.trig-acos').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'arcosh' : 'acos'; });
        document.querySelectorAll('.trig-atan').forEach(btn => { btn.textContent = engine.isHyperbolic ? 'artanh' : 'atan'; });
    }

    function showStatus(msg) {
        if (!statusBarText) return;
        statusBarText.textContent = msg;
        if (errorTimeout) clearTimeout(errorTimeout);
        errorTimeout = setTimeout(() => {
            statusBarText.textContent = '';
        }, 5000);
    }

    function processInputOrCommand(rawText) {
        triggerHaptic();
        const text = (rawText || '').trim();

        if (text === '') {
            const res = engine.executeOperation('ENTER');
            if (!res.success && engine.stack.count === 0) {
                showStatus('Stack is empty.');
            }
            updateUI();
            return;
        }

        // If it's a recognized command, execute it
        if (engine.isCommand(text)) {
            inputDisplay.value = '';
            const res = engine.executeOperation(text);
            if (!res.success) {
                showStatus(res.error || 'Operation failed.');
            }
            updateUI();
            return;
        }

        // Otherwise parse numeric value
        const parsed = engine.parseInput(text);
        if (!isNaN(parsed)) {
            engine.stack.push(parsed);
            inputDisplay.value = '';
            updateUI();
        } else {
            showStatus('Invalid input.');
        }
    }

    function handleOperation(op) {
        triggerHaptic();
        const currentText = inputDisplay.value.trim();
        let inputVal = null;

        if (currentText !== '') {
            if (engine.isCommand(currentText)) {
                engine.executeOperation(currentText);
                inputDisplay.value = '';
            } else {
                const parsed = engine.parseInput(currentText);
                if (!isNaN(parsed)) {
                    inputVal = parsed;
                    inputDisplay.value = '';
                } else {
                    showStatus('Invalid input.');
                    return;
                }
            }
        }

        const res = engine.executeOperation(op, inputVal);
        if (!res.success) {
            showStatus(res.error || 'Operation failed.');
        }
        updateUI();
    }

    function appendDigit(digit) {
        triggerHaptic();
        if (digit === 'EXP') {
            if (!inputDisplay.value.toUpperCase().includes('E')) {
                inputDisplay.value += 'E';
            }
        } else {
            inputDisplay.value += digit.toUpperCase();
        }
        inputDisplay.focus();
    }

    function setupEventListeners() {
        // Segmented Control Clicks (Base & Angle)
        document.querySelectorAll('#baseSegmented .segment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                triggerHaptic();
                setNumberBase(btn.dataset.base);
            });
        });

        document.querySelectorAll('#angleSegmented .segment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                triggerHaptic();
                setAngleUnit(btn.dataset.angle);
            });
        });

        // Mobile Keypad Tab Switcher Clicks
        document.querySelectorAll('.mobile-keypad-tabs .k-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                triggerHaptic();
                setMobileKeypadTab(tab.dataset.ktab);
            });
        });

        // Keypad Section Button Clicks (Delegated for full & adaptive grids)
        document.querySelector('.keypad-section').addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn || btn.disabled || btn.classList.contains('k-tab')) return;

            if (btn.dataset.val !== undefined) {
                appendDigit(btn.dataset.val);
            } else if (btn.dataset.action === 'enter') {
                processInputOrCommand(inputDisplay.value);
            } else if (btn.dataset.action === 'clr') {
                triggerHaptic();
                if (inputDisplay.value !== '') {
                    inputDisplay.value = '';
                } else {
                    engine.stack.drop();
                    updateUI();
                }
            } else if (btn.dataset.action === 'cla') {
                triggerHaptic();
                inputDisplay.value = '';
                engine.executeOperation('CLA');
                updateUI();
            } else if (btn.dataset.action === 'hyp') {
                triggerHaptic();
                engine.isHyperbolic = !engine.isHyperbolic;
                updateUI();
            } else if (btn.dataset.op !== undefined) {
                handleOperation(btn.dataset.op);
            }

            inputDisplay.focus();
        });

        // Menu Bar & Quick Header Icon Clicks
        document.querySelectorAll('[data-menu-action]').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.menuAction;
                const val = item.dataset.menuValue;
                handleMenuAction(action, val);
            });
        });

        // Input Field Keyboard Listener
        inputDisplay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                processInputOrCommand(inputDisplay.value);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                inputDisplay.value = '';
                engine.executeOperation('CLA');
                updateUI();
            } else if (['+', '-', '*', '/'].includes(e.key)) {
                if (inputDisplay.value === '' || (!isNaN(engine.parseInput(inputDisplay.value)) && e.key !== '-')) {
                    e.preventDefault();
                    handleOperation(e.key);
                }
            }
        });

        // Global Hotkeys Listener
        document.addEventListener('keydown', (e) => {
            if (document.querySelector('.modal-overlay.active')) {
                if (e.key === 'Escape') closeModal();
                return;
            }

            // Function Keys for Base and Angle Units
            if (e.key === 'F5') { e.preventDefault(); setNumberBase('DEC'); return; }
            if (e.key === 'F6') { e.preventDefault(); setNumberBase('HEX'); return; }
            if (e.key === 'F7') { e.preventDefault(); setNumberBase('BIN'); return; }
            if (e.key === 'F8') { e.preventDefault(); setNumberBase('OCT'); return; }
            if (e.key === 'F9') { e.preventDefault(); setAngleUnit('RAD'); return; }
            if (e.key === 'F10') { e.preventDefault(); setAngleUnit('DEG'); return; }
            if (e.key === 'F11') { e.preventDefault(); setAngleUnit('GRAD'); return; }

            if (document.activeElement !== inputDisplay) {
                if (/^[0-9a-zA-Z.]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    inputDisplay.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    processInputOrCommand(inputDisplay.value);
                } else if (e.key === 'Backspace') {
                    e.preventDefault();
                    if (inputDisplay.value.length > 0) {
                        inputDisplay.value = inputDisplay.value.slice(0, -1);
                    } else {
                        engine.stack.drop();
                        updateUI();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    inputDisplay.value = '';
                    engine.executeOperation('CLA');
                    updateUI();
                }
            }
        });
    }

    function setNumberBase(base) {
        if (inputDisplay.value.trim() !== '') {
            processInputOrCommand(inputDisplay.value);
        }
        engine.numberBase = base;
        if (base === 'HEX' && window.innerWidth < 600) {
            setMobileKeypadTab('hex');
        } else if (base !== 'HEX' && activeMobileTab === 'hex') {
            setMobileKeypadTab('basic');
        }
        saveSettings();
        updateUI();
    }

    function setAngleUnit(unit) {
        engine.angleUnit = unit;
        saveSettings();
        updateUI();
    }

    function handleMenuAction(action, val) {
        switch (action) {
            case 'copy-stack': {
                const stackText = engine.stack.items.map(v => engine.formatNumber(v)).join('\n');
                navigator.clipboard.writeText(stackText).then(() => showStatus('Stack copied to clipboard.'));
                break;
            }
            case 'copy-last': {
                if (engine.stack.count > 0) {
                    const top = engine.formatNumber(engine.stack.peek());
                    navigator.clipboard.writeText(top).then(() => showStatus('Last value copied.'));
                }
                break;
            }
            case 'set-display':
                engine.displayType = val;
                saveSettings();
                updateUI();
                break;
            case 'show-decimal-modal':
                decimalInput.value = engine.decimalPlaces;
                openModal(decimalModal);
                break;
            case 'show-log':
                renderLogTable();
                openModal(logModal);
                break;
            case 'set-theme':
                setTheme(val);
                break;
            case 'toggle-theme':
                triggerHaptic();
                toggleTheme();
                break;
            case 'show-about':
                openModal(aboutModal);
                break;
        }
    }

    // Modal controllers
    function openModal(modal) {
        if (modal) modal.classList.add('active');
    }

    function closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        inputDisplay.focus();
    }

    document.querySelectorAll('.modal-close-btn, .modal-close-btn-action, .modal-backdrop').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.getElementById('saveDecimalBtn')?.addEventListener('click', () => {
        const val = parseInt(decimalInput.value, 10);
        if (!isNaN(val) && val >= 0 && val <= 15) {
            engine.decimalPlaces = val;
            saveSettings();
            closeModal();
            updateUI();
        }
    });

    document.getElementById('clearLogBtn')?.addEventListener('click', () => {
        engine.history = [];
        renderLogTable();
    });

    document.getElementById('copyLogBtn')?.addEventListener('click', () => {
        const text = engine.history.map(h => `${h.time}\t${h.operation}\t${h.operands.join(', ')}\t${h.result}`).join('\n');
        navigator.clipboard.writeText(text).then(() => showStatus('Log copied to clipboard.'));
    });

    function renderLogTable() {
        if (!logTableBody) return;
        logTableBody.innerHTML = '';
        if (engine.history.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color:#888;">No entries in calculation log.</td></tr>';
            return;
        }

        engine.history.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.time}</td>
                <td><strong>${entry.operation}</strong></td>
                <td>${entry.operands.join(', ') || ''}</td>
                <td style="font-weight:bold; color:#0078d7;">${entry.result || ''}</td>
            `;
            logTableBody.appendChild(tr);
        });
    }

    init();
});
