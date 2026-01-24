import requests
import json

url = "http://localhost:8000/reminders/settings"
payload = {
    "user_id": "dae97c6b-2c34-40c4-9676-b0305b9ef112",
    "global_reminder_offset_minutes": 30,
    "reminder_offsets": [30],
    "default_alarm_sound": "default",
    "morning_mode_enabled": False,
    "morning_mode_sound": "default"
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.put(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Request failed: {e}")
