/*
 * lab-dilution-calculator.js
 *
 * DOM wiring for lab-dilution-calculator.html. All actual math lives in
 * calculators/labDilutionCalc.js (loaded before this file) so the
 * calculation logic can be unit tested independently of the page.
 */

var DILUTION_VOLUME_UNIT_LABEL = { uL: "µL", mL: "mL" };

function readNumberL(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var raw = el.value;
    if (raw === "" || raw === null || raw === undefined) return null;
    var n = parseFloat(raw);
    return isNaN(n) ? null : n;
}

function setTextL(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showBannerL(el, message) {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
}

function hideBannerL(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
}

function fmtL(value, sig) {
    if (value === null || value === undefined || typeof value !== "number" || !isFinite(value)) {
        return "—";
    }
    var rounded = LabDilutionCalc.roundSig(value, sig || 4);
    if (rounded === 0) rounded = 0;
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

// ---------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------

function updateActiveTabsL() {
    document.querySelectorAll(".calc-tabs").forEach(function (group) {
        group.querySelectorAll("input[type=radio]").forEach(function (radio) {
            var label = group.querySelector('label[for="' + radio.id + '"]');
            if (!label) return;
            label.classList.toggle("active-tab", radio.checked);
        });
    });
}

function updatePanelsL() {
    var modeRatio = document.getElementById("mode-ratio");
    if (!modeRatio) return;
    document.getElementById("panel-mode-ratio").classList.toggle("hide", !modeRatio.checked);
    document.getElementById("panel-mode-concentration").classList.toggle("hide", modeRatio.checked);
}

function updateCustomRatioVisibility() {
    var preset = document.getElementById("r-preset");
    var customField = document.getElementById("r-custom-field");
    if (!preset || !customField) return;
    customField.style.display = preset.value === "custom" ? "flex" : "none";
}

// ---------------------------------------------------------------------
// Mode A — Dilution Ratio Calculator
// ---------------------------------------------------------------------

function clearRatioResults() {
    ["r-result-specimen-volume", "r-result-diluent-volume", "r-result-final-volume", "r-result-effective-ratio"]
        .forEach(function (id) { setTextL(id, "—"); });
    setTextL("r-mixing-instructions", "");
    setTextL("r-calc-details-body", "");
    var specimenBar = document.getElementById("r-ratio-visual-specimen");
    var diluentBar = document.getElementById("r-ratio-visual-diluent");
    if (specimenBar) { specimenBar.style.flexBasis = "50%"; specimenBar.textContent = ""; }
    if (diluentBar) { diluentBar.style.flexBasis = "50%"; diluentBar.textContent = ""; }
}

function recalcRatioMode() {
    var errorBanner = document.getElementById("r-banner-error");
    if (!errorBanner) return;

    updateCustomRatioVisibility();

    var preset = document.getElementById("r-preset").value;
    var ratioN = preset === "custom" ? readNumberL("r-custom-n") : parseFloat(preset);
    var finalVolume = readNumberL("r-final-volume");
    var volumeUnit = document.getElementById("r-volume-unit").value;
    var unitLabel = DILUTION_VOLUME_UNIT_LABEL[volumeUnit] || volumeUnit;
    var conventionInput = document.querySelector('input[name="r-convention"]:checked');
    var convention = conventionInput ? conventionInput.value : "totalParts";

    if (ratioN === null || finalVolume === null) {
        clearRatioResults();
        hideBannerL(errorBanner);
        return;
    }

    var result = LabDilutionCalc.calcDilutionRatio({
        ratioN: ratioN,
        convention: convention,
        finalVolume: finalVolume
    });

    if (result.errors.length) {
        showBannerL(errorBanner, result.errors.join(" "));
        clearRatioResults();
        return;
    }
    hideBannerL(errorBanner);

    setTextL("r-result-specimen-volume", fmtL(result.specimenVolume) + " " + unitLabel);
    setTextL("r-result-diluent-volume", fmtL(result.diluentVolume) + " " + unitLabel);
    setTextL("r-result-final-volume", fmtL(result.finalVolume) + " " + unitLabel);
    setTextL("r-result-effective-ratio", result.effectiveRatioLabel);
    setTextL(
        "r-mixing-instructions",
        "Mix " + fmtL(result.specimenVolume) + " " + unitLabel + " of specimen with " +
        fmtL(result.diluentVolume) + " " + unitLabel + " of diluent for a final volume of " +
        fmtL(result.finalVolume) + " " + unitLabel + " (effective ratio " + result.effectiveRatioLabel + ")."
    );

    var conventionLabel = convention === "totalParts"
        ? "1 part specimen in " + ratioN + " total parts"
        : "1 part specimen plus " + ratioN + " parts diluent (" + (1 + ratioN) + " total parts)";
    setTextL(
        "r-calc-details-body",
        "Convention selected: " + conventionLabel + ". Total parts = " + result.totalParts + ". " +
        "Specimen = Final volume ÷ Total parts = " + fmtL(result.finalVolume) + " ÷ " + result.totalParts +
        " = " + fmtL(result.specimenVolume) + " " + unitLabel + ". " +
        "Diluent = Final volume − Specimen = " + fmtL(result.diluentVolume) + " " + unitLabel + "."
    );

    var specimenPercent = (result.specimenVolume / result.finalVolume) * 100;
    var diluentPercent = 100 - specimenPercent;
    var specimenBar = document.getElementById("r-ratio-visual-specimen");
    var diluentBar = document.getElementById("r-ratio-visual-diluent");
    if (specimenBar && diluentBar) {
        specimenBar.style.flexBasis = specimenPercent + "%";
        diluentBar.style.flexBasis = diluentPercent + "%";
        specimenBar.textContent = specimenPercent >= 10 ? "Specimen " + fmtL(specimenPercent, 3) + "%" : "";
        diluentBar.textContent = diluentPercent >= 10 ? "Diluent " + fmtL(diluentPercent, 3) + "%" : "";
        specimenBar.setAttribute("aria-label", "Specimen " + fmtL(specimenPercent, 3) + "%");
        diluentBar.setAttribute("aria-label", "Diluent " + fmtL(diluentPercent, 3) + "%");
    }
}

function resetRatioMode() {
    document.getElementById("r-preset").value = "5";
    document.getElementById("r-custom-n").value = "5";
    document.getElementById("r-final-volume").value = "";
    document.getElementById("r-volume-unit").value = "uL";
    document.getElementById("r-convention-1").checked = true;
    updateCustomRatioVisibility();
    recalcRatioMode();
}

// ---------------------------------------------------------------------
// Mode B — Concentration Dilution Calculator (C1V1 = C2V2)
// ---------------------------------------------------------------------

function clearConcentrationResults() {
    ["c-result-stock-volume", "c-result-diluent-volume", "c-result-final-volume", "c-result-dilution-factor"]
        .forEach(function (id) { setTextL(id, "—"); });
}

function recalcConcentrationMode() {
    var errorBanner = document.getElementById("c-banner-error");
    var infeasibleBanner = document.getElementById("c-banner-infeasible");
    if (!errorBanner) return;

    var startingConcentration = readNumberL("c-starting-concentration");
    var targetConcentration = readNumberL("c-target-concentration");
    var concentrationUnit = document.getElementById("c-concentration-unit").value;
    var finalVolume = readNumberL("c-final-volume");
    var volumeUnit = document.getElementById("c-volume-unit").value;
    var unitLabel = DILUTION_VOLUME_UNIT_LABEL[volumeUnit] || volumeUnit;

    var hasCoreInputs = startingConcentration !== null && targetConcentration !== null && finalVolume !== null;
    if (!hasCoreInputs) {
        clearConcentrationResults();
        hideBannerL(errorBanner);
        hideBannerL(infeasibleBanner);
        return;
    }

    var result = LabDilutionCalc.calcConcentrationDilution({
        startingConcentration: startingConcentration,
        targetConcentration: targetConcentration,
        concentrationUnit: concentrationUnit,
        finalVolume: finalVolume
    });

    if (result.errors.length) {
        showBannerL(errorBanner, result.errors.join(" "));
        clearConcentrationResults();
        hideBannerL(infeasibleBanner);
        return;
    }
    hideBannerL(errorBanner);

    if (!result.achievable) {
        showBannerL(infeasibleBanner, result.message);
        clearConcentrationResults();
        return;
    }
    hideBannerL(infeasibleBanner);

    setTextL("c-result-stock-volume", fmtL(result.stockVolume) + " " + unitLabel);
    setTextL("c-result-diluent-volume", fmtL(result.diluentVolume) + " " + unitLabel);
    setTextL("c-result-final-volume", fmtL(result.finalVolume) + " " + unitLabel);
    setTextL("c-result-dilution-factor", fmtL(result.dilutionFactor) + "×");

    setTextL("c-calc-v1", fmtL(result.stockVolume) + " " + unitLabel);
    setTextL("c-calc-diluent", fmtL(result.diluentVolume) + " " + unitLabel);
    setTextL("c-calc-factor", fmtL(result.dilutionFactor) + "×");
}

function resetConcentrationMode() {
    document.getElementById("c-starting-concentration").value = "";
    document.getElementById("c-target-concentration").value = "";
    document.getElementById("c-concentration-unit").value = "mgPerML";
    document.getElementById("c-final-volume").value = "";
    document.getElementById("c-volume-unit").value = "uL";
    recalcConcentrationMode();
}

// ---------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------

function handleLabDilutionChange() {
    updateActiveTabsL();
    updatePanelsL();
    recalcRatioMode();
    recalcConcentrationMode();
}

document.addEventListener("input", handleLabDilutionChange);
document.addEventListener("change", handleLabDilutionChange);

function initLabDilutionCalculator() {
    handleLabDilutionChange();
}
