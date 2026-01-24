import os
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
import datetime

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Primary User ID (from logs)
USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"

print(f"--- Verifying Accounts for {USER_ID} ---")

# 1. Fetch Connected Accounts
try:
    resp = supabase.table("connected_accounts").select("*").eq("user_id", USER_ID).execute()
    accounts = resp.data or []
    print(f"Found {len(accounts)} linked accounts.")
    
    for acc in accounts:
        print(f"\nAccount: {acc.get('email')} (ID: {acc.get('id')})")
        token = acc.get('access_token')
        refresh = acc.get('refresh_token')
        print(f"  Has Refresh Token: {bool(refresh)}")
        
        # 2. Try Fetching Events
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5"
        headers = {'Authorization': f'Bearer {token}'}
        
        verify_resp = requests.get(url, headers=headers)
        
        if verify_resp.status_code == 200:
            print(f"  [SUCCESS] Google API Access OK. Found items: {len(verify_resp.json().get('items', []))}")
        elif verify_resp.status_code == 401:
             print("  [401] Token Expired. Attempting Refresh simulation...")
             # (Not implementing full refresh here, just noting fail)
        else:
             print(f"  [FAIL] {verify_resp.status_code} {verify_resp.text}")

except Exception as e:
    print(f"DB Error: {e}")
