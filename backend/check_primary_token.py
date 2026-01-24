import os
from dotenv import load_dotenv
from supabase import create_client, Client
import requests

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

EMAIL = "dssgopalvarma228@gmail.com"

print(f"--- Checking Token for {EMAIL} ---")

resp = supabase.table("connected_accounts").select("*").eq("email", EMAIL).execute()
if resp.data:
    acc = resp.data[0]
    print(f"Account ID: {acc['id']}")
    print(f"User ID: {acc['user_id']}")
    token = acc.get('access_token')
    refresh = acc.get('refresh_token')
    print(f"Access Token Present: {bool(token)}")
    print(f"Refresh Token Present: {bool(refresh)}")
    
    if token:
        # Validate
        url = "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1"
        headers = {'Authorization': f'Bearer {token}'}
        r = requests.get(url, headers=headers)
        print(f"Token Validation: {r.status_code}")
        if r.status_code != 200:
            print(f"Response: {r.text}")
    else:
        print("No Access Token to validate.")
else:
    print("Account not found in DB.")
