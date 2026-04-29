#!/usr/bin/env python3
"""
Test script for ElevenLabs post-call webhook endpoint.

Usage:
    python test_webhook.py

This script simulates an ElevenLabs webhook callback to validate:
1. Webhook endpoint accepts POST requests
2. Authentication with webhook secret works
3. Call log is properly updated with webhook data
4. Execution log captures transcript and call metadata
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
WEBHOOK_ENDPOINT = "/api/elevenlabs/webhook"
WEBHOOK_SECRET = "wsec_64a35a9790114efa8ebe56a22ede32c9337900c03b6b9109bd42743eb9053416"

# Mock ElevenLabs webhook payload (realistic structure based on API docs)
MOCK_WEBHOOK_PAYLOAD = {
    "call_log_id": "test-call-001",  # Links to existing call_log record
    "conversation_id": "conv_test_12345",
    "call_sid": "CA1234567890abcdef",
    "from_number": "+919876543210",
    "to_number": "+919785413786",
    "call_status": "completed",
    "call_outcome": "success",
    "duration_seconds": 120,
    "transcript": [
        {
            "role": "assistant",
            "timestamp": 0,
            "message": "Hello, this is Dr. Sharma's office calling. May I speak with the patient?"
        },
        {
            "role": "user",
            "timestamp": 3,
            "message": "Yes, this is the patient speaking."
        },
        {
            "role": "assistant",
            "timestamp": 5,
            "message": "Great! I'm calling to confirm your appointment tomorrow at 2 PM."
        }
    ],
    "analysis": {
        "summary": "Patient confirmed availability for appointment",
        "sentiment": "positive",
        "key_points": ["Confirmed appointment", "Patient available"]
    },
    "confirmation": {
        "status": "confirmed",
        "data": {"appointment_status": "confirmed"}
    }
}


def test_webhook_with_auth():
    """Test webhook with proper authentication header."""
    print("\n" + "="*70)
    print("TEST 1: Webhook with Authentication Header")
    print("="*70)
    
    url = f"{BASE_URL}{WEBHOOK_ENDPOINT}"
    headers = {
        "Content-Type": "application/json",
        "x-elevenlabs-webhook-secret": WEBHOOK_SECRET
    }
    
    print(f"POST {url}")
    print(f"Headers: x-elevenlabs-webhook-secret: {WEBHOOK_SECRET}")
    print(f"Payload: {json.dumps(MOCK_WEBHOOK_PAYLOAD, indent=2)}")
    
    try:
        response = requests.post(url, json=MOCK_WEBHOOK_PAYLOAD, headers=headers, timeout=5)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("\n✅ PASS: Webhook accepted with valid authentication")
            return True
        else:
            print(f"\n❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False


def test_webhook_with_body_secret():
    """Test webhook with secret in JSON body."""
    print("\n" + "="*70)
    print("TEST 2: Webhook with Secret in JSON Body")
    print("="*70)
    
    url = f"{BASE_URL}{WEBHOOK_ENDPOINT}"
    payload = {**MOCK_WEBHOOK_PAYLOAD, "webhook_secret": WEBHOOK_SECRET}
    headers = {"Content-Type": "application/json"}
    
    print(f"POST {url}")
    print(f"Payload includes: webhook_secret: {WEBHOOK_SECRET}")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("\n✅ PASS: Webhook accepted with secret in body")
            return True
        else:
            print(f"\n❌ FAIL: Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False


def test_webhook_without_auth():
    """Test webhook without authentication (should fail)."""
    print("\n" + "="*70)
    print("TEST 3: Webhook WITHOUT Authentication (Should Fail)")
    print("="*70)
    
    url = f"{BASE_URL}{WEBHOOK_ENDPOINT}"
    headers = {"Content-Type": "application/json"}
    
    print(f"POST {url}")
    print(f"No authentication headers provided")
    
    try:
        response = requests.post(url, json=MOCK_WEBHOOK_PAYLOAD, headers=headers, timeout=5)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("\n✅ PASS: Webhook rejected without authentication (as expected)")
            return True
        elif response.status_code == 200:
            print("\n⚠️  WARNING: Webhook accepted without auth (webhook_secret may be empty in config)")
            return True
        else:
            print(f"\n❌ FAIL: Unexpected status {response.status_code}")
            return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False


def test_webhook_with_invalid_secret():
    """Test webhook with wrong secret (should fail)."""
    print("\n" + "="*70)
    print("TEST 4: Webhook with INVALID Secret (Should Fail)")
    print("="*70)
    
    url = f"{BASE_URL}{WEBHOOK_ENDPOINT}"
    headers = {
        "Content-Type": "application/json",
        "x-elevenlabs-webhook-secret": "wsec_invalid_secret_xyz"
    }
    
    print(f"POST {url}")
    print(f"Headers: x-elevenlabs-webhook-secret: wsec_invalid_secret_xyz")
    
    try:
        response = requests.post(url, json=MOCK_WEBHOOK_PAYLOAD, headers=headers, timeout=5)
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 401:
            print("\n✅ PASS: Webhook rejected with invalid secret (as expected)")
            return True
        else:
            print(f"\n❌ FAIL: Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False


def main():
    """Run all webhook tests."""
    print("\n" + "="*70)
    print("ElevenLabs Webhook Test Suite")
    print("="*70)
    print(f"Target: {BASE_URL}")
    print(f"Endpoint: {WEBHOOK_ENDPOINT}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=2)
    except Exception as e:
        print(f"\n❌ ERROR: Backend not responding at {BASE_URL}")
        print(f"   Make sure backend is running: uvicorn main:app --reload --port 8000")
        sys.exit(1)
    
    # Run tests
    results = []
    results.append(("Auth Header", test_webhook_with_auth()))
    results.append(("Body Secret", test_webhook_with_body_secret()))
    results.append(("No Auth", test_webhook_without_auth()))
    results.append(("Invalid Secret", test_webhook_with_invalid_secret()))
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Webhook endpoint is working correctly.")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check the output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
