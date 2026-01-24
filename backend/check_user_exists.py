from dotenv import load_dotenv
load_dotenv()

from services.supabase_client import supabase
import json

USER_ID = "dae97c6b-2c34-40c4-9676-b0305b9ef112"

try:
    print(f"Checking for User ID ({USER_ID}) in public.users...")
    response = supabase.table("users").select("*").eq("id", USER_ID).execute()
    
    if response.data:
        print("User FOUND in public.users:")
        print(response.data[0])
    else:
        print("User NOT FOUND in public.users!")
        # Check auth.users? We can't query auth schema directly easily via client usually, unless admin.
        
except Exception as e:
    print(f"Error: {e}")
