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
REDIRECT_URI = "http://localhost:8000/auth/google/callback"  # Update for Prod


@router.get("/google/url")
def get_google_auth_url(user_id: str, platform: str = "native"):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
         raise HTTPException(status_code=500, detail="Server misconfiguration: Missing Google Credentials")

    base_url = "https://accounts.google.com/o/oauth2/v2/auth"
    # Encode platform in state: "user_id|platform"
    state_s = f"{user_id}|{platform}"
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        # Request full offline access (refresh token)
        "scope": "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email",
        "access_type": "offline",
        "prompt": "consent",
        "state": state_s
    }
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.get("/google/callback")
def google_callback(code: str, state: str):
    # Decode state
    try:
        user_id, platform = state.split("|")
    except ValueError:
        user_id = state
        platform = "native"
    
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    # ... (rest of exchange logic same)
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
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

    # ENSURE USER EXISTS IN PUBLIC.USERS
    # Supabase Auth handles auth.users, but public.users must be synced for FKs
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
    frontend_redirect = f"http://localhost:8081/google-link?status=success&email={user_email}"
    
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
                    setTimeout(function() {{ window.close(); }}, 1000);
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
