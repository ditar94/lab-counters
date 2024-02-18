let totalCount = localStorage.getItem('totalCount') || 0;
let reticCount = localStorage.getItem('reticCount') || 0;
let buttonState = localStorage.getItem('buttonState') || "Add";
let percentage = localStorage.getItem('percentage') || 0;
document.getElementById("total").textContent = totalCount;
document.getElementById("retic").textContent = reticCount;
document.getElementById("switch").textContent = buttonState;
document.getElementById("percent").textContent = percentage;

// function incrementCounter() {
//     currentCount++; // Increment the counter variable by 1
//     localStorage.setItem('currentCount', currentCount); // Save the updated value to localStorage
//     document.getElementById("counter").textContent = currentCount; // Update the content of the <p> element
// }

// function decreaseCounter() {
//     currentCount--;
//     localStorage.setItem('currentCount', currentCount); // Save the updated value to localStorage
//     document.getElementById("counter").textContent = currentCount; // Update the content of the <p> element
// }

function percentageCalculator() {
    percentage = (reticCount/totalCount) * 100;
    localStorage.setItem('percentage', percentage);
    document.getElementById("percent").textContent = percentage.toFixed(2);
    return;
}

function buttonChange() {
    if (buttonState == "Add") {
        buttonState = "Subtract";
        localStorage.setItem('buttonState', buttonState);
        document.getElementById("switch").textContent = buttonState;
    } else {
        buttonState = "Add";
        localStorage.setItem('buttonState', buttonState);
        document.getElementById("switch").textContent = buttonState;
    }
}
function resetCounter() {
    totalCount = 0;
    reticCount = 0;
    percentage = 0;
    localStorage.setItem('reticCount', reticCount);
    localStorage.setItem('totalCount', totalCount);
    localStorage.setItem('percentage', percentage)
    document.getElementById("total").textContent = totalCount;
    document.getElementById("retic").textContent = reticCount;
    document.getElementById("percent").textContent = percentage;

}

function updateCounter() {
    let totalCount = localStorage.getItem('totalCount') || 0;
    document.getElementById("total").textContent = totalCount;
    let reticCount = localStorage.getItem('reticCount') || 0;
    document.getElementById("retic").textContent = reticCount;
    let buttonState = localStorage.getItem('buttonState') || "Add";
    document.getElementById("switch").textContent = buttonState;
    let percentage = localStorage.getItem('percentage') || 0;
    document.getElementById("percent").textContent = percentage;
}



function keyStroke(event) {
    if (event.code === "ArrowRight" && buttonState == "Add" && totalCount < 1000) {
        totalCount++;
        localStorage.setItem('totalCount', totalCount);
        document.getElementById("total").textContent = totalCount;
        percentageCalculator();
    } else if (event.code === "ArrowRight" && buttonState == "Subtract" && totalCount > 0) {
        totalCount--;
        localStorage.setItem('totalCount', totalCount);
        document.getElementById("total").textContent = totalCount;
        percentageCalculator();
    }
    if (event.code === "ArrowLeft" && buttonState == "Add" && totalCount < 1000) {
        reticCount++;
        localStorage.setItem('reticCount', reticCount);
        document.getElementById("retic").textContent = reticCount;
        totalCount++;
        localStorage.setItem('totalCount', totalCount);
        document.getElementById("total").textContent = totalCount;
        percentageCalculator();
    } else if (event.code === "ArrowLeft" && buttonState == "Subtract" && reticCount > 0) {
        reticCount--;
        localStorage.setItem('reticCount', reticCount);
        document.getElementById("retic").textContent = reticCount;
        if (totalCount > 0) {
        totalCount--;
        localStorage.setItem('totalCount', totalCount);
        document.getElementById("total").textContent = totalCount;
        }
        percentageCalculator();
    }
}

function buttonPress(inputId) {
    switch (inputId) {
        case 1:
            if (buttonState == "Add" && totalCount < 1000) {
                reticCount++;
                totalCount++;
            } else if (buttonState == "Subtract" && reticCount > 0) {
                reticCount--;
                if (totalCount > 0) {
                    totalCount--;
                }
            }
            break;
        case 2:
            if (buttonState == "Add" && totalCount < 1000) {
                totalCount++;
            } else if (buttonState == "Subtract" && totalCount > 0) {
                totalCount--;
            }
            break;
    }

    localStorage.setItem('reticCount', reticCount);
    document.getElementById("retic").textContent = reticCount;
    localStorage.setItem('totalCount', totalCount);
    document.getElementById("total").textContent = totalCount
    percentageCalculator();
}
