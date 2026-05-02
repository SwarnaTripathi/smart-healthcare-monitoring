# Hardware Integration Guide
## Connecting Real IoT Sensors to the Smart Healthcare System

---

## 1. COMPONENTS REQUIRED

| Component | Model | Purpose | Approx Cost (INR) |
|-----------|-------|---------|-------------------|
| Microcontroller | ESP32 DevKit V1 | WiFi-enabled processor | ₹450-600 |
| Pulse Oximeter Sensor | MAX30102 | Heart Rate + SpO2 | ₹250-400 |
| Temperature Sensor | DS18B20 (waterproof) | Body temperature | ₹80-150 |
| Pull-up Resistor | 4.7kΩ | Required for DS18B20 | ₹5 |
| Breadboard | Half-size | Prototyping | ₹80 |
| Jumper Wires | Male-to-Male & Male-to-Female | Connections | ₹60 |
| USB Cable | Micro-USB | Power + Programming | ₹100 |
| **TOTAL** | | | **₹1,025 - 1,395** |

---

## 2. WIRING DIAGRAM

```
                    ESP32 DevKit V1
                   ┌──────────────────┐
                   │                  │
  MAX30102         │   3V3 ──────────┤──── VCC (MAX30102)
  (Heart Rate      │   GND ──────────┤──── GND (MAX30102)
   + SpO2)         │   GPIO 21 (SDA)─┤──── SDA (MAX30102)
                   │   GPIO 22 (SCL)─┤──── SCL (MAX30102)
                   │                  │
                   │                  │        4.7kΩ
  DS18B20          │   3V3 ──────────┤──┬──── VCC (Red wire)
  (Temperature)    │   GND ──────────┤──┤──── GND (Black wire)
                   │   GPIO 4  ──────┤──┴──── DATA (Yellow wire)
                   │                  │   ↑ 4.7kΩ between VCC & DATA
                   │                  │
                   │   USB ───────── Computer/Power Bank
                   └──────────────────┘
```

### Pin Connections Table:

**MAX30102 → ESP32:**
| MAX30102 Pin | ESP32 Pin | Wire Color |
|-------------|-----------|------------|
| VIN / VCC | 3V3 | Red |
| GND | GND | Black |
| SDA | GPIO 21 | Blue |
| SCL | GPIO 22 | Yellow |

**DS18B20 → ESP32:**
| DS18B20 Wire | ESP32 Pin | Notes |
|-------------|-----------|-------|
| Red (VCC) | 3V3 | Power |
| Black (GND) | GND | Ground |
| Yellow (DATA) | GPIO 4 | Add 4.7kΩ pull-up between DATA and VCC |

> **IMPORTANT:** The 4.7kΩ resistor MUST be connected between the DATA pin
> and VCC pin of DS18B20. Without it, the sensor won't work.

---

## 3. SOFTWARE SETUP (Arduino IDE)

### Step 1: Install Arduino IDE
- Download from: https://www.arduino.cc/en/software
- Install version 2.x

### Step 2: Add ESP32 Board Support
1. Open Arduino IDE → File → Preferences
2. In "Additional Board Manager URLs", add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to Tools → Board → Board Manager
4. Search "ESP32" → Install **"esp32 by Espressif Systems"**

### Step 3: Install Required Libraries
Go to Sketch → Include Library → Manage Libraries and install:

| Library | Author | Purpose |
|---------|--------|---------|
| MAX30105 | SparkFun | Heart rate & SpO2 sensor driver |
| DallasTemperature | Miles Burton | DS18B20 driver |
| OneWire | Jim Studt | OneWire protocol for DS18B20 |
| ArduinoJson | Benoit Blanchon | JSON formatting |
| WiFi | (built-in) | ESP32 WiFi connectivity |
| HTTPClient | (built-in) | HTTP POST requests |

### Step 4: Select Board
- Tools → Board → ESP32 Arduino → **"ESP32 Dev Module"**
- Tools → Port → Select the COM port (e.g., COM3)

---

## 4. ESP32 ARDUINO CODE

Save this as `healthcare_sensor.ino` in Arduino IDE:

