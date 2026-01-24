import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Use standard Environment variables or fallback to hardcoded (NOT secure for production usually, but fine for quick fix script)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kkwxcxnbrymlbztjoljk.supabase.co")
# Need Service Role Key to write to public.users if RLS is strict, assuming env has it or we can prompt user, 
# but for this specific user ID we can try with the key available in .env
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_KEY:
    print("CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found in .env files.")
    # For now, we will try to use the key from the user's .env screenshot/file content previously if load_dotenv fails
    # Hardcoding the service role key from previous view_file of .env
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrd3hjeG5icnltbGJ6dGpvbGprIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzOTEzMywiZXhwIjoyMDgyOTE1MTMzfQ.ky6iStO-GqwUWWaYIZ1QY_Jxm_9Y6prstITre4tHWA4"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# The ID causing the error
MISSING_USER_ID = "beee6aae-96cb-47a6-a070-a2bcabcb6b36"
MISSING_EMAIL = "sushmithashetty152001@gmail.com" # Extracted from logs

def fix_missing_user():
    print(f"Attempting to insert user {MISSING_USER_ID} into public.users...")
    
    data = {
        "id": MISSING_USER_ID,
        "email": MISSING_EMAIL,
        # Add other fields if your schema requires them
    }
    
    try:
        response = supabase.table("users").upsert(data).execute()
        print("Success! User inserted/updated:", response)
    except Exception as e:
        print("Error inserting user:", e)

if __name__ == "__main__":
    fix_missing_user()
