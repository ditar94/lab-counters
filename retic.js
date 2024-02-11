let totalCount = localStorage.getItem('totalCount') || 0;
let reticCount = localStorage.getItem('reticCount') || 0;
document.getElementById("total").textContent = totalCount;
document.getElementById("retic").textContent = reticCount;

function incrementCounter() {
    currentCount++; // Increment the counter variable by 1
    localStorage.setItem('currentCount', currentCount); // Save the updated value to localStorage
    document.getElementById("counter").textContent = currentCount; // Update the content of the <p> element
}

function decreaseCounter() {
    currentCount--;
    localStorage.setItem('currentCount', currentCount); // Save the updated value to localStorage
    document.getElementById("counter").textContent = currentCount; // Update the content of the <p> element
}

function resetCounter() {
    totalCount = 0;
    reticCount = 0;
    localStorage.setItem('reticCount', reticCount);
    localStorage.setItem('totalCount', totalCount);
    document.getElementById("total").textContent = totalCount;
    document.getElementById("retic").textContent = reticCount;
}

function updateCounter() {
    let totalCount = localStorage.getItem('totalCount') || 0;
    document.getElementById("total").textContent = totalCount;
    let reticCount = localStorage.getItem('reticCount') || 0;
    document.getElementById("retic").textContent = reticCount;
}

function keyStroke(event) {
    if (event.code === "ArrowLeft") {
        totalCount++;
        localStorage.setItem('totalCount', totalCount);
        document.getElementById("total").textContent = totalCount;
    }

    if (event.code === "ArrowRight") {
        reticCount++;
        localStorage.setItem('reticCount', reticCount);
        document.getElementById("retic").textContent = reticCount;
    }
}
