from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from services.supabase_client import supabase
import os
from datetime import datetime, timedelta, timezone

router = APIRouter()

# Initialize Supabase Client


class AlarmSettings(BaseModel):
    user_id: str
    global_reminder_offset_minutes: int
    reminder_offsets: List[int]
    default_alarm_sound: str
    morning_mode_enabled: Optional[bool] = False

    morning_mode_sound: Optional[str] = "default"

class EventReminderSettings(BaseModel):
    reminder_offsets: List[int]

@router.get("/settings")
def get_settings(user_id: str):
    try:
        response = supabase.table("alarm_settings").select("*").eq("user_id", user_id).execute()
        if not response.data:
            # Create default settings if not exists
            default_settings = {
                "user_id": user_id,
                "global_reminder_offset_minutes": 30,
                "reminder_offsets": [30],
                "default_alarm_sound": "default",
                "morning_mode_enabled": False,
                "morning_mode_sound": "default"
            }
            supabase.table("alarm_settings").insert(default_settings).execute()
            return default_settings
        
        # Backfill if reminder_offsets is missing from old data
        data = response.data[0]
        if not data.get("reminder_offsets"):
             data["reminder_offsets"] = [data.get("global_reminder_offset_minutes", 30)]
             
        return data
    except Exception as e:
        print(f"DB Error in get_settings: {e}")
        # Return a safe default to prevent frontend crash
        return {
            "user_id": user_id,
            "global_reminder_offset_minutes": 30,
            "reminder_offsets": [30],
            "default_alarm_sound": "default"
        }

@router.put("/settings")
def update_settings(settings: AlarmSettings):
    try:
        # Upsert settings
        data = settings.dict()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Normalize: ensure global_reminder_offset_minutes is just the first one or 30
        if data["reminder_offsets"]:
            data["global_reminder_offset_minutes"] = data["reminder_offsets"][0]
        
        response = supabase.table("alarm_settings").upsert(data).execute()
        if response.data:
            return response.data[0]
        return {}
    except Exception as e:
        import traceback
        traceback.print_exc()

        
        print(f"DB Error in update_settings: {e}")
        raise HTTPException(status_code=500, detail=f"Database Sync Error: {e}")

from uuid import UUID

def is_valid_uuid(val):
    try:
        UUID(str(val))
        return True
    except ValueError:
        return False

@router.put("/events/{event_identifier}")
def update_event_reminders(event_identifier: str, settings: EventReminderSettings, user_id: str):
    try:
        # Update by google_event_id AND user_id to prevent checking other users' rows
        data = {
            "reminder_offsets": settings.reminder_offsets,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # 1. Try updating by Google Event ID (Most common from Frontend)
        # CRITICAL FIX: Add .eq("user_id", user_id) to ensure we only update THIS user's copy of the event
        response = supabase.table("events").update(data)\
            .eq("google_event_id", event_identifier)\
            .eq("user_id", user_id)\
            .execute()
        
        if response.data:
            print(f"Updated event reminders via Google ID: {event_identifier} for user {user_id}")
            return response.data[0]
            
        # 2. If not found, try updating by Internal UUID (Fallback)
        # ONLY if it looks like a valid UUID, otherwise Postgres will error
        if is_valid_uuid(event_identifier):
            print(f"Google ID update failed for {event_identifier}, trying UUID...")
            response = supabase.table("events").update(data).eq("id", event_identifier).eq("user_id", user_id).execute()
        
            if response.data:
                print(f"Updated event reminders via UUID: {event_identifier}")
                return response.data[0]

        print(f"Event not found for reminder update: {event_identifier}")
        # Return 404 so frontend knows it failed (though frontend might not handle it well yet)
        raise HTTPException(status_code=404, detail="Event not found")

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"DB Error in update_event_reminders: {e}")
        raise HTTPException(status_code=500, detail=f"Database Update Error: {e}")



@router.get("/events/{event_id}")
def get_event_settings(event_id: str):
    try:
        # Use google_event_id instead of id
        response = supabase.table("events").select("reminder_offsets").eq("google_event_id", event_id).execute()
        if response.data:
            # If multiple accounts have same event, just return the first one's settings
            return response.data[0] 
        # Return empty/default instead of 404 to be nicer to frontend? 
        # No, 404 is fine, frontend handles it? 
        # Actually frontend expects object or throws. 
        # Let's return empty offsets if not found (maybe event hasn't synced to DB yet?)
        # But if it's on Home Screen, it *should* have synced. 
        return {"reminder_offsets": []} 
    except Exception as e:
        print(f"DB Error in get_event_settings: {e}")
        raise HTTPException(status_code=500, detail=f"Database Fetch Error: {e}")

