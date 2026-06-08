// Configurations
const API_URL = 'http://localhost:3000';
const MQTT_CONFIG = {
    host: 'your_hivemq_host', // e.g., 'xxx.s1.eu.hivemq.cloud'
    port: 8884, // WebSocket port for HiveMQ Cloud
    path: '/mqtt',
    username: 'your_hivemq_username',
    password: 'your_hivemq_password'
};

// UI Elements
const video = document.getElementById('webcam');
const imageInput = document.getElementById('imageInput');
const captureBtn = document.getElementById('captureBtn');
const uploadBtn = document.getElementById('uploadBtn');
const resultCard = document.getElementById('resultCard');
const loading = document.getElementById('loading');

// Chart Setup
const ctx = document.getElementById('sensorChart').getContext('2d');
const sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Temp (°C)', borderColor: '#17a2b8', data: [] },
            { label: 'Humidity (%)', borderColor: '#007bff', data: [] },
            { label: 'Soil (%)', borderColor: '#ffc107', data: [] }
        ]
    },
    options: { responsive: true, maintainAspectRatio: false }
});

// Webcam Setup
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        console.error("Webcam Error:", err);
    }
}
setupWebcam();

// MQTT Setup (Live Dashboard)
const client = mqtt.connect(`wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}${MQTT_CONFIG.path}`, {
    username: MQTT_CONFIG.username,
    password: MQTT_CONFIG.password
});

client.on('connect', () => {
    console.log('Frontend connected to MQTT');
    client.subscribe(['plant/temperature', 'plant/humidity', 'plant/soil', 'plant/status']);
});

client.on('message', (topic, message) => {
    const val = parseFloat(message.toString());
    const time = new Date().toLocaleTimeString();

    if (topic === 'plant/temperature') {
        document.getElementById('liveTemp').innerText = `${val} °C`;
        updateChart(0, val, time);
    }
    if (topic === 'plant/humidity') {
        document.getElementById('liveHumidity').innerText = `${val} %`;
        updateChart(1, val, time);
    }
    if (topic === 'plant/soil') {
        document.getElementById('liveSoil').innerText = `${val} %`;
        updateChart(2, val, time);
    }

    addActivityLog(`${topic.split('/')[1]}: ${val}`);
});

function updateChart(datasetIndex, value, time) {
    if (sensorChart.data.labels.length > 10) {
        sensorChart.data.labels.shift();
        sensorChart.data.datasets.forEach(d => d.data.shift());
    }
    sensorChart.data.labels.push(time);
    sensorChart.data.datasets[datasetIndex].data.push(value);
    sensorChart.update();
}

function addActivityLog(msg) {
    const log = document.getElementById('activityLog');
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(li);
    if (log.children.length > 5) log.lastChild.remove();
}

// API Calls
async function analyzeImage(file) {
    loading.classList.remove('d-none');
    resultCard.classList.add('d-none');

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`${API_URL}/detect-disease`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        displayResult(data);
    } catch (err) {
        alert("Error analyzing image: " + err.message);
    } finally {
        loading.classList.add('d-none');
    }
}

function displayResult(data) {
    resultCard.classList.remove('d-none');
    document.getElementById('diseaseName').innerText = data.disease_name || "Unknown";
    document.getElementById('confidenceScore').innerText = `${(data.confidence_score * 100).toFixed(2)}%`;
    document.getElementById('treatmentRecommendation').innerText = data.treatment_recommendation || "N/A";
}

// Event Listeners
uploadBtn.addEventListener('click', () => {
    if (imageInput.files[0]) analyzeImage(imageInput.files[0]);
    else alert("Please select a file first");
});

captureBtn.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => analyzeImage(new File([blob], "capture.jpg", { type: "image/jpeg" })));
});
