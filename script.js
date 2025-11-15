document.addEventListener("DOMContentLoaded", () => {
    //this code adds content to the html file based on content
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");
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
            } else if (event.target.value === "hardOfHearing"){
                divContent.innerHTML = "Hard of Hearing";
            } else if (event.target.value === "speakingDifficulty"){
                divContent.innerHTML = "Speaking Difficulty";
            }
        }
        modeDiv.appendChild(divContent);
    })
})