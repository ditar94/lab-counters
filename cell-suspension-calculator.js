/*
 * cell-suspension-calculator.js
 *
 * DOM wiring for cell-suspension-calculator.html. All actual math lives
 * in calculators/cellSuspensionCalc.js (loaded before this file) so the
 * calculation logic can be unit tested independently of the page.
 */

var VOLUME_UNIT_LABEL = { uL: "µL", mL: "mL" };

function readNumber(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var raw = el.value;
    if (raw === "" || raw === null || raw === undefined) return null;
    var n = parseFloat(raw);
    return isNaN(n) ? null : n;
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showBanner(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function hideBanner(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
}

function fmt(value, sig) {
    if (value === null || value === undefined || typeof value !== "number" || !isFinite(value)) {
        return "—"; // em dash placeholder
    }
    var rounded = CellSuspensionCalc.roundSig(value, sig || 4);
    if (rounded === 0) rounded = 0; // normalize -0
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

// ---------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------

function updateActiveTabs() {
    document.querySelectorAll(".calc-tabs").forEach(function (group) {
        group.querySelectorAll("input[type=radio]").forEach(function (radio) {
            var label = group.querySelector('label[for="' + radio.id + '"]');
            if (!label) return;
            label.classList.toggle("active-tab", radio.checked);
        });
    });
}

function updatePanels() {
    var modeA = document.getElementById("mode-a");
    if (!modeA) return;
    document.getElementById("panel-mode-a").classList.toggle("hide", !modeA.checked);
    document.getElementById("panel-mode-b").classList.toggle("hide", modeA.checked);
}

// ---------------------------------------------------------------------
// Mode A — Target Cells Per Tube
// ---------------------------------------------------------------------

function clearResultsModeA() {
    ["a-result-volume-per-tube", "a-result-total-volume"].forEach(function (id) {
        setText(id, "—");
    });
}

function recalcModeA() {
    var errorBanner = document.getElementById("a-banner-error");
    if (!errorBanner) return; // page not loaded yet

    var concentration = readNumber("a-concentration");
    var concentrationUnit = document.getElementById("a-concentration-unit").value;
    var targetCellsPerTube = readNumber("a-target-cells");
    var numberOfTubes = readNumber("a-tubes");

    var hasCoreInputs = concentration !== null && targetCellsPerTube !== null && numberOfTubes !== null;
    if (!hasCoreInputs) {
        clearResultsModeA();
        hideBanner(errorBanner);
        return;
    }

    var result = CellSuspensionCalc.calcTargetCellsPerTube({
        concentration: concentration,
        concentrationUnit: concentrationUnit,
        targetCellsPerTube: targetCellsPerTube,
        numberOfTubes: numberOfTubes
    });

    if (result.errors.length) {
        showBanner(errorBanner, result.errors.join(" "));
        clearResultsModeA();
        return;
    }
    hideBanner(errorBanner);

    setText("a-result-volume-per-tube", fmt(result.volumePerTubeUL) + " µL");
    setText("a-result-total-volume", fmt(result.totalVolumeUL) + " µL");

    setText("a-calc-concentration-perul", fmt(result.concentrationPerUL, 6));
    setText("a-calc-volume-per-tube", fmt(result.volumePerTubeUL));
    setText("a-calc-total-volume", fmt(result.totalVolumeUL));
}

function resetModeA() {
    document.getElementById("a-concentration").value = "";
    document.getElementById("a-concentration-unit").value = "cellsPerUL";
    document.getElementById("a-target-cells").value = "";
    document.getElementById("a-tubes").value = "";
    recalcModeA();
}

// ---------------------------------------------------------------------
// Mode B — Target Cell Concentration (C1V1 = C2V2)
// ---------------------------------------------------------------------

function clearResultsModeB() {
    ["b-result-specimen-volume", "b-result-diluent-volume", "b-result-final-volume", "b-result-dilution-factor"]
        .forEach(function (id) { setText(id, "—"); });
    setText("b-mixing-instructions", "");
}

function recalcModeB() {
    var errorBanner = document.getElementById("b-banner-error");
    var infeasibleBanner = document.getElementById("b-banner-infeasible");
    if (!errorBanner) return;

    var startingConcentration = readNumber("b-starting-concentration");
    var targetConcentration = readNumber("b-target-concentration");
    var finalVolume = readNumber("b-final-volume");
    var volumeUnit = document.getElementById("b-volume-unit").value;
    var unitLabel = VOLUME_UNIT_LABEL[volumeUnit] || volumeUnit;

    var hasCoreInputs = startingConcentration !== null && targetConcentration !== null && finalVolume !== null;
    if (!hasCoreInputs) {
        clearResultsModeB();
        hideBanner(errorBanner);
        hideBanner(infeasibleBanner);
        return;
    }

    var result = CellSuspensionCalc.calcTargetConcentration({
        startingConcentration: startingConcentration,
        targetConcentration: targetConcentration,
        finalVolume: finalVolume,
        volumeUnit: volumeUnit
    });

    if (result.errors.length) {
        showBanner(errorBanner, result.errors.join(" "));
        clearResultsModeB();
        hideBanner(infeasibleBanner);
        return;
    }
    hideBanner(errorBanner);

    if (!result.achievable) {
        showBanner(infeasibleBanner, result.message);
        clearResultsModeB();
        return;
    }
    hideBanner(infeasibleBanner);

    setText("b-result-specimen-volume", fmt(result.specimenVolume) + " " + unitLabel);
    setText("b-result-diluent-volume", fmt(result.diluentVolume) + " " + unitLabel);
    setText("b-result-final-volume", fmt(result.finalVolume) + " " + unitLabel);
    setText("b-result-dilution-factor", fmt(result.dilutionFactor) + "×");
    setText(
        "b-mixing-instructions",
        "Mix " + fmt(result.specimenVolume) + " " + unitLabel + " of specimen with " +
        fmt(result.diluentVolume) + " " + unitLabel + " of diluent for a final volume of " +
        fmt(result.finalVolume) + " " + unitLabel + "."
    );

    setText("b-calc-v1", fmt(result.specimenVolume) + " " + unitLabel);
    setText("b-calc-diluent", fmt(result.diluentVolume) + " " + unitLabel);
    setText("b-calc-factor", fmt(result.dilutionFactor) + "×");
}

function resetModeB() {
    document.getElementById("b-starting-concentration").value = "";
    document.getElementById("b-target-concentration").value = "";
    document.getElementById("b-concentration-unit").value = "cellsPerUL";
    document.getElementById("b-final-volume").value = "";
    document.getElementById("b-volume-unit").value = "uL";
    recalcModeB();
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------

function handleCellSuspensionChange() {
    updateActiveTabs();
    updatePanels();
    recalcModeA();
    recalcModeB();
}

document.addEventListener("input", handleCellSuspensionChange);
document.addEventListener("change", handleCellSuspensionChange);

function initCellSuspensionCalculator() {
    handleCellSuspensionChange();
}
