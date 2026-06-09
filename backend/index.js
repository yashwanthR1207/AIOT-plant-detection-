const express = require('express');
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// MQTT Setup
const mqttOptions = {
    host: process.env.MQTT_HOST,
    port: parseInt(process.env.MQTT_PORT) || 8883,
    protocol: 'mqtts',
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
};

let mqttClient = null;
if (mqttOptions.host && !mqttOptions.host.includes('your_')) {
    mqttClient = mqtt.connect(mqttOptions);
    mqttClient.on('connect', () => {
        console.log('✅ Connected to HiveMQ Cloud');
        mqttClient.subscribe(['plant/temperature', 'plant/humidity', 'plant/soil']);
    });
}

mqttClient?.on('message', async (topic, message) => {
    const value = parseFloat(message.toString());
    let update = {};
    if (topic === 'plant/temperature') update.temp = value;
    if (topic === 'plant/humidity') update.humidity = value;
    if (topic === 'plant/soil') update.soil_moisture = value;

    if (Object.keys(update).length > 0 && supabase) {
        await supabase.from('sensor_data').insert([update]);
    }
});

// API: Local Detection Endpoint (Simulated YOLO backend)
app.post('/detect-disease', (req, res) => {
    // Note: In this YOLO version, detection is handled fast on the frontend 
    // for a "Pro" feel. This endpoint remains for logging if needed.
    res.json({ status: "success", message: "YOLO Inference handled on client" });
});

// Catch-all route to serve the frontend index.html
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend running at http://localhost:${port}`);
    });
}

module.exports = app;
