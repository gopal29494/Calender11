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
    print("Attempting to fetch from 'users' table...")
    response = supabase.table("users").select("*").limit(1).execute()
    print("Users table check:", response)
except Exception as e:
    print(f"Users table Error: {e}")

try:
    print("Attempting to fetch from 'alarm_settings' table...")
    response = supabase.table("alarm_settings").select("*").limit(1).execute()
    print("Alarm settings table check:", response)
except Exception as e:
    print(f"Alarm settings table Error: {e}")
