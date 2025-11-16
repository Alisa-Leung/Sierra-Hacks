document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const videoContainer = document.getElementById("videoContainer");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let stream = null;
    let cameraActive = false;
    let videoElement = null;
    const detectionResult = document.getElementById("detectionResult");
    let handDetector = null;
    let isDetecting = false;
    let animationId = null;
    
    async function loadHandDetector() {
        try {
            console.log("Loading hand detector...");
            detectionResult.textContent = "Loading hand detector...";
            
            if (typeof handpose === 'undefined') {
                throw new Error("HandPose library not loaded");
            }
            
            handDetector = await handpose.load();
            console.log("Hand detector loaded!");
            detectionResult.textContent = "Hand detector ready!";
            return true;
        } catch (err) {
            console.error("Error loading hand detector:", err);
            detectionResult.textContent = "Error: " + err.message;
            return false;
        }
    }
    
    // Draw hand landmarks on canvas
    function drawHandLandmarks(predictions, canvas, ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (predictions.length === 0) return;
        
        predictions.forEach(prediction => {
            const landmarks = prediction.landmarks;
            
            // Draw connections between joints
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index
                [0, 9], [9, 10], [10, 11], [11, 12], // Middle
                [0, 13], [13, 14], [14, 15], [15, 16], // Ring
                [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
                [5, 9], [9, 13], [13, 17] // Palm connections
            ];
            
            // Draw lines
            ctx.strokeStyle = "#7AB68C";
            ctx.lineWidth = 2;
            connections.forEach(([start, end]) => {
                ctx.beginPath();
                ctx.moveTo(landmarks[start][0], landmarks[start][1]);
                ctx.lineTo(landmarks[end][0], landmarks[end][1]);
                ctx.stroke();
            });
            
            // Draw joints
            landmarks.forEach((landmark, i) => {
                ctx.beginPath();
                ctx.arc(landmark[0], landmark[1], 4, 0, 2 * Math.PI);
                ctx.fillStyle = i === 0 ? "#17572a" : "#7AB68C"; // Wrist is darker
                ctx.fill();
                ctx.strokeStyle = "#021b09";
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        });
    }
    
    // Classify gesture based on hand landmarks
    function classifyGesture(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return null;
        }
        
        const hand = landmarks[0];
        
        // Key landmark indices
        const thumbTip = hand[4];
        const indexTip = hand[8];
        const middleTip = hand[12];
        const ringTip = hand[16];
        const pinkyTip = hand[20];
        const wrist = hand[0];
        const indexBase = hand[5];
        const middleBase = hand[9];
        
        // Calculate if fingers are extended
        const thumbUp = thumbTip[1] < wrist[1] - 30;
        const indexUp = indexTip[1] < indexBase[1];
        const middleUp = middleTip[1] < middleBase[1];
        const ringUp = ringTip[1] < wrist[1];
        const pinkyUp = pinkyTip[1] < wrist[1];
        
        // Count extended fingers
        const extendedCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
        
        // Simple gesture classification
        if (extendedCount === 0 && !thumbUp) {
            return { letter: "A", confidence: 0.7, description: "Fist (A)" };
        } else if (indexUp && !middleUp && !ringUp && !pinkyUp) {
            return { letter: "D", confidence: 0.65, description: "Pointing up (D/1)" };
        } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
            return { letter: "V", confidence: 0.6, description: "Peace sign (V/2)" };
        } else if (extendedCount === 4) {
            return { letter: "B", confidence: 0.5, description: "Open hand (B)" };
        } else if (thumbUp && !indexUp && !middleUp) {
            return { letter: "E", confidence: 0.55, description: "Thumb up (E)" };
        }
        
        return { letter: "?", confidence: 0.3, description: "Unknown gesture" };
    }
    
    // Detect hands continuously
    async function detectHands() {
        if (!isDetecting || !videoElement || !handDetector) return;
        
        try {
            const predictions = await handDetector.estimateHands(videoElement);
            
            // Draw landmarks on canvas
            const canvas = document.getElementById("outputCanvas");
            const ctx = canvas.getContext("2d");
            drawHandLandmarks(predictions, canvas, ctx);
            
            if (predictions.length > 0) {
                const gesture = classifyGesture(predictions);
                if (gesture && gesture.confidence > 0.4) {
                    detectionResult.textContent = `${gesture.letter} - ${gesture.description}`;
                    detectionResult.style.color = "#17572a";
                    detectionResult.style.fontWeight = "bold";
                } else {
                    detectionResult.textContent = "Hand detected - hold steady";
                    detectionResult.style.color = "#666";
                }
            } else {
                detectionResult.textContent = "No hand detected";
                detectionResult.style.color = "#999";
                detectionResult.style.fontWeight = "normal";
            }
            
        } catch (err) {
            console.error("Detection error:", err);
        }
        
        // Continue loop
        if (isDetecting) {
            animationId = requestAnimationFrame(detectHands);
        }
    }
    
    // Start detection
    function startDetection() {
        if (isDetecting || !handDetector) return;
        isDetecting = true;
        console.log("Starting hand detection...");
        detectHands();
    }
    
    // Stop detection
    function stopDetection() {
        isDetecting = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        detectionResult.textContent = "";
        console.log("Stopped hand detection");
    }
    
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive){
            try{
                console.log("Requesting camera access...");
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
                videoElement.muted = true;
                videoElement.setAttribute('width', '280');
                videoElement.setAttribute('height', '210');
                videoElement.srcObject = stream;
                
                videoElement.onloadedmetadata = async () => {
                    await videoElement.play().catch(err => {
                        console.error("Error playing video:", err);
                    });
                    
                    // Setup canvas overlay
                    const canvas = document.getElementById("outputCanvas");
                    canvas.width = 280;
                    canvas.height = 210;
                    canvas.style.display = "block";
                    
                    // Load hand detector if not loaded
                    if (!handDetector) {
                        await loadHandDetector();
                    }
                    
                    // Start detection after 1.5 seconds
                    if (handDetector) {
                        setTimeout(() => startDetection(), 1500);
                    }
                };
                
                videoContainer.appendChild(videoElement);
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
                
            } catch (err){
                console.error("Error accessing camera:", err);
                alert("Could not access camera. Please check permissions.")
            }
        } else{
            console.log("Stopping camera...")
            stopDetection();
            
            // Hide canvas
            const canvas = document.getElementById("outputCanvas");
            canvas.style.display = "none";
            
            if (stream){
                stream.getTracks().forEach(track => track.stop());
            }
            if (videoElement){
                videoElement.remove();
                videoElement = null;
            }
            toggleCameraBtn.textContent = "Start Camera";
            cameraActive = false;
            stream = null;
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