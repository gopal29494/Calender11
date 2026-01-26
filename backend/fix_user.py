from dotenv import load_dotenv
load_dotenv()
import os
from supabase import create_client

# Explicitly load env vars to ensure we have the Service Key
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing Supabase credentials")
    exit(1)

supabase = create_client(url, key)

user_id = "a580f75e-f7d5-4fc3-ad11-e57a996ad36e"
email = "ajaypamarthi8@gmail.com"

print(f"Attempting to backfill user {user_id}...")

try:
    # Check if user already exists
    existing = supabase.table("users").select("*").eq("id", user_id).execute()
    if existing.data:
        print("User already exists in public.users.")
    else:
        # Insert user
        data = {
            "id": user_id,
            "email": email,
            "full_name": "Ajay Pamarthi", # Placeholder
            "avatar_url": "" 
        }
        res = supabase.table("users").insert(data).execute()
        print(f"Successfully inserted user: {res.data}")
except Exception as e:
    print(f"Error inserting user: {e}")
