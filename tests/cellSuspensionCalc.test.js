const test = require("node:test");
const assert = require("node:assert/strict");
const CellSuspensionCalc = require("../calculators/cellSuspensionCalc.js");

function approxEqual(actual, expected, tolerance) {
    tolerance = tolerance === undefined ? 1e-9 : tolerance;
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

// ---------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------

test("convertConcentrationToPerUL: cells/uL is identity", () => {
    assert.equal(CellSuspensionCalc.convertConcentrationToPerUL(500, "cellsPerUL"), 500);
});

test("convertConcentrationToPerUL: cells/mL divides by 1000", () => {
    assert.equal(CellSuspensionCalc.convertConcentrationToPerUL(20000, "cellsPerML"), 20);
});

test("convertConcentrationToPerUL: million cells/mL multiplies by 1000", () => {
    assert.equal(CellSuspensionCalc.convertConcentrationToPerUL(2, "millionCellsPerML"), 2000);
});

test("convertVolumeToUL: mL multiplies by 1000", () => {
    assert.equal(CellSuspensionCalc.convertVolumeToUL(1.5, "mL"), 1500);
});

test("convertVolumeToUL: uL is identity", () => {
    assert.equal(CellSuspensionCalc.convertVolumeToUL(1.5, "uL"), 1.5);
});

// ---------------------------------------------------------------------
// Mode A — Target Cells Per Tube
// ---------------------------------------------------------------------

test("Mode A: worked example from spec (20,000 cells/uL, 1M/tube, 4 tubes)", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 0
    });
    assert.deepEqual(result.errors, []);
    approxEqual(result.volumePerTubeUL, 50);
    approxEqual(result.totalVolumeUL, 200);
    approxEqual(result.totalWithOverageUL, 200);
    approxEqual(result.additionalOverageUL, 0);
    approxEqual(result.totalCellsRequired, 4000000);
});

test("Mode A: overage percentage pads total volume correctly", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 10
    });
    approxEqual(result.totalVolumeUL, 200);
    approxEqual(result.totalWithOverageUL, 220);
    approxEqual(result.additionalOverageUL, 20);
});

test("Mode A: concentration given in cells/mL is converted before dividing", () => {
    // 20,000 cells/uL == 20,000,000 cells/mL
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000000,
        concentrationUnit: "cellsPerML",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 0
    });
    approxEqual(result.volumePerTubeUL, 50);
});

test("Mode A: concentration given in million cells/mL is converted before dividing", () => {
    // 20,000 cells/uL == 20 million cells/mL
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20,
        concentrationUnit: "millionCellsPerML",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 0
    });
    approxEqual(result.volumePerTubeUL, 50);
});

test("Mode A: flags when required volume is below minimum pipetting volume", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 1,
        overagePercent: 0,
        minPipetteVolumeUL: 100
    });
    // volume per tube is 50 uL, below the 100 uL minimum
    assert.equal(result.belowMinPipette, true);
});

test("Mode A: does not flag when required volume is at/above minimum pipetting volume", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 1,
        overagePercent: 0,
        minPipetteVolumeUL: 10
    });
    assert.equal(result.belowMinPipette, false);
});

test("Mode A: reports insufficient specimen when available volume is too low", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 10,
        availableVolume: 100,
        availableVolumeUnit: "uL"
    });
    // needs 220 uL total (with overage), only 100 uL available
    assert.equal(result.sufficient, false);
    approxEqual(result.surplusOrDeficitUL, 100 - 220);
});

test("Mode A: reports sufficient specimen when available volume covers the need", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 20000,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1000000,
        numberOfTubes: 4,
        overagePercent: 10,
        availableVolume: 1,
        availableVolumeUnit: "mL"
    });
    // 1 mL == 1000 uL available, needs 220 uL
    assert.equal(result.sufficient, true);
    approxEqual(result.surplusOrDeficitUL, 1000 - 220);
});

