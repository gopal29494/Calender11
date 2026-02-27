from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
import os
import requests
import urllib.parse
from services.supabase_client import supabase
from datetime import datetime, timedelta

router = APIRouter()

# Environment Variables
# SUPABASE_URL/KEY are handled in services/supabase_client.py
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = "https://calender11.onrender.com/auth/google/callback"  # Must match Google Console


@router.get("/google/url")
def get_google_auth_url(user_id: str, platform: str = "native", redirect_url: str = ""):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
         raise HTTPException(status_code=500, detail="Server misconfiguration: Missing Google Credentials")

    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    
    # Determine Redirect URI based on environment/request
    # If the user is running locally (localhost, IP, or via mobile app scheme), use the local backend callback
    if redirect_url and ("localhost" in redirect_url or "127.0.0.1" in redirect_url or "192.168" in redirect_url or "com.alarmsmartcalendar.app" in redirect_url):
        used_redirect_uri = "http://localhost:8000/auth/google/callback"
    else:
        used_redirect_uri = "https://calender11.onrender.com/auth/google/callback"
    
    # Encode platform and redirect_url in state: "user_id|platform|redirect_url"
    state_s = f"{user_id}|{platform}|{redirect_url}"
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": used_redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
        "access_type": "offline",
        "prompt": "consent",
        "state": state_s
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": url}

class DisconnectRequest(BaseModel):
    user_id: str
    email: str

@router.post("/google/disconnect")
def disconnect_google_account(req: DisconnectRequest):
    req_email = req.email.lower()
    print(f"Received disconnect request for {req_email} (User: {req.user_id})")
    try:
        # 1. Get Account ID
        acc_resp = supabase.table("connected_accounts").select("id").eq("user_id", req.user_id).eq("email", req_email).execute()
        
        if acc_resp.data:
            acc_id = acc_resp.data[0]['id']
            print(f"Found account ID: {acc_id}. Deleting events and marking inactive.")
            
            # 2. Delete Events (Hard Delete Events so they are gone)
            supabase.table("events").delete().eq("account_id", acc_id).execute()
            
            # 3. Soft Delete Account (Set is_active = False)
            response = supabase.table("connected_accounts").update({
                "is_active": False,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", acc_id).execute()
            
            if response.data:
                return {"message": "Account disconnected and events removed successfully"}
            else:
                return {"message": "Failed to update account status"}
        else:
             print("Account not found for disconnect.")
             return {"message": "Account not found"}
    except Exception as e:
        print(f"Error disconnecting account: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/google/callback")
def google_callback(code: str, state: str):
    # Decode state
    # Format: user_id|platform|redirect_url
    parts = state.split("|")
    user_id = parts[0]
    platform = parts[1] if len(parts) > 1 else "native"
    custom_redirect = parts[2] if len(parts) > 2 else ""

    if not code:
        raise HTTPException(status_code=400, detail="Missing code")
        
    # Determine which Redirect URI was used based on content of custom_redirect
    # Mirroring logic in get_google_auth_url
    if custom_redirect and ("localhost" in custom_redirect or "127.0.0.1" in custom_redirect or "192.168" in custom_redirect or "com.alarmsmartcalendar.app" in custom_redirect):
        used_redirect_uri = "http://localhost:8000/auth/google/callback"
    else:
        used_redirect_uri = "https://calender11.onrender.com/auth/google/callback"

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": used_redirect_uri,
        "grant_type": "authorization_code"
    }
    
    resp = requests.post(token_url, data=data)
    if resp.status_code != 200:
        return {"error": "Failed to exchange token", "details": resp.text}
    
    token_data = resp.json()
    access_token = token_data.get('access_token')
    refresh_token = token_data.get('refresh_token') 
    
    # Get User Info
    user_info_resp = requests.get("https://www.googleapis.com/oauth2/v2/userinfo", headers={'Authorization': f'Bearer {access_token}'})
    if user_info_resp.status_code != 200:
        return {"error": "Failed to fetch user info"}
        
    user_email = user_info_resp.json().get('email')

    # ... (Upsert logic to users and connected_accounts remains unchanged) ...
    # ENSURE USER EXISTS IN PUBLIC.USERS
    try:
        supabase.table("users").upsert({
            "id": user_id, 
            "email": user_email,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        print(f"Warning: failed to upsert public.users: {e}")

    # Upsert to Database
    db_data = {
        "user_id": user_id,
        "email": user_email,
        "access_token": access_token,
        "provider": "google",
        "is_active": True, 
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if refresh_token:
        db_data["refresh_token"] = refresh_token

    existing = supabase.table('connected_accounts').select('id').eq('user_id', user_id).eq('email', user_email).execute()
    
    if existing.data:
        supabase.table('connected_accounts').update(db_data).eq('id', existing.data[0]['id']).execute()
    else:
        supabase.table('connected_accounts').insert(db_data).execute()

    # Response Logic
    # Use custom redirect if provided, else fallback
    if custom_redirect:
        frontend_redirect = f"{custom_redirect}?status=success&email={user_email}"
    else:
         frontend_redirect = f"https://smartalarmm.netlify.app/google-link?status=success&email={user_email}"
    
    from fastapi.responses import HTMLResponse
    
    if platform == "web":
        # For Web, use window.opener.postMessage to signal Expo Web Browser to close the popup
        # This prevents the app from reloading inside the popup
        html = f"""
        <html>
            <body style="background-color: #1F2937; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <h2 style="color: #10B981;">Linking Successful!</h2>
                <p>You can now close this window.</p>
                <button onclick="window.close()" style="padding: 10px 20px; background-color: #EF4444; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 20px;">Close Window</button>
                <script>
                    try {{
                        window.opener.postMessage({{ type: 'org.expo.unimodules.webbrowser.message', url: '{frontend_redirect}' }}, '*');
                    }} catch (e) {{
                        console.log('Opener communication failed, but linking worked.');
                    }}
                    setTimeout(function() {{ window.close(); }}, 3000);
                </script>
            </body>
        </html>
        """
        return HTMLResponse(content=html, headers={"Cross-Origin-Opener-Policy": "unsafe-none"})
    else:
        # Native: Redirect usually works best
        html = f"""
        <html>
            <head>
                <meta http-equiv="refresh" content="0;url={frontend_redirect}" />
            </head>
            <body>
                <p>Linking Successful! Redirecting back to app...</p>
                <script>window.location.href = "{frontend_redirect}";</script>
            </body>
        </html>
        """
        return HTMLResponse(content=html)
