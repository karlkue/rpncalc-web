/**
 * RPN Calculator Core Engine
 * Reverse Polish Notation scientific calculator matching original C# RPN_Calculator logic
 * with full command dispatch dictionary, multi-base fractional arithmetic,
 * multi-level Undo/Redo stack, engineering constants, and state persistence.
 */

class RPNStack {
    constructor() {
        this.items = [];
        this.lastX = null;
    }

    push(val) {
        if (typeof val === 'number' && !isNaN(val)) {
            this.items.push(val);
        }
    }

    pop() {
        if (this.items.length === 0) return 0;
        return this.items.pop();
    }

    peek() {
        if (this.items.length === 0) return 0;
        return this.items[this.items.length - 1];
    }

    clear() {
        this.items = [];
    }

    drop() {
        if (this.items.length > 0) {
            this.items.pop();
        }
    }

    swap() {
        if (this.items.length >= 2) {
            const y = this.items[this.items.length - 2];
            const x = this.items[this.items.length - 1];
            this.items[this.items.length - 2] = x;
            this.items[this.items.length - 1] = y;
        }
    }

    rotateUp() {
        if (this.items.length > 1) {
            const top = this.items.pop();
            this.items.unshift(top);
        }
    }

    rotateDown() {
        if (this.items.length > 1) {
            const bottom = this.items.shift();
            this.items.push(bottom);
        }
    }

    dup() {
        if (this.items.length > 0) {
            this.items.push(this.peek());
        }
    }

    get count() {
        return this.items.length;
    }

    get(index) {
        return this.items[index];
    }
}

