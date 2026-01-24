from dotenv import load_dotenv
load_dotenv()
import os
from services.supabase_client import supabase

if not supabase:
    print("Supabase client failed to initialize")
    exit(1)

print("Checking public.users...")
try:
    users = supabase.table("users").select("*").limit(5).execute()
    print(f"Users found: {len(users.data)}")
    for u in users.data:
        print(f" - {u.get('email', 'no-email')} ({u['id']})")
except Exception as e:
    print(f"Error reading users: {e}")

print("\nChecking alarm_settings...")
try:
    settings = supabase.table("alarm_settings").select("*").limit(1).execute()
    if settings.data:
        print("Settings columns:", settings.data[0].keys())
    else:
        print("Settings table is empty or accessible.")
except Exception as e:
    print(f"Error reading settings: {e}")