test("Mode A: rejects zero and negative concentration", () => {
    assert.ok(CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 0,
        targetCellsPerTube: 100,
        numberOfTubes: 1
    }).errors.length > 0);
    assert.ok(CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: -5,
        targetCellsPerTube: 100,
        numberOfTubes: 1
    }).errors.length > 0);
});

test("Mode A: rejects zero, negative, and non-integer tube counts", () => {
    assert.ok(CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 100,
        targetCellsPerTube: 100,
        numberOfTubes: 0
    }).errors.length > 0);
    assert.ok(CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 100,
        targetCellsPerTube: 100,
        numberOfTubes: -2
    }).errors.length > 0);
    assert.ok(CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 100,
        targetCellsPerTube: 100,
        numberOfTubes: 1.5
    }).errors.length > 0);
});

test("Mode A: rejects missing required inputs", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({});
    assert.ok(result.errors.length >= 3);
});

test("Mode A: rejects negative overage percentage", () => {
    const result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 100,
        targetCellsPerTube: 100,
        numberOfTubes: 1,
        overagePercent: -5
    });
    assert.ok(result.errors.length > 0);
});

test("Mode A: handles very large and very small concentrations without losing precision", () => {
    const large = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 5e9,
        concentrationUnit: "cellsPerML",
        targetCellsPerTube: 2.5e6,
        numberOfTubes: 10,
        overagePercent: 0
    });
    approxEqual(large.volumePerTubeUL, 2.5e6 / 5e6, 1e-9);

    const small = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: 0.001,
        concentrationUnit: "cellsPerUL",
        targetCellsPerTube: 1,
        numberOfTubes: 1,
        overagePercent: 0
    });
    approxEqual(small.volumePerTubeUL, 1000);
});

// ---------------------------------------------------------------------
// Mode B — Target Cell Concentration (C1V1 = C2V2)
// ---------------------------------------------------------------------

test("Mode B: worked example from spec (20,000 -> 10,000 cells/uL, 1000 uL)", () => {
    const result = CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: 20000,
        targetConcentration: 10000,
        finalVolume: 1000,
        volumeUnit: "uL"
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.achievable, true);
    approxEqual(result.specimenVolume, 500);
    approxEqual(result.diluentVolume, 500);
    approxEqual(result.dilutionFactor, 2);
});

test("Mode B: target concentration equal to starting concentration needs no dilution", () => {
    const result = CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: 15000,
        targetConcentration: 15000,
        finalVolume: 750,
        volumeUnit: "uL"
    });
    approxEqual(result.specimenVolume, 750);
    approxEqual(result.diluentVolume, 0);
    approxEqual(result.dilutionFactor, 1);
});

test("Mode B: target concentration higher than starting is flagged as unachievable", () => {
    const result = CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: 10000,
        targetConcentration: 20000,
        finalVolume: 1000,
        volumeUnit: "uL"
    });
    assert.equal(result.achievable, false);
    assert.equal(result.diluentVolume, undefined);
    assert.ok(/cannot be achieved by dilution/i.test(result.message));
});

test("Mode B: never returns a negative diluent volume", () => {
    const result = CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: 100,
        targetConcentration: 99.9999999,
        finalVolume: 1000,
        volumeUnit: "uL"
    });
    assert.ok(result.diluentVolume >= 0);
});

test("Mode B: rejects zero/negative/missing inputs", () => {
    assert.ok(CellSuspensionCalc.calcTargetConcentration({}).errors.length === 3);
    assert.ok(CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: -1,
        targetConcentration: 10,
        finalVolume: 10
    }).errors.length > 0);
    assert.ok(CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: 10,
        targetConcentration: 0,
        finalVolume: 10
    }).errors.length > 0);
});

// ---------------------------------------------------------------------
// roundSig (display helper)
// ---------------------------------------------------------------------

test("roundSig: rounds to requested significant figures", () => {
    assert.equal(CellSuspensionCalc.roundSig(1234.5678, 4), 1235);
    assert.equal(CellSuspensionCalc.roundSig(0.0012345, 3), 0.00123);
    assert.equal(CellSuspensionCalc.roundSig(0, 4), 0);
});