class RPNCalculatorEngine {
    constructor() {
        this.stack = new RPNStack();
        this.history = [];
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;

        this.angleUnit = 'DEG'; // DEG, RAD, GRAD
        this.numberBase = 'DEC'; // DEC, HEX, BIN, OCT
        this.displayType = 'Standard'; // Standard, Fixed, Scientific, Engineering, Grouped
        this.decimalPlaces = 4;
        this.isHyperbolic = false;
        this.registers = {}; // STO/RCL memory registers 0-9

        // Engineering & Physical Constants Catalog (CODATA / NIST)
        this.constantsCatalog = [
            { cmd: 'CONST_PI', alias: 'PI', symbol: 'π', name: 'Archimedes Constant (Pi)', value: Math.PI, unit: 'rad' },
            { cmd: 'CONST_E', alias: 'E', symbol: 'e', name: "Euler's Number", value: Math.E, unit: '' },
            { cmd: 'CONST_PHI', alias: 'PHI', symbol: 'φ', name: 'Golden Ratio', value: 1.618033988749895, unit: '' },
            { cmd: 'CONST_C', alias: 'C_LIGHT', symbol: 'c', name: 'Speed of Light in Vacuum', value: 299792458, unit: 'm/s' },
            { cmd: 'CONST_G', alias: 'G_GRAV', symbol: 'g', name: 'Standard Acceleration of Gravity', value: 9.80665, unit: 'm/s²' },
            { cmd: 'CONST_BIG_G', alias: 'BIG_G', symbol: 'G', name: 'Newtonian Gravitational Constant', value: 6.67430e-11, unit: 'm³/(kg·s²)' },
            { cmd: 'CONST_H', alias: 'PLANCK', symbol: 'h', name: 'Planck Constant', value: 6.62607015e-34, unit: 'J·s' },
            { cmd: 'CONST_KB', alias: 'BOLTZMANN', symbol: 'k_B', name: 'Boltzmann Constant', value: 1.380649e-23, unit: 'J/K' },
            { cmd: 'CONST_NA', alias: 'AVOGADRO', symbol: 'N_A', name: 'Avogadro Constant', value: 6.02214076e23, unit: 'mol⁻¹' },
            { cmd: 'CONST_QE', alias: 'Q_ELEM', symbol: 'q_e', name: 'Elementary Charge', value: 1.602176634e-19, unit: 'C' },
            { cmd: 'CONST_ME', alias: 'M_ELEC', symbol: 'm_e', name: 'Electron Mass', value: 9.1093837015e-31, unit: 'kg' },
            { cmd: 'CONST_EPS0', alias: 'EPS0', symbol: 'ε₀', name: 'Vacuum Electric Permittivity', value: 8.8541878128e-12, unit: 'F/m' },
            { cmd: 'CONST_R', alias: 'GAS_R', symbol: 'R', name: 'Molar Gas Constant', value: 8.314462618, unit: 'J/(mol·K)' }
        ];

        // Command alias dictionary
        this.commandAliases = {
            // Arithmetic
            '+': 'ADD', 'ADD': 'ADD', 'PLUS': 'ADD',
            '-': 'SUB', 'SUB': 'SUB', 'SUBTRACT': 'SUB', 'MINUS': 'SUB',
            '*': 'MULT', '×': 'MULT', 'MULT': 'MULT', 'MULTIPLY': 'MULT', 'TIMES': 'MULT',
            '/': 'DIV', '÷': 'DIV', 'DIV': 'DIV', 'DIVIDE': 'DIV',
            'MOD': 'MOD', '%': 'MOD', 'MODULO': 'MOD',
            '+/-': 'NEG', 'NEG': 'NEG', 'NEGATE': 'NEG', 'CHS': 'NEG',
            '1/X': 'INV', 'INV': 'INV', 'RECIP': 'INV', 'RECIPROCAL': 'INV',
            'ABS': 'ABS',

            // Powers & Roots
            'SQ': 'SQ', 'SQR': 'SQ', 'SQUARE': 'SQ', 'X^2': 'SQ', 'X2': 'SQ', 'X²': 'SQ',
            'SQRT': 'SQRT', 'ROOT2': 'SQRT', '√': 'SQRT', '√X': 'SQRT',
            'POW': 'POW', 'Y^X': 'POW', 'YX': 'POW', 'POWER': 'POW', '^': 'POW', 'Yˣ': 'POW',
            'XROOT': 'XROOT', 'ROOT': 'XROOT', 'ˣ√Y': 'XROOT', 'X_ROOT_Y': 'XROOT',
            '10^X': 'POW10', 'POW10': 'POW10', '10ˣ': 'POW10',
            '2^X': 'POW2', 'POW2': 'POW2', '2ˣ': 'POW2',
            'E^X': 'POWE', 'POWE': 'POWE', 'Eˣ': 'POWE', 'EXP': 'POWE',

            // Logarithms
            'LOG': 'LOG10', 'LOG10': 'LOG10',
            'LOG2': 'LOG2',
            'LN': 'LN', 'LOGN': 'LN',

            // Factorial & Combinatorics
            'FACT': 'FACT', 'FACTORIAL': 'FACT', 'X!': 'FACT', '!': 'FACT',

            // Constants
            'PI': 'PI', 'π': 'PI', 'CONST_PI': 'PI',
            'E': 'E', 'CONST_E': 'E',
            'PHI': 'CONST_PHI', 'φ': 'CONST_PHI', 'CONST_PHI': 'CONST_PHI',
            'C_LIGHT': 'CONST_C', 'CONST_C': 'CONST_C',
            'G_GRAV': 'CONST_G', 'CONST_G': 'CONST_G',
            'BIG_G': 'CONST_BIG_G', 'CONST_BIG_G': 'CONST_BIG_G',
            'PLANCK': 'CONST_H', 'CONST_H': 'CONST_H',
            'BOLTZMANN': 'CONST_KB', 'CONST_KB': 'CONST_KB',
            'AVOGADRO': 'CONST_NA', 'NA': 'CONST_NA', 'CONST_NA': 'CONST_NA',
            'Q_ELEM': 'CONST_QE', 'CONST_QE': 'CONST_QE',
            'M_ELEC': 'CONST_ME', 'CONST_ME': 'CONST_ME',
            'EPS0': 'CONST_EPS0', 'CONST_EPS0': 'CONST_EPS0',
            'GAS_R': 'CONST_R', 'CONST_R': 'CONST_R',
            'RAND': 'RAND', 'RANDOM': 'RAND',

            // Trigonometry
            'SIN': 'SIN', 'SINH': 'SINH',
            'COS': 'COS', 'COSH': 'COSH',
            'TAN': 'TAN', 'TANH': 'TANH',
            'ASIN': 'ASIN', 'ASINH': 'ASINH', 'ARSINH': 'ASINH', 'ARCSIN': 'ASIN',
            'ACOS': 'ACOS', 'ACOSH': 'ACOSH', 'ARCOSH': 'ACOSH', 'ARCCOS': 'ACOS',
            'ATAN': 'ATAN', 'ATANH': 'ATANH', 'ARTANH': 'ATANH', 'ARCTAN': 'ATAN',

            // Stack Operations
            'ENTER': 'ENTER',
            'SWAP': 'SWAP',
            'DROP': 'DROP',
            'DUP': 'DUP', 'DUPLICATE': 'DUP',
            'ROLL_UP': 'ROLL_UP', 'ROLLUP': 'ROLL_UP', 'ROTATEUP': 'ROLL_UP', 'UP': 'ROLL_UP', '▲ ROLL': 'ROLL_UP',
            'ROLL_DOWN': 'ROLL_DOWN', 'ROLLDOWN': 'ROLL_DOWN', 'ROTATEDOWN': 'ROLL_DOWN', 'DOWN': 'ROLL_DOWN', '▼ ROLL': 'ROLL_DOWN',
            'LAST': 'LASTX', 'LASTX': 'LASTX', 'LAST X': 'LASTX',
            'CLR': 'CLR', 'CLEAR': 'CLR',
            'CLA': 'CLA', 'CLEARALL': 'CLA', 'CLEAR_ALL': 'CLA',
            'HYP': 'HYP',

            // Aggregate Stack Operations
            'SUM': 'SUM', 'Σ': 'SUM',
            'MEAN': 'MEAN', 'AVG': 'MEAN',

            // Undo / Redo
            'UNDO': 'UNDO',
            'REDO': 'REDO'
        };
    }

