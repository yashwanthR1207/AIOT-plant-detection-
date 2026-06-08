#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ESP32Servo.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// HiveMQ Configuration
const char* mqtt_server = "YOUR_HIVEMQ_HOST"; // e.g. xxx.s1.eu.hivemq.cloud
const int mqtt_port = 8883;
const char* mqtt_user = "YOUR_USERNAME";
const char* mqtt_pass = "YOUR_PASSWORD";

// Pins
#define DHTPIN 4
#define DHTTYPE DHT11
#define SOIL_PIN 34
#define SERVO_PIN 18

DHT dht(DHTPIN, DHTTYPE);
Servo sprayerServo;
WiFiClientSecure espClient;
PubSubClient client(espClient);

long lastMsg = 0;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println("Message arrived [" + String(topic) + "] " + message);

  if (String(topic) == "plant/spray") {
    if (message == "ON") {
      Serial.println("Spraying ON...");
      sprayerServo.write(90);
    } else if (message == "OFF") {
      Serial.println("Spraying OFF...");
      sprayerServo.write(0);
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32_Client", mqtt_user, mqtt_pass)) {
      Serial.println("connected");
      client.subscribe("plant/spray");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  
  // Configure SSL for HiveMQ Cloud
  espClient.setInsecure(); // For production, use CA Certificate
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  dht.begin();
  sprayerServo.attach(SERVO_PIN);
  sprayerServo.write(0);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    int soilValue = analogRead(SOIL_PIN);
    int soilPercent = map(soilValue, 4095, 0, 0, 100); // Adjust based on your sensor

    if (!isnan(h) && !isnan(t)) {
      client.publish("plant/temperature", String(t).c_str());
      client.publish("plant/humidity", String(h).c_str());
      client.publish("plant/soil", String(soilPercent).c_str());
      
      Serial.printf("Published: T:%.1f H:%.1f S:%d\n", t, h, soilPercent);
    }
  }
}
