
window.field_1 = localStorage.getItem('field_1') || 0;
window.field_2 = localStorage.getItem('field_2') || 0;
window.field_3 = localStorage.getItem('field_3') || 0;
window.field_4 = localStorage.getItem('field_4') || 0;
window.field_5 = localStorage.getItem('field_5') || 0;
window.average_RBC = localStorage.getItem('average_RBC') || 0;
window.thirty_Fields = localStorage.getItem('thirty_Fields') || 0;
window.field_7 = localStorage.getItem('field_7') || 0;
window.field_6 = localStorage.getItem('field_6') || 0;
window.add_Subtract1 = localStorage.getItem('add_Subtract1') || "Add";
window.add_Subtract2 = localStorage.getItem('add_Subtract2') || "Add";
window.add_Subtract3 = localStorage.getItem('add_Subtract3') || "Add";
window.add_Subtract4 = localStorage.getItem('add_Subtract4') || "Add";
window.add_Subtract5 = localStorage.getItem('add_Subtract5') || "Add";
window.add_Subtract6 = localStorage.getItem('add_Subtract6') || "Add";
window.percent_Fetals = localStorage.getItem('percent_Fetals') || 0;
document.addEventListener("input", updateValue);
document.addEventListener("click", inputSwitcher);

function inputSwitcher() {
    var hideMe = document.querySelectorAll('.hide-counters');
    if (document.getElementById('wantCounter').checked) {
        for (i=0; i< hideMe.length; i++) {
            document.querySelectorAll('.hide-counters')[i].style.display = "flex";
        }
        document.querySelectorAll('.alt_count')[0].style.visibility = "hidden";
        document.querySelectorAll('.alt_count')[1].style.visibility = "hidden";
        document.querySelectorAll('.alt_count')[0].style.maxHeight ="0";
        document.querySelectorAll('.alt_count')[1].style.maxHeight = "0";

    } else if (document.getElementById('noCounter').checked) {
        document.getElementById('red-count-input').value = field_1;
        for (i=0; i< hideMe.length; i++) {
            document.querySelectorAll('.hide-counters')[i].style.display = "none";
        }
        document.querySelectorAll('.alt_count')[0].style.visibility = "visible";
        document.querySelectorAll('.alt_count')[1].style.visibility = "visible";
        document.querySelectorAll('.alt_count')[0].style.maxHeight ="none";
        document.querySelectorAll('.alt_count')[1].style.maxHeight = "none";


    }
}

function updateValue() {
    field_1 = document.getElementById('red-count-input').value;
    field_2 = document.getElementById('red-count-input').value;
    field_3 = document.getElementById('red-count-input').value;
    field_4 = document.getElementById('red-count-input').value;
    field_5 = document.getElementById('red-count-input').value;
    console.log(average_RBC);
    console.log(document.getElementById('red-count-input'))
    updateCounter();
    calculateAverage();
    calculatePercentage();
}

function updateCounter() {
    document.getElementById("field1").textContent = field_1;
    document.getElementById("field2").textContent = field_2;
    document.getElementById("field3").textContent = field_3;
    document.getElementById("field4").textContent = field_4;
    document.getElementById("field5").textContent = field_5;
    document.getElementById("averageRBC").textContent = average_RBC;
    document.getElementById("thirtyFields").textContent = thirty_Fields;
    document.getElementById("field7").textContent = field_7;
    document.getElementById("field6").textContent = field_6;
    document.getElementById("addSubtract1").textContent = add_Subtract1;
    document.getElementById("addSubtract2").textContent = add_Subtract2;
    document.getElementById("addSubtract3").textContent = add_Subtract3;
    document.getElementById("addSubtract4").textContent = add_Subtract4;
    document.getElementById("addSubtract5").textContent = add_Subtract5;
    document.getElementById("addSubtract6").textContent = add_Subtract6;
    document.getElementById("percentFetals").textContent = percent_Fetals;
}


