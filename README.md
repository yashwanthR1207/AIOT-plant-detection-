# AIoT Smart Plant Disease Detection and Automatic Spraying System

This project provides a complete solution for monitoring plant health, detecting diseases using Google Gemini AI, and automatically triggering a sprayer via an ESP32.

## Features
- **Real-time Monitoring**: Temperature, Humidity, and Soil Moisture.
- **AI Disease Detection**: Analyze leaf images using Gemini 1.5 Flash.
- **Automatic Spraying**: Triggered when a disease is detected with high confidence (>80%).
- **Interactive Dashboard**: Live charts and activity logs.

## Project Structure
- `backend/`: Node.js Express server.
- `frontend/`: Bootstrap-based web interface.
- `esp32/`: Arduino firmware for ESP32.
- `database/`: SQL schema for Supabase.

## Setup Instructions

### 1. Database (Supabase)
- Create a new project on [Supabase](https://supabase.com/).
- Go to the SQL Editor and run the queries in `database/schema.sql`.
- Note down your `SUPABASE_URL` and `SUPABASE_KEY` (anon public key).

### 2. MQTT (HiveMQ Cloud)
- Create a free cluster on [HiveMQ Cloud](https://www.hivemq.com/mqtt-cloud-broker/).
- Create a set of credentials (username/password).
- Note down the Cluster URL (e.g., `xxx.s1.eu.hivemq.cloud`).

### 3. Backend Setup
- Navigate to `backend/`.
- Create a `.env` file based on `.env.example`.
- Fill in your API keys and credentials:
  - `GEMINI_API_KEY`: Get it from [Google AI Studio](https://aistudio.google.com/).
  - `SUPABASE_URL` & `SUPABASE_KEY`.
  - `MQTT_HOST`, `MQTT_USER`, `MQTT_PASSWORD`.
- Run:
  ```bash
  npm install
  node index.js
  ```

### 4. Frontend Setup
- Open `frontend/js/app.js`.
- Update the `MQTT_CONFIG` object with your HiveMQ details.
- Open `frontend/index.html` in your browser (or use a local server like Live Server).

### 5. ESP32 Setup
- Open `esp32/esp32_firmware.ino` in Arduino IDE.
- Install the required libraries: `DHT sensor library`, `ESP32Servo`, `PubSubClient`.
- Update the WiFi and HiveMQ credentials in the code.
- Upload to your ESP32.

## Hardware Connections
- **DHT11**: VCC -> 3.3V, GND -> GND, Data -> GPIO 4.
- **Soil Moisture**: VCC -> 3.3V, GND -> GND, Signal -> GPIO 34 (Analog).
- **Servo Motor**: VCC -> 5V/3.3V, GND -> GND, PWM -> GPIO 18.

## Usage
1. Ensure the backend is running.
2. Open the dashboard.
3. Upload or capture a plant leaf image in the "Disease Detection" section.
4. If a disease is detected, Gemini will provide a treatment, and the ESP32 will trigger the sprayer automatically if confidence is high.
