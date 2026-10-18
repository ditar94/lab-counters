/*
 * labDilutionCalc.js
 *
 * Pure calculation logic for the Laboratory Dilution Calculator
 * (lab-dilution-calculator.html). No DOM access here on purpose — this
 * file is loaded directly in the browser (as a classic script,
 * attaching a `LabDilutionCalc` global) and required as-is from the
 * Node test runner.
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.LabDilutionCalc = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // Multiply a value in the given mass-concentration unit by this
    // factor to get µg/mL (the common base unit used internally).
    var MASS_CONCENTRATION_TO_UG_PER_ML = {
        mgPerML: 1000,
        ugPerML: 1,
        ngPerML: 1 / 1000
    };

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function convertMassConcentration(value, fromUnit, toUnit) {
        var fromFactor = MASS_CONCENTRATION_TO_UG_PER_ML[fromUnit];
        var toFactor = MASS_CONCENTRATION_TO_UG_PER_ML[toUnit];
        if (fromFactor === undefined) throw new Error("Unknown concentration unit: " + fromUnit);
        if (toFactor === undefined) throw new Error("Unknown concentration unit: " + toUnit);
        var ugPerML = value * fromFactor;
        return ugPerML / toFactor;
    }

    function roundSig(value, sig) {
        if (!isFiniteNumber(value)) return value;
        if (value === 0) return 0;
        sig = sig || 4;
        var magnitude = Math.ceil(Math.log10(Math.abs(value)));
        var factor = Math.pow(10, sig - magnitude);
        return Math.round(value * factor) / factor;
    }

    /**
     * Mode A — Dilution Ratio Calculator.
     *
     * `ratioN` is the X in a "1:X" ratio. `convention` is either:
     *   "totalParts"       — 1 part specimen in X TOTAL parts
     *                         (specimen = finalVolume / X)
     *   "specimenToDiluent" — 1 part specimen PLUS X parts diluent
     *                         (specimen = finalVolume / (1 + X))
     *
     * Both conventions are reduced to a common "effective" X:Y total-parts
     * ratio in the result, so the UI can always show the unambiguous form
     * regardless of which convention was used for input.
     */
    function calcDilutionRatio(input) {
        var errors = [];
        var ratioN = input.ratioN;
        var convention = input.convention || "totalParts";
        var finalVolume = input.finalVolume;

        if (!isFiniteNumber(ratioN) || ratioN <= 1) {
            errors.push("The ratio's second number must be greater than 1 (e.g. the 5 in 1:5).");
        }
        if (!isFiniteNumber(finalVolume) || finalVolume <= 0) {
            errors.push("Desired final volume must be a number greater than 0.");
        }
        if (convention !== "totalParts" && convention !== "specimenToDiluent") {
            errors.push("Unknown dilution convention.");
        }

        if (errors.length) {
            return { errors: errors };
        }

        var totalParts = convention === "totalParts" ? ratioN : 1 + ratioN;
        var specimenVolume = finalVolume / totalParts;
        var diluentVolume = finalVolume - specimenVolume;

        return {
            errors: [],
            convention: convention,
            totalParts: totalParts,
            specimenVolume: specimenVolume,
            diluentVolume: diluentVolume,
            finalVolume: finalVolume,
            effectiveRatioLabel: "1:" + totalParts
        };
    }

    /**
     * Mode B — Concentration Dilution Calculator (C1V1 = C2V2) for mass
     * concentrations (mg/mL, µg/mL, ng/mL). Both C1 and C2 are converted
     * to µg/mL internally so the ratio is computed correctly even if a
     * future UI allows mixed units; the current UI uses one shared unit
     * for both, in which case the conversion is a no-op.
     */
    function calcConcentrationDilution(input) {
        var errors = [];
        var startingConcentration = input.startingConcentration;
        var targetConcentration = input.targetConcentration;
        var concentrationUnit = input.concentrationUnit || "mgPerML";
        var finalVolume = input.finalVolume;

        if (!isFiniteNumber(startingConcentration) || startingConcentration <= 0) {
            errors.push("Starting concentration (C1) must be a number greater than 0.");
        }
        if (!isFiniteNumber(targetConcentration) || targetConcentration <= 0) {
            errors.push("Target concentration (C2) must be a number greater than 0.");
        }
        if (!isFiniteNumber(finalVolume) || finalVolume <= 0) {
            errors.push("Final volume (V2) must be a number greater than 0.");
        }

        if (errors.length) {
            return { errors: errors };
        }

        var c1UgPerML = convertMassConcentration(startingConcentration, concentrationUnit, "ugPerML");
        var c2UgPerML = convertMassConcentration(targetConcentration, concentrationUnit, "ugPerML");

        if (c2UgPerML > c1UgPerML) {
            return {
                errors: [],
                achievable: false,
                message:
                    "The target concentration is higher than the starting concentration. " +
                    "Dilution can only lower a concentration, never raise it."
            };
        }

        var stockVolume = (c2UgPerML * finalVolume) / c1UgPerML;
        var diluentVolume = finalVolume - stockVolume;
        if (diluentVolume < 0) diluentVolume = 0;
        var dilutionFactor = c1UgPerML / c2UgPerML;

        return {
            errors: [],
            achievable: true,
            stockVolume: stockVolume,
            diluentVolume: diluentVolume,
            finalVolume: finalVolume,
            dilutionFactor: dilutionFactor
        };
    }

    return {
        MASS_CONCENTRATION_TO_UG_PER_ML: MASS_CONCENTRATION_TO_UG_PER_ML,
        convertMassConcentration: convertMassConcentration,
        roundSig: roundSig,
        calcDilutionRatio: calcDilutionRatio,
        calcConcentrationDilution: calcConcentrationDilution
    };
});
