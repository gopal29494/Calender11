import requests
import json
from dotenv import load_dotenv
load_dotenv()
from services.supabase_client import supabase

BASE_URL = "http://localhost:8000"

def check_upcoming():
    print("Checking upcoming reminders...")
    # Get user id
    users = supabase.table("users").select("id").limit(1).execute()
    if not users.data:
        print("No user found")
        return
    user_id = users.data[0]['id']
    
    try:
        resp = requests.get(f"{BASE_URL}/reminders/upcoming?user_id={user_id}")
        data = resp.json()
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_upcoming()
