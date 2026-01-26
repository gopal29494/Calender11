import os
import asyncio
# Load .env manually
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, val = line.strip().split('=', 1)
                os.environ[key] = val

from services.supabase_client import supabase

async def check_user_state():
    user_id = "38a18246-6915-45e6-bc73-df322308f893"
    print(f"Checking state for user: {user_id}")
    
    # 1. Check Connected Accounts
    print("\n--- Connected Accounts ---")
    resp = supabase.table("connected_accounts").select("*").eq("user_id", user_id).execute()
    accounts = resp.data or []
    for acc in accounts:
        print(f"ID: {acc['id']}, Email: {acc['email']}, Active: {acc['is_active']}")
        
    # 2. Check Events
    print("\n--- Events (Count) ---")
    resp = supabase.table("events").select("id, account_id, title").eq("user_id", user_id).execute()
    events = resp.data or []
    print(f"Total Events: {len(events)}")
    
    # Group by account
    counts = {}
    for e in events:
        aid = e['account_id']
        counts[aid] = counts.get(aid, 0) + 1
        
    for aid, count in counts.items():
        print(f"Account {aid}: {count} events")

if __name__ == "__main__":
    asyncio.run(check_user_state())
