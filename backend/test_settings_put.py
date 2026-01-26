import requests
import json

URL = "http://localhost:8000/reminders/settings"

# Sample payload based on what frontend sends
payload = {
    "user_id": "a580f75e-f7d5-4fc3-ad11-e57a996ad36e", # Using a known ID from logs
    "global_reminder_offset_minutes": 30,
    "reminder_offsets": [30, 45],
    "default_alarm_sound": "default",
    "morning_mode_enabled": False,
    "morning_mode_sound": "default"
}

try:
    print("Sending PUT request...")
    resp = requests.put(URL, json=payload)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
