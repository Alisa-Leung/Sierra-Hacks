document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const video = document.getElementById("cameraVideo");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let stream = null;
    let cameraActive = false;
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive){
            try{
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: {ideal: 640},
                        height: {ideal: 480}
                    },
                    audio:false
                });
                video.srcObject = stream;
                video.style.display = "block";
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
            } catch (err){
                console.error("Erorr accessing camera:", err);
                alert("Could not access camera. Please check permissions.")
            }
        } else{
            if (stream){
                stream.getTracks().forEach(track => track.stop());
                video.srcObject = null;
                video.style.display = null;
                video.style.display = "none";
                toggleCameraBtn.textContent = "Start Camera";
                cameraActive = false;
            }
        }
    })
    //this code adds content to the html file based on content
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");
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