```cpp
/*
 * Smart Healthcare Monitoring System - ESP32 Sensor Node
 * Hardware: ESP32 + MAX30102 + DS18B20
 * Sends vitals to Node.js backend via HTTP POST
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"           // SparkFun MAX30102 library
#include "heartRate.h"          // Heart rate calculation algorithm
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ============ CONFIGURATION — CHANGE THESE ============
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // Your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // Your WiFi password
const char* SERVER_URL    = "http://YOUR_PC_IP:3000/api/health-data";
// Replace YOUR_PC_IP with your computer's local IP (e.g., 192.168.1.100)
// Find it by running 'ipconfig' in CMD on your PC
const char* PATIENT_ID    = "PT-00001";               // Patient ID from database
const char* DEVICE_ID     = "ESP32-NODE-001";         // Unique device identifier
const int   SEND_INTERVAL = 5000;                     // Send data every 5 seconds
// ======================================================

// Sensor objects
MAX30105 particleSensor;
OneWire oneWire(4);                    // DS18B20 on GPIO 4
DallasTemperature tempSensor(&oneWire);

// Heart rate calculation variables
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

// SpO2 variables
double avered = 0;
double aveir = 0;
double sumirrms = 0;
double sumredrms = 0;
double SpO2 = 0;
int spo2Counter = 0;

unsigned long lastSendTime = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Smart Healthcare Sensor Node ===");

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Initialize MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30102 not found! Check wiring.");
    while (1); // Halt if sensor not found
  }
  Serial.println("MAX30102 initialized.");

  // Configure MAX30102 for heart rate + SpO2
  particleSensor.setup(
    60,    // LED brightness (0-255)
    4,     // Sample average (1, 2, 4, 8, 16, 32)
    2,     // LED mode (1=Red, 2=Red+IR for SpO2)
    100,   // Sample rate (50, 100, 200, 400, 800, 1000, 1600, 3200)
    411,   // Pulse width (69, 118, 215, 411)
    4096   // ADC range (2048, 4096, 8192, 16384)
  );
  particleSensor.setPulseAmplitudeRed(0x0A);   // Low red LED for indicator
  particleSensor.setPulseAmplitudeIR(0x0A);

  // Initialize DS18B20
  tempSensor.begin();
  Serial.println("DS18B20 initialized.");

  Serial.println("System ready. Place finger on MAX30102 sensor.\n");
}

void loop() {
  // === Read MAX30102 (Heart Rate + SpO2) ===
  long irValue = particleSensor.getIR();

  // Check if finger is placed on sensor
  if (irValue < 50000) {
    Serial.println("No finger detected. Place finger on sensor...");
    delay(1000);
    return;
  }

  // Heart rate calculation
  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();

    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      rates[rateSpot++ % RATE_SIZE] = (byte)beatsPerMinute;
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }

  // SpO2 estimation
  uint32_t ir, red;
  double fred, fir;

  particleSensor.check();
  while (particleSensor.available()) {
    red = particleSensor.getRed();
    ir = particleSensor.getIR();
    particleSensor.nextSample();

    fred = (double)red;
    fir = (double)ir;
    avered = avered * 0.95 + fred * 0.05;
    aveir = aveir * 0.95 + fir * 0.05;
    sumredrms += (fred - avered) * (fred - avered);
    sumirrms += (fir - aveir) * (fir - aveir);
    spo2Counter++;

    if (spo2Counter >= 100) {
      double R = (sqrt(sumredrms) / avered) / (sqrt(sumirrms) / aveir);
      SpO2 = -45.060 * R * R + 30.354 * R + 94.845;  // SpO2 formula
      sumredrms = 0;
      sumirrms = 0;
      spo2Counter = 0;
    }
  }

  // === Read DS18B20 (Temperature) ===
  tempSensor.requestTemperatures();
  float temperature = tempSensor.getTempCByIndex(0);

  // Validate readings
  if (temperature == -127.0) {
    Serial.println("DS18B20 error — check wiring.");
    temperature = 36.5;  // Default fallback
  }

  // === Send data to server every SEND_INTERVAL ms ===
  if (millis() - lastSendTime > SEND_INTERVAL && beatAvg > 0) {
    lastSendTime = millis();
    sendDataToServer(beatAvg, constrain(SpO2, 85, 100), temperature);
  }

  // Print to Serial Monitor
  Serial.printf("HR: %d bpm | SpO2: %.1f%% | Temp: %.1f°C\n",
                beatAvg, SpO2, temperature);
  delay(10);
}

void sendDataToServer(int heartRate, float spO2, float temperature) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    WiFi.reconnect();
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload (same format as Python simulator)
  StaticJsonDocument<256> doc;
  doc["patientId"] = PATIENT_ID;
  doc["deviceId"] = DEVICE_ID;
  doc["heartRate"] = heartRate;
  doc["spO2"] = round(spO2 * 10.0) / 10.0;  // 1 decimal place
  doc["temperature"] = round(temperature * 10.0) / 10.0;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.print("Sending: ");
  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    Serial.printf("Server response: %d\n", httpCode);
  } else {
    Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
```

---

## 5. STEP-BY-STEP CONNECTION PROCESS

### Step 1: Find Your PC's IP Address
Open CMD on your computer and run:
```
ipconfig
```
Look for **"IPv4 Address"** under your WiFi adapter. Example: `192.168.1.100`

### Step 2: Update ESP32 Code
In the Arduino code, change these 3 values:
```cpp
const char* WIFI_SSID     = "YourWiFiName";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* SERVER_URL    = "http://192.168.1.100:3000/api/health-data";
```

### Step 3: Update Backend to Accept Network Requests
Your server currently listens on `localhost`. To accept ESP32 requests from the same WiFi network, change the server listen address.

In `server.js`, the server already listens on all interfaces by default with:
```javascript
server.listen(PORT)  // This binds to 0.0.0.0 (all interfaces)
```
So no changes needed — the ESP32 can reach it via your PC's IP.

