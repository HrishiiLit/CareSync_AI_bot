import os

file_path = r"c:\Users\hrish\Downloads\Learn\Projects\CareSync_AI_2\backend\app\api\endpoints.py"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Truncate at the start of the broken code
# We know it starts at the last @router.post("/auth/sync") or similar
clean_lines = []
for line in lines:
    if "@router.post(" in line and "/auth/sync" in line:
        break
    clean_lines.append(line)

new_code = """@router.post("/auth/sync")
async def auth_sync(req: AuthSyncRequest):
    \"\"\"Sync Supabase Auth session with backend user profiles.\"\"\"
    # 1. Check if user exists in user_accounts
    user_acc = sb.table("user_accounts").select("*").eq("auth_user_id", req.auth_user_id).execute()
    
    is_new = False
    if not user_acc.data:
        is_new = True
        # Create basic account record
        sb.table("user_accounts").insert({
            "auth_user_id": req.auth_user_id,
            "role": req.role,
            "email": "", # Will be updated by metadata later
            "username": req.auth_user_id
        }).execute()
    
    # 2. Check if role-specific profile exists
    if req.role == "doctor":
        profile = sb.table("doctors").select("*").eq("auth_user_id", req.auth_user_id).execute()
        if not profile.data: is_new = True
    else:
        profile = sb.table("patients").select("*").eq("auth_user_id", req.auth_user_id).execute()
        if not profile.data: is_new = True
        
    return {
        "status": "synced",
        "is_new": is_new,
        "role": req.role,
        "user_id": req.auth_user_id
    }
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(clean_lines)
    f.write("\n\n" + new_code)

print("Backend endpoints.py repaired successfully.")
