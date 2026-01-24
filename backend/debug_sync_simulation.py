import os
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
from datetime import datetime

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112" # dssgopalvarma

print(f"--- Simulating Sync for User: {USER_ID} ---")

# 1. Fetch Accounts
accs_resp = supabase.table("connected_accounts").select("*").eq("user_id", USER_ID).execute()
accounts = accs_resp.data
print(f"Found {len(accounts)} accounts.")

for acc in accounts:
    email = acc.get('email')
    print(f"\nProcessing {email} (ID: {acc.get('id')})...")
    token = acc.get('access_token')
    refresh = acc.get('refresh_token')
    
    # 2. Try Fetch with Backend Params
    # Backend uses timeMin=Today UTC, singleEvents=True, orderBy=startTime
    time_min = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
    url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={time_min}&singleEvents=true&orderBy=startTime&maxResults=50"
    headers = {'Authorization': f'Bearer {token}'}
    
    try:
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            items = r.json().get('items', [])
            print(f"  [SUCCESS] Fetched {len(items)} events.")
            for i in items:
                print(f"    - {i.get('summary')} ({i.get('start')})")
        
        elif r.status_code == 401:
            print(f"  [401] Token Expired.")
            if refresh:
                print("    Has refresh token. Attempting refresh...")
                # Simulate Refresh
                GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")
                GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
                
                ref_url = "https://oauth2.googleapis.com/token"
                data = {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token"
                }
                ref_r = requests.post(ref_url, data=data)
                if ref_r.status_code == 200:
                    print("    [REFRESH SUCCESS] Got new token.")
                    new_token = ref_r.json().get('access_token')
                    # Retry Fetch
                    headers2 = {'Authorization': f'Bearer {new_token}'}
                    r2 = requests.get(url, headers=headers2)
                    if r2.status_code == 200:
                        print(f"    [RETRY SUCCESS] Fetched {len(r2.json().get('items', []))} events.")
                    else:
                        print(f"    [RETRY FAIL] {r2.status_code} {r2.text}")
                else:
                    print(f"    [REFRESH FAIL] {ref_r.text}")
            else:
                 print("    [FAIL] No refresh token available.")
        
        else:
             print(f"  [FAIL] {r.status_code} {r.text}")

    except Exception as e:
        print(f"  [ERROR] {e}")
