import requests
import json

URL = "http://localhost:8000/reminders/events/cosm2c9pc4r6abb2cpij4b9kcdij2bb275i68b9o6di3eob5cgq38d34ck"
PAYLOAD = {"reminder_offsets": [5]}

try:
    print(f"Sending PUT to {URL}...")
    resp = requests.put(URL, json=PAYLOAD)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
