from dotenv import load_dotenv
load_dotenv()

import requests
import json

# Use one of the IDs from the previous step output
EVENT_ID = "35073adf-055b-4d1c-9c1e-6f77b55835c2" # This is the Google Event ID I saw earlier in logs? No, that was id.
# Let's use the one I WILL see in the output. I'll hardcode one based on finding "Daily Scrum"
# But I need to read the output of the previous command first.
# Oh, I can just use python to find it dynamically.

from services.supabase_client import supabase

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"
BACKEND_URL = "http://localhost:8000"

try:
    # 1. Get an event ID
    print("Finding an event...")
    response = supabase.table("events").select("*").eq("user_id", USER_ID).ilike("title", "%Scrum%").limit(1).execute()
    if not response.data:
        print("No event found.")
        exit()
        
    event = response.data[0]
    google_id = event['google_event_id'] 
    print(f"Target Event: {event['title']} (Google ID: {google_id})")
    
    # 2. Simulate PUT request
    url = f"{BACKEND_URL}/reminders/events/{google_id}"
    payload = {"reminder_offsets": [10, 5]}
    
    print(f"Sending PUT to {url} with {payload}...")
    resp = requests.put(url, json=payload)
    
    if resp.status_code == 200:
        print("Update Success:", resp.json())
        
        # 3. Verify persistence
        print("Verifying DB...")
        check = supabase.table("events").select("reminder_offsets").eq("google_event_id", google_id).execute()
        print("DB Value:", check.data[0]['reminder_offsets'])
    else:
        print(f"Update Failed: {resp.status_code} - {resp.text}")

except Exception as e:
    print(f"Error: {e}")
