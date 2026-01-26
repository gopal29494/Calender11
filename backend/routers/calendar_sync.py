from fastapi import APIRouter, HTTPException, Header
import os
from services.supabase_client import supabase
import requests
from datetime import datetime, timedelta
import re



# Config
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

router = APIRouter()

def refresh_google_token(account):
    """Uses refresh_token to get a new access_token and updates DB."""
    refresh_token = account.get('refresh_token')
    if not refresh_token:
        print(f"[{account.get('email')}] No refresh token available.")
        return None
        
    url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }
    
    try:
        print(f"Refreshing token for {account.get('email')}...")
        resp = requests.post(url, data=data)
        if resp.status_code == 200:
            new_tokens = resp.json()
            new_access = new_tokens.get('access_token')
            print(f"[{account.get('email')}] Token refreshed successfully.")
            
            # Update DB with new token and naive UTC time
            supabase.table('connected_accounts').update({
                'access_token': new_access,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', account['id']).execute()
            
            return new_access
        else:
            print(f"[{account.get('email')}] Refresh failed: {resp.text}")
            return None
    except Exception as e:
        print(f"Error refreshing token: {e}")
        return None


@router.get("/fetch-from-google")
def fetch_google_events(x_user_id: str = Header(None), x_google_token: str = Header(None), x_google_refresh_token: str = Header(None)):
    
    if not x_user_id:
         raise HTTPException(status_code=400, detail="Missing X-User-Id header")

    print(f"\n--- Starting Event Fetch for User: {x_user_id} ---")
    all_events = []
    
    # 1. Get all connected accounts from DB
    try:
        # Filter by is_active (Soft Delete)
        # Note: If migration run, this works. If not, might error? 
        # Ideally we catch error, but for now assuming migration applied.
        db_accounts = supabase.table('connected_accounts').select('*').eq('user_id', x_user_id).eq('is_active', True).execute()
        accounts = db_accounts.data or []
    except Exception as e:
        print(f"DB Error fetching accounts: {e}")
        # Fallback: try fetching without is_active if it failed (migration missing?)
        try:
             db_accounts = supabase.table('connected_accounts').select('*').eq('user_id', x_user_id).execute()
             accounts = db_accounts.data or []
        except:
             accounts = []
    
    print(f"Found {len(accounts)} connected accounts in DB.")

    # 2. Build list of sources and fetch
    try:
        sources = []
        
        # Add DB accounts
        for acc in accounts:
            sources.append({
                'token': acc.get('access_token'),
                'refresh_token': acc.get('refresh_token'),
                'email': acc.get('email'),
                'id': acc.get('id'),
                'is_primary': False
            })

        # Add Primary Header Token (Fallback/Session)
        if x_google_token:
            # 2a. Resolve Email for Primary Token
            try:
                user_info_resp = requests.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={'Authorization': f'Bearer {x_google_token}'}
                )
                if user_info_resp.status_code == 200:
                    u_info = user_info_resp.json()
                    p_email = u_info.get('email', '').strip().lower()
                    
                    with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                        dbg.write(f"\n[{datetime.utcnow()}] Primary Token Email: '{p_email}'\n")

                    # CHECK IF SOFT DELETED (Inactive)
                    is_inactive = False
                    try:
                        # Case insensitive match just to be safe, though we stored as is.
                        # We use ilike or just exact match on the normalized email?
                        # Our DB stores what Google gave us. standardizing to lower is good practice.
                        check_resp = supabase.table("connected_accounts").select("id, is_active, email")\
                            .eq("user_id", x_user_id)\
                            .eq("email", p_email)\
                            .execute()
                        
                        msg = f"DB Check for '{p_email}': {check_resp.data}"
                        print(msg)
                        with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                            dbg.write(f"  {msg}\n")

                        if check_resp.data:
                            # Account exists. Check activity.
                            # Default is_active is TRUE. So check explicit False.
                            acc_record = check_resp.data[0]
                            if acc_record.get("is_active") is False:
                                is_inactive = True
                    except Exception as e:
                        print(f"Error checking inactive status: {e}")
                        with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                            dbg.write(f"  Error checking status: {e}\n")
                    
                    if is_inactive:
                        skip_msg = f"Skipping INACTIVE primary account: {p_email}"
                        print(skip_msg)
                        with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                            dbg.write(f"  {skip_msg}\n")
                    else:
                        # 2b. Upsert into connected_accounts to get a valid ID for persistence
                        # Only upsert if NOT inactive.
                        
                        # CAREFUL: If we upsert here, we might accidentally re-activate if we are not careful?
                        # We only want to upsert if it DOES NOT EXIST.
                        # If it exists and is_active=True, we update tokens.
                        
                        db_action = ""
                        p_id = None
                        
                        if check_resp.data:
                            # Exists and is active (checked above)
                            p_id = check_resp.data[0]['id']
                            update_data = {
                                "access_token": x_google_token,
                                "updated_at": datetime.utcnow().isoformat()
                            }
                            if x_google_refresh_token:
                                update_data["refresh_token"] = x_google_refresh_token
                            
                            supabase.table("connected_accounts").update(update_data).eq("id", p_id).execute()
                            db_action = "Updated"
                        else:
                            # Does not exist. Insert new.
                            account_data = {
                                "user_id": x_user_id,
                                "email": p_email,
                                "access_token": x_google_token,
                                "is_active": True,
                                "updated_at": datetime.utcnow().isoformat()
                            }
                            if x_google_refresh_token:
                                account_data["refresh_token"] = x_google_refresh_token
                                
                            upsert_resp = supabase.table("connected_accounts").insert(account_data).execute()
                            if upsert_resp.data:
                                p_id = upsert_resp.data[0]['id']
                                db_action = "Inserted"
                            else:
                                db_action = "Insert Failed"

                        if p_id:
                            sources.append({
                                'token': x_google_token,
                                'refresh_token': x_google_refresh_token, # Might be None
                                'email': p_email,
                                'id': p_id,
                                'is_primary': True
                            })
                            with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                                dbg.write(f"  Processed Primary: {db_action} ID [{p_id}]\n")
                        else:
                             print("Failed to persist primary account.")
                else:
                    print(f"Failed to get user info for primary token: {user_info_resp.text}")
            except Exception as e:
                print(f"Error resolving primary token: {e}")
                with open(r"C:\varma alarm\backend\debug_sync_live.txt", "a") as dbg:
                    dbg.write(f"  Error resolving primary: {e}\n")

        if not sources:
             print("No accounts connected and no session token provided.")
             return {"events": []}
        
        # Time Min start of today UTC
        # Use simple naive UTC + 'Z' to satisfy Google API
        time_min = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + 'Z'
        print(f"Fetching events from: {time_min}")
        
        fetched_emails = set()
        events_to_upsert = []

        for source in sources:
            source_email = source.get('email', 'Unknown')
            token = source['token']
            
            # Dedup
            if source_email in fetched_emails and source_email != 'Primary (Session)':
                continue

            print(f"Fetching for: {source_email}...")

            # Function to fetch all pages
            def fetch_with_retry(token, refresh_token):
                all_items = []
                page_token = None
                
                while True:
                    url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={time_min}&singleEvents=true&orderBy=startTime&maxResults=250"
                    if page_token:
                        url += f"&pageToken={page_token}"
                        
                    headers = {'Authorization': f'Bearer {token}'}
                    print(f"[{source_email}] Requesting page...")
                    response = requests.get(url, headers=headers)
                    
                    if response.status_code == 401:
                        if refresh_token:
                            print(f"[{source_email}] Token 401. Attempting refresh...")
                            new_token = refresh_google_token(source)
                            if new_token:
                                token = new_token # Update local token var for next loop
                                continue # Retry the SAME request (loop will rebuild url without nextToken if it was first page, or with it? Wait. Logic needs to be robust)
                                # Actually, if we refresh, we should probably restart the fetch or just retry the current page?
                                # Ideally retry current request.
                                # But let's keep it simple: if refresh works, update token and retry the iteration.
                            else:
                                print(f"[{source_email}] Refresh failed. Abort.")
                                return 401, []
                        else:
                             return 401, []
                    
                    if response.status_code != 200:
                        return response.status_code, []
                        
                    data = response.json()
                    items = data.get('items', [])
                    all_items.extend(items)
                    
                    page_token = data.get('nextPageToken')
                    if not page_token:
                        break
                        
                return 200, all_items

            status_code, items = fetch_with_retry(token, source['refresh_token'])
            
            # Process Response
            if status_code == 200:
                if source_email != 'Unknown':
                     fetched_emails.add(source_email)

                print(f"[{source_email}] Success. Found {len(items)} events total.")
                
                for item in items:
                    # Skip cancelled
                    if item.get('status') == 'cancelled':
                        continue
                        
                    start_raw = item.get('start', {}).get('dateTime') or item.get('start', {}).get('date')
                    end_raw = item.get('end', {}).get('dateTime') or item.get('end', {}).get('date')
                    
                    # Formatting time string for UI
                    try:
                        # Simple parse
                        if 'T' in start_raw:
                            # Is ISO format with likely offset or Z
                            # We just want a simple HH:MM AM/PM representation
                            # This is rough but works for display
                            # Better: use dateutil, but trying to keep deps minimal if not installed
                             val = start_raw.split('T')[1][:5]
                             # Convert 24h to 12h manually or use datetime
                             # Let's try datetime parse
                             dt = datetime.fromisoformat(start_raw.replace('Z', '+00:00'))
                             time_str = dt.strftime("%I:%M %p")
                        else:
                             # Full day
                             time_str = "All Day"
                    except:
                        time_str = start_raw

                    
                    # Extract Meeting Link
                    meeting_link = item.get('hangoutLink')
                    if not meeting_link:
                        # Search in description and location
                        text_to_search = (item.get('description') or '') + " " + (item.get('location') or '')
                        # Regex for common meeting tools (Google Meet, Zoom, Teams)
                        try:
                            # Expanded regex to catch more variations
                            match = re.search(r'(https?://)?(meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}|zoom\.us/j/\d+|teams\.microsoft\.com/l/meetup-join/[^\s"<]+)', text_to_search, re.IGNORECASE)
                            if match:
                                meeting_link = match.group(0)
                                # Ensure protocol
                                if not meeting_link.startswith('http'):
                                    meeting_link = 'https://' + meeting_link
                                print(f"DEBUG: Found Manual Meeting Link for '{item.get('summary')}': {meeting_link}")
                        except Exception as e:
                            print(f"Regex Error: {e}")

                    event_obj = {
                        'id': item.get('id'),
                        'title': item.get('summary', '(No Title)'),
                        'start': start_raw,
                        'end': end_raw,
                        'time': time_str,
                        'link': item.get('htmlLink'),
                        'meeting_link': meeting_link,
                        'source': source_email,
                        'calendar': 'Google',
                        'color': '#4F46E5' 
                    }
                    all_events.append(event_obj)
                    
                    # DB Upsert Preparation
                    # Persist ALL accounts now since we have valid IDs
                    if source['id']:
                        if not start_raw or not end_raw:
                            print(f"Skipping event {item.get('id')} due to missing dates.")
                            continue

                        db_record = {
                             "user_id": x_user_id,
                             "account_id": source['id'],
                             "google_event_id": item['id'],
                             "title": item.get('summary', '(No Title)'),
                             "description": item.get('description', ''),
                             "start_time": start_raw,
                             "end_time": end_raw,
                             "is_all_day": 'date' in item.get('start', {}),
                             "location": item.get('location'),
                             "html_link": item.get('htmlLink'),
                             "meeting_link": meeting_link,
                             "updated_at": datetime.utcnow().isoformat()
                        }
                        events_to_upsert.append(db_record)

            else:
                 print(f"[{source_email}] API Error: {response.status_code} {response.text}")

        # Upsert
        upsert_error = None
        if events_to_upsert:
            try:
                print(f"DEBUG: Prepare to persist {len(events_to_upsert)} events.")
                # print(f"Sample Event: {events_to_upsert[0]['google_event_id']}")
                resp = supabase.table("events").upsert(events_to_upsert, on_conflict="account_id, google_event_id").execute()
                print(f"Events persisted. Response: {len(resp.data) if resp.data else 'No Data'}")
            except Exception as e:
                print(f"Upsert failed: {e}")
                upsert_error = str(e)
        else:
             print("DEBUG: events_to_upsert is EMPTY.")

    except Exception as e:
        print(f"CRITICAL ERROR in fetch_google_events: {e}")
        import traceback
        traceback.print_exc()
        return {"events": all_events, "error": str(e)}

    # LOG TO FILE
    try:
        log_path = r"C:\varma alarm\backend\debug_log_v2.txt"
        with open(log_path, "a") as f:
            f.write(f"\n[{datetime.utcnow()}] Returning {len(all_events)} events. Upsert Error: {upsert_error}\n")
            if events_to_upsert:
                f.write(f"  Upserting {len(events_to_upsert)} events.\n")
                # specific check
                found_target = False
                for e in events_to_upsert:
                     if "cosm" in e.get("google_event_id", ""):
                          f.write(f"  Target Event FOUND in upsert list: {e}\n")
                          found_target = True
                if not found_target:
                     f.write(f"  Target Event NOT in upsert list.\n")
            else:
                f.write("  events_to_upsert was EMPTY.\n")
    except Exception as e:
        print(f"Log write failed: {e}")

    print(f"Returning {len(all_events)} events total.")
    return {"events": all_events, "upsert_error": upsert_error}


@router.get("/events")
def get_db_events(user_id: str):
    try:
        # Fetch appropriate range (e.g., today onwards)
        now = datetime.utcnow()
        lookback = now - timedelta(hours=12) 
        
        # 1. Get Active Accounts and Build Map
        account_map = {}
        active_ids = []
        try:
            # Filter by is_active=True
            acc_resp = supabase.table("connected_accounts")\
                .select("id, email")\
                .eq("user_id", user_id)\
                .eq("is_active", True)\
                .execute()
                
            for acc in acc_resp.data:
                account_map[acc['id']] = acc['email']
                active_ids.append(acc['id'])
        except Exception as e:
             print(f"Error fetching active accounts: {e}")
             # If error (e.g. column missing), fall back to all? 
             # No, if column missing, we assume all active?
             # Let's try fetching all if above failed
             try:
                 acc_resp = supabase.table("connected_accounts").select("id, email").eq("user_id", user_id).execute()
                 for acc in acc_resp.data:
                    account_map[acc['id']] = acc['email']
                    active_ids.append(acc['id'])
             except:
                 pass

        if not active_ids:
            return {"events": []}

        response = supabase.table("events")\
            .select("*")\
            .eq("user_id", user_id)\
            .gte("start_time", lookback.isoformat())\
            .in_("account_id", active_ids)\
            .order("start_time")\
            .execute()
            
        mapped_events = []
        seen_ids = set()
        
        for ev in response.data:
            g_id = ev.get('google_event_id')
            if g_id in seen_ids:
                continue
            seen_ids.add(g_id)
            
            # Resolve Source Email
            acc_id = ev.get('account_id')
            source_email = account_map.get(acc_id, 'Google Calendar')

            mapped_events.append({
                'id': g_id,
                'title': ev.get('title'),
                'start': ev.get('start_time'),
                'end': ev.get('end_time'),
                'location': ev.get('location'),
                'meeting_link': ev.get('meeting_link'),
                'source': source_email,
                'color': '#4F46E5',
                'duration': 'Event' 
            })
            
        return {"events": mapped_events}
    except Exception as e:
        print(f"Error fetching DB events: {e}")
        return {"events": []}
