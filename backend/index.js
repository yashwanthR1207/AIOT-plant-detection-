const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mqtt = require('mqtt');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// Supabase Setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MQTT Setup
const mqttOptions = {
    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    protocol: 'mqtts',
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
};
const mqttClient = mqtt.connect(mqttOptions);

mqttClient.on('connect', () => {
    console.log('Connected to HiveMQ Cloud');
    mqttClient.subscribe(['plant/temperature', 'plant/humidity', 'plant/soil'], (err) => {
        if (err) console.error('MQTT Subscribe Error:', err);
    });
});

mqttClient.on('message', async (topic, message) => {
    const value = parseFloat(message.toString());
    console.log(`Received message: ${topic} -> ${value}`);

    let update = {};
    if (topic === 'plant/temperature') update.temp = value;
    if (topic === 'plant/humidity') update.humidity = value;
    if (topic === 'plant/soil') update.soil_moisture = value;

    if (Object.keys(update).length > 0) {
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
            mqttClient.publish('plant/spray', 'ON');
            await supabase.from('spray_logs').insert([{ action: 'ON' }]);
            
            setTimeout(async () => {
                mqttClient.publish('plant/spray', 'OFF');
                await supabase.from('spray_logs').insert([{ action: 'OFF' }]);
            }, 5000);
        }

        // Save to Supabase
        await supabase.from('disease_logs').insert([{
            disease_name: analysis.disease_name,
            confidence: analysis.confidence_score,
            treatment: analysis.treatment_recommendation,
            image_url: req.file.filename // In production, upload to Supabase Storage
        }]);

        // Cleanup local file
        fs.unlinkSync(req.file.path);

        res.json(analysis);
    } catch (error) {
        console.error('Detection Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
});
