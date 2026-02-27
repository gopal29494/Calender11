import os
import json
import base64
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not key:
    print("No key found")
    exit()

# JWT is 3 parts: header.payload.signature
parts = key.split('.')
if len(parts) < 2:
    print("Invalid JWT format")
    exit()

payload = parts[1]
# Pad it
payload += '=' * (-len(payload) % 4)

try:
    decoded = base64.urlsafe_b64decode(payload)
    data = json.loads(decoded)
    print("Decoded JWT Payload:")
    print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error decoding: {e}")
