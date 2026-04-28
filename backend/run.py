import uvicorn
import sys

if __name__ == "__main__":
    print("Starting CareSync AI Backend...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
