const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Use /tmp for Vercel read-only filesystem compatibility
const upload = multer({ dest: '/tmp/' });

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_')) {
    console.warn('⚠️  WARNING: Supabase credentials missing. Database logging will be disabled.');
}
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Gemini AI Setup
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey || geminiKey.includes('your_')) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY missing. Disease detection will not work.');
}
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

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
        mqttClient.subscribe(['plant/temperature', 'plant/humidity', 'plant/soil'], (err) => {
            if (err) console.error('MQTT Subscribe Error:', err);
        });
    });
} else {
    console.warn('⚠️  WARNING: MQTT credentials missing. Real-time sensor data will be disabled.');
}

mqttClient?.on('message', async (topic, message) => {
    const value = parseFloat(message.toString());
    console.log(`Received message: ${topic} -> ${value}`);

    let update = {};
    if (topic === 'plant/temperature') update.temp = value;
    if (topic === 'plant/humidity') update.humidity = value;
    if (topic === 'plant/soil') update.soil_moisture = value;

    if (Object.keys(update).length > 0 && supabase) {
        const { error } = await supabase.from('sensor_data').insert([update]);
        if (error) console.error('Supabase Insert Error:', error);
    }
});

// Helper: Convert file to Gemini Part
function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString('base64'),
            mimeType,
        },
    };
}

// API: Detect Disease
app.post('/detect-disease', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
        if (!genAI) return res.status(503).json({ error: 'Gemini AI not configured' });

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = "Analyze this plant leaf image. Return JSON format with fields: disease_name, confidence_score (0-1), and treatment_recommendation. If no disease is found, state 'Healthy'.";

        const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        
        // Extract JSON from response (Gemini might wrap it in markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse AI response' };

        // Auto Spray Logic
        if (analysis.confidence_score > 0.8 && analysis.disease_name !== 'Healthy') {
            console.log('Confidence high, triggering sprayer...');
            mqttClient?.publish('plant/spray', 'ON');
            if (supabase) await supabase.from('spray_logs').insert([{ action: 'ON' }]);
            
            setTimeout(async () => {
                mqttClient?.publish('plant/spray', 'OFF');
                if (supabase) await supabase.from('spray_logs').insert([{ action: 'OFF' }]);
            }, 5000);
        }

        // Save to Supabase
        if (supabase) {
            await supabase.from('disease_logs').insert([{
                disease_name: analysis.disease_name,
                confidence: analysis.confidence_score,
                treatment: analysis.treatment_recommendation,
                image_url: req.file.filename
            }]);
        }

        // Cleanup local file
        fs.unlinkSync(req.file.path);

        res.json(analysis);
    } catch (error) {
        console.error('Detection Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Catch-all route to serve the frontend index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Backend running at http://localhost:${port}`);
    });
}

// Export for Vercel
module.exports = app;
