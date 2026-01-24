import requests
import json
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()
from services.supabase_client import supabase

BASE_URL = "http://localhost:8000"

def debug():
    print("--- Debugging Reminders ---")
    
    # 1. Get user
    try:
        users = supabase.table("users").select("id").limit(1).execute()
        if not users.data:
            print("No users found.")
            return
        user_id = users.data[0]['id']
        print(f"User ID: {user_id}")
    except Exception as e:
        print(f"Error fetching user: {e}")
        return

    # 2. Fetch upcoming
    url = f"{BASE_URL}/reminders/upcoming?user_id={user_id}"
    print(f"Fetching: {url}")
    
    try:
        resp = requests.get(url)
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print("Error:", resp.text)
            return
            
        data = resp.json()
        reminders = data.get("reminders", [])
        
        print(f"Found {len(reminders)} reminders.")
        
        for r in reminders:
            print(f"\n[Reminder]")
            print(f"  ID: {r.get('id')}")
            print(f"  Title: {r.get('title')}")
            print(f"  Offsets: {r.get('minutes_before')} min")
            print(f"  Reminder Time: {r.get('reminder_time')}")
            
            # Check time diff manually
            rem_time = datetime.fromisoformat(r['reminder_time'].replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            diff = (rem_time - now).total_seconds()
            print(f"  Starts in: {diff:.1f} seconds")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    debug()
