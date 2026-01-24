import requests
from dotenv import load_dotenv
load_dotenv()
import os
from services.supabase_client import supabase
import json

# Setup
BASE_URL = "http://localhost:8000"

def verify():
    print("--- Starting Verification ---")
    
    # 1. Get a user
    try:
        users = supabase.table("users").select("id").limit(1).execute()
        if not users.data:
            print("No users found in DB.")
            return
        user_id = users.data[0]['id']
        print(f"Using User ID: {user_id}")
    except Exception as e:
        print(f"Error fetching user: {e}")
        return

    # 2. Get an event's Google ID from DB
    try:
        # We need a google_event_id. Let's just pick one from the events table.
        events_resp = supabase.table("events").select("google_event_id, title").limit(1).execute()
        if not events_resp.data:
             print("No events in DB.")
             return
             
        target_event = events_resp.data[0]
        event_id = target_event['google_event_id']
        print(f"Target Event: {target_event.get('title')} (Google ID: {event_id})")
        
    except Exception as e:
        print(f"Error fetching event: {e}")
        return

    # 3. Set a NEW, custom offset
    # We will use the Google ID for the API call
    new_offset = [15, 60]
    print(f"Setting new offset: {new_offset} for event {event_id}...")
    
    try:
        update_url = f"{BASE_URL}/reminders/events/{event_id}"
        payload = {"reminder_offsets": new_offset}
        update_resp = requests.put(update_url, json=payload)
        
        if update_resp.status_code != 200:
            print(f"Update failed: {update_resp.text}")
            return
        
        print("Update response:", update_resp.json())
        
    except Exception as e:
        print(f"Error updating event: {e}")
        return

    # 4. Verify update via API
    print("Verifying update...")
    try:
        resp = requests.get(f"{BASE_URL}/reminders/upcoming?user_id={user_id}")
        data = resp.json()
        reminders = data.get("reminders", [])
        
        # Find the specific reminder instance with the new offset
        found = False
        for r in reminders:
            if r['event_id'] == event_id:
                if r['minutes_before'] == new_offset[0]:
                    print("SUCCESS! Found reminder with updated offset.")
                    found = True
                    break
                else:
                    print(f"Found reminder but offset mismatch: {r['minutes_before']}")
        
        if not found:
            print("FAILURE: Did not find reminder with new offset.")
            
    except Exception as e:
        print(f"Error verifying: {e}")

    # 5. Cleanup/Revert (Optional: Reset to NULL to use global defaults)
    # Uncomment to revert
    # print("Reverting changes...")
    # requests.put(f"{BASE_URL}/reminders/events/{event_id}", json={"reminder_offsets": []}) # or null? Pydantic expects list. Empty list = no reminders. None = default? 
    # To revert to default, we probably updated our model to accept Optional[List] or handle empty list.
    # Our model says "reminder_offsets: List[int]". It doesn't allow None easily via JSON unless configured.
    # Actually, in DB NULL means default. But API expects List[int]. 
    # If we send [], it writes []. 
    # If we want to write NULL, we might need to update the API to accept None.
    # For now, let's just leave it modified as proof.

if __name__ == "__main__":
    verify()
