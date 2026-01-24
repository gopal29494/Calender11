import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing credentials")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Fetching one row from alarm_settings...")
    response = supabase.table("alarm_settings").select("*").limit(1).execute()
    if response.data:
        print("Columns found:", response.data[0].keys())
    else:
        print("Table exists but is empty. Trying to insert a dummy to check schema...")
        # We can't easily check schema without data via JS client, but we can try an insert and see if it fails.
        # Check if 'reminder_offsets' is accepted
        try:
             # Just checking if we can select specific columns
             supabase.table("alarm_settings").select("reminder_offsets").limit(1).execute()
             print("Column 'reminder_offsets' exists.")
        except Exception as e:
             print(f"Column 'reminder_offsets' ERROR: {e}")

        try:
             supabase.table("alarm_settings").select("morning_mode_enabled").limit(1).execute()
             print("Column 'morning_mode_enabled' exists.")
        except Exception as e:
             print(f"Column 'morning_mode_enabled' ERROR: {e}")

except Exception as e:
    print(f"Error: {e}")
