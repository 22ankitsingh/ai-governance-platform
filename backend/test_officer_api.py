import httpx
import json

BASE = "http://127.0.0.1:8001"
TIMEOUT = 30  # generous timeout

client = httpx.Client(timeout=TIMEOUT)

print("=== 1. Officer Login ===")
r = client.post(f"{BASE}/api/officer/login", json={"email": "officer@gov.in", "password": "officer123"})
print(f"Status: {r.status_code}")
data = r.json()
print(f"Officer: {data['user']['name']}")
print(f"Department: {data['user']['department_name']}")
print(f"Role: {data['user']['role']}")
print(f"Designation: {data['user']['designation']}")
token = data["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("\n=== 2. Officer Stats ===")
r = client.get(f"{BASE}/api/officer/stats", headers=headers)
print(f"Status: {r.status_code}")
print(json.dumps(r.json(), indent=2))

print("\n=== 3. Current Issue ===")
r = client.get(f"{BASE}/api/officer/current-issue", headers=headers)
print(f"Status: {r.status_code}")
issue = r.json()
if issue:
    print(f"Active issue: {issue['title']}")
else:
    print("No active issue assigned")

print("\n=== 4. Previous Issues ===")
r = client.get(f"{BASE}/api/officer/previous-issues", headers=headers)
print(f"Status: {r.status_code}, Count: {len(r.json())}")

print("\n=== 5. Officer Profile ===")
r = client.get(f"{BASE}/api/officer/me", headers=headers)
print(f"Status: {r.status_code}")
p = r.json()
print(f"Name: {p['name']}, Email: {p['email']}, Designation: {p['designation']}")

print("\n=== 6. Leave Toggle ===")
r = client.put(f"{BASE}/api/officer/leave", headers=headers, json={"is_on_leave": True})
print(f"Toggle on leave: {r.status_code}, is_on_leave: {r.json()['is_on_leave']}")
r = client.put(f"{BASE}/api/officer/leave", headers=headers, json={"is_on_leave": False})
print(f"Toggle back: {r.status_code}, is_on_leave: {r.json()['is_on_leave']}")

print("\n=== 7. Admin - Officer List ===")
r = client.post(f"{BASE}/api/auth/login", json={"email": "admin@gov.in", "password": "admin123"})
admin_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

r = client.get(f"{BASE}/api/admin/real-officers", headers=admin_headers)
print(f"Status: {r.status_code}, Total: {len(r.json())}")
for o in r.json()[:3]:
    avail = "Available" if o["is_available"] else ("On Leave" if o["is_on_leave"] else "Busy")
    print(f"  - {o['name']} ({o['designation']}) [{o['department_name']}] {avail}")

print("\n=== 8. Admin - Officer Stats ===")
r = client.get(f"{BASE}/api/admin/officer-stats", headers=admin_headers)
print(f"Status: {r.status_code}")
print(json.dumps(r.json(), indent=2))

print("\n=== 9. Admin - Filter Available Only ===")
r = client.get(f"{BASE}/api/admin/real-officers", params={"available_only": True}, headers=admin_headers)
print(f"Available officers: {len(r.json())}")

print("\n=== 10. Verify Role Separation ===")
# Officer token should NOT work on citizen endpoints
r = client.get(f"{BASE}/api/users/me", headers=headers)
print(f"Officer on citizen endpoint: {r.status_code} (expected 403)")

# And admin token should NOT work on officer endpoints
r = client.get(f"{BASE}/api/officer/me", headers=admin_headers)
print(f"Admin on officer endpoint: {r.status_code} (expected 403)")

client.close()
print("\n✅ All API tests complete!")
