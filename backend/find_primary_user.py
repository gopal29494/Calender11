import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

TARGET_EMAIL = "dssgopalvarma228@gmail.com"

print(f"--- Searching for {TARGET_EMAIL} ---")

try:
    # 1. Search in connected_accounts
    resp = supabase.table("connected_accounts").select("*").eq("email", TARGET_EMAIL).execute()
    if resp.data:
        for acc in resp.data:
            print(f"FOUND in connected_accounts!")
            print(f"  User ID (Owner): {acc['user_id']}")
            print(f"  Account ID: {acc['id']}")
            print(f"  Updated At: {acc['updated_at']}")
            
            # Check if this User ID exists in public.users
            uid = acc['user_id']
            u_resp = supabase.table("users").select("*").eq("id", uid).execute()
            if u_resp.data:
                print(f"  [OK] User {uid} exists in public.users.")
            else:
                 print(f"  [CRITICAL] User {uid} is MISSING from public.users.")

            # Check linked accounts for this User ID
            linked_resp = supabase.table("connected_accounts").select("*").eq("user_id", uid).execute()
            print(f"  Linked Accounts for {uid}:")
            for l in linked_resp.data:
                print(f"    - {l['email']} (ID: {l['id']})")
                
    else:
        print("Not found in connected_accounts.")

except Exception as e:
    print(f"Error: {e}")
