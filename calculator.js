/**
 * RPN Calculator Core Engine
 * Reverse Polish Notation scientific calculator matching original C# RPN_Calculator logic
 * with full command dispatch dictionary and multi-base fractional arithmetic.
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
        this.angleUnit = 'DEG'; // DEG, RAD, GRAD
        this.numberBase = 'DEC'; // DEC, HEX, BIN, OCT
        this.displayType = 'Standard'; // Standard, Fixed, Scientific, Grouped
        this.decimalPlaces = 4;
        this.isHyperbolic = false;

        // Command alias dictionary
        this.commandAliases = {
            // Arithmetic
            '+': 'ADD', 'ADD': 'ADD', 'PLUS': 'ADD',
            '-': 'SUB', 'SUB': 'SUB', 'SUBTRACT': 'SUB', 'MINUS': 'SUB',
            '*': 'MULT', '×': 'MULT', 'MULT': 'MULT', 'MULTIPLY': 'MULT', 'TIMES': 'MULT',
            '/': 'DIV', '÷': 'DIV', 'DIV': 'DIV', 'DIVIDE': 'DIV',
            '+/-': 'NEG', 'NEG': 'NEG', 'NEGATE': 'NEG', 'CHS': 'NEG',
            '1/X': 'INV', 'INV': 'INV', 'RECIP': 'INV', 'RECIPROCAL': 'INV',
            
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

            // Factorial
            'FACT': 'FACT', 'FACTORIAL': 'FACT', 'X!': 'FACT', '!': 'FACT',

            // Constants
            'PI': 'PI', 'π': 'PI',
            'E': 'E',
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
            'HYP': 'HYP'
        };
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
        const str = inputStr.trim();
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
        if (currentInputVal !== null && !isNaN(currentInputVal)) {
            this.stack.push(currentInputVal);
        }

        const normalized = (rawOp || '').trim().toUpperCase();
        const op = this.commandAliases[normalized] || normalized;

        let result = null;
        let operands = [];
        let logName = rawOp;

        // Capture Last X before performing modifying operation
        if (!['LASTX', 'DUP', 'SWAP', 'ROLL_UP', 'ROLL_DOWN', 'CLR', 'CLA', 'HYP'].includes(op)) {
            if (this.stack.count > 0) {
                this.stack.lastX = this.stack.peek();
            }
        }

        try {
            switch (op) {
                // Arithmetic
                case 'ADD': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a + b);
                    logName = '+';
                    break;
                }
                case 'SUB': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a - b);
                    logName = '-';
                    break;
                }
                case 'MULT': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const b = this.stack.pop();
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a * b);
                    logName = '×';
                    break;
                }
                case 'DIV': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const b = this.stack.pop();
                    if (b === 0) {
                        this.stack.push(b);
                        return { success: false, error: 'Division by zero' };
                    }
                    const a = this.stack.pop();
                    operands = [a, b];
                    result = this.cleanFloat(a / b);
                    logName = '÷';
                    break;
                }
                case 'NEG': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(-a);
                    logName = 'Neg';
                    break;
                }
                case 'INV': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a === 0) {
                        this.stack.push(a);
                        return { success: false, error: 'Division by zero' };
                    }
                    operands = [a];
                    result = this.cleanFloat(1.0 / a);
                    logName = '1/x';
                    break;
                }
                case 'SQRT': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a < 0) {
                        this.stack.push(a);
                        return { success: false, error: 'Cannot calculate square root of negative number' };
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.sqrt(a));
                    logName = '√';
                    break;
                }
                case 'SQ': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(a * a);
                    logName = 'x²';
                    break;
                }
                case 'POW': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const x = this.stack.pop();
                    const y = this.stack.pop();
                    operands = [y, x];
                    result = this.cleanFloat(Math.pow(y, x));
                    logName = 'yˣ';
                    break;
                }
                case 'XROOT': {
                    if (this.stack.count < 2) return { success: false, error: 'Insufficient arguments on stack' };
                    const x = this.stack.pop();
                    const y = this.stack.pop();
                    if (x === 0) {
                        this.stack.push(y);
                        this.stack.push(x);
                        return { success: false, error: 'Root degree cannot be zero' };
                    }
                    operands = [y, x];
                    result = this.cleanFloat(Math.pow(y, 1.0 / x));
                    logName = 'ˣ√y';
                    break;
                }
                case 'POW10': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.pow(10, a));
                    logName = '10ˣ';
                    break;
                }
                case 'POW2': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.pow(2, a));
                    logName = '2ˣ';
                    break;
                }
                case 'POWE': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    result = this.cleanFloat(Math.exp(a));
                    logName = 'eˣ';
                    break;
                }
                case 'LOG10': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a <= 0) {
                        this.stack.push(a);
                        return { success: false, error: 'Log domain error (x <= 0)' };
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log10(a));
                    logName = 'log';
                    break;
                }
                case 'LOG2': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a <= 0) {
                        this.stack.push(a);
                        return { success: false, error: 'Log domain error (x <= 0)' };
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log2(a));
                    logName = 'log₂';
                    break;
                }
                case 'LN': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a <= 0) {
                        this.stack.push(a);
                        return { success: false, error: 'Natural log domain error (x <= 0)' };
                    }
                    operands = [a];
                    result = this.cleanFloat(Math.log(a));
                    logName = 'ln';
                    break;
                }
                case 'FACT': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    if (a < 0 || !Number.isInteger(a) || a > 170) {
                        this.stack.push(a);
                        return { success: false, error: 'Factorial requires integer (0 to 170)' };
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
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
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
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
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
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
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
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ASINH') {
                        result = this.cleanFloat(Math.asinh(a));
                        logName = 'asinh';
                    } else {
                        if (a < -1 || a > 1) {
                            this.stack.push(a);
                            return { success: false, error: 'asin domain error (-1 to 1)' };
                        }
                        result = this.cleanFloat(this.fromRadians(Math.asin(a)));
                        logName = 'asin';
                    }
                    break;
                }
                case 'ACOS':
                case 'ACOSH': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ACOSH') {
                        if (a < 1) {
                            this.stack.push(a);
                            return { success: false, error: 'acosh domain error (x >= 1)' };
                        }
                        result = this.cleanFloat(Math.acosh(a));
                        logName = 'acosh';
                    } else {
                        if (a < -1 || a > 1) {
                            this.stack.push(a);
                            return { success: false, error: 'acos domain error (-1 to 1)' };
                        }
                        result = this.cleanFloat(this.fromRadians(Math.acos(a)));
                        logName = 'acos';
                    }
                    break;
                }
                case 'ATAN':
                case 'ATANH': {
                    if (this.stack.count < 1) return { success: false, error: 'Stack is empty' };
                    const a = this.stack.pop();
                    operands = [a];
                    if (this.isHyperbolic || op === 'ATANH') {
                        if (a <= -1 || a >= 1) {
                            this.stack.push(a);
                            return { success: false, error: 'atanh domain error (-1 < x < 1)' };
                        }
                        result = this.cleanFloat(Math.atanh(a));
                        logName = 'atanh';
                    } else {
                        result = this.cleanFloat(this.fromRadians(Math.atan(a)));
                        logName = 'atan';
                    }
                    break;
                }

                // Constants
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
                case 'RAND': {
                    result = Math.random();
                    logName = 'Rand';
                    break;
                }

                // Mode toggle
                case 'HYP': {
                    this.isHyperbolic = !this.isHyperbolic;
                    return { success: true };
                }

                // Stack Manipulations
                case 'ENTER': {
                    if (this.stack.count === 0) return { success: false, error: 'Stack is empty' };
                    this.stack.dup();
                    this.logOperation('ENTER', [], this.stack.peek());
                    return { success: true };
                }
                case 'LASTX': {
                    if (this.stack.lastX === null || isNaN(this.stack.lastX)) {
                        return { success: false, error: 'No Last X value available' };
                    }
                    result = this.stack.lastX;
                    logName = 'Last x';
                    break;
                }
                case 'SWAP': {
                    if (this.stack.count < 2) return { success: false, error: 'Need at least 2 values to swap' };
                    this.stack.swap();
                    this.logOperation('SWAP', [], null);
                    return { success: true };
                }
                case 'DROP': {
                    if (this.stack.count > 0) {
                        this.stack.drop();
                        this.logOperation('DROP', [], null);
                    }
                    return { success: true };
                }
                case 'DUP': {
                    if (this.stack.count > 0) {
                        this.stack.dup();
                        this.logOperation('DUP', [], this.stack.peek());
                    }
                    return { success: true };
                }
                case 'ROLL_UP': {
                    this.stack.rotateUp();
                    this.logOperation('ROLL_UP', [], null);
                    return { success: true };
                }
                case 'ROLL_DOWN': {
                    this.stack.rotateDown();
                    this.logOperation('ROLL_DOWN', [], null);
                    return { success: true };
                }
                case 'CLR': {
                    if (this.stack.count > 0) this.stack.drop();
                    return { success: true };
                }
                case 'CLA': {
                    this.stack.clear();
                    this.logOperation('CLEAR_ALL', [], null);
                    return { success: true };
                }

                default:
                    return { success: false, error: `Unknown operation: ${rawOp}` };
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
        const time = new Date().toLocaleTimeString();
        this.history.unshift({
            time,
            operation,
            operands: operands.map(o => this.formatNumber(o)),
            result: result !== null ? this.formatNumber(result) : ''
        });
        if (this.history.length > 500) {
            this.history.pop();
        }
    }
}

window.RPNCalculatorEngine = RPNCalculatorEngine;
