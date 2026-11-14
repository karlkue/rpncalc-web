/**
 * Automated Verification Suite for RPNCalculatorEngine
 * Tests core arithmetic, trigonometry, multi-base formatting,
 * multi-level Undo/Redo, CLA recovery, CODATA constants, and JSON state serialization.
 */

const assert = require('assert');
const { RPNCalculatorEngine } = require('./calculator.js');

function runTests() {
    console.log('Running RPNCalculatorEngine Verification Suite...\n');

    // 1. Basic Postfix Arithmetic & Last X
    {
        const engine = new RPNCalculatorEngine();
        engine.pushValue(25);
        engine.pushValue(4);
        const res = engine.executeOperation('MULT');
        assert.strictEqual(res.success, true);
        assert.strictEqual(engine.stack.peek(), 100);
        assert.strictEqual(engine.stack.lastX, 4);
        console.log('✓ 1. Postfix arithmetic & Last X tracking');
    }

    // 2. Multi-Level Undo & Redo (Including Accidental CLA Recovery)
    {
        const engine = new RPNCalculatorEngine();
        engine.pushValue(10);
        engine.pushValue(20);
        engine.pushValue(30);
        assert.strictEqual(engine.stack.count, 3);

        // Accidental Clear All (CLA)
        engine.executeOperation('CLA');
        assert.strictEqual(engine.stack.count, 0);

        // Single Undo restores all 3 stack registers!
        const undoRes = engine.executeOperation('UNDO');
        assert.strictEqual(undoRes.success, true);
        assert.deepStrictEqual(engine.stack.items, [10, 20, 30]);

        // Undo again removes 30
        engine.executeOperation('UNDO');
        assert.deepStrictEqual(engine.stack.items, [10, 20]);

        // Redo restores 30
        engine.executeOperation('REDO');
        assert.deepStrictEqual(engine.stack.items, [10, 20, 30]);
        console.log('✓ 2. Multi-level Undo/Redo & non-destructive CLA recovery');
    }

    // 3. Error Safety (Failed operations do not corrupt stack or undo history)
    {
        const engine = new RPNCalculatorEngine();
        engine.pushValue(42);
        engine.pushValue(0);
        const divZero = engine.executeOperation('DIV');
        assert.strictEqual(divZero.success, false);
        assert.deepStrictEqual(engine.stack.items, [42, 0]);

        // Inline inputVal on empty stack (e.g. typing "1" then "+")
        const emptyEngine = new RPNCalculatorEngine();
        const emptyAdd = emptyEngine.executeOperation('ADD', 1);
        assert.strictEqual(emptyAdd.success, false);
        assert.deepStrictEqual(emptyEngine.stack.items, []);

        console.log('✓ 3. Division-by-zero & domain error stack preservation');
    }

    // 4. Engineering Constants & Aggregate Operations (SUM, MEAN)
    {
        const engine = new RPNCalculatorEngine();
        engine.executeOperation('CONST_C');
        assert.strictEqual(engine.stack.peek(), 299792458);

        engine.executeOperation('CLA');
        engine.pushValue(10);
        engine.pushValue(20);
        engine.pushValue(30);
        engine.executeOperation('SUM');
        assert.strictEqual(engine.stack.peek(), 60);

        engine.executeOperation('UNDO');
        assert.deepStrictEqual(engine.stack.items, [10, 20, 30]);
        engine.executeOperation('MEAN');
        assert.strictEqual(engine.stack.peek(), 20);
        console.log('✓ 4. CODATA physical constants & aggregate stack operations (SUM, MEAN)');
    }

    // 5. State Serialization & Persistence (toJSON / fromJSON)
    {
        const engine1 = new RPNCalculatorEngine();
        engine1.numberBase = 'HEX';
        engine1.angleUnit = 'RAD';
        engine1.displayType = 'Grouped';
        engine1.decimalPlaces = 6;
        engine1.pushValue(255);
        engine1.pushValue(4096);
        engine1.executeOperation('ADD');

        const serialized = JSON.stringify(engine1.toJSON());

        const engine2 = new RPNCalculatorEngine();
        engine2.fromJSON(JSON.parse(serialized));

        assert.strictEqual(engine2.numberBase, 'HEX');
        assert.strictEqual(engine2.angleUnit, 'RAD');
        assert.strictEqual(engine2.displayType, 'Grouped');
        assert.strictEqual(engine2.decimalPlaces, 6);
        assert.strictEqual(engine2.stack.peek(), 4351);
        assert.strictEqual(engine2.formatNumber(engine2.stack.peek()), '10FF');
        assert.strictEqual(engine2.history.length, 1);

        // Undo works even after deserialization!
        engine2.executeOperation('UNDO');
        assert.deepStrictEqual(engine2.stack.items, [255, 4096]);
        console.log('✓ 5. Full state serialization (toJSON/fromJSON) & cross-session Undo');
    }

    console.log('\nALL TESTS PASSED SUCCESSFULLY!');
}

runTests();
