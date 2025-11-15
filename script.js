document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let cameraActive = false;
    Webcam.set ({
        width : 280,
        height: 210,
        image_format: 'jpeg',
        jpeg_quality: 90
    });
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive){
            try{
                Webcam.attach("#videoContainer");
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
            } catch (err){
                console.error("Error accessing camera:", err);
                alert("Could not access camera. Please check permissions.")
            }
        } else{
            Webcam.reset();
            toggleCameraBtn.textContext = "Start Camera";
            cameraActive = false;
        }
    })
    //this code adds content to the html file based on content
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");
    
    const camera = document.getElementById("videoContainer");
    Webcam.attach('#videoContainer');
    //creates on/off switch element
    modeDropdown.addEventListener("change", (event) => {
        const existingContent = document.getElementById("divContent");
        if (existingContent){
            existingContent.remove();
        }
        const existingSwitch = document.getElementById("toggleSwitch");
        if (existingSwitch){
            existingSwitch.remove();
        }
        const divContent = document.createElement("p");
        if (event.target.value){
            divContent.id = "divContent";
            if (event.target.value === "visuallyImpaired"){
                divContent.innerHTML = "Visually Impaired";
                createSwitch();
            } else if (event.target.value === "hardOfHearing"){
                divContent.innerHTML = "Hard of Hearing";
                createSwitch();
            } else if (event.target.value === "speakingDifficulty"){
                divContent.innerHTML = "Speaking Difficulty";
                createSwitch();
            }
        }
        modeDiv.appendChild(divContent);
    })
});

function createSwitch(){
    const onOffSwitch = document.createElement("label");
    onOffSwitch.className = "switch";
    onOffSwitch.id = "toggleSwitch";
    const input = document.createElement("input");
    input.type = "checkbox";
    const span = document.createElement("span");
    span.className = "slider round";
    onOffSwitch.appendChild(input);
    onOffSwitch.appendChild(span);
    modeDiv.appendChild(onOffSwitch);
}