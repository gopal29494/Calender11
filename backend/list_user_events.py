import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112" # dssgopalvarma
EMAIL = "dssgopalvarma228@gmail.com"

print(f"--- listing Events for {EMAIL} ({USER_ID}) ---")

# Get Account Map
acc_resp = supabase.table("connected_accounts").select("id, email").eq("user_id", USER_ID).execute()
acc_map = {a['id']: a['email'] for a in acc_resp.data}
print(f"Accounts: {acc_map}")

# Get Events
resp = supabase.table("events").select("*").eq("user_id", USER_ID).order("start_time", desc=True).limit(20).execute()

if resp.data:
    for ev in resp.data:
        src = acc_map.get(ev['account_id'], f"Unknown({ev['account_id']})")
        print(f"[{src}] {ev['title']} ({ev['start_time']}) ID: {ev['google_event_id']}")
else:
    print("No events found in DB.")
