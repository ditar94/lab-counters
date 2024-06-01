let totalCount = 0;
let reticCount = 0;
let buttonState = "Add";
let percentage = 0;


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
    document.getElementById("percent").textContent = percentage.toFixed(2);
    return;
}

function buttonChange() {
    if (buttonState == "Add") {
        buttonState = "Subtract";
        document.getElementById("switch").textContent = buttonState;
    } else {
        buttonState = "Add";
        document.getElementById("switch").textContent = buttonState;
    }
}
function resetCounter() {
    totalCount = 0;
    reticCount = 0;
    percentage = 0;
    document.getElementById("total").textContent = totalCount;
    document.getElementById("retic").textContent = reticCount;
    document.getElementById("percent").textContent = percentage;

}

function updateCounter() {
    totalCount = 0;
    document.getElementById("total").textContent = totalCount;
    reticCount = 0;
    document.getElementById("retic").textContent = reticCount;
    buttonState = "Add";
    document.getElementById("switch").textContent = buttonState;
    percentage = 0;
    document.getElementById("percent").textContent = percentage;
}



function keyStroke(event) {
    if (event.key == "3" && buttonState == "Add" && totalCount < 1000) {
        totalCount++;
    } else if (event.key == "3" && buttonState == "Subtract" && totalCount > 0) {
        totalCount--;
    }
    if (event.key == "1" && buttonState == "Add" && totalCount < 1000) {
        reticCount++;
        totalCount++;

    } else if (event.key == "1" && buttonState == "Subtract" && reticCount > 0) {
        reticCount--;
        if (totalCount > 0) {
        totalCount--;
        }
    }
    document.getElementById("retic").textContent = reticCount;
    document.getElementById("total").textContent = totalCount;
    percentageCalculator();
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

    document.getElementById("retic").textContent = reticCount;
    document.getElementById("total").textContent = totalCount;
    percentageCalculator();
}