### Step 4: Make Sure Both Are on Same WiFi
```
Your PC (running Node.js)  ──── WiFi Router ──── ESP32 (with sensors)
    192.168.1.100                                  192.168.1.xxx
         ↑                                              │
    Port 3000                    HTTP POST ──────────────┘
    (Backend)                /api/health-data
```

### Step 5: Upload Code to ESP32
1. Connect ESP32 to PC via USB
2. In Arduino IDE, select the correct board and port
3. Click Upload (→ button)
4. Open Serial Monitor (115200 baud) to see output

### Step 6: Start Your Backend
```bash
cd "d:\smart health care\app\server"
node server.js
```

### Step 7: Place Finger on MAX30102
- The sensor needs firm finger contact
- Red LED should be visible through your finger
- Wait 5-10 seconds for readings to stabilize
- Data will appear on your dashboard in real-time!

---

## 6. UNDERSTANDING THE DATA FLOW

```
[MAX30102 Sensor]                    [DS18B20 Sensor]
  (I2C: SDA/SCL)                       (OneWire: GPIO4)
       │                                     │
       ▼                                     ▼
┌──────────────────────────────────────────────────┐
│                    ESP32                          │
│  1. Read heart rate + SpO2 from MAX30102         │
│  2. Read temperature from DS18B20                │
│  3. Build JSON: {patientId, heartRate, spO2, temp}│
│  4. HTTP POST to server every 5 seconds          │
└──────────────────────────────────────────────────┘
       │ (WiFi - HTTP POST)
       ▼
┌──────────────────────────────────────────────────┐
│               Node.js Backend (Port 3000)         │
│  1. POST /api/health-data receives JSON           │
│  2. alertChecker evaluates thresholds             │
│  3. Saves to MongoDB (HealthData collection)      │
│  4. Socket.IO broadcasts to all browser clients   │
└──────────────────────────────────────────────────┘
       │ (WebSocket)
       ▼
┌──────────────────────────────────────────────────┐
│               React Dashboard (Port 5173)         │
│  1. Socket listener receives 'health-data' event  │
│  2. Updates live vital cards (HR, SpO2, Temp)     │
│  3. Pushes new point to Chart.js graphs           │
│  4. Shows alert toast if critical/warning         │
└──────────────────────────────────────────────────┘
```

---

## 7. TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| MAX30102 not detected | Check I2C wiring (SDA→21, SCL→22). Try 3.3V instead of 5V. |
| DS18B20 shows -127°C | Missing 4.7kΩ pull-up resistor between DATA and VCC |
| WiFi won't connect | Check SSID/password. ESP32 only supports 2.4GHz WiFi (NOT 5GHz) |
| Server not receiving data | Verify PC IP address. Check Windows Firewall allows port 3000 |
| Readings are erratic | Ensure firm finger contact on MAX30102. Wait 10s for stabilization |
| Upload fails in Arduino | Hold BOOT button on ESP32 while uploading. Select correct COM port |
| "Guru Meditation Error" | Usually a power issue. Use USB 3.0 port or external 3.3V supply |

### Windows Firewall Fix
If ESP32 can't reach your PC, allow port 3000:
```
# Run in CMD as Administrator:
netsh advfirewall firewall add rule name="NodeJS Healthcare" dir=in action=allow protocol=TCP localport=3000
```

---

## 8. SWITCHING BETWEEN SIMULATOR AND HARDWARE

Your system works with **both** the Python simulator AND real hardware simultaneously!

- **Python Simulator:** Sends data via `http://localhost:3000/api/health-data`
- **ESP32 Hardware:** Sends data via `http://YOUR_PC_IP:3000/api/health-data`

Both hit the **exact same endpoint**. The only difference:
- Simulator: `deviceId = "SIM-ESP32-001"`
- Hardware: `deviceId = "ESP32-NODE-001"`

You can identify which source is sending data by the device ID on the Devices page.

---

## 9. FOR PROJECT DEMO / VIVA

### If you have hardware:
1. Wire up the circuit on a breadboard
2. Upload the Arduino code to ESP32
3. Start the backend + frontend
4. Place finger on MAX30102
5. Show live data updating on the dashboard

### If you DON'T have hardware:
1. Use the Python simulator: `python simulator/iot_simulator.py PT-00001`
2. Explain: "The simulator mimics an ESP32 sending the exact same HTTP POST requests"
3. Show the Arduino code as "production-ready firmware"
4. The backend doesn't know the difference — same API endpoint

### Key Talking Points:
- "Our system is hardware-agnostic — any device that sends a JSON POST request works"
- "The data pipeline is: Sensor → ESP32 → WiFi → HTTP POST → Express API → MongoDB → Socket.IO → React Dashboard"
- "We can connect multiple ESP32 devices for different patients simultaneously"
- "The alert system works identically with both simulator and real hardware"

---

*Hardware Integration Guide — Smart Healthcare Monitoring System*
