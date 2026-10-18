/*
 * cellSuspensionCalc.js
 *
 * Pure calculation logic for the Cell Suspension Calculator
 * (cell-suspension-calculator.html). No DOM access here on purpose —
 * this file is loaded directly in the browser (as a classic script,
 * attaching a `CellSuspensionCalc` global) and required as-is from the
 * Node test runner, so the math can be verified independently of the UI.
 *
 * All internal math is done in cells/µL and µL. Unit conversion happens
 * at the edges (convertConcentrationToPerUL / volume unit factors).
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.CellSuspensionCalc = factory();
    }
})(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    // Multiply a value in the given concentration unit by this factor to
    // get cells/µL.
    var CONCENTRATION_TO_PER_UL = {
        cellsPerUL: 1,
        cellsPerML: 1 / 1000,
        millionCellsPerML: 1000
    };

    // Multiply a value in the given volume unit by this factor to get µL.
    var VOLUME_TO_UL = {
        uL: 1,
        mL: 1000
    };

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function convertConcentrationToPerUL(value, unit) {
        var factor = CONCENTRATION_TO_PER_UL[unit];
        if (factor === undefined) {
            throw new Error("Unknown concentration unit: " + unit);
        }
        return value * factor;
    }

    function convertVolumeToUL(value, unit) {
        var factor = VOLUME_TO_UL[unit];
        if (factor === undefined) {
            throw new Error("Unknown volume unit: " + unit);
        }
        return value * factor;
    }

    function convertULToVolumeUnit(valueUL, unit) {
        var factor = VOLUME_TO_UL[unit];
        if (factor === undefined) {
            throw new Error("Unknown volume unit: " + unit);
        }
        return valueUL / factor;
    }

    /**
     * Round to a given number of significant figures without introducing
     * binary floating point noise, for display purposes only.
     */
    function roundSig(value, sig) {
        if (!isFiniteNumber(value)) return value;
        if (value === 0) return 0;
        sig = sig || 4;
        var magnitude = Math.ceil(Math.log10(Math.abs(value)));
        var factor = Math.pow(10, sig - magnitude);
        return Math.round(value * factor) / factor;
    }

    /**
     * Mode A — Target Cells Per Tube.
     *
     * Given a starting concentration and a desired number of cells per
     * tube, work out how much specimen is needed per tube and in total,
     * with an optional overage pad and feasibility checks against an
     * optional available-specimen volume and minimum pipetting volume.
     */
    function calcTargetCellsPerTube(input) {
        var errors = [];
        var concentration = input.concentration;
        var concentrationUnit = input.concentrationUnit || "cellsPerUL";
        var targetCellsPerTube = input.targetCellsPerTube;
        var numberOfTubes = input.numberOfTubes;
        var overagePercent = input.overagePercent;
        if (overagePercent === undefined || overagePercent === null || overagePercent === "") {
            overagePercent = 0;
        }
        var availableVolume = input.availableVolume;
        var availableVolumeUnit = input.availableVolumeUnit || "uL";
        var minPipetteVolumeUL = input.minPipetteVolumeUL;

        if (!isFiniteNumber(concentration) || concentration <= 0) {
            errors.push("Starting cell concentration must be a number greater than 0.");
        }
        if (!isFiniteNumber(targetCellsPerTube) || targetCellsPerTube <= 0) {
            errors.push("Desired cells per tube must be a number greater than 0.");
        }
        if (!isFiniteNumber(numberOfTubes) || numberOfTubes <= 0 || Math.floor(numberOfTubes) !== numberOfTubes) {
            errors.push("Number of tubes must be a whole number of 1 or more.");
        }
        if (!isFiniteNumber(overagePercent) || overagePercent < 0) {
            errors.push("Overage percentage cannot be negative.");
        }
        if (availableVolume !== undefined && availableVolume !== null && availableVolume !== "") {
            if (!isFiniteNumber(availableVolume) || availableVolume < 0) {
                errors.push("Available specimen volume cannot be negative.");
            }
        }
        if (minPipetteVolumeUL !== undefined && minPipetteVolumeUL !== null && minPipetteVolumeUL !== "") {
            if (!isFiniteNumber(minPipetteVolumeUL) || minPipetteVolumeUL < 0) {
                errors.push("Minimum reliable pipetting volume cannot be negative.");
            }
        }

        if (errors.length) {
            return { errors: errors };
        }

        var concentrationPerUL = convertConcentrationToPerUL(concentration, concentrationUnit);

        var volumePerTubeUL = targetCellsPerTube / concentrationPerUL;
        var totalVolumeUL = volumePerTubeUL * numberOfTubes;
        var totalWithOverageUL = totalVolumeUL * (1 + overagePercent / 100);
        var additionalOverageUL = totalWithOverageUL - totalVolumeUL;
        var totalCellsRequired = targetCellsPerTube * numberOfTubes;

        var belowMinPipette = null;
        if (minPipetteVolumeUL !== undefined && minPipetteVolumeUL !== null && minPipetteVolumeUL !== "") {
            belowMinPipette = volumePerTubeUL < minPipetteVolumeUL;
        }

        var sufficient = null;
        var availableVolumeUL = null;
        var surplusOrDeficitUL = null;
        if (availableVolume !== undefined && availableVolume !== null && availableVolume !== "") {
            availableVolumeUL = convertVolumeToUL(availableVolume, availableVolumeUnit);
            sufficient = availableVolumeUL >= totalWithOverageUL;
            surplusOrDeficitUL = availableVolumeUL - totalWithOverageUL;
        }

        return {
            errors: [],
            concentrationPerUL: concentrationPerUL,
            volumePerTubeUL: volumePerTubeUL,
            totalVolumeUL: totalVolumeUL,
            additionalOverageUL: additionalOverageUL,
            totalWithOverageUL: totalWithOverageUL,
            totalCellsRequired: totalCellsRequired,
            belowMinPipette: belowMinPipette,
            sufficient: sufficient,
            availableVolumeUL: availableVolumeUL,
            surplusOrDeficitUL: surplusOrDeficitUL
        };
    }

    /**
     * Mode B — Target Cell Concentration (C1V1 = C2V2).
     *
     * Both concentrations must be expressed in the same unit (the ratio
     * C2/C1 is unit-independent, so no base-unit conversion is required),
     * and the resulting volumes are expressed in the chosen volume unit.
     */
    function calcTargetConcentration(input) {
        var errors = [];
        var startingConcentration = input.startingConcentration;
        var targetConcentration = input.targetConcentration;
        var finalVolume = input.finalVolume;
        var volumeUnit = input.volumeUnit || "uL";

        if (!isFiniteNumber(startingConcentration) || startingConcentration <= 0) {
            errors.push("Starting cell concentration must be a number greater than 0.");
        }
        if (!isFiniteNumber(targetConcentration) || targetConcentration <= 0) {
            errors.push("Desired final cell concentration must be a number greater than 0.");
        }
        if (!isFiniteNumber(finalVolume) || finalVolume <= 0) {
            errors.push("Desired final suspension volume must be a number greater than 0.");
        }

        if (errors.length) {
            return { errors: errors };
        }

        if (targetConcentration > startingConcentration) {
            return {
                errors: [],
                achievable: false,
                message:
                    "The target concentration is higher than the starting concentration. " +
                    "This cannot be achieved by dilution alone — the specimen would need to be " +
                    "concentrated first (e.g. by centrifugation), which this calculator does not perform."
            };
        }

        var specimenVolume = (targetConcentration * finalVolume) / startingConcentration;
        var diluentVolume = finalVolume - specimenVolume;
        if (diluentVolume < 0) diluentVolume = 0; // guards against floating point noise at C1 === C2
        var dilutionFactor = startingConcentration / targetConcentration;

        return {
            errors: [],
            achievable: true,
            specimenVolume: specimenVolume,
            diluentVolume: diluentVolume,
            finalVolume: finalVolume,
            volumeUnit: volumeUnit,
            dilutionFactor: dilutionFactor
        };
    }

    return {
        CONCENTRATION_TO_PER_UL: CONCENTRATION_TO_PER_UL,
        VOLUME_TO_UL: VOLUME_TO_UL,
        convertConcentrationToPerUL: convertConcentrationToPerUL,
        convertVolumeToUL: convertVolumeToUL,
        convertULToVolumeUnit: convertULToVolumeUnit,
        roundSig: roundSig,
        calcTargetCellsPerTube: calcTargetCellsPerTube,
        calcTargetConcentration: calcTargetConcentration
    };
});
