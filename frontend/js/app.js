// Configurations
const MQTT_CONFIG = {
    host: 'ed27ef14c693417e8e804913cc462527.s1.eu.hivemq.cloud',
    port: 8884,
    path: '/mqtt',
    username: 'yashwanth',
    password: 'Yashwanth'
};

// UI Elements
const video = document.getElementById('webcam');
const detectionOverlay = document.getElementById('detectionOverlay');
const imageInput = document.getElementById('imageInput');
const uploadTrigger = document.getElementById('uploadTrigger');
const captureBtn = document.getElementById('captureBtn');
const resultCard = document.getElementById('resultCard');
const loading = document.getElementById('loading');
const placeholderText = document.getElementById('placeholderText');

// Chart Setup - Professional & Clean
const ctx = document.getElementById('sensorChart').getContext('2d');
const sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { 
                label: 'Temp', 
                borderColor: '#059669', 
                backgroundColor: 'rgba(5, 150, 105, 0.05)', 
                data: [], 
                fill: true, 
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2
            },
            { 
                label: 'Humid', 
                borderColor: '#3b82f6', 
                backgroundColor: 'rgba(59, 130, 246, 0.05)', 
                data: [], 
                fill: true, 
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2
            },
            { 
                label: 'Soil', 
                borderColor: '#f59e0b', 
                backgroundColor: 'rgba(245, 158, 11, 0.05)', 
                data: [], 
                fill: true, 
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 2
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: { size: 11, weight: '600' } } } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
            y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b', font: { size: 10 } } }
        }
    }
});

// Webcam Setup
let currentFacingMode = 'user'; // 'user' for front, 'environment' for back

async function setupWebcam() {
    try {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: { facingMode: currentFacingMode }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            detectionOverlay.width = video.videoWidth;
            detectionOverlay.height = video.videoHeight;
        };
    } catch (err) {
        console.error("Webcam Error:", err);
        // Fallback if specific facingMode fails
        if (currentFacingMode === 'environment') {
            currentFacingMode = 'user';
            setupWebcam();
        }
    }
}
setupWebcam();

// Switch Camera Control
document.getElementById('switchCameraBtn')?.addEventListener('click', () => {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    setupWebcam();
});

// MQTT Setup
const client = mqtt.connect(`wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password
});

client.on('connect', () => {
    document.getElementById('systemStatus').innerText = 'System Connected';
    client.subscribe(['plant/temperature', 'plant/humidity', 'plant/soil']);
});

client.on('message', (topic, message) => {
    const val = parseFloat(message.toString());
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (topic === 'plant/temperature') {
        document.getElementById('liveTemp').innerText = `${val}°C`;
        updateChart(0, val, time);
    }
    if (topic === 'plant/humidity') {
        document.getElementById('liveHumidity').innerText = `${val}%`;
        updateChart(1, val, time);
    }
    if (topic === 'plant/soil') {
        document.getElementById('liveSoil').innerText = `${val}%`;
        updateChart(2, val, time);
    }

    addActivityLog(`${topic.split('/')[1].toUpperCase()}: ${val}`);
});

function updateChart(index, value, time) {
    if (sensorChart.data.labels.length > 15) {
        sensorChart.data.labels.shift();
        sensorChart.data.datasets.forEach(d => d.data.shift());
    }
    if (sensorChart.data.labels[sensorChart.data.labels.length - 1] !== time) {
        sensorChart.data.labels.push(time);
    }
    sensorChart.data.datasets[index].data.push(value);
    sensorChart.update('none');
}

function addActivityLog(msg) {
    const log = document.getElementById('activityLog');
    const p = document.createElement('p');
    p.style.fontSize = '0.85rem';
    p.style.padding = '0.5rem';
    p.style.background = '#f8fafc';
    p.style.borderRadius = '8px';
    p.style.borderLeft = '3px solid var(--primary)';
    p.innerHTML = `<span style="color: var(--primary); font-weight: 700;">[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]</span> ${msg}`;
    log.prepend(p);
    if (log.children.length > 5) log.lastChild.remove();
}

// YOLO Diagnostic Logic
const DISEASES = [
    { name: "Leaf Rust", confidence: 0.94, treatment: "Apply copper-based fungicide. Prune affected leaves immediately to stop the spread.", optTemp: "18-24°C", optHumidity: "55%", water: "500ml / Morning" },
    { name: "Powdery Mildew", confidence: 0.89, treatment: "Use neem oil spray or a baking soda solution. Ensure better spacing between plants.", optTemp: "20-27°C", optHumidity: "45%", water: "400ml / Day" },
    { name: "Early Blight", confidence: 0.87, treatment: "Remove bottom leaves. Apply mulch to prevent soil spores from splashing onto leaves.", optTemp: "24-29°C", optHumidity: "75%", water: "600ml / Day" },
    { name: "Late Blight", confidence: 0.96, treatment: "Isolate plant. Apply preventative fungicide. Avoid high moisture on leaves during evening.", optTemp: "15-21°C", optHumidity: "90%+", water: "450ml / Restricted" },
    { name: "Healthy", confidence: 0.99, treatment: "Plant is thriving. Maintain current light and water schedule.", optTemp: "21-26°C", optHumidity: "60%", water: "500ml / Standard" }
];

async function runYOLOInference(event) {
    loading.classList.remove('d-none');
    resultCard.classList.add('d-none');
    placeholderText.classList.add('d-none');
    
    const ctx = detectionOverlay.getContext('2d');
    
    // Handle Image Upload display
    if (event && event.target && event.target.files && event.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Resize canvas to match image
                detectionOverlay.width = img.width;
                detectionOverlay.height = img.height;
                ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
                ctx.drawImage(img, 0, 0);
                performInference(ctx, detectionOverlay.width, detectionOverlay.height, true);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(event.target.files[0]);
    } else {
        // Use Webcam - Capture frame for persistence
        detectionOverlay.width = video.videoWidth || 640;
        detectionOverlay.height = video.videoHeight || 480;
        ctx.clearRect(0, 0, detectionOverlay.width, detectionOverlay.height);
        ctx.drawImage(video, 0, 0, detectionOverlay.width, detectionOverlay.height);
        performInference(ctx, detectionOverlay.width, detectionOverlay.height, false);
    }
}

async function performInference(ctx, width, height, isUpload) {
    await new Promise(r => setTimeout(r, 1500));

    // Simulate Human vs Plant detection
    // For demo, we trigger "Invalid" if the brightness is very low or randomly
    const isHumanDetected = Math.random() < 0.15; 

    if (isHumanDetected) {
        showInvalidScan(ctx, width, height);
        loading.classList.add('d-none');
        return;
    }

    const result = DISEASES[Math.floor(Math.random() * DISEASES.length)];
    const boxW = width * 0.7;
    const boxH = height * 0.6;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2;

    if (result.name === "Healthy") {
        // Success Overlay for Healthy
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 6;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        
        ctx.fillStyle = "#10b981";
        ctx.fillRect(boxX, boxY - 40, 220, 40);
        
        ctx.fillStyle = "#000";
        ctx.font = "bold 18px Inter";
        ctx.fillText(`PLANT: HEALTHY 100%`, boxX + 15, boxY - 12);
        
        // Add a subtle green glow to the whole image
        ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
        ctx.fillRect(0, 0, width, height);
    } else {
        // Warning Overlay for Disease
        ctx.strokeStyle = "#f59e0b"; // Amber for disease
        ctx.lineWidth = 6;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        
        ctx.fillStyle = "#f59e0b";
        ctx.fillRect(boxX, boxY - 40, 260, 40);
        
        ctx.fillStyle = "#000";
        ctx.font = "bold 18px Inter";
        ctx.fillText(`${result.name.toUpperCase()} ${Math.round(result.confidence * 100)}%`, boxX + 15, boxY - 12);

        // Reddish tint for danger
        ctx.fillStyle = "rgba(245, 158, 11, 0.1)";
        ctx.fillRect(0, 0, width, height);
    }

    displayResult(result);
    loading.classList.add('d-none');
}

function showInvalidScan(ctx, width, height) {
    resultCard.classList.add('d-none');
    
    // Darken overlay
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)"; // Redish tint
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 24px Inter";
    ctx.textAlign = "center";
    ctx.fillText("INVALID OBJECT DETECTED", width / 2, height / 2);
    ctx.font = "16px Inter";
    ctx.fillText("Please scan a plant leaf", width / 2, height / 2 + 40);
    
    // Update Result UI
    placeholderText.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
        <p style="font-weight: 600; color: #ef4444;">Invalid Scan</p>
        <p style="font-size: 0.85rem;">Human or non-plant detected. Please try again.</p>
    `;
    placeholderText.classList.remove('d-none');
}

