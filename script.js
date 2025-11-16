document.addEventListener("DOMContentLoaded", () => {
    //camera stuff
    const videoContainer = document.getElementById("videoContainer");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    let stream = null;
    let cameraActive = false;
    let videoElement = null;
    let isDetecting = false;
    let animationId = null;
    let lastGesture = null;
    let gestureStartTime = 0;
    
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
    
    // Find convex hull points (fingertips)
    function findConvexityDefects(skinPixels) {
        if (skinPixels.length < 100) return [];
        
        // Find the topmost points (potential fingertips)
        let topPoints = [];
        const gridSize = 25;
        const grid = {};
        
        // Divide into grid and find highest point in each cell
        skinPixels.forEach(p => {
            const key = `${Math.floor(p.x / gridSize)}_${Math.floor(p.y / gridSize)}`;
            if (!grid[key] || p.y < grid[key].y) {
                grid[key] = p;
            }
        });
        
        // Get all high points
        Object.values(grid).forEach(p => {
            topPoints.push(p);
        });
        
        // Sort by y coordinate (top to bottom)
        topPoints.sort((a, b) => a.y - b.y);
        
        // Keep only the top 20% of points and push them down slightly
        const topThreshold = topPoints[Math.floor(topPoints.length * 0.2)]?.y || 0;
        topPoints = topPoints.filter(p => p.y <= topThreshold + 40);
        
        // Adjust points downward to better match fingertips (move down by 15-20 pixels)
        topPoints = topPoints.map(p => ({ x: p.x, y: p.y + 18 }));
        
        return topPoints;
    }
    
    // Count extended fingers based on top points
    function countFingers(topPoints, handWidth) {
        if (topPoints.length < 2) return 0;
        
        // Cluster nearby points
        const clusters = [];
        const minDistance = handWidth * 0.15; // Minimum distance between fingers
        
        topPoints.forEach(point => {
            let addedToCluster = false;
            
            for (let cluster of clusters) {
                const avgX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
                const avgY = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
                const dist = Math.sqrt((point.x - avgX) ** 2 + (point.y - avgY) ** 2);
                
                if (dist < minDistance) {
                    cluster.push(point);
                    addedToCluster = true;
                    break;
                }
            }
            
            if (!addedToCluster) {
                clusters.push([point]);
            }
        });
        
        return Math.min(clusters.length, 5); // Max 5 fingers
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
        
        // Find fingertips
        const topPoints = findConvexityDefects(skinPixels);
        const fingerCount = countFingers(topPoints, handWidth);
        
        // Draw bounding box
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 3;
        ctx.strokeRect(minX, minY, handWidth, handHeight);
        
        // Draw center point
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = "#17572a";
        ctx.fill();
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw fingertip markers
        topPoints.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = "#FF6B6B";
            ctx.fill();
        });
        
        // Draw corner markers
        const markerSize = 12;
        ctx.strokeStyle = "#17572a";
        ctx.lineWidth = 2;
        
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
            pixelCount: skinPixels.length,
            centerX: centerX,
            centerY: centerY,
            fingerCount: fingerCount
        };
    }
    
    // Classify gestures based on finger count and shape
    function classifyGesture(handInfo) {
        if (!handInfo) return null;
        
        const aspectRatio = handInfo.width / handInfo.height;
        const size = Math.sqrt(handInfo.width * handInfo.width + handInfo.height * handInfo.height);
        const fingers = handInfo.fingerCount;
        
        console.log(`Fingers: ${fingers}, Size: ${size.toFixed(0)}, Aspect: ${aspectRatio.toFixed(2)}`);
        
        // Classify based on finger count
        if (fingers === 0) {
            if (size < 100) {
                return { letter: "A", description: "Closed fist" };
            } else {
                return { letter: "S", description: "Closed hand" };
            }
        } else if (fingers === 1) {
            return { letter: "D", description: "One finger" };
        } else if (fingers === 2) {
            if (aspectRatio < 0.9) {
                return { letter: "V", description: "Peace sign" };
            } else {
                return { letter: "U", description: "Two fingers" };
            }
        } else if (fingers === 3) {
            return { letter: "W", description: "Three fingers" };
        } else if (fingers === 4) {
            return { letter: "4", description: "Four fingers" };
        } else if (fingers >= 5) {
            if (aspectRatio > 1.4) {
                return { letter: "B", description: "Flat hand (wide)" };
            } else {
                return { letter: "5", description: "Open hand" };
            }
        }
        
        // Fallback
        return { letter: "?", description: "Unknown gesture" };
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
            
            // Show result with confidence
            if (handInfo) {
                const gesture = classifyGesture(handInfo);
                const currentTime = Date.now();
                
                // Check if gesture changed or is stable
                if (lastGesture !== gesture.letter) {
                    lastGesture = gesture.letter;
                    gestureStartTime = currentTime;
                }
                
                const holdTime = (currentTime - gestureStartTime) / 1000;
                const isStable = holdTime > 0.5;
                
                if (isStable) {
                    detectionResult.textContent = `✓ ${gesture.letter} - ${gesture.description}`;
                    detectionResult.style.color = "#17572a";
                    detectionResult.style.fontWeight = "bold";
                    detectionResult.style.backgroundColor = "rgba(122, 182, 140, 0.3)";
                } else {
                    detectionResult.textContent = `${gesture.letter} - ${gesture.description}`;
                    detectionResult.style.color = "#666";
                    detectionResult.style.fontWeight = "normal";
                    detectionResult.style.backgroundColor = "rgba(122, 182, 140, 0.15)";
                }
            } else {
                lastGesture = null;
                gestureStartTime = 0;
                detectionResult.textContent = "No hand detected - show your palm";
                detectionResult.style.color = "#999";
                detectionResult.style.fontWeight = "normal";
                detectionResult.style.backgroundColor = "rgba(122, 182, 140, 0.05)";
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
            const divContent = document.createElement("p");
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