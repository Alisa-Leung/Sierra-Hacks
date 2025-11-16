// script.js
// Full updated script with strong filtering, k-means hand isolation,
// morphological cleanup, convex-hull fingertip extraction, and improved gesture classification.
// Designed to drop into your existing HTML/CSS (uses #outputCanvas, #videoContainer, #toggleCamera, #detectionResult).

document.addEventListener("DOMContentLoaded", () => {
    // Camera / UI elements
    const videoContainer = document.getElementById("videoContainer");
    const toggleCameraBtn = document.getElementById("toggleCamera");
    const detectionResult = document.getElementById("detectionResult");
    let stream = null;
    let cameraActive = false;
    let videoElement = null;

    // Detection state
    let isDetecting = false;
    let animationId = null;
    let lastGestureLetter = null;
    let gestureStartTime = 0;
    let fingerHistory = [];
    let lastSmoothedFingerCount = 0;

    // -----------------------
    // Utility helpers
    // -----------------------
    function euclidSq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    function dist(a, b) {
        return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
    }

    // -----------------------
    // Skin detection (same-ish as before but returns points)
    // -----------------------
    function detectHand(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const skinPixels = [];

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Simple but robust skin color rule in RGB (kept from your original logic)
            if (
                r > 95 && g > 40 && b > 20 &&
                r > g && r > b &&
                Math.abs(r - g) > 15 &&
                (r - b) > 15
            ) {
                const x = (i / 4) % width;
                const y = Math.floor((i / 4) / width);
                skinPixels.push({ x, y });
            }
        }

        return skinPixels;
    }

    // -----------------------
    // STRONG FILTER: k-means clustering to isolate largest skin blob (hand),
    // then morphological neighbor-based cleanup
    // -----------------------
    function cleanHandPixels(skinPixels, canvasWidth, canvasHeight) {
        if (!skinPixels || skinPixels.length < 80) return skinPixels;

        // K-means (k=3) on pixel coords (fast, small iterations)
        const k = 3;
        let centroids = [];
        // initialize centroids evenly sampled
        for (let i = 0; i < k; i++) {
            const p = skinPixels[Math.floor((i / k) * skinPixels.length)];
            centroids.push({ x: p.x, y: p.y });
        }

        let clusters = [];
        for (let iter = 0; iter < 8; iter++) {
            clusters = Array.from({ length: k }, () => []);
            // assign
            for (let p of skinPixels) {
                let best = 0, bestDist = Infinity;
                for (let c = 0; c < k; c++) {
                    const d = (p.x - centroids[c].x) ** 2 + (p.y - centroids[c].y) ** 2;
                    if (d < bestDist) {
                        bestDist = d; best = c;
                    }
                }
                clusters[best].push(p);
            }
            // recompute
            for (let c = 0; c < k; c++) {
                if (clusters[c].length === 0) continue;
                let sx = 0, sy = 0;
                for (let q of clusters[c]) { sx += q.x; sy += q.y; }
                centroids[c] = { x: sx / clusters[c].length, y: sy / clusters[c].length };
            }
        }

        // pick largest cluster (likely the hand)
        let largest = clusters.reduce((a, b) => (b.length > a.length ? b : a), clusters[0] || []);
        if (!largest || largest.length < 60) {
            // fallback: if clustering failed, return original (but still try a light filter)
            return skinPixels.filter((p, i) => {
                // small neighborhood check to remove isolated pixels anyway
                let neighbors = 0;
                for (let j = 0; j < skinPixels.length; j += Math.max(1, Math.floor(skinPixels.length / 500))) {
                    const q = skinPixels[j];
                    if (Math.abs(p.x - q.x) < 5 && Math.abs(p.y - q.y) < 5) neighbors++;
                    if (neighbors > 3) break;
                }
                return neighbors > 1;
            });
        }

        // morphological-like cleanup: keep pixels with enough nearby pixels
        const cleaned = [];
        const radius = Math.max(4, Math.round(Math.min(canvasWidth, canvasHeight) * 0.02)); // adapt to size
        const neighborThreshold = 6; // requires several neighbors in radius
        // Build spatial hash to accelerate neighbor counting
        const cellSize = radius;
        const hash = {};
        function hashKey(px, py) {
            return `${Math.floor(px / cellSize)}_${Math.floor(py / cellSize)}`;
        }
        for (let p of largest) {
            const kkey = hashKey(p.x, p.y);
            if (!hash[kkey]) hash[kkey] = [];
            hash[kkey].push(p);
        }
        for (let p of largest) {
            let count = 0;
            const gx = Math.floor(p.x / cellSize);
            const gy = Math.floor(p.y / cellSize);
            // check neighboring buckets
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const key = `${gx + ox}_${gy + oy}`;
                    const bucket = hash[key];
                    if (!bucket) continue;
                    for (let q of bucket) {
                        if (Math.abs(p.x - q.x) <= radius && Math.abs(p.y - q.y) <= radius) {
                            count++;
                            if (count >= neighborThreshold) break;
                        }
                    }
                    if (count >= neighborThreshold) break;
                }
                if (count >= neighborThreshold) break;
            }
            if (count >= neighborThreshold) cleaned.push(p);
        }

        return cleaned;
    }

    // -----------------------
    // Convex Hull (Monotonic chain / Andrew's algorithm)
    // Input: array of {x,y}; Output: hull array in CCW order
    // -----------------------
    function convexHull(points) {
        if (!points || points.length < 3) return points.slice();

        // sort by x then y
        const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower = [];
        for (let p of pts) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }
        const upper = [];
        for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }
        lower.pop();
        upper.pop();
        return lower.concat(upper);
    }

    // -----------------------
    // Find fingertip candidates from hull:
    // - pick hull vertices that are local "top" (low y) and are reasonably spaced
    // - limit to max 5
    // -----------------------
    function findFingertipsFromHull(hull, bbox) {
        if (!hull || hull.length === 0) return [];
        // heuristics: fingertips are hull points that are near the top third of the hand bounding box
        const topY = bbox.minY;
        const thresholdY = bbox.minY + Math.min( Math.max(15, (bbox.maxY - bbox.minY) * 0.45), 80); // adaptive

        // gather candidate hull points above thresholdY
        const candidates = hull.filter(p => p.y <= thresholdY);

        if (candidates.length === 0) {
            // fallback: take topmost hull points (sorted by y)
            const sorted = hull.slice().sort((a, b) => a.y - b.y);
            return sorted.slice(0, Math.min(5, sorted.length)).map(p => ({ x: p.x, y: p.y }));
        }

        // cluster candidates left-right to merge neighbouring vertices into single fingertip
        const clusters = [];
        const minXSeparation = Math.max(20, Math.round((bbox.maxX - bbox.minX) * 0.08));
        const sortedByX = candidates.slice().sort((a, b) => a.x - b.x);
        for (let p of sortedByX) {
            if (clusters.length === 0) {
                clusters.push([p]);
                continue;
            }
            const last = clusters[clusters.length - 1];
            const avgX = last.reduce((s, q) => s + q.x, 0) / last.length;
            if (Math.abs(p.x - avgX) <= minXSeparation) {
                last.push(p);
            } else {
                clusters.push([p]);
            }
        }
        // convert clusters to representative fingertip (take min y in cluster)
        const fingertips = clusters.map(cluster => cluster.reduce((a, b) => (a.y < b.y ? a : b)));
        // sort by x (left to right) and limit to 5
        fingertips.sort((a, b) => a.x - b.x);
        return fingertips.slice(0, 5).map(p => ({ x: p.x, y: p.y }));
    }

    // -----------------------
    // Compute bounding box & center & basic handInfo
    // -----------------------
    function computeHandInfo(pixels) {
        if (!pixels || pixels.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;
        for (let p of pixels) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
            sumX += p.x;
            sumY += p.y;
        }
        const centerX = sumX / pixels.length;
        const centerY = sumY / pixels.length;
        const width = Math.max(1, maxX - minX);
        const height = Math.max(1, maxY - minY);

        return {
            minX, minY, maxX, maxY,
            centerX, centerY,
            width, height,
            pixelCount: pixels.length
        };
    }

    // -----------------------
    // Improved fingertip extraction pipeline
    // -----------------------
    function extractFingertips(skinPixels, canvasWidth, canvasHeight) {
        if (!skinPixels || skinPixels.length < 50) return [];

        const handInfo = computeHandInfo(skinPixels);

        // Create a coarser set of points for hull computation to reduce noise
        // Use grid-sampled representative points: pick highest point in each grid cell
        const gridSize = Math.max(10, Math.round(Math.min(canvasWidth, canvasHeight) * 0.02));
        const grid = {};
        for (let p of skinPixels) {
            const key = `${Math.floor(p.x / gridSize)}_${Math.floor(p.y / gridSize)}`;
            if (!grid[key] || p.y < grid[key].y) grid[key] = p; // keep topmost in cell
        }
        const sampled = Object.values(grid);

        // compute hull
        const hull = convexHull(sampled);

        // bounding box for fingertip heuristics
        const bbox = { minX: handInfo.minX, minY: handInfo.minY, maxX: handInfo.maxX, maxY: handInfo.maxY };

        // get fingertip candidates from hull
        const fingertips = findFingertipsFromHull(hull, bbox);

        // Final filter: remove points too close to each other, ensure they fall within bbox with margin
        const final = [];
        const minSep = Math.max(18, Math.round(handInfo.width * 0.12));
        for (let p of fingertips) {
            if (p.x < bbox.minX - 8 || p.x > bbox.maxX + 8 || p.y < bbox.minY - 15 || p.y > bbox.maxY + 20) continue;
            let ok = true;
            for (let q of final) {
                if (Math.abs(p.x - q.x) < minSep) ok = false;
            }
            if (ok) final.push(p);
        }
        // sort left->right
        final.sort((a,b) => a.x - b.x);
        return final.slice(0, 5);
    }

    // -----------------------
    // Count fingers from fingertip points using clustering + geometry
    // (This builds on top of extractFingertips but double-checks distances)
    // -----------------------
    function countFingersFromTips(tips, handInfo) {
        if (!handInfo) return 0;
        if (!tips || tips.length === 0) return 0;

        // basic heuristic: consider horizontal separation and relative positions.
        // Merge tips that are very close, then count up to 5.
        const merged = [];
        const minDist = Math.max(18, Math.round(handInfo.width * 0.09));
        for (let t of tips) {
            if (merged.length === 0) { merged.push(t); continue; }
            const last = merged[merged.length - 1];
            if (Math.abs(t.x - last.x) < minDist) {
                // keep the higher (smaller y)
                if (t.y < last.y) merged[merged.length - 1] = t;
            } else merged.push(t);
        }
        return Math.min(5, merged.length);
    }

    // -----------------------
    // Improved gesture classification using smoothed finger count and aspect ratio/relative widths
    // -----------------------
    function classifyGesture(handInfo, fingerCount, fingertips) {
        if (!handInfo) return null;
        const aspect = handInfo.width / handInfo.height;
        const size = Math.sqrt(handInfo.width * handInfo.width + handInfo.height * handInfo.height);
        const fc = fingerCount;

        // use fingertip X-spread to distinguish flat hand from spread finger cases
        let spread = 0;
        if (fingertips && fingertips.length >= 2) {
            spread = (fingertips[fingertips.length - 1].x - fingertips[0].x) / handInfo.width; // normalized
        }

        // classify with improved heuristics
        if (fc === 0) {
            // small closed fist vs big palm
            if (size < 110) return { letter: "A", description: "Closed fist" };
            return { letter: "S", description: "Closed hand" };
        }
        if (fc === 1) {
            // single finger — try to detect index vs thumb by position: typically single finger near side -> thumb
            const tip = (fingertips && fingertips[0]) || null;
            if (tip && (tip.x < handInfo.centerX - handInfo.width * 0.15 || tip.x > handInfo.centerX + handInfo.width * 0.15)) {
                return { letter: "D", description: "One finger (likely thumb)" };
            }
            return { letter: "D", description: "One finger" };
        }
        if (fc === 2) {
            // V vs two together: if spread large and aspect is tall (fingers separated) => V (peace)
            if (modeDropdown.value == "csl"){
                return { letter: "八", description: "Two fingers" };
            } else{
                if (spread > 0.45 && handInfo.height > handInfo.width * 0.9) return { letter: "V", description: "Peace sign" };
                return { letter: "U", description: "Two fingers" };
            }        
        }
        if (fc === 3) {
            return { letter: "W", description: "Three fingers" };
        }
        if (fc === 4) {
            return { letter: "4", description: "Four fingers" };
        }
        if (fc >= 5) {
            // differentiate open palm vs flat wide palm
            if (spread > 0.7 && aspect > 1.1) return { letter: "B", description: "Flat/wide hand" };
            return { letter: "5", description: "Open hand" };
        }
        // fallback
        return { letter: "?", description: "Unknown gesture" };
    }

    // -----------------------
    // Draw overlays on canvas
    // -----------------------
    function drawHandOverlay(ctx, pixels, handInfo, fingertips) {
        if (!handInfo) return;
        // bounding box
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 3;
        ctx.strokeRect(handInfo.minX, handInfo.minY, handInfo.width, handInfo.height);

        // center point
        ctx.beginPath();
        ctx.arc(handInfo.centerX, handInfo.centerY, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#17572a";
        ctx.fill();
        ctx.strokeStyle = "#7AB68C";
        ctx.lineWidth = 2;
        ctx.stroke();

        // fingertips
        if (fingertips && fingertips.length) {
            for (let p of fingertips) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = "#FF6B6B";
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = "#FFF";
                ctx.stroke();
            }
        }

        // corner markers (like original)
        const markerSize = 12;
        ctx.strokeStyle = "#17572a";
        ctx.lineWidth = 2;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(handInfo.minX, handInfo.minY + markerSize);
        ctx.lineTo(handInfo.minX, handInfo.minY);
        ctx.lineTo(handInfo.minX + markerSize, handInfo.minY);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(handInfo.maxX - markerSize, handInfo.minY);
        ctx.lineTo(handInfo.maxX, handInfo.minY);
        ctx.lineTo(handInfo.maxX, handInfo.minY + markerSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(handInfo.minX, handInfo.maxY - markerSize);
        ctx.lineTo(handInfo.minX, handInfo.maxY);
        ctx.lineTo(handInfo.minX + markerSize, handInfo.maxY);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(handInfo.maxX - markerSize, handInfo.maxY);
        ctx.lineTo(handInfo.maxX, handInfo.maxY);
        ctx.lineTo(handInfo.maxX, handInfo.maxY - markerSize);
        ctx.stroke();
    }

    // -----------------------
    // Main detection loop
    // -----------------------
    async function detectLoop() {
        if (!isDetecting || !videoElement) return;

        try {
            const canvas = document.getElementById("outputCanvas");
            const ctx = canvas.getContext("2d");

            // draw frame from video (mirrored by CSS)
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // read skin pixels from frame
            const rawSkin = detectHand(ctx, canvas.width, canvas.height);

            // strong cleaning
            const cleaned = cleanHandPixels(rawSkin, canvas.width, canvas.height);

            // clear canvas and draw overlays from cleaned detection
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // if the cleaned blob is large enough, compute info & fingertips
            let handInfo = null;
            let fingertips = [];
            if (cleaned && cleaned.length > 50) {
                handInfo = computeHandInfo(cleaned);
                // build hull & find fingertips
                fingertips = extractFingertips(cleaned, canvas.width, canvas.height);
                // count fingers (with geometry)
                const rawCount = countFingersFromTips(fingertips, handInfo);

                // temporal smoothing of finger count
                fingerHistory.push(rawCount);
                if (fingerHistory.length > 6) fingerHistory.shift();
                const avg = fingerHistory.reduce((a, b) => a + b, 0) / fingerHistory.length;
                const smoothed = Math.round(avg);
                lastSmoothedFingerCount = smoothed;

                // draw overlay
                drawHandOverlay(ctx, cleaned, handInfo, fingertips);

                // classify using smoothed count and fingertip geometry
                const gesture = classifyGesture(handInfo, smoothed, fingertips);

                // stable-hold check
                const currentTime = Date.now();
                if (lastGestureLetter !== gesture.letter) {
                    lastGestureLetter = gesture.letter;
                    gestureStartTime = currentTime;
                }
                const holdTime = (currentTime - gestureStartTime) / 1000;
                const isStable = holdTime > 0.6;

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
                // no hand detected
                fingerHistory = []; // reset smoothing when hand disappears
                lastGestureLetter = null;
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

    // -----------------------
    // Camera start/stop logic (preserves original behavior)
    // -----------------------
    toggleCameraBtn.addEventListener("click", async () => {
        if (!cameraActive) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 280 }, height: { ideal: 210 } },
                    audio: false
                });

                videoElement = document.createElement("video");
                videoElement.autoplay = true;
                videoElement.playsInline = true;
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

                    // small delay to let video warm up
                    setTimeout(() => startDetection(), 300);
                };

                videoContainer.appendChild(videoElement);
                toggleCameraBtn.textContent = "Stop Camera";
                cameraActive = true;
            } catch (err) {
                console.error("Camera error:", err);
                alert("Camera error: " + err.message);
            }
        } else {
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

    // ---------- existing UI code preserved: dropdown + switch creation ----------
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");

    modeDropdown.addEventListener("change", (event) => {
        const existingContent = document.getElementById("divContent");
        if (existingContent) existingContent.remove();
        const existingSwitch = document.getElementById("toggleSwitch");
        if (existingSwitch) existingSwitch.remove();

        if (event.target.value) {
            const divContent = document.createElement("p");
            divContent.id = "divContent";
            if (event.target.value === "visuallyImpaired") {
                divContent.innerHTML = "Visually Impaired";
                createSwitch();
            } else if (event.target.value === "hardOfHearing") {
                divContent.innerHTML = "Hard of Hearing";
                createSwitch();
            } else if (event.target.value === "speakingDifficulty") {
                divContent.innerHTML = "Speaking Difficulty";
                createSwitch();
            }
            modeDiv.appendChild(divContent);
        }
    });

    function createSwitch() {
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

}); // DOMContentLoaded end
