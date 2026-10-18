/*
 * tip-widget.js
 *
 * Positions #tip-bar (the Buy Me a Coffee widget) just below the actual
 * rendered header, rather than a guessed pixel value — header height
 * varies by breakpoint and by how many lines the nav wraps to, so this
 * is recalculated on load and on resize instead of hardcoded.
 */
function positionTipBar() {
    var bar = document.getElementById("tip-bar");
    var header = document.querySelector("header");
    if (!bar || !header) return;
    bar.style.top = (header.offsetTop + header.offsetHeight + 8) + "px";
}

window.addEventListener("load", positionTipBar);
window.addEventListener("resize", positionTipBar);