@router.get("/upcoming")
def get_upcoming_reminders(user_id: str):
    # 1. Get user settings
    try:
        settings_response = supabase.table("alarm_settings").select("*").eq("user_id", user_id).execute()
    except Exception as e:
        print(f"DB Error getting settings: {e}")
        return {"reminders": [], "error": "Settings fetch failed"}
    
    offsets = [30]
    sound = "default"
    
    if settings_response.data:
        data = settings_response.data[0]
        # Robustly handle missing or empty list
        db_offsets = data.get("reminder_offsets")
        if db_offsets and isinstance(db_offsets, list) and len(db_offsets) > 0:
            offsets = db_offsets
        else:
             # Fallback to legacy field
             offsets = [data.get("global_reminder_offset_minutes", 30)]
        sound = data.get("default_alarm_sound", "default")
    
    # 2. Get connected accounts map (id -> email)
    account_map = {}
    try:
        accounts_resp = supabase.table("connected_accounts").select("id, email").eq("user_id", user_id).execute()
        for acc in accounts_resp.data:
            account_map[acc['id']] = acc['email']
    except Exception as e:
        print(f"DB Error getting accounts: {e}")

    # 3. Get upcoming events (next 24 hours + recent past for missed reminders)
    # Use timezone-aware UTC
    now = datetime.now(timezone.utc)
    lookback_time = now - timedelta(hours=2) # Look back to find active/recent events
    next_24h = now + timedelta(hours=24)
    
    print(f"DEBUG: Checking reminders for user {user_id}")
    print(f"DEBUG: Server Time (UTC): {now.isoformat()}")
    print(f"DEBUG: Offsets: {offsets}")
    
    try:
        events_response = supabase.table("events")\
            .select("*")\
            .eq("user_id", user_id)\
            .gte("start_time", lookback_time.isoformat())\
            .lte("start_time", next_24h.isoformat())\
            .execute()
    except Exception as e:
         print(f"DB Error getting events: {e}")
         return {"reminders": [], "error": "Events fetch failed"}
        
    print(f"DEBUG: Found {len(events_response.data)} upcoming events")

    reminders = []
    try:
        for event in events_response.data:
            # DEBUG RAW OFFSETS
            print(f"DEBUG: Event '{event.get('title')}' (ID: {event.get('google_event_id')}) RAW OFFSETS: {event.get('reminder_offsets')}")

            # start_time is already ISO with timezone from DB (timestamptz)
            # normalize it to ensure python treats it as aware
            try:
                start_iso = event["start_time"]
                # Handle YYYY-MM-DD (All Day)
                if 'T' not in start_iso and len(start_iso) == 10:
                    start_iso = f"{start_iso}T09:00:00+00:00" # Default All Day to 9 AM UTC? Or user TZ?
                    # Better: Just parse as day and set TZ.
                    
                # Handle Z by replacing with +00:00 for valid isoformat
                start_iso = start_iso.replace('Z', '+00:00')
                start_time = datetime.fromisoformat(start_iso)
                
                # Double check: if naive, assume UTC
                if start_time.tzinfo is None:
                     start_time = start_time.replace(tzinfo=timezone.utc)
            except Exception as e:
                # Fallback if parsing fails
                print(f"DEBUG: Error parsing date for '{event.get('title')}': {e} (Raw: {event.get('start_time')})")
                continue
            
            # Determine which offsets to use for THIS event
            event_offsets = offsets # Default to global
            
            # Check for per-event override
            # Explicitly check for None to allow [] (No Reminders) to work if user enabled it.
            # But if user complains about 'not coming', maybe they want valid list.
            if event.get("reminder_offsets") is not None:
                event_offsets = event["reminder_offsets"]
                # print(f"DEBUG: Event '{event['title']}' using CUSTOM offsets: {event_offsets}")
            
            # Generate a reminder for EACH offset
            for minutes in event_offsets:
                reminder_time = start_time - timedelta(minutes=minutes)
                
                # Check diff (both are aware now)
                diff_seconds = (reminder_time - now).total_seconds()
                
                # Logic: Return if it's in the future OR if it's "TRIGGER TIME" (within last minute)
                if diff_seconds > -60: 
                    # Add detailed debug for specific near-term events
                    # if diff_seconds < 300: # 5 mins
                    #      print(f"DEBUG: Event '{event['title']}' with offset {minutes} is due in {diff_seconds}s")

                    reminders.append({
                        "id": f"{event['id']}_{minutes}", # Unique ID for each reminder instance
                        "event_id": event["id"],
                        "title": event["title"],
                        "start_time": event["start_time"],
                        "reminder_time": reminder_time.isoformat(),
                        "minutes_before": minutes,
                        "sound": sound,
                        "account_id": event.get('account_id'),
                        "account_email": account_map.get(event.get('account_id'), "Unknown Email"), 
                        "meeting_link": event.get("meeting_link"),
                        "trigger_immediately": diff_seconds <= 0 and diff_seconds > -60 # Flag for frontend
                    })
                else:
                    pass
                    # if diff_seconds > -600: # Log things we JUST missed
                    #      print(f"DEBUG: Skipped '{event['title']}' offset {minutes} (Diff: {diff_seconds}s - Too old)")

    except Exception as e:
        print(f"CRITICAL ERROR in get_upcoming_reminders: {e}")
        import traceback
        traceback.print_exc()
        return {"reminders": [], "settings": {"offsets": offsets, "sound": sound}, "error": str(e)}

    return {"reminders": reminders, "settings": {"offsets": offsets, "sound": sound}}
            

