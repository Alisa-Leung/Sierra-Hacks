document.addEventListener("DOMContentLoaded", () => {
    //this code adds content to the html file based on content
    const modeDropdown = document.getElementById("modeDropdown");
    const modeDiv = document.getElementById("modeDiv");
    const micBtn = document.getElementById('mic-btn');
    const outputLabel = document.getElementById('text');


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

const micBtn = document.getElementById("micBtn");
const textLabel = document.getElementById("textLabel");

function initSpeechToText(button, outputLabel) {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        button.addEventListener('click', () => {
            recognition.start();
            button.style.background = 'rgb(248, 157, 104)'; // active
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            outputLabel.innerHTML = transcript;
        };

        recognition.onerror = (event) => console.error(event.error);

        recognition.onend = () => button.style.background = 'rgba(255, 194, 209, 0.3)';
    } else {
        button.style.display = 'none';
        console.warn("SpeechRecognition API not supported in this browser.");
    }
}

// Initialize
initSpeechToText(micBtn, textLabel);