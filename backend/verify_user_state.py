
import os
from supabase import create_client, Client
import json

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    # Fallback to hardcoded from env dump if needed, but assuming env is loaded in shell
    print("Env vars missing")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

USER_ID = "38a18246-6915-45e6-bc73-df322308f893"

print(f"Checking state for user: {USER_ID}")

# 1. Check public.users
try:
    res = supabase.table("users").select("*").eq("id", USER_ID).execute()
    print(f"Public Users: {len(res.data)}")
    if res.data:
        print(f"User Email: {res.data[0].get('email')}")
except Exception as e:
    print(f"Error checking users: {e}")

# 2. Check connected_accounts
try:
    res = supabase.table("connected_accounts").select("*").eq("user_id", USER_ID).execute()
    print(f"Connected Accounts: {len(res.data)}")
    for acc in res.data:
        print(f"  - {acc.get('email')} (Active: {acc.get('is_active')})")
except Exception as e:
    print(f"Error checking accounts: {e}")
