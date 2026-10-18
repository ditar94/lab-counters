/*
 * ads.js
 *
 * Reusable helper for rendering a manual Google AdSense display-ad unit
 * into a reserved <div class="ad-slot" id="..."> container. Used by the
 * calculator pages alongside the site's existing sitewide Auto ads
 * loader script (see the adsbygoogle.js <script> tag on each page) —
 * Auto ads and manually-placed display units are both supported by
 * AdSense at the same time, so this does not duplicate or replace it.
 *
 * CONFIGURATION:
 * The ad unit (slot) IDs below are placeholders. Create the actual ad
 * units in the AdSense dashboard (Ads > By ad unit > Display ads) and
 * paste their numeric slot IDs in here. Until a slot ID is filled in,
 * renderAdSlot() simply does nothing — the reserved <div> stays empty
 * and collapsed, so the page layout and the calculator are completely
 * unaffected either way.
 */
var AD_SLOT_IDS = {
    calculatorTop: "", // TODO: set from AdSense dashboard, e.g. "1234567890"
    calculatorBottom: "" // TODO: set from AdSense dashboard
};

var ADSENSE_CLIENT_ID = "ca-pub-8727841619590493";

function renderAdSlot(containerId, slotKey) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var slotId = AD_SLOT_IDS[slotKey];
    if (!slotId) {
        // Not configured yet. Leave the reserved space empty rather than
        // showing a blank placeholder box.
        return;
    }

    container.setAttribute("data-configured", "true");

    var label = document.createElement("p");
    label.className = "ad-slot-label";
    label.textContent = "Advertisement";
    container.appendChild(label);

    var ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.setAttribute("data-ad-client", ADSENSE_CLIENT_ID);
    ins.setAttribute("data-ad-slot", slotId);
    ins.setAttribute("data-ad-format", "auto");
    ins.setAttribute("data-full-width-responsive", "true");
    container.appendChild(ins);

    try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
        // AdSense blocked (ad blocker, firewall, network issue, or account
        // not yet approved to serve ads) — fail silently. The calculator
        // itself never depends on this succeeding.
        console.warn("CellCounter: ad slot failed to initialize; page continues to work normally.", e);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    renderAdSlot("ad-slot-top", "calculatorTop");
    renderAdSlot("ad-slot-bottom", "calculatorBottom");
});
