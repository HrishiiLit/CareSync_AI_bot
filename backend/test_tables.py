import asyncio
from app.services.supabase_service import get_supabase

def check_tables():
    sb = get_supabase()
    tables = [
        "patients", "workflows", "call_logs", "patient_conditions", "patient_medications",
        "notifications", "lab_orders", "referrals", "staff_assignments", "reports", "pdf_documents"
    ]
    for t in tables:
        try:
            sb.table(t).select("*").limit(1).execute()
            print(f"✅ {t} exists")
        except Exception as e:
            print(f"❌ {t} does not exist: {e}")

if __name__ == "__main__":
    check_tables()
