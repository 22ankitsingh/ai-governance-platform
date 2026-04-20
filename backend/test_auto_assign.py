import httpx
import json

BASE = "http://127.0.0.1:8000"

# Citizen login
r = httpx.post(f"{BASE}/api/auth/login", json={"email": "citizen@example.com", "password": "citizen123"}, timeout=10)
token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get categories
r = httpx.get(f"{BASE}/api/reference/categories", headers=headers, timeout=10)
cats = r.json()
dept = cats[0]
it = dept["issue_types"][0]
print(f"Creating issue: dept={dept['department_name']}, type={it['name']}")

# Create issue with longer timeout (AI analysis takes time)
r = httpx.post(f"{BASE}/api/issues", headers=headers, timeout=60,
    data={"title": "Auto-assign test - officer system", "description": "Testing automatic officer assignment flow. A cooperative society in Sector 12 is suspected of fraudulent activities. Members report missing funds.", "issue_type_id": it["id"]})
print(f"Status: {r.status_code}")
issue = r.json()
print(f"Issue ID: {issue.get('id', 'N/A')}")
print(f"Issue Status: {issue.get('status', 'N/A')}")
print(f"Officer Name: {issue.get('officer_name', 'None')}")
print(f"Officer ID: {issue.get('officer_id', 'None')}")

if issue.get("officer_name"):
    print("AUTO-ASSIGNMENT WORKS!")
else:
    print("Not auto-assigned (expected if AI assigns to different dept)")

print("Done!")
