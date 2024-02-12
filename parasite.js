let parasiteCount = localStorage.getItem('parasiteCount') || 0;
let totalCountP = localStorage.getItem('totalCountP') || 0;
let percentageP = localStorage.getItem('percentageP') || 0;
let buttonStateP = localStorage.getItem('buttonStateP') || 0;

updateCounter();



function updateCounter() {

    document.getElementById("parasite").textContent = parasiteCount;
    document.getElementById("total").textContent = totalCountP;
    document.getElementById("percent").textContent = percentageP;
    document.getElementById("switch").textContent = buttonStateP;

}

function percentageCalculator() {
    percentageP = ( parasiteCount / totalCountP ) * 100;
    localStorage.setItem('percentageP', percentageP);
    document.getElementById("percent").textContent = percentageP.toFixed(2);
    return;
}

function buttonChange() {
    if (buttonStateP == "Add") {
        buttonStateP = "Subtract";
    } else if (buttonStateP = "Subtract") {
        buttonStateP = "Add";
    }
    localStorage.setItem('buttonStateP', buttonStateP);
    document.getElementById("switch").textContent = buttonStateP;
}

function keyStroke(event) {
    if (event.code === "ArrowLeft" && buttonStateP == "Add" && totalCountP < 1000) {
        parasiteCount++;
        totalCountP++;
    } else if (event.code === "ArrowLeft" && buttonStateP == "Subtract" && parasiteCount > 0) {
        parasiteCount--;
        if (totalCountP > 0) {
            totalCountP--;
        }
    } else if (event.code === "ArrowRight" && buttonStateP == "Add" && totalCountP < 1000) {
        totalCountP++
    } else if(event.code === "ArrowRight" && buttonStateP == "Subtract" && totalCountP > 0) {
        totalCountP--
    }
    counterSave()
    percentageCalculator();
}

//This function saves the counter and updates webpage
function counterSave() {
    localStorage.setItem('totalCountP', totalCountP);
    document.getElementById("total").textContent = totalCountP;
    localStorage.setItem('parasiteCount', parasiteCount);
    document.getElementById("parasite").textContent = parasiteCount;
}

function resetCounter() {
    parasiteCount = 0;
    totalCountP = 0;
    percentageP = 0;
    counterSave();
    percentageCalculator()
}
