from dotenv import load_dotenv
load_dotenv()

from services.supabase_client import supabase
import json

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"

try:
    print("Fetching events for user...")
    response = supabase.table("events").select("*").eq("user_id", USER_ID).execute()
    events = response.data
    
    print(f"Found {len(events)} events.")
    for e in events:
        if "Scrum" in e.get('title', ''):
            print(f"Title: {e.get('title')}")
            print(f"  Google ID: {e.get('google_event_id')}")
            print(f"  UUID: {e.get('id')}")
            print(f"  Explicit Offsets: {e.get('reminder_offsets')}")
            print("-" * 20)

except Exception as e:
    print(f"Error: {e}")
