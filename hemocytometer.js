let rbc_1 = localStorage.getItem('rbc_1') || 0;
let rbc_2 = localStorage.getItem('rbc_2') || 0;
let tnc_1 = localStorage.getItem('tnc_1') || 0;
let tnc_2 = localStorage.getItem('tnc_2') || 0;
let buttonStateH1 = localStorage.getItem('buttonStateH1') || "Add";
let buttonStateH2 = localStorage.getItem('buttonStateH2') || "Add";

updateCounter();

function updateCounter() {
    document.getElementById("rbc1").textContent = rbc_1;
    document.getElementById("rbc2").textContent = rbc_2;
    document.getElementById("tnc1").textContent = tnc_1;
    document.getElementById("tnc2").textContent = tnc_2;
    document.getElementById("switch1").textContent = buttonStateH1;
    document.getElementById("switch2").textContent = buttonStateH2;
}

function buttonChange(thisButton) {
    if (thisButton == 's1') {
        if (buttonStateH1 == "Add") {
            buttonStateH1 = "Subtract";
        } else if (buttonStateH1 == "Subtract") {
            buttonStateH1 = "Add";
        }
    } else if (thisButton == 's2') {
        if (buttonStateH2 == "Add") {
            buttonStateH2 = "Subtract";
        } else if (buttonStateH2 == "Subtract") {
            buttonStateH2 = "Add";
        }
    }
    localStorage.setItem('buttonStateH1', buttonStateH1);
    localStorage.setItem('buttonStateH2', buttonStateH2);
    document.getElementById("switch1").textContent = buttonStateH1;
    document.getElementById("switch2").textContent = buttonStateH2;

}

function resetCounter(thisCounter) {
    if (thisCounter == "c1") {
        rbc_1 = 0;
        tnc_1 = 0;
    } else if (thisCounter == "c2") {
        rbc_2 = 0;
        tnc_2 = 0;
    }
    counterSave();
}
function keyStroke(event, inputId) {
    if (inputId === "input1") {
        if (event.code === "ArrowLeft" && buttonStateH1 == "Add") {
            rbc_1++;
        } else if (event.code === "ArrowLeft" && buttonStateH1 == "Subtract" && rbc_1 > 0) {
            rbc_1--;
        } else if (event.code === "ArrowRight" && buttonStateH1 == "Add") {
            tnc_1++;
        } else if (event.code === "ArrowRight" && buttonStateH1 == "Subtract" && tnc_1 > 0) {
            tnc_1--;
        }
    } else if (inputId === "input2") {
        if (event.code === "ArrowLeft" && buttonStateH2 == "Add") {
            rbc_2++;
        } else if (event.code === "ArrowLeft" && buttonStateH2 == "Subtract" && rbc_2 > 0) {
            rbc_2--;
        } else if (event.code === "ArrowRight" && buttonStateH2 == "Add") {
            tnc_2++;
        } else if (event.code === "ArrowRight" && buttonStateH2 == "Subtract" && tnc_2 > 0) {
            tnc_2--;
        }
    }
    calculateCount();
    counterSave();
}

function buttonPress(inputId) {
    switch (inputId) {
        case 1:
            if (buttonStateH1 == "Add") {
                rbc_1++;
            } else if (buttonStateH1 == "Subtract" && rbc_1 > 0) {
                rbc_1--;
            }
            break;
        case 2:
            if (buttonStateH1 == "Add") {
                tnc_1++;
            } else if (buttonStateH1 == "Subtract" && tnc_1 > 0) {
                tnc_1--;
            }
            break;
        case 3:
            if (buttonStateH2 == "Add") {
                rbc_2++;
            } else if (buttonStateH2 == "Subtract" && rbc_2 > 0) {
                rbc_2--;
            }
            break;
        case 4:
            if (buttonStateH2 == "Add") {
                tnc_2++;
            } else if (buttonStateH2 == "Subtract" && tnc_2 > 0) {
                tnc_2--;
            }
            break;
    }
    calculateCount();
    counterSave();
}

function counterSave() {
    localStorage.setItem('rbc_1', rbc_1);
    document.getElementById("rbc1").textContent = rbc_1;
    localStorage.setItem('rbc_2', rbc_2);
    document.getElementById("rbc2").textContent = rbc_2;
    localStorage.setItem('tnc_1', tnc_1);
    document.getElementById("tnc1").textContent = tnc_1;
    localStorage.setItem('tnc_2', tnc_2);
    document.getElementById("tnc2").textContent = tnc_2;
}


function calculateCount() {
    updateCounter();
    let dilution = document.getElementById("dilution").value;
    let squares = parseFloat(document.getElementById("squares").value);
    let rbcCount;
    let rbcAvg = (parseInt(rbc_1) + parseInt(rbc_2)) / 2;
    let tncCount;
    let tncAverage = (parseInt(tnc_1) + parseInt(tnc_2)) / 2;
    rbcCount = 10 * dilution * rbcAvg / squares ;
    tncCount = 10 * dilution * tncAverage / squares ;

    document.getElementById("rbcCount").textContent = Math.round(rbcCount);
    document.getElementById("tncCount").textContent = Math.round(tncCount);

}