    /**
     * Save current stack & lastX snapshot before mutating state
     */
    saveSnapshot() {
        this.undoStack.push({
            items: [...this.stack.items],
            lastX: this.stack.lastX
        });
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /**
     * Push a value onto the stack with Undo support
     */
    pushValue(val) {
        if (typeof val === 'number' && !isNaN(val)) {
            this.saveSnapshot();
            this.stack.push(val);
            return true;
        }
        return false;
    }

    /**
     * Drop top of stack with Undo support
     */
    dropTop() {
        if (this.stack.count > 0) {
            this.saveSnapshot();
            this.stack.drop();
            return true;
        }
        return false;
    }

    undo() {
        if (this.undoStack.length === 0) {
            return { success: false, error: 'Nothing to undo' };
        }
        this.redoStack.push({
            items: [...this.stack.items],
            lastX: this.stack.lastX
        });
        const prev = this.undoStack.pop();
        this.stack.items = [...prev.items];
        this.stack.lastX = prev.lastX;
        return { success: true };
    }

    redo() {
        if (this.redoStack.length === 0) {
            return { success: false, error: 'Nothing to redo' };
        }
        this.undoStack.push({
            items: [...this.stack.items],
            lastX: this.stack.lastX
        });
        const next = this.redoStack.pop();
        this.stack.items = [...next.items];
        this.stack.lastX = next.lastX;
        return { success: true };
    }

    /**
     * Serialize engine state for localStorage / Native App persistence
     */
    toJSON() {
        return {
            items: this.stack.items,
            lastX: this.stack.lastX,
            history: this.history.slice(0, 200),
            undoStack: this.undoStack.slice(-25),
            redoStack: this.redoStack.slice(-25),
            angleUnit: this.angleUnit,
            numberBase: this.numberBase,
            displayType: this.displayType,
            decimalPlaces: this.decimalPlaces,
            registers: this.registers
        };
    }

    /**
     * Restore engine state from JSON object
     */
    fromJSON(data) {
        if (!data || typeof data !== 'object') return false;
        if (Array.isArray(data.items)) {
            this.stack.items = data.items.filter(v => typeof v === 'number' && !isNaN(v));
        }
        if (typeof data.lastX === 'number' && !isNaN(data.lastX)) {
            this.stack.lastX = data.lastX;
        } else {
            this.stack.lastX = null;
        }
        if (Array.isArray(data.history)) {
            this.history = data.history;
        }
        if (Array.isArray(data.undoStack)) {
            this.undoStack = data.undoStack.filter(s => s && Array.isArray(s.items));
        }
        if (Array.isArray(data.redoStack)) {
            this.redoStack = data.redoStack.filter(s => s && Array.isArray(s.items));
        }
        if (data.angleUnit && ['DEG', 'RAD', 'GRAD'].includes(data.angleUnit)) {
            this.angleUnit = data.angleUnit;
        }
        if (data.numberBase && ['DEC', 'HEX', 'BIN', 'OCT'].includes(data.numberBase)) {
            this.numberBase = data.numberBase;
        }
        if (data.displayType && ['Standard', 'Fixed', 'Scientific', 'Engineering', 'Grouped'].includes(data.displayType)) {
            this.displayType = data.displayType;
        }
        if (typeof data.decimalPlaces === 'number' && data.decimalPlaces >= 0 && data.decimalPlaces <= 15) {
            this.decimalPlaces = data.decimalPlaces;
        }
        if (data.registers && typeof data.registers === 'object') {
            this.registers = { ...data.registers };
        }
        return true;
    }

    isCommand(cmd) {
        if (!cmd || typeof cmd !== 'string') return false;
        const normalized = cmd.trim().toUpperCase();
        return this.commandAliases.hasOwnProperty(normalized);
    }

    cleanFloat(val) {
        if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return val;
        return parseFloat(val.toPrecision(14));
    }

    toRadians(angle) {
        if (this.angleUnit === 'DEG') {
            return (angle / 180.0) * Math.PI;
        } else if (this.angleUnit === 'GRAD') {
            return (angle / 200.0) * Math.PI;
        }
        return angle;
    }

    fromRadians(rad) {
        if (this.angleUnit === 'DEG') {
            return (rad / Math.PI) * 180.0;
        } else if (this.angleUnit === 'GRAD') {
            return (rad / Math.PI) * 200.0;
        }
        return rad;
    }

    getRadix() {
        switch (this.numberBase) {
            case 'HEX': return 16;
            case 'OCT': return 8;
            case 'BIN': return 2;
            case 'DEC':
            default: return 10;
        }
    }

    formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return 'NaN';
        if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';

        const radix = this.getRadix();

        if (radix !== 10) {
            let isNeg = num < 0;
            let absNum = Math.abs(num);
            let intPart = Math.floor(absNum);
            let fracPart = absNum - intPart;

            let intStr = intPart.toString(radix).toUpperCase();
            if (fracPart === 0) {
                return (isNeg ? '-' : '') + intStr;
            }

            let maxFracDigits = radix === 16 ? 10 : (radix === 8 ? 12 : 16);
            let fracStr = '';
            let currentFrac = fracPart;

            for (let i = 0; i < maxFracDigits && currentFrac > 0; i++) {
                currentFrac *= radix;
                let digit = Math.floor(currentFrac);
                fracStr += digit.toString(radix).toUpperCase();
                currentFrac -= digit;
                if (Math.abs(currentFrac) < 1e-12) break;
            }

            return (isNeg ? '-' : '') + intStr + '.' + fracStr;
        }

        switch (this.displayType) {
            case 'Fixed':
                return num.toFixed(Math.max(0, Math.min(15, this.decimalPlaces)));
            case 'Scientific':
                return num.toExponential(Math.max(0, Math.min(15, this.decimalPlaces))).toUpperCase();
            case 'Engineering': {
                if (num === 0) return (0).toFixed(Math.max(0, Math.min(15, this.decimalPlaces))) + 'E+0';
                const exp = Math.floor(Math.log10(Math.abs(num)));
                const engExp = Math.floor(exp / 3) * 3;
                const mantissa = num / Math.pow(10, engExp);
                const dp = Math.max(0, Math.min(15, this.decimalPlaces));
                const sign = engExp >= 0 ? '+' : '';
                return `${mantissa.toFixed(dp)}E${sign}${engExp}`;
            }
            case 'Grouped': {
                const rounded = this.cleanFloat(num);
                const parts = rounded.toString().split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                return parts.join('.');
            }
            case 'Standard':
            default: {
                const rounded = this.cleanFloat(num);
                return rounded.toString();
            }
        }
    }

