const test = require("node:test");
const assert = require("node:assert/strict");
const LabDilutionCalc = require("../calculators/labDilutionCalc.js");

function approxEqual(actual, expected, tolerance) {
    tolerance = tolerance === undefined ? 1e-9 : tolerance;
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

// ---------------------------------------------------------------------
// Mass concentration unit conversion
// ---------------------------------------------------------------------

test("convertMassConcentration: mg/mL -> ug/mL multiplies by 1000", () => {
    assert.equal(LabDilutionCalc.convertMassConcentration(10, "mgPerML", "ugPerML"), 10000);
});

test("convertMassConcentration: ng/mL -> ug/mL divides by 1000", () => {
    approxEqual(LabDilutionCalc.convertMassConcentration(1000, "ngPerML", "ugPerML"), 1);
});

test("convertMassConcentration: same unit is identity", () => {
    assert.equal(LabDilutionCalc.convertMassConcentration(42, "mgPerML", "mgPerML"), 42);
});

test("convertMassConcentration: round trip mg/mL -> ng/mL -> mg/mL", () => {
    const ngPerML = LabDilutionCalc.convertMassConcentration(2, "mgPerML", "ngPerML");
    approxEqual(ngPerML, 2 * 1000 * 1000);
    const backToMg = LabDilutionCalc.convertMassConcentration(ngPerML, "ngPerML", "mgPerML");
    approxEqual(backToMg, 2);
});

// ---------------------------------------------------------------------
// Mode A — Dilution Ratio Calculator
// ---------------------------------------------------------------------

test("Ratio Mode, Convention 1 (total parts): worked example 1:5, 1000 uL", () => {
    const result = LabDilutionCalc.calcDilutionRatio({
        ratioN: 5,
        convention: "totalParts",
        finalVolume: 1000
    });
    assert.deepEqual(result.errors, []);
    approxEqual(result.specimenVolume, 200);
    approxEqual(result.diluentVolume, 800);
    assert.equal(result.effectiveRatioLabel, "1:5");
});

test("Ratio Mode, Convention 2 (specimen + diluent parts): worked example 1:5, 1200 uL", () => {
    const result = LabDilutionCalc.calcDilutionRatio({
        ratioN: 5,
        convention: "specimenToDiluent",
        finalVolume: 1200
    });
    assert.deepEqual(result.errors, []);
    approxEqual(result.specimenVolume, 200);
    approxEqual(result.diluentVolume, 1000);
    // 1 part specimen + 5 parts diluent = 6 total parts
    assert.equal(result.effectiveRatioLabel, "1:6");
});

test("Ratio Mode: the two conventions give different results for the same nominal ratio", () => {
    const totalParts = LabDilutionCalc.calcDilutionRatio({
        ratioN: 10,
        convention: "totalParts",
        finalVolume: 1000
    });
    const specimenToDiluent = LabDilutionCalc.calcDilutionRatio({
        ratioN: 10,
        convention: "specimenToDiluent",
        finalVolume: 1000
    });
    assert.notEqual(totalParts.specimenVolume, specimenToDiluent.specimenVolume);
    approxEqual(totalParts.specimenVolume, 100); // 1000 / 10
    approxEqual(specimenToDiluent.specimenVolume, 1000 / 11);
});

test("Ratio Mode: preset ratios all resolve to sensible specimen/diluent splits", () => {
    [2, 5, 10, 20, 50, 100].forEach((n) => {
        const result = LabDilutionCalc.calcDilutionRatio({
            ratioN: n,
            convention: "totalParts",
            finalVolume: 1000
        });
        approxEqual(result.specimenVolume + result.diluentVolume, 1000);
        approxEqual(result.specimenVolume, 1000 / n);
    });
});

test("Ratio Mode: specimen + diluent always sum to the final volume", () => {
    const result = LabDilutionCalc.calcDilutionRatio({
        ratioN: 7,
        convention: "specimenToDiluent",
        finalVolume: 333
    });
    approxEqual(result.specimenVolume + result.diluentVolume, 333);
});

test("Ratio Mode: rejects a ratio of 1:1 or below (not a dilution)", () => {
    const result = LabDilutionCalc.calcDilutionRatio({
        ratioN: 1,
        convention: "totalParts",
        finalVolume: 1000
    });
    assert.ok(result.errors.length > 0);
});

test("Ratio Mode: rejects zero, negative, and missing final volume", () => {
    assert.ok(LabDilutionCalc.calcDilutionRatio({ ratioN: 5, finalVolume: 0 }).errors.length > 0);
    assert.ok(LabDilutionCalc.calcDilutionRatio({ ratioN: 5, finalVolume: -10 }).errors.length > 0);
    assert.ok(LabDilutionCalc.calcDilutionRatio({ ratioN: 5 }).errors.length > 0);
});

test("Ratio Mode: rejects an unknown convention", () => {
    const result = LabDilutionCalc.calcDilutionRatio({
        ratioN: 5,
        convention: "somethingElse",
        finalVolume: 1000
    });
    assert.ok(result.errors.length > 0);
});

// ---------------------------------------------------------------------
// Mode B — Concentration Dilution Calculator (C1V1 = C2V2)
// ---------------------------------------------------------------------

test("Concentration Mode: worked example from spec (10 mg/mL -> 2 mg/mL, 500 uL)", () => {
    const result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10,
        targetConcentration: 2,
        concentrationUnit: "mgPerML",
        finalVolume: 500
    });
    assert.deepEqual(result.errors, []);
    assert.equal(result.achievable, true);
    approxEqual(result.stockVolume, 100);
    approxEqual(result.diluentVolume, 400);
    approxEqual(result.dilutionFactor, 5);
});