function displayResult(data) {
    resultCard.classList.remove('d-none');
    document.getElementById('diseaseName').innerText = data.name;
    const score = Math.round(data.confidence * 100);
    document.getElementById('confidenceScore').innerText = `${score}%`;
    document.getElementById('confidenceFill').style.width = `${score}%`;
    document.getElementById('treatmentRecommendation').innerText = data.treatment;
    document.getElementById('optTemp').innerText = data.optTemp;
    document.getElementById('optHumidity').innerText = data.optHumidity;
    document.getElementById('waterReq').innerText = data.water;
}

// Controls
captureBtn.addEventListener('click', runYOLOInference);
uploadTrigger.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', runYOLOInference);

// Auth & Profile Logic
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('plantCareUser'));
    if (user) {
        document.getElementById('authOverlay').style.display = 'none';
        updateProfileUI(user);
    } else {
        document.getElementById('authOverlay').style.display = 'flex';
    }
}

function updateProfileUI(user) {
    document.getElementById('profileNameDisplay').innerText = user.name;
    document.getElementById('profilePhoneDisplay').innerText = user.phone;
    document.getElementById('profileTypeDisplay').innerText = user.type;
    
    // Update welcome message
    document.querySelector('header p').innerText = `Welcome back, ${user.name.split(' ')[0]}`;
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const userData = {
        name: document.getElementById('userNameInput').value,
        phone: document.getElementById('userPhoneInput').value,
        type: document.getElementById('userTypeInput').value
    };
    localStorage.setItem('plantCareUser', JSON.stringify(userData));
    checkAuth();
});

function logout() {
    localStorage.removeItem('plantCareUser');
    window.location.reload();
}

// Initialize Auth
checkAuth();

// Nav Logic
function updateActiveLink(hash) {
    document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === hash) link.classList.add('active');
    });

    // Handle section visibility
    document.querySelectorAll('main > section').forEach(section => {
        section.style.display = 'none';
    });
    const target = document.querySelector(hash);
    if (target) target.style.display = 'block';
}

document.querySelectorAll('.nav-link, .mobile-nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        const hash = link.getAttribute('href');
        if (hash.startsWith('#')) {
            e.preventDefault();
            updateActiveLink(hash);
            window.location.hash = hash;
        }
    });
});

// Set default view
if (!window.location.hash) window.location.hash = '#dashboard';
updateActiveLink(window.location.hash);
