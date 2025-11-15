document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const videoContainer = document.getElementById("videoContainer");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let stream = null;
    let cameraActive = false;
    let videoElement = null;
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive){
            try{
                stream = await navigator.mediaDevices.getUserMedia({
                    video:{
                        width:{ideal:280},
                        height:{ideal: 210}
                    },
                    audio: false
                });
                videoElement = document.createElement("video");
                videoElement.autoplay = true;
                videoElement.playsinline = true;
                videoElement.style.width = "280px";
                videoElement.style.height = "210px";
                videoElement.style.borderRadius = "8px";
                videoElement.style.border = "2px solid #7AB68C";
                videoElement.srcObject = stream;
                videoContainer.appendChild(videoElement);
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
            } catch (err){
                console.error("Error accessing camera:", err);
                alert("Could not access camera. Please check permissions.")
            }
        } else{
            if (stream){
                stream.getTracks().forEach(track => track.stop());
            }
            if (videoElement){
                videoElement.remove();
                videoElement = null;
            }
            toggleCameraBtn.textContext = "Start Camera";
            cameraActive = false;
        }
    });
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