    parseInput(inputStr) {
        if (!inputStr || inputStr.trim() === '') return NaN;
        const str = inputStr.trim().replace(/,/g, '');
        const radix = this.getRadix();

        if (radix === 10) {
            return parseFloat(str);
        }

        let isNeg = str.startsWith('-');
        let cleanStr = isNeg ? str.substring(1) : str;

        const dotIdx = cleanStr.indexOf('.');
        if (dotIdx < 0) {
            let intVal = parseInt(cleanStr, radix);
            return isNeg ? -intVal : intVal;
        }

        let intPartStr = cleanStr.substring(0, dotIdx);
        let fracPartStr = cleanStr.substring(dotIdx + 1);

        let intVal = intPartStr.length > 0 ? parseInt(intPartStr, radix) : 0;
        let fracVal = 0;

        for (let i = 0; i < fracPartStr.length; i++) {
            let digit = parseInt(fracPartStr[i], radix);
            if (isNaN(digit)) return NaN;
            fracVal += digit / Math.pow(radix, i + 1);
        }

        let total = intVal + fracVal;
        return isNeg ? -total : total;
    }

    executeOperation(rawOp, currentInputVal = null) {
        const normalized = (rawOp || '').trim().toUpperCase();
        const op = this.commandAliases[normalized] || normalized;

        if (op === 'UNDO') {
            return this.undo();
        }
        if (op === 'REDO') {
            return this.redo();
        }
        if (op === 'HYP') {
            this.isHyperbolic = !this.isHyperbolic;
            return { success: true };
        }

        // Snapshot state before any stack modification
        this.saveSnapshot();

        if (currentInputVal !== null && !isNaN(currentInputVal)) {
            this.stack.push(currentInputVal);
        }

        let result = null;
        let operands = [];
        let logName = rawOp;

        // Capture Last X before performing modifying mathematical operation
        const prevLastX = this.stack.lastX;
        if (!['LASTX', 'DUP', 'SWAP', 'ROLL_UP', 'ROLL_DOWN', 'CLR', 'CLA', 'HYP', 'UNDO', 'REDO'].includes(op)) {
            if (this.stack.count > 0) {
                this.stack.lastX = this.stack.peek();
            }
        }

        const abortAndRestore = (errorMsg) => {
            this.stack.lastX = prevLastX;
            if (this.undoStack.length > 0) {
                const snap = this.undoStack.pop();
                this.stack.items = [...snap.items];
                this.stack.lastX = snap.lastX;
            }
            return { success: false, error: errorMsg };
        };

        try {
            switch (op) {
                // Arithmetic
                case 'ADD': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a + b);
                    logName = '+';
                    break;
                }
                case 'SUB': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a - b);
                    logName = '-';
                    break;
                }
                case 'MULT': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a * b);
                    logName = '×';
                    break;
                }
                case 'DIV': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const b = this.stack.pop();
                    if (b === 0) {
                        return abortAndRestore('Division by zero');
                    }
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a / b);
                    logName = '÷';
                    break;
                }
                case 'MOD': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const b = this.stack.pop();
                    if (b === 0) {
                        return abortAndRestore('Modulo by zero');
                    }
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a % b);
                    logName = 'mod';
                    break;
                }
                case 'NEG': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(-a);
                    logName = 'Neg';
                    break;
                }
                case 'ABS': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.abs(a));
                    logName = '|x|';
                    break;
                }
                case 'INV': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a === 0) {
                        return abortAndRestore('Division by zero');
                    }
                    operands = [a];
                    result = this.cleanFloat(1.0 / a);
                    logName = '1/x';
                    break;
                }
                case 'SQRT': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a < 0) {
                        return abortAndRestore('Cannot calculate square root of negative number');
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.sqrt(a));
                    logName = '√';
                    break;
                }
                case 'SQ': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(a * a);
                    logName = 'x²';
                    break;
                }
                case 'POW': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop();
                    const y = this.stack.pop();
                    operands = [y, x];
                    result = this.cleanFloat(Math.pow(y, x));
                    logName = 'yˣ';
                    break;
                }
                case 'XROOT': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop();
                    const y = this.stack.pop();
                    if (x === 0) {
                        return abortAndRestore('Root degree cannot be zero');
                    }
                    operands = [y, x];
                    result = this.cleanFloat(Math.pow(y, 1.0 / x));
                    logName = 'ˣ√y';
                    break;
                }
                case 'POW10': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.pow(10, a));
                    logName = '10ˣ';
                    break;
                }
                case 'POW2': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.pow(2, a));
                    logName = '2ˣ';
                    break;
                }
                case 'POWE': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.exp(a));
                    logName = 'eˣ';
                    break;
                }
                case 'LOG10': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a <= 0) {
                        return abortAndRestore('Log domain error (x <= 0)');
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log10(a));
                    logName = 'log';
                    break;
                }
                case 'LOG2': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a <= 0) {
                        return abortAndRestore('Log domain error (x <= 0)');
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log2(a));
                    logName = 'log₂';
                    break;
                }
                case 'LN': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a <= 0) {
                        return abortAndRestore('Natural log domain error (x <= 0)');
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log(a));
                    logName = 'ln';
                    break;
                }
                case 'FACT': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    if (a < 0 || !Number.isInteger(a) || a > 170) {
                        return abortAndRestore('Factorial requires integer (0 to 170)');
                    }
                    operands = [a];
                    let f = 1;
                    for (let i = 2; i <= a; i++) f *= i;
                    result = f;
                    logName = 'x!';
                    break;
                }

                // Trigonometry & Hyperbolic
                case 'SIN':
                case 'SINH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'SINH') {
                        result = this.cleanFloat(Math.sinh(a));
                        logName = 'sinh';
                    } else {
                        result = this.cleanFloat(Math.sin(this.toRadians(a)));
                        logName = 'sin';
                    }
                    break;
                }
                case 'COS':
                case 'COSH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'COSH') {
                        result = this.cleanFloat(Math.cosh(a));
                        logName = 'cosh';
                    } else {
                        result = this.cleanFloat(Math.cos(this.toRadians(a)));
                        logName = 'cos';
                    }
                    break;
                }
                case 'TAN':
                case 'TANH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'TANH') {
                        result = this.cleanFloat(Math.tanh(a));
                        logName = 'tanh';
                    } else {
                        result = this.cleanFloat(Math.tan(this.toRadians(a)));
                        logName = 'tan';
                    }
                    break;
                }
                case 'ASIN':
                case 'ASINH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ASINH') {
                        result = this.cleanFloat(Math.asinh(a));
                        logName = 'asinh';
                    } else {
                        if (a < -1 || a > 1) {
                            return abortAndRestore('asin domain error (-1 to 1)');
                        }
                        result = this.cleanFloat(this.fromRadians(Math.asin(a)));
                        logName = 'asin';
                    }
                    break;
                }
                case 'ACOS':
                case 'ACOSH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ACOSH') {
                        if (a < 1) {
                            return abortAndRestore('acosh domain error (x >= 1)');
                        }
                        result = this.cleanFloat(Math.acosh(a));
                        logName = 'acosh';
                    } else {
                        if (a < -1 || a > 1) {
                            return abortAndRestore('acos domain error (-1 to 1)');
                        }
                        result = this.cleanFloat(this.fromRadians(Math.acos(a)));
                        logName = 'acos';
                    }
                    break;
                }
                case 'ATAN':
                case 'ATANH': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ATANH') {
                        if (a <= -1 || a >= 1) {
                            return abortAndRestore('atanh domain error (-1 < x < 1)');
                        }
                        result = this.cleanFloat(Math.atanh(a));
                        logName = 'atanh';
                    } else {
                        result = this.cleanFloat(this.fromRadians(Math.atan(a)));
                        logName = 'atan';
                    }
                    break;
                }

                // Mathematical & Physical Constants
                case 'PI': {
                    result = Math.PI;
                    logName = 'π';
                    break;
                }
                case 'E': {
                    result = Math.E;
                    logName = 'e';
                    break;
                }
                case 'CONST_PHI': {
                    result = 1.618033988749895;
                    logName = 'φ';
                    break;
                }
                case 'CONST_C': {
                    result = 299792458;
                    logName = 'c (m/s)';
                    break;
                }
                case 'CONST_G': {
                    result = 9.80665;
                    logName = 'g (m/s²)';
                    break;
                }
                case 'CONST_BIG_G': {
                    result = 6.67430e-11;
                    logName = 'G';
                    break;
                }
                case 'CONST_H': {
                    result = 6.62607015e-34;
                    logName = 'h';
                    break;
                }
                case 'CONST_KB': {
                    result = 1.380649e-23;
                    logName = 'k_B';
                    break;
                }
                case 'CONST_NA': {
                    result = 6.02214076e23;
                    logName = 'N_A';
                    break;
                }
                case 'CONST_QE': {
                    result = 1.602176634e-19;
                    logName = 'q_e';
                    break;
                }
                case 'CONST_ME': {
                    result = 9.1093837015e-31;
                    logName = 'm_e';
                    break;
                }
                case 'CONST_EPS0': {
                    result = 8.8541878128e-12;
                    logName = 'ε₀';
                    break;
                }
                case 'CONST_R': {
                    result = 8.314462618;
                    logName = 'R';
                    break;
                }
                case 'RAND': {
                    result = Math.random();
                    logName = 'Rand';
                    break;
                }

                // Aggregate Stack Functions
                case 'SUM': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    operands = [...this.stack.items];
                    const total = this.stack.items.reduce((acc, v) => acc + v, 0);
                    this.stack.clear();
                    result = this.cleanFloat(total);
                    logName = 'Σ Sum';
                    break;
                }
                case 'MEAN': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    operands = [...this.stack.items];
                    const avg = this.stack.items.reduce((acc, v) => acc + v, 0) / this.stack.count;
                    this.stack.clear();
                    result = this.cleanFloat(avg);
                    logName = 'x̄ Mean';
                    break;
                }

                // Stack Manipulations
                case 'ENTER': {
                    if (this.stack.count === 0) return abortAndRestore('Stack is empty');
                    this.stack.dup();
                    this.logOperation('ENTER', [], this.stack.peek());
                    return { success: true };
                }
                case 'LASTX': {
                    if (this.stack.lastX === null || isNaN(this.stack.lastX)) {
                        return abortAndRestore('No Last X value available');
                    }
                    result = this.stack.lastX;
                    logName = 'Last x';
                    break;
                }
                case 'SWAP': {
                    if (this.stack.count < 2) return abortAndRestore('Need at least 2 values to swap');
                    this.stack.swap();
                    this.logOperation('SWAP', [], null);
                    return { success: true };
                }
                case 'DROP': {
                    if (this.stack.count === 0) return abortAndRestore('Stack is empty');
                    this.stack.drop();
                    this.logOperation('DROP', [], null);
                    return { success: true };
                }
                case 'DUP': {
                    if (this.stack.count === 0) return abortAndRestore('Stack is empty');
                    this.stack.dup();
                    this.logOperation('DUP', [], this.stack.peek());
                    return { success: true };
                }
                case 'ROLL_UP': {
                    if (this.stack.count < 2) return abortAndRestore('Need at least 2 values to roll');
                    this.stack.rotateUp();
                    this.logOperation('ROLL_UP', [], null);
                    return { success: true };
                }
                case 'ROLL_DOWN': {
                    if (this.stack.count < 2) return abortAndRestore('Need at least 2 values to roll');
                    this.stack.rotateDown();
                    this.logOperation('ROLL_DOWN', [], null);
                    return { success: true };
                }
                case 'CLR': {
                    if (this.stack.count === 0) return abortAndRestore('Stack is empty');
                    this.stack.drop();
                    return { success: true };
                }
                case 'CLA': {
                    if (this.stack.count === 0) {
                        this.undoStack.pop();
                        return { success: true };
                    }
                    this.stack.clear();
                    this.logOperation('CLEAR_ALL', [], null);
                    return { success: true };
                }

                case 'AND': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop() | 0;
                    const y = this.stack.pop() | 0;
                    result = (y & x) >>> 0;
                    logName = 'AND'; operands = [y, x];
                    break;
                }
                case 'OR': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop() | 0;
                    const y = this.stack.pop() | 0;
                    result = (y | x) >>> 0;
                    logName = 'OR'; operands = [y, x];
                    break;
                }
                case 'XOR': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop() | 0;
                    const y = this.stack.pop() | 0;
                    result = (y ^ x) >>> 0;
                    logName = 'XOR'; operands = [y, x];
                    break;
                }
                case 'NOT': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const x = this.stack.pop() | 0;
                    result = (~x) >>> 0;
                    logName = 'NOT'; operands = [x];
                    break;
                }
                case 'SHL': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const x = this.stack.pop() | 0;
                    result = (x << 1) >>> 0;
                    logName = 'SHL'; operands = [x];
                    break;
                }
                case 'SHR': {
                    if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                    const x = this.stack.pop() | 0;
                    result = x >>> 1;
                    logName = 'SHR'; operands = [x];
                    break;
                }
                case 'PCT': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop();
                    const y = this.stack.peek();
                    result = (y * x) / 100;
                    logName = '%'; operands = [y, x];
                    break;
                }
                case 'PCT_CHG': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop();
                    const y = this.stack.peek();
                    if (y === 0) return abortAndRestore('Division by zero');
                    result = ((x - y) / y) * 100;
                    logName = 'Δ%'; operands = [y, x];
                    break;
                }
                case 'TO_POLAR': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const x = this.stack.pop();
                    const y = this.stack.pop();
                    const r = Math.hypot(x, y);
                    const theta = this.fromRadians(Math.atan2(y, x));
                    this.stack.push(theta);
                    result = r;
                    logName = '→P'; operands = [x, y];
                    break;
                }
                case 'TO_RECT': {
                    if (this.stack.count < 2) return abortAndRestore('Insufficient arguments on stack');
                    const r = this.stack.pop();
                    const theta = this.toRadians(this.stack.pop());
                    const x = r * Math.cos(theta);
                    const y = r * Math.sin(theta);
                    this.stack.push(y);
                    result = x;
                    logName = '→R'; operands = [r, theta];
                    break;
                }
                default: {
                    const stoMatch = op.match(/^STO_?([0-9])$/);
                    if (stoMatch) {
                        if (this.stack.count < 1) return abortAndRestore('Stack is empty');
                        const reg = stoMatch[1];
                        this.registers[reg] = this.stack.peek();
                        this.logOperation(`STO ${reg}`, [this.registers[reg]], null);
                        return { success: true };
                    }
                    const rclMatch = op.match(/^RCL_?([0-9])$/);
                    if (rclMatch) {
                        const reg = rclMatch[1];
                        if (typeof this.registers[reg] !== 'number') {
                            return abortAndRestore(`Register R${reg} is empty`);
                        }
                        result = this.registers[reg];
                        logName = `RCL ${reg}`; operands = [];
                        break;
                    }
                    return abortAndRestore(`Unknown operation: ${rawOp}`);
                }
            }
        } finally {
            if (this.isHyperbolic && ['SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'SINH', 'COSH', 'TANH', 'ASINH', 'ACOSH', 'ATANH'].includes(op)) {
                this.isHyperbolic = false;
            }
        }

        if (result !== null) {
            this.stack.push(result);
            this.logOperation(logName, operands, result);
            return { success: true, result };
        }

        return { success: true };
    }

    logOperation(operation, operands, result) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.history.unshift({
            time,
            operation,
            operands: operands.map(o => this.formatNumber(o)),
            rawResult: typeof result === 'number' ? result : null,
            result: result !== null ? this.formatNumber(result) : ''
        });
        if (this.history.length > 500) {
            this.history.pop();
        }
    }
}

if (typeof window !== 'undefined') {
    window.RPNCalculatorEngine = RPNCalculatorEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RPNCalculatorEngine, RPNStack };
}
