
window.field_1 = localStorage.getItem('field_1') || 0;
window.field_2 = localStorage.getItem('field_2') || 0;
window.field_3 = localStorage.getItem('field_3') || 0;
window.field_4 = localStorage.getItem('field_4') || 0;
window.field_5 = localStorage.getItem('field_5') || 0;
window.average_RBC = localStorage.getItem('average_RBC') || 0;
window.thirty_Fields = localStorage.getItem('thirty_Fields') || 0;
window.field_Count = localStorage.getItem('field_Count') || 0;
window.fetal_Count = localStorage.getItem('fetal_Count') || 0;
window.add_Subtract1 = localStorage.getItem('add_Subtract1') || "Add";
window.add_Subtract2 = localStorage.getItem('add_Subtract2') || "Add";
window.add_Subtract3 = localStorage.getItem('add_Subtract3') || "Add";
window.add_Subtract4 = localStorage.getItem('add_Subtract4') || "Add";
window.add_Subtract5 = localStorage.getItem('add_Subtract5') || "Add";
window.add_Subtract6 = localStorage.getItem('add_Subtract6') || "Add";
window.percent_Fetals = localStorage.getItem('percent_Fetals') || 0;


updateCounter();

function updateCounter() {
    document.getElementById("field1").textContent = field_1;
    document.getElementById("field2").textContent = field_2;
    document.getElementById("field3").textContent = field_3;
    document.getElementById("field4").textContent = field_4;
    document.getElementById("field5").textContent = field_5;
    document.getElementById("averageRBC").textContent = average_RBC;
    document.getElementById("thirtyFields").textContent = thirty_Fields;
    document.getElementById("fieldCount").textContent = field_Count;
    document.getElementById("fetalCount").textContent = fetal_Count;
    document.getElementById("addSubtract1").textContent = add_Subtract1;
    document.getElementById("addSubtract2").textContent = add_Subtract2;
    document.getElementById("addSubtract3").textContent = add_Subtract3;
    document.getElementById("addSubtract4").textContent = add_Subtract4;
    document.getElementById("addSubtract5").textContent = add_Subtract5;
    document.getElementById("addSubtract6").textContent = add_Subtract6;
    document.getElementById("percentFetals").textContent = percent_Fetals;
}

const buttonVariableMap = {
    "s1": "add_Subtract1",
    "s2": "add_Subtract2",
    "s3": "add_Subtract3",
    "s4": "add_Subtract4",
    "s5": "add_Subtract5",
    "s6": "add_Subtract6"
};

// window.fields = {
//     "field_1": localStorage.getItem('field_1') || 0,
//     "field_2": localStorage.getItem('field_2') || 0,
//     "field_3": localStorage.getItem('field_3') || 0,
//     "field_4": localStorage.getItem('field_4') || 0,
//     "field_5": localStorage.getItem('field_5') || 0,
//     // Add more fields as needed
// };

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
        field_Count = 0;
        fetal_Count = 0;
        counterSave("field_Count");
        counterSave("fetal_Count");
    }
    calculateAverage();
    calculatePercentage();
}

function counterSave(fieldValue) {
    localStorage.setItem(fieldValue, window[fieldValue]);
    document.getElementById(fieldValue.replace("_", "")).textContent = window[fieldValue];
}

function buttonChange(thisButton) {
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
    // switch (inputId) {
    //     case 1:
    //         keyMapping(event, inputId);
    //         break;
    //     case 2:
    //         keyMapping(event, inputId);
    //         break;
    //     case 3:
    //         keyMapping(event, inputId);
    //         break;
    //     case 4:
    //         keyMapping(event, inputId);
    //         break;
    //     case 5:
    //         keyMapping(event, inputId);
    //         break;
    //     case 6:
    //         keyMapping(event, inputId);
    //         break;
    // }

    let buttonCode = 'add_Subtract' + String(inputId);

        switch (inputId) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                let element = 'field' + String(inputId);
                let valueCode = element.replace('d', 'd_');
                if (event.code === "ArrowRight" &&  window[buttonCode] == "Add") {
                    window[valueCode]++;
                } else if (event.code === "ArrowRight" && window[buttonCode] == "Subtract" && window[valueCode] > 0) {
                    window[valueCode]--;
                }
                //document.getElementById(element).textContent = window[valueCode];
                counterSave(valueCode);
                break;
            case 6:
                if (event.code === "ArrowRight" &&  window[buttonCode] == "Add") {
                    fetal_Count++;
                } else if (event.code === "ArrowRight" && window[buttonCode] == "Subtract" && fetal_Count > 0) {
                    fetal_Count--;
                } else if (event.code === "ArrowLeft" && window[buttonCode] == "Add" && field_Count < 30) {
                    field_Count++;
                } else if (event.code === "ArrowLeft" && window[buttonCode] == "Subtract" && field_Count > 0) {
                    field_Count--;
                }
                counterSave("fetal_Count");
                counterSave("field_Count");
                break;

        }
    calculateAverage();
    calculatePercentage();

}


function calculatePercentage() {
    percent_Fetals = ((fetal_Count / thirty_Fields ) * 100).toFixed(1);
    counterSave("percent_Fetals");
}

// function keyMapping(event, inputId) {
//     let buttonCode = 'add_Subtract' + String(inputId);
//     let element = 'field' + String(inputId);
//     let valueCode = element.replace('d', 'd_');
//     console.log(event.code);
//     console.log(element);
//     console.log(valueCode);
//     if (event.code === "ArrowRight" &&  window[buttonCode] == "Add") {
//         window[valueCode]++;
//     } else if (event.code === "ArrowRight" && window[buttonCode] == "Subtract" && window[valueCode] > 0) {
//         window[valueCode]--;
//     }
//     document.getElementById(element).textContent = window[valueCode];
//     counterSave(valueCode);
// }

calculateAverage();
calculatePercentage();
