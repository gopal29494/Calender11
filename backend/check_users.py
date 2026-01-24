import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

emails = ["dssgopalvarma228@gmail.com", "gopalvarma2208@gmail.com", "padmavathisai99@gmail.com"]

print("--- User ID Mapping ---")
try:
    # Check public.users by ID
    target_ids = ["8071a739-153b-484b-9b36-3a4089295063", "38a18246-6915-45e6-bc73-df322308f893", "dae97c6b-2c34-40c4-9676-b0305b9ef112"]
    resp = supabase.table("users").select("*").in_("id", target_ids).execute()
    for u in resp.data:
        print(f"ID: {u['id']} -> Email: {u['email']}")

    print("\n--- Events for Meeting Time ---")
    TARGET = "meeting Time"
    resp = supabase.table("events").select("user_id, title").ilike("title", f"%{TARGET}%").execute()
    for ev in resp.data:
        print(f"Event '{ev['title']}' belongs to User ID: {ev['user_id']}")

except Exception as e:
    print(e)
