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
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, val = line.strip().split('=', 1)
                os.environ[key] = val

async def inspect_user_data():
    user_id = "38a18246-6915-45e6-bc73-df322308f893" 
    print(f"Inspecting data for user: {user_id}")

    # 1. Check Connected Accounts
    print("\n--- CONNECTED ACCOUNTS ---")
    resp = supabase.table("connected_accounts").select("*").eq("user_id", user_id).execute()
    accounts = resp.data or []
    for acc in accounts:
        print(f"ID: {acc['id']}")
        print(f"  Email: {acc['email']}")
        print(f"  Is Active: {acc['is_active']}")
        print(f"  Provider: {acc['provider']}")
        print("-" * 20)

    # 2. Check Events
    print("\n--- EVENTS SNAPSHOT ---")
    resp = supabase.table("events").select("id, title, account_id").eq("user_id", user_id).execute()
    events = resp.data or []
    print(f"Total Events Found: {len(events)}")
    
    # Group by account ID
    counts = {}
    for e in events:
        aid = e.get('account_id')
        counts[aid] = counts.get(aid, 0) + 1
        
    for aid, count in counts.items():
        # Find email for this account_id
        email = "Unknown/HardDeleted"
        for acc in accounts:
            if acc['id'] == aid:
                email = acc['email']
                break
        print(f"Account {aid} ({email}): {count} events")

if __name__ == "__main__":
    asyncio.run(inspect_user_data())
