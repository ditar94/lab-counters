let rbc_1 = 0;
let rbc_2 = 0;
let tnc_1 = 0;
let tnc_2 = 0;
let buttonStateH1 = "Add";
let buttonStateH2 = "Add";
document.addEventListener("click", inputSwitcher);

function inputSwitcher() {
    var toggleBox = document.querySelectorAll('.hide');
    var toggleCount = document.querySelectorAll('.final');
    let RBCTNCMatch;
    if (document.getElementById('separate-counts').checked) {
        for (i=0; i<toggleBox.length;i++) {
            document.querySelectorAll('.hide')[i].style.display = 'flex';
        }
    } else {
        for (i=0; i<toggleBox.length;i++) {
            document.querySelectorAll('.hide')[i].style.display = 'none';
        }
    }

    if (document.getElementById('toggle-prelim').checked) {
            document.querySelectorAll('.prelim-calc-group')[0].style.display = 'flex';
    } else {
            document.querySelectorAll('.prelim-calc-group')[0].style.display = 'none';
    }

    if (document.getElementById('side1-done').checked && document.getElementById('side2-done').checked) {
        for (i=0; i<toggleCount.length;i++) {
            document.querySelectorAll('.final')[i].style.visibility= 'visible';
            document.querySelectorAll('.final')[i].classList.remove("pseudo");
            document.getElementById('err').style.display= 'block';
            document.getElementsByClassName('showyourwork-group')[0].style.display= 'flex';
        }
        RBCTNCMatch = matchLogic();

        switch (true) {
            case RBCTNCMatch[0] && RBCTNCMatch[1]:
                console.log('both are true');
                setButtonStyle([0, 1, 4, 5], 'green', 'green');
                document.getElementById('err').style.display='none';
                break;
            case RBCTNCMatch[0] && !RBCTNCMatch[1]:
                console.log('tnc doesnt match');
                setButtonStyle([1, 5], 'red', 'red');
                setButtonStyle([0, 4], 'green', 'green');
                document.getElementById('err').textContent = RBCTNCMatch[3];
                break;
            case !RBCTNCMatch[0] && RBCTNCMatch[1]:
                console.log('rbc doesnt match');
                setButtonStyle([0, 4], 'red', 'red');
                setButtonStyle([1, 5], 'green', 'green');
                document.getElementById('err').textContent = RBCTNCMatch[2];
                break;
            default:
                console.log('both are false');
                setButtonStyle([0, 1, 4, 5], 'red', 'red');
                document.getElementById('err').textContent='Counts are too far apart!';
                break;
        }


    } else {
        for (i=0; i<toggleCount.length;i++) {
            document.querySelectorAll('.final')[i].style.visibility= 'hidden';
            document.querySelectorAll('.final')[i].classList.add("pseudo");
            document.getElementById('err').style.display = 'none';
            document.getElementsByClassName('showyourwork-group')[0].style.display= 'none';

        }
        setButtonStyle([0, 1, 4, 5], 'black', 'black');

    }

    if (document.getElementById('side1-done').checked) {
        for (i=0; i<4;i++) {
            document.getElementsByTagName('button')[i].disabled=true;
            document.querySelectorAll("input[type='text']")[0].disabled=true;
            document.querySelectorAll("input[type='text']")[0].placeholder="Counter Disabled";

        }
    } else {
        for (i=0; i<4;i++) {
            document.getElementsByTagName('button')[i].disabled=false;
            document.querySelectorAll("input[type='text']")[0].disabled=false;
            document.querySelectorAll("input[type='text']")[0].placeholder="Click here to count";
        }
    }

    if (document.getElementById('side2-done').checked) {
        for (i=4; i<8;i++) {
            document.getElementsByTagName('button')[i].disabled=true;
            document.querySelectorAll("input[type='text']")[1].disabled=true;
            document.querySelectorAll("input[type='text']")[1].placeholder="Counter Disabled";
        }
    } else {
        for (i=4; i<8;i++) {
            document.getElementsByTagName('button')[i].disabled=false;
            document.querySelectorAll("input[type='text']")[1].disabled=false;
            document.querySelectorAll("input[type='text']")[1].placeholder="Click here to count";
        }
    }

    calculateCount();
}


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
    calculateCount();
}
function keyStroke(event, inputId) {
    if (inputId === "input1") {
        if (event.key === "1" && buttonStateH1 == "Add") {
            rbc_1++;
        } else if (event.key === "1" && buttonStateH1 == "Subtract" && rbc_1 > 0) {
            rbc_1--;
        } else if (event.key === "3" && buttonStateH1 == "Add") {
            tnc_1++;
        } else if (event.key === "3" && buttonStateH1 == "Subtract" && tnc_1 > 0) {
            tnc_1--;
        }
    } else if (inputId === "input2") {
        if (event.key === "1" && buttonStateH2 == "Add") {
            rbc_2++;
        } else if (event.key === "1" && buttonStateH2 == "Subtract" && rbc_2 > 0) {
            rbc_2--;
        } else if (event.key === "3" && buttonStateH2 == "Add") {
            tnc_2++;
        } else if (event.key === "3" && buttonStateH2 == "Subtract" && tnc_2 > 0) {
            tnc_2--;
        }
    }
    calculateCount();
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
    // counterSave();
}

// function counterSave() {
//     localStorage.setItem('rbc_1', rbc_1);
//     document.getElementById("rbc1").textContent = rbc_1;
//     localStorage.setItem('rbc_2', rbc_2);
//     document.getElementById("rbc2").textContent = rbc_2;
//     localStorage.setItem('tnc_1', tnc_1);
//     document.getElementById("tnc1").textContent = tnc_1;
//     localStorage.setItem('tnc_2', tnc_2);
//     document.getElementById("tnc2").textContent = tnc_2;
// }


