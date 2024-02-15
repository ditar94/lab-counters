
let field_1 = localStorage.getItem('field_1') || 0;
let field_2 = localStorage.getItem('field_2') || 0;
let field_3 = localStorage.getItem('field_3') || 0;
let field_4 = localStorage.getItem('field_4') || 0;
let field_5 = localStorage.getItem('field_5') || 0;
console.log(localStorage.getItem('field_1'));
let average_RBC = localStorage.getItem('average_RBC') || 0;
let thirty_Fields = localStorage.getItem('thirty_Fields') || 0;
let field_Count = localStorage.getItem('field_Count') || 0;
let fetal_Count = localStorage.getItem('fetal_Count') || 0;
let add_Subtract1 = localStorage.getItem('add_Subtract1') || "Add";
let add_Subtract2 = localStorage.getItem('add_Subtract2') || "Add";
let add_Subtract3 = localStorage.getItem('add_Subtract3') || "Add";
let add_Subtract4 = localStorage.getItem('add_Subtract4') || "Add";
let add_Subtract5 = localStorage.getItem('add_Subtract5') || "Add";
//let add_Subtract6 = localStorage.getItem('add_Subtract6') || "Add";
let percent_Fetals = localStorage.getItem('percent_Fetals') || 0;


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
    //document.getElementById("addSubtract6").textContent = add_Subtract6;
    document.getElementById("percentFetals").textContent = percent_Fetals;
}

let fields = {
    "field_1": localStorage.getItem('field_1') || 0,
    "field_2": localStorage.getItem('field_2') || 0,
    "field_3": localStorage.getItem('field_3') || 0,
    "field_4": localStorage.getItem('field_4') || 0,
    "field_5": localStorage.getItem('field_5') || 0,
    // Add more fields as needed
};

function resetCounter(thisCounter) {
    console.log("Button clicked:", thisCounter);
    let pass;
    if (thisCounter == "r1") {
        field_1 = 0;
        pass = "field_1";
    } else if (thisCounter == "r2") {
        field_2 = 0;
        pass = 'field_2';
    } else if (thisCounter == "r3") {
        field_3 = 0;
        pass = "field_3";
    } else if (thisCounter == "r4") {
        field_4 = 0;
        pass = "field_4";
    } else if (thisCounter == "r5") {
        field_5 = 0;
        pass = "field_5";
    } else if (thisCounter == "r6") {
        field_Count = 0;
        pass = "field_Count";
    }

    //this is a test, normally it would be counterSave(pass)
    counterSave("field_2");
}

function counterSave(fieldValue) {
    console.log(fieldValue);
    console.log(window[fieldValue]);
    localStorage.setItem(fieldValue, window[fieldValue]);
    document.getElementById(fieldValue.replace("_", "")).textContent = window[fieldValue];
}

function buttonChange(thisButton) {
    console.log(localStorage.getItem('field_5'));
    console.log("Button clicked:", thisButton);
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
        localStorage.setItem(currentButton, window[currentButton]);
        document.getElementById(currentButton.replace("_", "")).textContent = window[currentButton];
    };

    console.log("When buttonChange runs, thisButton is ", thisButton);
    console.log(window[currentButton] == "Add");
    console.log("When buttonChange runs, currentButton is ", currentButton);
    console.log("When buttonChange runs, window[currentButton] is ", window[currentButton]);
    console.log(localStorage.getItem('field_5'));
}

function calculateAverage() {
    average_RBC = (field_1 + field_2 + field_3 + field_4 + field_5) / 5;
    thirty_Fields = average_RBC * 30;
    counterSave("average_RBC");
    counterSave("thirty_Fields");
}
