document.addEventListener("DOMContentLoaded", () => {
    //this code adds content to the html file based on content
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");
    //creates on/off switch element
    modeDropdown.addEventListener("change", (event) => {
        const existingContent = document.getElementById("divContent");
        if (existingContent){
            existingContent.remove();
        }
        const divContent = document.createElement("p");
        if (event.target.value){
            divContent.id = "divContent";
            if (event.target.value === "visuallyImpaired"){
                divContent.innerHTML = "Visually Impaired";
                createSwitch
            } else if (event.target.value === "hardOfHearing"){
                divContent.innerHTML = "Hard of Hearing";
                createSwitch
            } else if (event.target.value === "speakingDifficulty"){
                divContent.innerHTML = "Speaking Difficulty";
                createSwitch
            }
        }
        modeDiv.appendChild(divContent);
    })    
})

function createSwitch(){
    const onOffSwitch = document.createElement("label");
    onOffSwitch.class = "switch";
    onOffSwitch.appendChild("input");
    onOffSwitch.firstChild.type = "checkbox";
    onOffSwitch.appendChild("span");
    onOffSwitch.lastChild.class = "slider round";
    modeDiv.appendChild(onOffSwitch);
}