function calculateCount() {
    updateCounter();
    let dilution1;
    let squares1;
    let dilution2;
    let squares2;
    dilution1 = document.getElementById("dilution1").value;
    squares1 = parseFloat(document.getElementById("squares1").value);
    if (document.getElementById('separate-counts').checked) {
        dilution2 = document.getElementById("dilution2").value;
        squares2 = parseFloat(document.getElementById("squares2").value);
    } else {
        dilution2 = dilution1;
        squares2 = squares1;
    }
    let rbcCount;
    let rbcAvg = (parseInt(rbc_1) + parseInt(rbc_2)) / 2;
    let tncCount;
    let tncAverage = (parseInt(tnc_1) + parseInt(tnc_2)) / 2;
    let prelimRBC1 = 10 * dilution1 * parseInt(rbc_1) / squares1;
    let prelimRBC2 = 10 * dilution1 * parseInt(rbc_2) / squares1;
    let prelimTNC1 = 10 * dilution2 * parseInt(tnc_1) / squares2;
    let prelimTNC2 = 10 * dilution2 * parseInt(tnc_2) / squares2;
    rbcCount = 10 * dilution1 * rbcAvg / squares1 ;
    tncCount = 10 * dilution2 * tncAverage / squares2 ;

    document.getElementById("rbcCount").textContent = Math.round(rbcCount);
    document.getElementById("tncCount").textContent = Math.round(tncCount);
    // document.getElementsById("avgRBC").textContent = Math.round(rbcAvg);

    document.getElementById("rbcCount_1").textContent = Math.round(prelimRBC1);
    document.getElementById("rbcCount_2").textContent = Math.round(prelimRBC2);
    document.getElementById("tncCount_1").textContent = Math.round(prelimTNC1);
    document.getElementById("tncCount_2").textContent = Math.round(prelimTNC2);
    document.getElementById("calcAvRBC").textContent = rbcAvg;
    document.getElementById("calcAvTNC").textContent = tncAverage;
    document.getElementById("calcDilRBC").textContent = dilution1;
    document.getElementById("calcSquaresRBC").textContent = squares1;
    document.getElementById("calcDilTNC").textContent = dilution2;
    document.getElementById("calcSquaresTNC").textContent = squares2;
    document.getElementById("calcCountRBC").textContent = " " + Math.round(rbcCount);
    document.getElementById("calcCountTNC").textContent = " " + Math.round(tncCount);

    // counterSave();


}


function matchLogic() {
    console.log("rbc_1 = " + rbc_1 + ", rbc_2 = " + rbc_2 + ", tnc_1 = " + tnc_1 + ", tnc_2 = " + tnc_2);
    let matchRBCTNC = [false,false,'RBC counts are too far apart!','TNC counts are too far apart!'];
    if ((parseInt(rbc_1) < 10) || (parseInt(rbc_2)< 10) ) {
        let rbcDiff = Math.abs(parseInt(rbc_2)-parseInt(rbc_1));
        console.log("rbcDiff = " + rbcDiff);
        console.log("RBC is less than 10");
        if (rbcDiff <= 5) {
            matchRBCTNC[0] = true;
            matchRBCTNC[2] = 'RBC counts match';
        }
    } else {
        let percentDiffefenceRBC = 100 * Math.abs(parseInt(rbc_1)-parseInt(rbc_2))/((parseInt(rbc_1)+parseInt(rbc_2))/2);
        console.log("percentDiffefenceRBC is = " + percentDiffefenceRBC);
        if (percentDiffefenceRBC <= 20) {
            matchRBCTNC[0] = true;
            matchRBCTNC[2] = 'RBC counts match';
        } else {
            matchRBCTNC[0] = false;
            matchRBCTNC[2] = 'RBC counts are too far apart!';
        }
    }

    if ((parseInt(tnc_1) < 10) || (parseInt(tnc_2)< 10) ) {
        let tncDiff = Math.abs(parseInt(tnc_2)-parseInt(tnc_1));
        console.log("tncDiff = " + tncDiff);

        // for (i=0;i<6;i++) {
        //     if ((parseInt(tnc_1)-i == parseInt(tnc_2))||(parseInt(tnc_1)+i == parseInt(tnc_2))){
        //         matchRBCTNC[1] = true;
        //     }
        // }
        console.log("TNC is less than 10");
        if (tncDiff <= 5) {
            matchRBCTNC[1] = true;
            matchRBCTNC[3] = 'TNC counts match';
        }
    } else {
        let percentDiffefenceTNC = 100 * Math.abs(parseInt(tnc_1)-parseInt(tnc_2))/((parseInt(tnc_1)+parseInt(tnc_2))/2);
        console.log("percentDifferenceTNC = " + percentDiffefenceTNC);

        if (percentDiffefenceTNC <= 20) {
            matchRBCTNC[1] = true;
            matchRBCTNC[3] = 'TNC counts match';
        } else {
            matchRBCTNC[1] = false;
            matchRBCTNC[3] = 'TNC counts are too far apart!';
        }
    }

    console.log(matchRBCTNC);
    return matchRBCTNC;
}

function setButtonStyle(buttonIndices, borderColor, textColor) {
    buttonIndices.forEach(index => {
        const button = document.getElementsByTagName('button')[index];
        button.style.border = `1px solid ${borderColor}`;
        button.style.color = textColor;
    });
}
// // Test values

// rbc_1 =200;
// rbc_2 =220;
// tnc_1 = 0;
// tnc_2 = 6;
