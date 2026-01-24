from services.supabase_client import supabase
import json

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"

try:
    print("Fetching events for user...")
    response = supabase.table("events").select("*").eq("user_id", USER_ID).execute()
    events = response.data
    
    print(f"Found {len(events)} events.")
    for e in events:
        print(f"Title: {e.get('title')}")
        print(f"  Description: {e.get('description')}")
        print(f"  Location: {e.get('location')}")
        print(f"  Meeting Link: {e.get('meeting_link')}")
        print("-" * 20)

except Exception as e:
    print(f"Error: {e}")
