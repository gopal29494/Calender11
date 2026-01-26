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

async def cleanup_ghost_events():
    print("Starting cleanup of events from inactive accounts...")
    
    # 1. Get all inactive accounts
    try:
        response = supabase.table("connected_accounts").select("id, email").eq("is_active", False).execute()
        inactive_accounts = response.data or []
        
        print(f"Found {len(inactive_accounts)} inactive accounts.")
        for acc in inactive_accounts:
            print(f"  - {acc['email']} (ID: {acc['id']})")
        
        ids_to_clean = [acc['id'] for acc in inactive_accounts]
        
        # 2. Delete events for these accounts
        # Note: We must ensure we cast ID to string if necessary, but supabase-py handles UUIDs usually.
        if ids_to_clean:
            print(f"Deleting events for account IDs: {ids_to_clean}")
            del_resp = supabase.table("events").delete().in_("account_id", ids_to_clean).execute()
            
            if del_resp.data:
                print(f"Deleted {len(del_resp.data)} events.")
            else:
                print("No events deleted (maybe none existed?).")
                
            # Verify events are gone
            check_resp = supabase.table("events").select("id").in_("account_id", ids_to_clean).execute()
            if check_resp.data:
                print(f"WARNING: {len(check_resp.data)} events REMAIN after delete!")
            else:
                print("Verification successful: No events remain for inactive accounts.")
        else:
             print("No inactive accounts found to clean.")
        
    except Exception as e:
        print(f"Error during cleanup: {e}")

if __name__ == "__main__":
    asyncio.run(cleanup_ghost_events())