test("Concentration Mode: works consistently across mg/mL, ug/mL, and ng/mL for an equivalent ratio", () => {
    const mg = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10,
        targetConcentration: 2,
        concentrationUnit: "mgPerML",
        finalVolume: 500
    });
    const ug = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10000,
        targetConcentration: 2000,
        concentrationUnit: "ugPerML",
        finalVolume: 500
    });
    const ng = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10000000,
        targetConcentration: 2000000,
        concentrationUnit: "ngPerML",
        finalVolume: 500
    });
    approxEqual(mg.stockVolume, ug.stockVolume);
    approxEqual(mg.stockVolume, ng.stockVolume);
    approxEqual(mg.diluentVolume, ug.diluentVolume);
    approxEqual(mg.diluentVolume, ng.diluentVolume);
});

test("Concentration Mode: equal start/target concentration needs no diluent", () => {
    const result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 5,
        targetConcentration: 5,
        concentrationUnit: "mgPerML",
        finalVolume: 250
    });
    approxEqual(result.stockVolume, 250);
    approxEqual(result.diluentVolume, 0);
    approxEqual(result.dilutionFactor, 1);
});

test("Concentration Mode: target higher than starting is flagged as an impossible request", () => {
    const result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 2,
        targetConcentration: 10,
        concentrationUnit: "mgPerML",
        finalVolume: 500
    });
    assert.equal(result.achievable, false);
    assert.equal(result.diluentVolume, undefined);
});

test("Concentration Mode: never returns a negative diluent volume", () => {
    const result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10,
        targetConcentration: 9.999999999,
        concentrationUnit: "mgPerML",
        finalVolume: 500
    });
    assert.ok(result.diluentVolume >= 0);
});

test("Concentration Mode: rejects zero, negative, and missing inputs", () => {
    assert.ok(LabDilutionCalc.calcConcentrationDilution({}).errors.length === 3);
    assert.ok(LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 0,
        targetConcentration: 1,
        finalVolume: 1
    }).errors.length > 0);
    assert.ok(LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 10,
        targetConcentration: -1,
        finalVolume: 1
    }).errors.length > 0);
});

test("Concentration Mode: handles large and small concentration values", () => {
    const result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: 1e6,
        targetConcentration: 1e-2,
        concentrationUnit: "ngPerML",
        finalVolume: 1000
    });
    assert.equal(result.achievable, true);
    approxEqual(result.dilutionFactor, 1e8, 1);
});

// ---------------------------------------------------------------------
// roundSig (display helper)
// ---------------------------------------------------------------------

test("roundSig: rounds to requested significant figures", () => {
    assert.equal(LabDilutionCalc.roundSig(1234.5678, 4), 1235);
    assert.equal(LabDilutionCalc.roundSig(0.0012345, 3), 0.00123);
});
