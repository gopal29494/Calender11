from dotenv import load_dotenv
load_dotenv()

from services.supabase_client import supabase
import requests
import json

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"
BACKEND_URL = "http://localhost:8000"

try:
    print("Fetching connected accounts...")
    resp = supabase.table("connected_accounts").select("*").eq("user_id", USER_ID).execute()
    accounts = resp.data
    
    if not accounts:
        print("No connected accounts found.")
        exit()
        
    acc = accounts[0]
    token = acc.get('access_token')
    refresh = acc.get('refresh_token')
    
    print(f"Using account {acc.get('email')}...")
    
    headers = {
        "X-User-Id": USER_ID,
        "X-Google-Token": token,
        "X-Google-Refresh-Token": refresh if refresh else ""
    }
    
    print("Triggering /calendar/fetch-from-google...")
    sync_resp = requests.get(f"{BACKEND_URL}/calendar/fetch-from-google", headers=headers)
    
    print(f"Status: {sync_resp.status_code}")
    # print(f"Response: {sync_resp.text[:500]}...") # Truncate
    
    data = sync_resp.json()
    if data.get("upsert_error"):
        print(f"!!! UPSERT ERROR: {data.get('upsert_error')}")

    events = data.get('events', [])
    print(f"Received {len(events)} events.")
    
    # Check if 'cosm...' event is in the list
    found = False
    for e in events:
        if "cosm" in str(e.get('id')):
             print(f"Target Event FOUND in response: {e.get('title')} (ID: {e.get('id')})")
             found = True
             break
    if not found:
        print("Target Event NOT in response.")

except Exception as e:
    print(f"Error: {e}")
