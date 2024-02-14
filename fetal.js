let field_1 = localStorage.getItem('field_1') || 0;
let field_2 = localStorage.getItem('field_2') || 0;
let field_3 = localStorage.getItem('field_3') || 0;
let field_4 = localStorage.getItem('field_4') || 0;
let field_5 = localStorage.getItem('field_5') || 0;

let average_RBC = localStorage.getItem('average_RBC') || 0;
let thirty_Fields = localStorage.getItem('thirty_Fields') || 0;
let field_Count = localStorage.getItem('field_Count') || 0;
let fetal_Count = localStorage.getItem('fetal_Count') || 0;
let add_Subtract1 = localStorage.getItem('add_Subtract1') || "Add";
let add_Subtract2 = localStorage.getItem('add_Subtract2') || "Add";
let add_Subtract3 = localStorage.getItem('add_Subtract3') || "Add";
let add_Subtract4 = localStorage.getItem('add_Subtract4') || "Add";
let add_Subtract5 = localStorage.getItem('add_Subtract5') || "Add";
let add_Subtract6 = localStorage.getItem('add_Subtract6') || "Add";
let percent_Fetals = localStorage.getItem('percent_Fetals') || 0;

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
    document.getElementById("switch1").textContent = add_Subtract1;
    document.getElementById("switch2").textContent = add_Subtract2;
    document.getElementById("switch3").textContent = add_Subtract3;
    document.getElementById("switch4").textContent = add_Subtract4;
    document.getElementById("switch5").textContent = add_Subtract5;
    document.getElementById("switch6").textContent = add_Subtract6;
    document.getElementById("percentFetals").textContent = percent_Fetals;

}
