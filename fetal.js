
let field_1 = 0;
let field_2 = 0;
let field_3 = 0;
let field_4 = 0;
let field_5 = 0;
let average_RBC = 0;
let thirty_Fields = 0;
let five_Fields = 0;
let field_7 = 0;
let field_6 = 0;
let add_Subtract1 = "Add";
let add_Subtract2 = "Add";
let add_Subtract3 = "Add";
let add_Subtract4 = "Add";
let add_Subtract5 = "Add";
let add_Subtract6 = "Add";
let percent_Fetals = 0;
let testNum = 0;
document.addEventListener("click", inputSwitcher);
document.addEventListener("input", updateValue);


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
    document.getElementById("fiveFields").textContent = five_Fields;
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
    if (thisCounter == "r1") {
        field_1 = 0;
    } else if (thisCounter == "r2") {
        field_2 = 0;
    } else if (thisCounter == "r3") {
        field_3 = 0;
    } else if (thisCounter == "r4") {
        field_4 = 0;
    } else if (thisCounter == "r5") {
        field_5 = 0;
    } else if (thisCounter == "r6") {
        field_7 = 0;
        field_6 = 0;
    }
    calculateAverage();
    calculatePercentage();
    updateCounter();
}

// function counterSave(fieldValue) {
//     document.getElementById(fieldValue.replace("_", "")).textContent = eval(fieldValue);
//     if (document.getElementById('noCounter').checked) {
//         field_2 = field_1;
//         field_3 = field_1;
//         field_4 = field_1;
//         field_5 = field_1;
//     }
// }

function buttonChange(thisButton) {
    // const buttonVariableMap = {
    //     "s1": "add_Subtract1",
    //     "s2": "add_Subtract2",
    //     "s3": "add_Subtract3",
    //     "s4": "add_Subtract4",
    //     "s5": "add_Subtract5",
    //     "s6": "add_Subtract6"
    // };
    // const currentButton = buttonVariableMap[thisButton];
    // if (currentButton && eval(currentButton) {
    //     eval(currentButton) = (eval(currentButton) == "Add") ? "Subtract" : "Add";
    //     counterSave(currentButton);
    // };
    console.log("thisButton is " + thisButton);
    console.log("eval(thisButton) is " + eval(thisButton));

    (eval(thisButton) == 'Add') ? eval(thisButton + "= 'Subtract'"): eval(thisButton + "= 'Add'");
    updateCounter();


    // currentButton = (eval(eval(currentButton)) == "Add") ? "Subtract" : "Add";
    // updateCounter();

}

function calculateAverage() {
    average_RBC = (parseInt(field_1) + parseInt(field_2) + parseInt(field_3) + parseInt(field_4) + parseInt(field_5)) / 5;
    thirty_Fields = parseInt(average_RBC * 30);
    five_Fields = (parseInt(field_1) + parseInt(field_2) + parseInt(field_3) + parseInt(field_4) + parseInt(field_5));
    updateCounter()
}

function keyStroke(event, inputId) {
    let buttonCode = 'add_Subtract' + String(inputId);
    console.log("The event.key is: " + event.key);
    let valueCode = 'field_' + String(inputId);
    console.log("TestNum is: " + String(testNum));
    console.log("valueCode is: " + String(valueCode));
    console.log("eval(valueCode) is: " + String(eval(valueCode)));
    console.log("eval(buttonCode) is: " + String(eval(buttonCode)));




        switch (inputId) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
                if (event.key == "3" && eval(buttonCode) == "Add") {
                    eval(valueCode + '++');
                    testNum++;
                    console.log("TestNum is: " + String(testNum));
                } else if (event.key == "3" && eval(buttonCode) == "Subtract" && eval(valueCode)> 0) {
                    eval(valueCode + '--');
                }
                break;
            case 6:
                if (event.key == "3" &&  eval(buttonCode) == "Add" && field_7 < 30) {
                    field_7++;
                } else if (event.key == "3" && eval(buttonCode) == "Subtract" && field_7 > 0) {
                    field_7--;
                } else if (event.key == "1" && eval(buttonCode) == "Add" && field_7 < 30) {
                    field_6++;
                } else if (event.key == "1" && eval(buttonCode) == "Subtract" && field_6 > 0) {
                    field_6--;
                }
                break;

        }
    updateCounter();
    calculateAverage();
    calculatePercentage();

}

function buttonPress(inputId) {
    console.log("inputId is " + inputId);
    let buttonCode = 'add_Subtract' + String(inputId);
    let valueCode = 'field_' + String(inputId);
    if (inputId == "7") {
        buttonCode = 'add_Subtract' + String(parseInt(inputId)-1);
    }
    console.log("TestNum is: " + String(testNum));
    switch (inputId) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
            if (eval(buttonCode) == "Add") {
                eval(valueCode + '++');
                testNum++;
                console.log("TestNum is: " + String(testNum));

            } else if (eval(buttonCode) == "Subtract" && eval(valueCode) > 0) {
                eval(valueCode + '--');
            }
            break;
        case 6:
        case 7:
            if (eval(buttonCode) == "Add" && field_7 < 30) {
                eval(valueCode + '++');
            } else if (eval(buttonCode) == "Subtract" && eval(valueCode) > 0) {
                eval(valueCode + '--');
            }
            break;
    }
    updateCounter();
    calculateAverage();
    calculatePercentage();
}




function calculatePercentage() {
    percent_Fetals = ((field_6 / thirty_Fields ) * 100).toFixed(1);
    updateCounter();
}
