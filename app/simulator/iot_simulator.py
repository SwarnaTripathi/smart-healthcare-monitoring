"""
IoT Health Data Simulator
Simulates ESP32 + MAX30102 + DS18B20 sensor readings
Sends data to the backend server via HTTP POST every 3 seconds
"""

import requests
import time
import random
import sys
import math
import os

# Fix Windows console encoding
if os.name == 'nt':
    sys.stdout.reconfigure(encoding='utf-8')

SERVER_URL = "http://localhost:3000/api/health-data"

# Default patient ID - change this or pass as argument
PATIENT_ID = sys.argv[1] if len(sys.argv) > 1 else "PT-00001"
DEVICE_ID = "SIM-ESP32-001"

# Simulation parameters
INTERVAL = 3  # seconds between readings

# Base values for realistic simulation
base_hr = 75
base_spo2 = 97.5
base_temp = 36.6

# Anomaly settings
ANOMALY_CHANCE = 0.08  # 8% chance of anomaly per reading

def simulate_reading(t):
    """Generate realistic sensor readings with natural variation"""
    
    # Natural sinusoidal variation (simulates daily rhythm)
    hr_variation = math.sin(t * 0.05) * 5 + random.gauss(0, 2)
    spo2_variation = math.sin(t * 0.03) * 0.8 + random.gauss(0, 0.3)
    temp_variation = math.sin(t * 0.02) * 0.2 + random.gauss(0, 0.05)
    
    heart_rate = round(base_hr + hr_variation)
    spo2 = round(base_spo2 + spo2_variation, 1)
    temperature = round(base_temp + temp_variation, 1)
    
    # Simulate anomaly
    if random.random() < ANOMALY_CHANCE:
        anomaly_type = random.choice(['high_hr', 'low_hr', 'low_spo2', 'high_temp'])
        if anomaly_type == 'high_hr':
            heart_rate = random.randint(125, 160)
            print("  [!] ANOMALY: High heart rate!")
        elif anomaly_type == 'low_hr':
            heart_rate = random.randint(38, 48)
            print("  [!] ANOMALY: Low heart rate!")
        elif anomaly_type == 'low_spo2':
            spo2 = round(random.uniform(85, 92), 1)
            print("  [!] ANOMALY: Low SpO2!")
        elif anomaly_type == 'high_temp':
            temperature = round(random.uniform(38.5, 40.5), 1)
            print("  [!] ANOMALY: High temperature!")
    
    # Clamp values to realistic ranges
    heart_rate = max(35, min(180, heart_rate))
    spo2 = max(80, min(100, spo2))
    temperature = max(34.0, min(42.0, temperature))
    
    return heart_rate, spo2, temperature

def main():
    print("")
    print("=" * 56)
    print("  IoT Health Data Simulator")
    print("  " + "-" * 40)
    print(f"  Patient:   {PATIENT_ID}")
    print(f"  Device:    {DEVICE_ID}")
    print(f"  Interval:  {INTERVAL}s")
    print(f"  Server:    {SERVER_URL}")
    print("=" * 56)
    print("")
    print("Sending health data... Press Ctrl+C to stop.\n")
    
    t = 0
    consecutive_errors = 0
    
    while True:
        try:
            heart_rate, spo2, temperature = simulate_reading(t)
            
            payload = {
                "patientId": PATIENT_ID,
                "deviceId": DEVICE_ID,
                "heartRate": heart_rate,
                "spO2": spo2,
                "temperature": temperature
            }
            
            response = requests.post(SERVER_URL, json=payload, timeout=5)
            
            if response.status_code == 201:
                data = response.json()
                status = data.get('status', 'normal')
                icon = "[OK]" if status == 'normal' else "[!!]" if status == 'warning' else "[XX]"
                
                print(f"  {icon} HR: {heart_rate:>3d} bpm | SpO2: {spo2:>5.1f}% | Temp: {temperature:>5.1f} C | Status: {status}")
                consecutive_errors = 0
            else:
                print(f"  [ERR] Server error: {response.status_code}")
                consecutive_errors += 1
                
        except requests.exceptions.ConnectionError:
            print(f"  [ERR] Cannot connect to server at {SERVER_URL}")
            consecutive_errors += 1
            if consecutive_errors >= 5:
                print("\n  [FATAL] Too many connection errors. Is the server running?")
                print(f"     Start it with: cd app/server && npm run dev\n")
        except requests.exceptions.Timeout:
            print("  [TIMEOUT] Request timeout")
        except KeyboardInterrupt:
            print(f"\n\n  Simulator stopped. Sent {t} readings.\n")
            sys.exit(0)
        
        t += 1
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
