document.addEventListener("DOMContentLoaded", () => {
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");

    modeDropdown.addEventListener("change", (event) => {
        const existingContent = document.getElementById("divContent");
        if (existingContent){
            existingContent.remove();
        }

        if (event.target.value){
            const divContent = document.createElement("p");
            divContent.id = "divContent";

            if (event.target.value === "visuallyImpaired"){
                divContent.innerHTML = "Visually Impaired Mode Selected";
            } else if (event.target.value === "hardOfHearing"){
                divContent.innerHTML = "Hard of Hearing Mode Selected";
            } else if (event.target.value === "speakingDifficulty"){
                divContent.innerHTML = "Speaking Difficulty Mode Selected";
            }

            modeDiv.appendChild(divContent);
        }
    });
});
