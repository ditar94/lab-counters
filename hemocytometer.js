let rbc1 = localStorage.getItem('rbc1') || 0;
let rbc2 = localStorage.getItem('rbc2') || 0;
let tnc1 = localStorage.getItem('tnc1') || 0;
let tnc2 = localStorage.getItem('tnc2') || 0;
let buttonStateH1 = localStorage.getItem('buttonStateH1') || "Add";
let buttonStateH2 = localStorage.getItem('buttonStateH2') || "Add";

updateCounter();

function updateCounter() {
    document.getElementById("rbc1").textContent = rbc1;
    document.getElementById("rbc2").textContent = rbc2;
    document.getElementById("tnc1").textContent = tnc1;
    document.getElementById("tnc2").textContent = tnc2;
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
        rbc1 = 0;
        tnc1 = 0;
    } else if (thisCounter == "c2") {
        rbc2 = 0;
        tnc2 = 0;
    }
    counterSave();
}
function keyStroke(event, inputId) {
    if (inputId === "input1") {
        if (event.code === "ArrowLeft" && buttonStateH1 == "Add") {
            rbc1++;
        } else if (event.code === "ArrowLeft" && buttonStateH1 == "Subtract" && rbc1 > 0) {
            rbc1--;
        } else if (event.code === "ArrowRight" && buttonStateH1 == "Add") {
            tnc1++;
        } else if (event.code === "ArrowRight" && buttonStateH1 == "Subtract" && tnc1 > 0) {
            tnc1--;
        }
    } else if (inputId === "input2") {
        if (event.code === "ArrowLeft" && buttonStateH2 == "Add") {
            rbc2++;
        } else if (event.code === "ArrowLeft" && buttonStateH2 == "Subtract" && rbc2 > 0) {
            rbc2--;
        } else if (event.code === "ArrowRight" && buttonStateH2 == "Add") {
            tnc2++;
        } else if (event.code === "ArrowRight" && buttonStateH2 == "Subtract" && tnc2 > 0) {
            tnc2--;
        }
    }
    counterSave();
}

function counterSave() {
    localStorage.setItem('rbc1', rbc1);
    document.getElementById("rbc1").textContent = rbc1;
    localStorage.setItem('rbc2', rbc2);
    document.getElementById("rbc2").textContent = rbc2;
    localStorage.setItem('tnc1', tnc1);
    document.getElementById("tnc1").textContent = tnc1;
    localStorage.setItem('tnc2', tnc2);
    document.getElementById("tnc2").textContent = tnc2;
}
