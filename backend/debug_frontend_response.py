import requests
import json

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"
URL = f"http://localhost:8000/reminders/upcoming?user_id={USER_ID}"

try:
    print(f"Fetching from {URL}...")
    resp = requests.get(URL)
    if resp.status_code == 200:
        data = resp.json()
        print("Settings:", json.dumps(data.get("settings"), indent=2))
        print(f"Found {len(data.get('reminders', []))} reminders.")
        for r in data.get('reminders', []):
            print(f"ID: {r.get('id')}")
            print(f"  Title: {r.get('title')}")
            print(f"  Offset: {r.get('minutes_before')} min")
            print(f"  Meeting Link: {r.get('meeting_link')}")
            print(f"  Trigger Immediately: {r.get('trigger_immediately')}")
            print("-" * 20)
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"Exception: {e}")
