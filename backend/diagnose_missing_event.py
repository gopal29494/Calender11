import os
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
from datetime import datetime

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET_TITLE = "meeting Time"

print(f"--- Diagnosing Missing Event: '{TARGET_TITLE}' ---")

# 1. Search in DB
try:
    print("Searching in 'events' table...")
    # ILIKE is case-insensitive
    resp = supabase.table("events").select("*").ilike("title", f"%{TARGET_TITLE}%").execute()
    
    if resp.data:
        print(f"[FOUND] Found {len(resp.data)} matching events in DB.")
        for ev in resp.data:
            print(f"  - ID: {ev['google_event_id']}")
            print(f"    User ID: {ev['user_id']}")
            print(f"    Account ID: {ev['account_id']}")
            print(f"    Start: {ev['start_time']}")
            print(f"    Meeting Link: {ev['meeting_link']}")
    else:
        print("[NOT FOUND] The event is NOT in the database.")

except Exception as e:
    print(f"DB Error: {e}")

print("\n--- Checking Account Tokens ---")
try:
    # Get all accounts
    accs = supabase.table("connected_accounts").select("*").execute()
    for acc in accs.data:
        print(f"Account: {acc.get('email')} (ID: {acc.get('id')})")
        token = acc.get('access_token')
        
        # Test Token
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1"
        headers = {'Authorization': f'Bearer {token}'}
        r = requests.get(url, headers=headers)
        
        if r.status_code == 200:
            print(f"  [OK] Token VALID.")
        else:
            print(f"  [FAIL] Token INVALID ({r.status_code}). reason: {r.text}")

except Exception as e:
    print(f"Token Check Error: {e}")