function resetCounter(thisCounter) {
    let pass;
    if (thisCounter == "r1") {
        field_1 = 0;
        pass = "field_1";
        counterSave(pass);
    } else if (thisCounter == "r2") {
        field_2 = 0;
        pass = 'field_2';
        counterSave(pass);
    } else if (thisCounter == "r3") {
        field_3 = 0;
        pass = "field_3";
        counterSave(pass);
    } else if (thisCounter == "r4") {
        field_4 = 0;
        pass = "field_4";
        counterSave(pass);
    } else if (thisCounter == "r5") {
        field_5 = 0;
        pass = "field_5";
        counterSave(pass);
    } else if (thisCounter == "r6") {
        field_7 = 0;
        field_6 = 0;
        counterSave("field_7");
        counterSave("field_6");
    }
    calculateAverage();
    calculatePercentage();
}

function counterSave(fieldValue) {
    localStorage.setItem(fieldValue, window[fieldValue]);
    document.getElementById(fieldValue.replace("_", "")).textContent = window[fieldValue];
    if (document.getElementById('noCounter').checked) {
        field_2 = field_1;
        field_3 = field_1;
        field_4 = field_1;
        field_5 = field_1;
    }
}

function buttonChange(thisButton) {
    const buttonVariableMap = {
        "s1": "add_Subtract1",
        "s2": "add_Subtract2",
        "s3": "add_Subtract3",
        "s4": "add_Subtract4",
        "s5": "add_Subtract5",
        "s6": "add_Subtract6"
    };
    const currentButton = buttonVariableMap[thisButton];
    if (currentButton && window[currentButton]) {
        window[currentButton] = (window[currentButton] == "Add") ? "Subtract" : "Add";
        counterSave(currentButton);
    };
}

function calculateAverage() {
    average_RBC = (parseInt(field_1) + parseInt(field_2) + parseInt(field_3) + parseInt(field_4) + parseInt(field_5)) / 5;
    thirty_Fields = parseInt(average_RBC * 30);
    counterSave("average_RBC");
    counterSave("thirty_Fields");
}

function keyStroke(event, inputId) {
    let buttonCode = 'add_Subtract' + String(inputId);
    let element = 'field' + String(inputId);
    let valueCode = element.replace('d', 'd_');
        switch (inputId) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                if (event.code === "ArrowRight" &&  window[buttonCode] == "Add") {
                    window[valueCode]++;
                } else if (event.code === "ArrowRight" && window[buttonCode] == "Subtract" && window[valueCode] > 0) {
                    window[valueCode]--;
                }
                //document.getElementById(element).textContent = window[valueCode];
                counterSave(valueCode);
                break;
            case 6:
                if (event.code == "ArrowRight" &&  window[buttonCode] == "Add" && field_7 < 30) {
                    field_7++;
                } else if (event.code == "ArrowRight" && window[buttonCode] == "Subtract" && field_7 > 0) {
                    field_7--;
                } else if (event.code == "ArrowLeft" && window[buttonCode] == "Add" && field_7 < 30) {
                    field_6++;
                } else if (event.code == "ArrowLeft" && window[buttonCode] == "Subtract" && field_6 > 0) {
                    field_6--;
                }
                counterSave("field_6");
                counterSave("field_7");
                break;

        }
    calculateAverage();
    calculatePercentage();

}

function buttonPress(inputId) {
    console.log("inputId is " + inputId);
    let buttonCode = 'add_Subtract' + String(inputId);
    let element = 'field' + String(inputId);
    let valueCode = element.replace('d', 'd_');
    if (inputId == "7") {
        buttonCode = 'add_Subtract' + String(parseInt(inputId)-1);
    }
    switch (inputId) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
            if (window[buttonCode] == "Add") {
                window[valueCode]++;
            } else if (window[buttonCode] == "Subtract" && window[valueCode] > 0) {
                window[valueCode]--;
            }
            break;
        case 6:
        case 7:
            if (window[buttonCode] == "Add" && field_7 < 30) {
                window[valueCode]++;
            } else if (window[buttonCode] == "Subtract" && window[valueCode] > 0) {
                window[valueCode]--;
            }
            break;
    }

    console.log("buttonCode is " + buttonCode);
    console.log("valueCode is " + valueCode);
    counterSave(valueCode);
    calculateAverage();
    calculatePercentage();
}




function calculatePercentage() {
    percent_Fetals = ((field_6 / thirty_Fields ) * 100).toFixed(1);
    counterSave("percent_Fetals");
}
