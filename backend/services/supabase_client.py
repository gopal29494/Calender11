import os
from supabase import create_client, Client

# Initialize Supabase Client (Singleton)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: Supabase Credentials not found in environment!")
    supabase: Client = None
else:
    from supabase.lib.client_options import ClientOptions
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(postgrest_client_timeout=10, storage_client_timeout=10))
    except Exception as e:
        print(f"Failed to initialize Supabase Client: {e}")
        supabase = None
