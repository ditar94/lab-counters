let parasiteCount = localStorage.getItem('parasiteCount') || 0;
let totalCountP = localStorage.getItem('totalCountP') || 0;
let percentageP = localStorage.getItem('percentageP') || 0;
let buttonStateP = localStorage.getItem('buttonStateP') || "Add";
const input = document.querySelector("#count-input");
const radio = document.querySelector("#wantCounter");
const log = document.getElementById('para');
document.addEventListener("input", updateValue);
document.addEventListener("click", inputSwitcher);



// function updateValue() {
//     log.textContent = e.target.value;
// }



function inputSwitcher() {
    if (document.getElementById('wantCounter').checked) {
        document.querySelectorAll('.hide-counters')[0].style.visibility = "visible";
        document.querySelectorAll('.hide-counters')[1].style.visibility = "visible";
        document.querySelectorAll('.alt_count')[0].style.visibility = "hidden";
        document.querySelectorAll('.alt_count')[1].style.visibility = "hidden";
        document.querySelectorAll('.hide-counters')[0].style.maxHeight = "none";
        document.querySelectorAll('.hide-counters')[1].style.maxHeight = "none";
        document.querySelectorAll('.alt_count')[0].style.maxHeight ="0";
        document.querySelectorAll('.alt_count')[1].style.maxHeight = "0";

    } else if (document.getElementById('noCounter').checked) {
        document.getElementById('para-count-input').value = parasiteCount;
        document.getElementById('red-count-input').value = totalCountP;
        document.querySelectorAll('.hide-counters')[0].style.visibility = "hidden";
        document.querySelectorAll('.hide-counters')[0].style.maxHeight = "0";
        document.querySelectorAll('.hide-counters')[1].style.visibility = "hidden";
        document.querySelectorAll('.hide-counters')[1].style.maxHeight = "0";
        document.querySelectorAll('.alt_count')[0].style.visibility = "visible";
        document.querySelectorAll('.alt_count')[1].style.visibility = "visible";
        document.querySelectorAll('.alt_count')[0].style.maxHeight ="none";
        document.querySelectorAll('.alt_count')[1].style.maxHeight = "none";


    }
}

function updateValue() {
    parasiteCount = document.getElementById('para-count-input').value;
    totalCountP = document.getElementById('red-count-input').value;
    console.log(parasiteCount);
    counterSave();
    percentageCalculator();
}




function updateCounter() {

    document.getElementById("parasite").textContent = parasiteCount;
    document.getElementById("total").textContent = totalCountP;
    document.getElementById("percent").textContent = percentageP;
    document.getElementById("switch").textContent = buttonStateP;
    console.log(parasiteCount);
    console.log(input);

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
    if (event.key == "ArrowLeft" && buttonStateP == "Add" && totalCountP < 1000) {
        console.log("event.code is" + event.code + ". Parasite count before is: " + parasiteCount);
        parasiteCount++;
        totalCountP++;
        console.log("event.code is" + event.code + ". Parasite count after is: " + parasiteCount);
    } else if (event.key == "ArrowLeft" && buttonStateP == "Subtract" && parasiteCount > 0) {
        parasiteCount--;
        if (totalCountP > 0) {
            totalCountP--;
        }
    } else if (event.key === "ArrowRight" && buttonStateP == "Add" && totalCountP < 1000) {
        totalCountP++
    } else if(event.key === "ArrowRight" && buttonStateP == "Subtract" && totalCountP > 0) {
        totalCountP--
    }
    counterSave()
    percentageCalculator();
}

function buttonPress(inputId) {
    switch (inputId) {
        case 1:
            if (buttonStateP == "Add" && totalCountP < 1000) {
                parasiteCount++;
                totalCountP++;
            } else if (buttonStateP == "Subtract" && parasiteCount > 0) {
                parasiteCount--;
                if (totalCountP > 0) {
                    totalCountP--;
                }
            }
            break;
        case 2:
            if (buttonStateP == "Add" && totalCountP < 1000) {
                totalCountP++;
            } else if (buttonStateP == "Subtract" && totalCountP > 0) {
                totalCountP--;
            }
            break;
    }

    counterSave();
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
