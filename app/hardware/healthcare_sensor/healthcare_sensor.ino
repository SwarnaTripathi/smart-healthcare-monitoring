/*
 * Smart Healthcare Monitoring System - ESP32 Sensor Node
 * Hardware: ESP32 + MAX30102 + DS18B20
 * Sends vitals to Node.js backend via HTTP POST
 * 
 * Wiring:
 *   MAX30102: SDA→GPIO21, SCL→GPIO22, VCC→3V3, GND→GND
 *   DS18B20:  DATA→GPIO4 (+ 4.7kΩ pull-up to 3V3), VCC→3V3, GND→GND
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ============ CHANGE THESE VALUES ============
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.1.100:3000/api/health-data";
const char* PATIENT_ID    = "PT-00001";
const char* DEVICE_ID     = "ESP32-NODE-001";
const int   SEND_INTERVAL = 5000;
// =============================================

MAX30105 particleSensor;
OneWire oneWire(4);
DallasTemperature tempSensor(&oneWire);

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

double avered = 0, aveir = 0;
double sumirrms = 0, sumredrms = 0;
double SpO2 = 0;
int spo2Counter = 0;
unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Smart Healthcare Sensor Node ===");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30102 not found!");
    while (1);
  }
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeIR(0x0A);

  tempSensor.begin();
  Serial.println("Sensors ready. Place finger on MAX30102.\n");
}

void loop() {
  long irValue = particleSensor.getIR();

  if (irValue < 50000) {
    Serial.println("No finger detected...");
    delay(1000);
    return;
  }

  if (checkForBeat(irValue)) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);
    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      rates[rateSpot++ % RATE_SIZE] = (byte)beatsPerMinute;
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }

  uint32_t ir, red;
  particleSensor.check();
  while (particleSensor.available()) {
    red = particleSensor.getRed();
    ir = particleSensor.getIR();
    particleSensor.nextSample();
    double fred = (double)red, fir = (double)ir;
    avered = avered * 0.95 + fred * 0.05;
    aveir = aveir * 0.95 + fir * 0.05;
    sumredrms += (fred - avered) * (fred - avered);
    sumirrms += (fir - aveir) * (fir - aveir);
    if (++spo2Counter >= 100) {
      double R = (sqrt(sumredrms) / avered) / (sqrt(sumirrms) / aveir);
      SpO2 = -45.060 * R * R + 30.354 * R + 94.845;
      sumredrms = sumirrms = 0;
      spo2Counter = 0;
    }
  }

  tempSensor.requestTemperatures();
  float temperature = tempSensor.getTempCByIndex(0);
  if (temperature == -127.0) temperature = 36.5;

  if (millis() - lastSendTime > SEND_INTERVAL && beatAvg > 0) {
    lastSendTime = millis();
    sendData(beatAvg, constrain(SpO2, 85, 100), temperature);
  }

  Serial.printf("HR: %d bpm | SpO2: %.1f%% | Temp: %.1f°C\n", beatAvg, SpO2, temperature);
  delay(10);
}

void sendData(int heartRate, float spO2, float temperature) {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); return; }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["patientId"] = PATIENT_ID;
  doc["deviceId"] = DEVICE_ID;
  doc["heartRate"] = heartRate;
  doc["spO2"] = round(spO2 * 10.0) / 10.0;
  doc["temperature"] = round(temperature * 10.0) / 10.0;

  String payload;
  serializeJson(doc, payload);
  Serial.printf(">>> %s\n", payload.c_str());

  int code = http.POST(payload);
  Serial.printf("Response: %d\n\n", code);
  http.end();
}
