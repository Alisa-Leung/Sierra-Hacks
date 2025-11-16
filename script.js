document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const videoContainer = document.getElementById("videoContainer");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let stream = null;
    let cameraActive = false;
    let videoElement = null;
    let isDetecting = false;
    let animationId = null;
    
    // Detect hand using skin color
    function detectHand(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        let skinPixels = [];
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Skin color detection
            if (r > 95 && g > 40 && b > 20 &&
                r > g && r > b &&
                Math.abs(r - g) > 15 &&
                r - b > 15) {
                const x = (i / 4) % width;
                const y = Math.floor((i / 4) / width);
                skinPixels.push({ x, y });
            }
        }
        
        return skinPixels;
    }
    
    // Draw hand visualization
    function drawHand(skinPixels, ctx, width, height) {
        if (skinPixels.length < 100) return null;
        
        // Find boundaries
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let sumX = 0, sumY = 0;
        
        skinPixels.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
            sumX += p.x;
            sumY += p.y;
        });
        
        const centerX = sumX / skinPixels.length;
        const centerY = sumY / skinPixels.length;
        const handWidth = maxX - minX;
        const handHeight = maxY - minY;
        
        // Draw bounding box
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 3;
        ctx.strokeRect(minX, minY, handWidth, handHeight);
        
        // Draw center point
        ctx.beginPath();
        ctx.arc(centerX, centerY, 10, 0, 2 * Math.PI);
        ctx.fillStyle = "#17572a";
        ctx.fill();
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw corner markers
        const markerSize = 15;
        ctx.strokeStyle = "#17572a";
        ctx.lineWidth = 3;
        
        // Top-left
        ctx.beginPath();
        ctx.moveTo(minX, minY + markerSize);
        ctx.lineTo(minX, minY);
        ctx.lineTo(minX + markerSize, minY);
        ctx.stroke();
        
        // Top-right
        ctx.beginPath();
        ctx.moveTo(maxX - markerSize, minY);
        ctx.lineTo(maxX, minY);
        ctx.lineTo(maxX, minY + markerSize);
        ctx.stroke();
        
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(minX, maxY - markerSize);
        ctx.lineTo(minX, maxY);
        ctx.lineTo(minX + markerSize, maxY);
        ctx.stroke();
        
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(maxX - markerSize, maxY);
        ctx.lineTo(maxX, maxY);
        ctx.lineTo(maxX, maxY - markerSize);
        ctx.stroke();
        
        return {
            width: handWidth,
            height: handHeight,
            pixelCount: skinPixels.length
        };
    }
    
    // Classify basic gestures
    function classifyGesture(handInfo) {
        if (!handInfo) return null;
        
        const aspectRatio = handInfo.width / handInfo.height;
        const size = Math.sqrt(handInfo.width * handInfo.width + handInfo.height * handInfo.height);
        
        if (size < 60) {
            return { letter: "A", description: "Closed fist" };
        } else if (aspectRatio > 1.4) {
            return { letter: "B", description: "Open hand (wide)" };
        } else if (aspectRatio < 0.6) {
            return { letter: "D", description: "Pointing gesture" };
        } else if (size > 120) {
            return { letter: "B", description: "Open hand (large)" };
        } else {
            return { letter: "Hand", description: "Hand detected" };
        }
    }
    
    // Main detection loop
    async function detectLoop() {
        if (!isDetecting || !videoElement) return;
        
        try {
            const canvas = document.getElementById("outputCanvas");
            const ctx = canvas.getContext("2d");
            
            // Draw video frame
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            // Detect hand
            const skinPixels = detectHand(ctx, canvas.width, canvas.height);
            
            // Clear and redraw
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const handInfo = drawHand(skinPixels, ctx, canvas.width, canvas.height);
            
            // Show result
            if (handInfo) {
                const gesture = classifyGesture(handInfo);
                detectionResult.textContent = `${gesture.letter} - ${gesture.description}`;
                detectionResult.style.color = "#17572a";
                detectionResult.style.fontWeight = "bold";
            } else {
                detectionResult.textContent = "No hand detected - show your palm";
                detectionResult.style.color = "#999";
                detectionResult.style.fontWeight = "normal";
            }
            
        } catch (err) {
            console.error("Detection error:", err);
        }
        
        if (isDetecting) {
            animationId = requestAnimationFrame(detectLoop);
        }
    }
    
    function startDetection() {
        if (isDetecting) return;
        isDetecting = true;
        detectionResult.textContent = "Starting detection...";
        detectLoop();
    }
    
    function stopDetection() {
        isDetecting = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        detectionResult.textContent = "";
    }
    
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive) {
            try {
                console.log("Requesting camera access...");
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 280 }, height: { ideal: 210 } },
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
                    await videoElement.play();
                    
                    const canvas = document.getElementById("outputCanvas");
                    canvas.width = 280;
                    canvas.height = 210;
                    canvas.classList.add('active');
                    
                    setTimeout(() => startDetection(), 500);
                };
                
                videoContainer.appendChild(videoElement);
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
                
            } catch (err) {
                console.error("Camera error:", err);
                alert("Camera error: " + err.message);
            }
        } else {
            console.log("Stopping camera...");
            stopDetection();
            
            const canvas = document.getElementById("outputCanvas");
            canvas.classList.remove('active');
            
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (videoElement) {
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