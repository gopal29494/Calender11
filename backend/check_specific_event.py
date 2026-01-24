from dotenv import load_dotenv
load_dotenv()

from services.supabase_client import supabase
import json

TARGET_ID = "cosm2c9pc4r6abb2cpij4b9kcdij2bb275i68b9o6di3eob5cgq38d34ck"

try:
    print(f"Searching for Google ID like: %Client meeting%")
    response = supabase.table("events").select("*").ilike("title", "%Client meeting%").execute()
    
    if response.data:
        print(f"Found {len(response.data)} events.")
        print(response.data[0])
    else:
        print("Event NOT FOUND with partial match.")

except Exception as e:
    print(f"Error: {e}")
