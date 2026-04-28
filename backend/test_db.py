from app.services.supabase_service import get_supabase
sb = get_supabase()
data = sb.table("patients").select("*").execute().data
for p in data:
    print(f"Patient ID: {p['id']}, Phone: {p['phone']}")

logs = sb.table("call_logs").select("*").order("created_at", desc=True).limit(2).execute().data
import json
print("Latest Call Logs:", json.dumps(logs, indent=2))
