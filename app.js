/**
 * RPN Calculator UI Controller (Responsive, Tactile & Monetization-Ready)
 * Synthesizes principles from Refactoring UI & Designing Interfaces:
 * - Full state persistence (stack, Last X, undo/redo, calculation tape)
 * - Capacitor Native Haptics + Web Audio API mechanical key-click synthesizer
 * - X/Y/Z/T register visual hierarchy & direct manipulation (click-to-copy, double-click-to-push)
 * - Command & Physical Constants Palette (⌘K)
 * - Native vs. Web funnel detection
 */

const MONETIZATION_CONFIG = {
    iosAppStoreUrl: 'https://apps.apple.com/app/rpn-scientific-calculator/id0000000000',
    googlePlayUrl: 'https://play.google.com/store/apps/details?id=com.karlkue.rpncalc',
    supportTipUrl: 'https://buymeacoffee.com/karlkue',
    priceDisplay: '$3.99'
};

document.addEventListener('DOMContentLoaded', () => {
    const engine = new RPNCalculatorEngine();

    // DOM Elements
    const stackBox = document.getElementById('stackBox');
    const stackContainer = document.getElementById('stackContainer');
    const inputDisplay = document.getElementById('display');
    const statusBarText = document.getElementById('statusBarText');
    const telemetryLastX = document.getElementById('telemetryLastX');
    const telemetryDepth = document.getElementById('telemetryDepth');
    const undoHeaderBtn = document.getElementById('undoHeaderBtn');
    const soundToggleBtn = document.getElementById('soundToggleBtn');
    const soundMenuToggle = document.getElementById('soundMenuToggle');

    // Modals
    const logModal = document.getElementById('logModal');
    const logTableBody = document.getElementById('logTableBody');
    const paletteModal = document.getElementById('paletteModal');
    const paletteSearchInput = document.getElementById('paletteSearchInput');
    const paletteList = document.getElementById('paletteList');
    const decimalModal = document.getElementById('decimalModal');
    const decimalInput = document.getElementById('decimalPlacesInput');
    const appStoreModal = document.getElementById('appStoreModal');
    const aboutModal = document.getElementById('aboutModal');

    // Menu Checkmark Elements
    const menuDisplayStandard = document.getElementById('menuDisplayStandard');
    const menuDisplayFixed = document.getElementById('menuDisplayFixed');
    const menuDisplayScientific = document.getElementById('menuDisplayScientific');
    const menuDisplayGrouped = document.getElementById('menuDisplayGrouped');

    let errorTimeout = null;
    let currentTheme = 'dark';
    let soundEnabled = false;
    let audioCtx = null;
    let deferredInstallPrompt = null;

    // Configure Store & Support URLs
    const linkIOS = document.getElementById('linkAppStoreIOS');
    const linkPlay = document.getElementById('linkGooglePlay');
    const linkTip = document.getElementById('linkSupportTip');
    if (linkIOS) linkIOS.href = MONETIZATION_CONFIG.iosAppStoreUrl;
    if (linkPlay) linkPlay.href = MONETIZATION_CONFIG.googlePlayUrl;
    if (linkTip) linkTip.href = MONETIZATION_CONFIG.supportTipUrl;

    // Detect Capacitor Native Platform vs Web Browser
    const isNativeApp = Boolean(
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform()
    );
    if (isNativeApp) {
        document.body.classList.add('is-native-app');
    }

    // PWA Install Prompt Capture
    const installPwaBtn = document.getElementById('installPwaBtn');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (installPwaBtn) installPwaBtn.style.display = 'inline-flex';
    });

    installPwaBtn?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installPwaBtn.style.display = 'none';
    });

    // Service Worker Registration for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration skipped:', err);
        });
    }

    /**
     * Synthesize a crisp 4ms HP-style mechanical microswitch click via Web Audio API
     */
    function playMechanicalClick(isAccent = false) {
        if (!soundEnabled) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!audioCtx) audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();

            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(isAccent ? 190 : 240, now);
            osc.frequency.exponentialRampToValueAtTime(55, now + 0.012);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.014);
        } catch (e) {
            // Ignore audio context restrictions
        }
    }

    /**
     * Hybrid Tactile Feedback:
     * 1. Capacitor Native Haptics (iOS Taptic Engine / Android Native Actuator)
     * 2. Web Vibration API (Android Browsers)
     * 3. Optional Web Audio Mechanical Microswitch Click (iOS Safari & Desktop)
     */
    function triggerHaptic(isHeavy = false) {
        playMechanicalClick(isHeavy);

        // 1. Native Capacitor Haptics Bridge
        if (window.Capacitor?.Plugins?.Haptics) {
            try {
                window.Capacitor.Plugins.Haptics.impact({
                    style: isHeavy ? 'MEDIUM' : 'LIGHT'
                });
                return;
            } catch (e) {}
        }

        // 2. Standard Web Vibration Fallback
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(isHeavy ? 12 : 7);
            } catch (e) {}
        }
    }

    function updateSoundUI() {
        if (soundToggleBtn) {
            soundToggleBtn.textContent = soundEnabled ? '🔊' : '🔇';
            soundToggleBtn.title = `Mechanical Key Click Sound: ${soundEnabled ? 'On' : 'Off'}`;
        }
        if (soundMenuToggle) {
            soundMenuToggle.textContent = `Key Click Sound: ${soundEnabled ? 'On ✓' : 'Off'}`;
        }
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        try {
            localStorage.setItem('rpn_sound', soundEnabled ? '1' : '0');
        } catch (e) {}
        updateSoundUI();
        if (soundEnabled) playMechanicalClick(true);
        showStatus(`Key click sound: ${soundEnabled ? 'Enabled' : 'Muted'}`);
    }

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

    function loadSettingsAndState() {
        try {
            const savedState = localStorage.getItem('rpn_engine_state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                engine.fromJSON(parsed);
            } else {
                // Legacy individual keys fallback
                const savedBase = localStorage.getItem('rpn_base');
                const savedAngle = localStorage.getItem('rpn_angle');
                const savedDisplay = localStorage.getItem('rpn_display');
                const savedDecimals = localStorage.getItem('rpn_decimals');

                if (savedBase && ['DEC', 'HEX', 'BIN', 'OCT'].includes(savedBase)) engine.numberBase = savedBase;
                if (savedAngle && ['DEG', 'RAD', 'GRAD'].includes(savedAngle)) engine.angleUnit = savedAngle;
                if (savedDisplay && ['Standard', 'Fixed', 'Scientific', 'Grouped'].includes(savedDisplay)) engine.displayType = savedDisplay;
                if (savedDecimals) {
                    const dec = parseInt(savedDecimals, 10);
                    if (!isNaN(dec) && dec >= 0 && dec <= 15) engine.decimalPlaces = dec;
                }
            }

            const savedTheme = localStorage.getItem('rpn_theme');
            setTheme(savedTheme || 'dark');

            soundEnabled = localStorage.getItem('rpn_sound') === '1';
            updateSoundUI();
        } catch (e) {
            setTheme('dark');
        }
    }

    function persistState() {
        try {
            localStorage.setItem('rpn_engine_state', JSON.stringify(engine.toJSON()));
        } catch (e) {
            // ignore storage quota errors
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

    /**
     * Format traditional RPN register label:
     * 1: X, 2: Y, 3: Z, 4: T, 5+: n:
     */
    function getRegisterLabel(posFromTop) {
        switch (posFromTop) {
            case 1: return '1: X';
            case 2: return '2: Y';
            case 3: return '3: Z';
            case 4: return '4: T';
            default: return `${posFromTop}:`;
        }
    }

    function updateUI() {
        persistState();

        // 1. Render Stack Box with X/Y/Z/T Register Hierarchy or Interactive Empty State
        stackBox.innerHTML = '';
        const count = engine.stack.count;

        if (count === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'stack-empty-onboarding';
            emptyEl.innerHTML = `
                <div class="empty-onboarding-header">
                    <span>RPN STACK READY</span>
                    <span>X / Y / Z / T REGISTERS</span>
                </div>
                <div class="empty-onboarding-steps">
                    Enter operand <code>25</code> → press <code>Enter ↵</code> → enter <code>4</code> → press <code>×</code>
                </div>
                <div class="empty-onboarding-actions">
                    <button type="button" class="empty-chip-btn" id="emptyTryDemoBtn">⚡ Load Demo Stack</button>
                    <button type="button" class="empty-chip-btn" id="emptyOpenPaletteBtn">⌘K Constants &amp; Ops</button>
                </div>
            `;
            stackBox.appendChild(emptyEl);

            emptyEl.querySelector('#emptyTryDemoBtn')?.addEventListener('click', () => {
                triggerHaptic(true);
                loadDemoStack();
            });
            emptyEl.querySelector('#emptyOpenPaletteBtn')?.addEventListener('click', () => {
                triggerHaptic();
                openPaletteModal();
            });
        } else {
            for (let i = 0; i < count; i++) {
                const posFromTop = count - i;
                const rawVal = engine.stack.get(i);
                const formattedVal = engine.formatNumber(rawVal);

                const rowEl = document.createElement('div');
                rowEl.className = 'stack-row' + (posFromTop === 1 ? ' stack-row-x' : '');
                rowEl.title = 'Click to copy · Double-click to duplicate to X register';

                const idxEl = document.createElement('span');
                idxEl.className = 'stack-idx';
                idxEl.textContent = getRegisterLabel(posFromTop);

                const valEl = document.createElement('span');
                valEl.className = 'stack-val';
                valEl.textContent = formattedVal;

                rowEl.appendChild(idxEl);
                rowEl.appendChild(valEl);

                // Direct Manipulation: Click to copy, Double-click to pull value to X
                rowEl.addEventListener('click', () => {
                    triggerHaptic();
                    navigator.clipboard?.writeText(formattedVal).catch(() => {});
                    showStatus(`Copied ${getRegisterLabel(posFromTop)} (${formattedVal})`);
                });

                rowEl.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    triggerHaptic(true);
                    engine.pushValue(rawVal);
                    showStatus(`Pulled ${formattedVal} to X register`);
                    updateUI();
                });

                stackBox.appendChild(rowEl);
            }
        }

        // Auto-scroll stack to bottom so X register is always visible
        if (stackContainer) {
            stackContainer.scrollTop = stackContainer.scrollHeight;
        }

        // 2. Update Status Bar Telemetry
        if (telemetryLastX) {
            const lx = engine.stack.lastX !== null && !isNaN(engine.stack.lastX)
                ? engine.formatNumber(engine.stack.lastX)
                : '—';
            telemetryLastX.textContent = `Last X: ${lx}`;
        }
        if (telemetryDepth) {
            telemetryDepth.textContent = `Stack: ${count}`;
        }
        if (undoHeaderBtn) {
            undoHeaderBtn.style.opacity = engine.undoStack.length > 0 ? '1' : '0.45';
        }

        // 3. Segmented Controls State
        document.querySelectorAll('#baseSegmented .segment-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.base === engine.numberBase);
        });

        document.querySelectorAll('#angleSegmented .segment-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.angle === engine.angleUnit);
        });

        // 4. Menu Checkmarks
        if (menuDisplayStandard) menuDisplayStandard.textContent = 'Standard' + (engine.displayType === 'Standard' ? ' ✓' : '');
        if (menuDisplayFixed) menuDisplayFixed.textContent = 'Fixed digits' + (engine.displayType === 'Fixed' ? ' ✓' : '');
        if (menuDisplayScientific) menuDisplayScientific.textContent = 'Scientific' + (engine.displayType === 'Scientific' ? ' ✓' : '');
        if (menuDisplayGrouped) menuDisplayGrouped.textContent = 'Grouped (1,000)' + (engine.displayType === 'Grouped' ? ' ✓' : '');

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
        }, 4500);
    }

    function loadDemoStack() {
        engine.saveSnapshot();
        engine.stack.clear();
        engine.stack.push(1024);
        engine.stack.push(256);
        engine.stack.push(3.14159265358979);
        engine.stack.push(42);
        engine.logOperation('DEMO_LOAD', [], 42);
        updateUI();
        showStatus('Loaded sample RPN registers (T, Z, Y, X)');
    }

    function processInputOrCommand(rawText) {
        triggerHaptic(true);
        const text = (rawText || '').trim();

        if (text === '') {
            const res = engine.executeOperation('ENTER');
            if (!res.success && engine.stack.count === 0) {
                showStatus('Stack is empty — type a number first');
            }
            updateUI();
            return;
        }

        // If it's a recognized command or constant, execute it
        if (engine.isCommand(text)) {
            inputDisplay.value = '';
            const res = engine.executeOperation(text);
            if (!res.success) {
                showStatus(res.error || 'Operation failed');
            }
            updateUI();
            return;
        }

        // Otherwise parse numeric value
        const parsed = engine.parseInput(text);
        if (!isNaN(parsed)) {
            engine.pushValue(parsed);
            engine.logOperation('PUSH', [], parsed);
            inputDisplay.value = '';
            updateUI();
        } else {
            showStatus('Unrecognized number or command (Press ⌘K for list)');
        }
    }

    function handleOperation(op) {
        triggerHaptic(op === 'ENTER' || op === 'CLA');
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
                    showStatus('Invalid entry buffer');
                    return;
                }
            }
        }

        const res = engine.executeOperation(op, inputVal);
        if (!res.success) {
            showStatus(res.error || 'Operation failed');
        } else if (op === 'UNDO') {
            showStatus('Undid last action');
        } else if (op === 'REDO') {
            showStatus('Redid action');
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

    function setupResizeGrip() {
        const card = document.querySelector('.calculator-card');
        const grip = document.querySelector('.resize-grip');
        if (!card || !grip) return;

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        const savedH = localStorage.getItem('rpn_card_height');
        if (savedH && window.innerWidth >= 600) {
            const parsed = parseInt(savedH, 10);
            if (!isNaN(parsed) && parsed >= 560) {
                const maxH = Math.floor(window.innerHeight * 0.96);
                card.style.height = `${Math.min(maxH, parsed)}px`;
            } else {
                card.style.height = '590px';
            }
        } else if (window.innerWidth >= 600) {
            card.style.height = '590px';
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
            const newH = Math.max(560, Math.min(maxH, startHeight + delta));
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

    /**
     * Command & Constants Palette (⌘K)
     */
    const paletteCatalog = [
        ...engine.constantsCatalog.map(c => ({
            cmd: c.cmd,
            symbol: c.symbol,
            title: c.name,
            meta: `${c.value} ${c.unit}`.trim(),
            keywords: `${c.name} ${c.alias} ${c.symbol} constant`.toLowerCase()
        })),
        { cmd: 'SUM', symbol: 'Σ', title: 'Sum All Stack Items', meta: 'Command: sum', keywords: 'sum total aggregate add all' },
        { cmd: 'MEAN', symbol: 'x̄', title: 'Arithmetic Mean (Average) of Stack', meta: 'Command: mean', keywords: 'mean average stat' },
        { cmd: 'MOD', symbol: 'mod', title: 'Modulo Remainder (y mod x)', meta: 'Command: mod', keywords: 'modulo remainder percent' },
        { cmd: 'ABS', symbol: '|x|', title: 'Absolute Value', meta: 'Command: abs', keywords: 'abs absolute magnitude' },
        { cmd: 'UNDO', symbol: '↶', title: 'Undo Last Operation', meta: 'Shortcut: ⌘Z', keywords: 'undo revert back' },
        { cmd: 'REDO', symbol: '↷', title: 'Redo Operation', meta: 'Shortcut: ⌘Y', keywords: 'redo forward' },
        { cmd: 'SWAP', symbol: 'x↔y', title: 'Swap X and Y Registers', meta: 'Command: swap', keywords: 'swap exchange xy' },
        { cmd: 'LASTX', symbol: 'LstX', title: 'Recall Last X Operand', meta: 'Command: lastx', keywords: 'lastx recall previous' }
    ];

    function renderPaletteList(query = '') {
        if (!paletteList) return;
        paletteList.innerHTML = '';
        const q = query.trim().toLowerCase();
        const filtered = q === ''
            ? paletteCatalog
            : paletteCatalog.filter(item => item.keywords.includes(q) || item.title.toLowerCase().includes(q));

        if (filtered.length === 0) {
            paletteList.innerHTML = '<div style="padding: 18px; text-align:center; color: var(--text-muted); font-size: 12.5px;">No matching constants or commands found.</div>';
            return;
        }

        filtered.forEach((item, idx) => {
            const el = document.createElement('div');
            el.className = 'palette-item' + (idx === 0 ? ' selected' : '');
            el.dataset.cmd = item.cmd;
            el.innerHTML = `
                <div class="palette-item-left">
                    <span class="palette-symbol">${item.symbol}</span>
                    <span class="palette-title">${item.title}</span>
                </div>
                <span class="palette-meta">${item.meta}</span>
            `;
            el.addEventListener('click', () => {
                closeModal();
                handleOperation(item.cmd);
            });
            paletteList.appendChild(el);
        });
    }

    function openPaletteModal() {
        renderPaletteList('');
        openModal(paletteModal);
        if (paletteSearchInput) {
            paletteSearchInput.value = '';
            setTimeout(() => paletteSearchInput.focus(), 40);
        }
    }

    paletteSearchInput?.addEventListener('input', () => {
        renderPaletteList(paletteSearchInput.value);
    });

    paletteSearchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstSelected = paletteList?.querySelector('.palette-item.selected, .palette-item');
            if (firstSelected && firstSelected.dataset.cmd) {
                const cmd = firstSelected.dataset.cmd;
                closeModal();
                handleOperation(cmd);
            }
        }
    });

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

        // Status Bar Telemetry Clicks
        telemetryLastX?.addEventListener('click', () => {
            handleOperation('LASTX');
        });
        telemetryDepth?.addEventListener('click', () => {
            renderLogTable();
            openModal(logModal);
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
            } else if (btn.dataset.action === 'palette') {
                triggerHaptic();
                openPaletteModal();
                return;
            } else if (btn.dataset.action === 'clr') {
                triggerHaptic();
                if (inputDisplay.value !== '') {
                    inputDisplay.value = '';
                } else {
                    engine.dropTop();
                    updateUI();
                }
            } else if (btn.dataset.action === 'cla') {
                triggerHaptic(true);
                inputDisplay.value = '';
                engine.executeOperation('CLA');
                showStatus('Cleared stack (Press ⌘Z or Undo to restore)');
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
                if (inputDisplay.value !== '') {
                    inputDisplay.value = '';
                } else {
                    engine.executeOperation('CLA');
                    showStatus('Cleared stack (⌘Z to undo)');
                    updateUI();
                }
            } else if (['+', '-', '*', '/'].includes(e.key)) {
                const val = inputDisplay.value;
                const isExponentSign = (e.key === '-' || e.key === '+') && /[eE]$/.test(val);
                if (!isExponentSign && (val === '' || !isNaN(engine.parseInput(val)))) {
                    e.preventDefault();
                    handleOperation(e.key);
                }
            }
        });

        // Global Hotkeys Listener
        document.addEventListener('keydown', (e) => {
            // Undo / Redo / Palette / Log Global Shortcuts
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                openPaletteModal();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                renderLogTable();
                openModal(logModal);
                return;
            }
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                if (inputDisplay.value === '') {
                    e.preventDefault();
                    handleOperation('UNDO');
                    return;
                }
            }
            if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
                ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                handleOperation('REDO');
                return;
            }

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
                        engine.dropTop();
                        updateUI();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    inputDisplay.value = '';
                    engine.executeOperation('CLA');
                    showStatus('Cleared stack (⌘Z to undo)');
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
        updateUI();
    }

    function setAngleUnit(unit) {
        engine.angleUnit = unit;
        updateUI();
    }

    function handleMenuAction(action, val) {
        switch (action) {
            case 'undo':
                handleOperation('UNDO');
                break;
            case 'redo':
                handleOperation('REDO');
                break;
            case 'exec-op':
                if (val) handleOperation(val);
                break;
            case 'copy-stack': {
                const stackText = engine.stack.items.map(v => engine.formatNumber(v)).join('\n');
                navigator.clipboard?.writeText(stackText).then(() => showStatus('Full stack copied to clipboard'));
                break;
            }
            case 'copy-last': {
                if (engine.stack.count > 0) {
                    const top = engine.formatNumber(engine.stack.peek());
                    navigator.clipboard?.writeText(top).then(() => showStatus(`Copied X register (${top})`));
                }
                break;
            }
            case 'set-display':
                engine.displayType = val;
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
            case 'show-palette':
                openPaletteModal();
                break;
            case 'load-demo':
                loadDemoStack();
                break;
            case 'set-theme':
                setTheme(val);
                break;
            case 'toggle-theme':
                triggerHaptic();
                toggleTheme();
                break;
            case 'toggle-sound':
                toggleSound();
                break;
            case 'show-app-store':
                closeModal();
                openModal(appStoreModal);
                break;
            case 'show-about':
                openModal(aboutModal);
                break;
        }
    }

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
            closeModal();
            updateUI();
        }
    });

    document.getElementById('clearLogBtn')?.addEventListener('click', () => {
        engine.history = [];
        persistState();
        renderLogTable();
    });

    document.getElementById('copyLogBtn')?.addEventListener('click', () => {
        const text = engine.history.map(h => `${h.time}\t${h.operation}\t${(h.operands || []).join(', ')}\t${h.result}`).join('\n');
        navigator.clipboard?.writeText(text).then(() => showStatus('Calculation tape copied to clipboard'));
    });

    function renderLogTable() {
        if (!logTableBody) return;
        logTableBody.innerHTML = '';
        if (engine.history.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">Calculation tape is empty. Perform an operation to record entries.</td></tr>';
            return;
        }

        engine.history.forEach(entry => {
            const tr = document.createElement('tr');
            const hasNumericResult = typeof entry.rawResult === 'number' && !isNaN(entry.rawResult);
            if (hasNumericResult) {
                tr.className = 'log-row-interactive';
                tr.title = `Click to push ${entry.result} onto stack`;
            }

            tr.innerHTML = `
                <td>${entry.time || ''}</td>
                <td><strong>${entry.operation || ''}</strong></td>
                <td>${(entry.operands || []).join(', ')}</td>
                <td class="log-result-cell">${entry.result || ''}</td>
            `;

            if (hasNumericResult) {
                tr.addEventListener('click', () => {
                    triggerHaptic(true);
                    engine.pushValue(entry.rawResult);
                    closeModal();
                    showStatus(`Pushed tape result ${entry.result} to X register`);
                    updateUI();
                });
            }

            logTableBody.appendChild(tr);
        });
    }

    function init() {
        loadSettingsAndState();
        setupEventListeners();
        setupResizeGrip();
        setMobileKeypadTab('basic');
        updateUI();

        if (window.ResizeObserver && stackContainer) {
            const ro = new ResizeObserver(() => {
                stackContainer.scrollTop = stackContainer.scrollHeight;
            });
            ro.observe(stackContainer);
        }

        inputDisplay.focus();
    }

    init();
});
