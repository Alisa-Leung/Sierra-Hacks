const modeDropdown = document.getElementById("modeDropdown");
modeDiv = document.getElementById("modeDiv");

modeDropdown.addEventListener("change", (event) => {
    const divContent = document.createElement("p");
    divContent.innerHTML = "Visually Impaired";
    if (modeDropdown.value == "visuallyImpaired") {
        modeDiv.appendChild(divContent);
    }
})