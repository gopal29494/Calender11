from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, calendar_sync, reminders

app = FastAPI(title="Alarm Smart Calendar API")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Alarm Smart Calendar Backend is Running"}

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(calendar_sync.router, prefix="/calendar", tags=["Calendar"])
app.include_router(reminders.router, prefix="/reminders", tags=["Reminders"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
