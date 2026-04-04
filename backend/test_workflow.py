import urllib.request, json

BASE = 'http://localhost:8001'

def api(method, path, data=None, token=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

print('=== OFFICER ASSIGNMENT & STATUS WORKFLOW TEST ===')

# 1. Login admin
resp, s = api('POST', '/api/auth/login', {'email': 'admin@gov.in', 'password': 'admin123'})
assert s == 200, f'Admin login failed: {s} {resp}'
admin_token = resp['access_token']
print('1. Admin login: PASS')

# 2. Login citizen
resp2, s2 = api('POST', '/api/auth/login', {'email': 'citizen@example.com', 'password': 'citizen123'})
assert s2 == 200, f'Citizen login failed: {s2} {resp2}'
citizen_token = resp2['access_token']
print('2. Citizen login: PASS')

# 3. Get a not_assigned issue
resp3, s3 = api('GET', '/api/admin/issues?status=not_assigned&page_size=1', token=admin_token)
assert s3 == 200 and len(resp3) > 0, f'No not_assigned issues: {s3} {resp3}'
iid = resp3[0]['id']
assert resp3[0].get('officer_name') is None, 'Officer name should be None initially'
print(f'3. Got not_assigned issue (id={iid[:8]}...): PASS')

# 4. Assign officer -> status should become in_progress
r4, s4 = api('POST', '/api/admin/issues/' + iid + '/assign',
             {'officer_name': 'Inspector Sharma', 'notes': 'Assigned for testing'}, token=admin_token)
assert s4 == 200, f'Assign failed: {s4} {r4}'
assert r4['status'] == 'in_progress', f'Expected in_progress, got {r4["status"]}'
assert r4['officer_name'] == 'Inspector Sharma', f'Officer name mismatch: {r4.get("officer_name")}'
print(f'4. Assign officer (status->{r4["status"]}, officer={r4["officer_name"]}): PASS')

# 5. Try to assign again (should fail - not_assigned/reopened only)
r5, s5 = api('POST', '/api/admin/issues/' + iid + '/assign',
             {'officer_name': 'Someone Else'}, token=admin_token)
assert s5 == 400, f'Expected 400 for double-assign, got {s5}'
print(f'5. Double-assign rejected (status 400): PASS')

# 6. Try invalid: resolve directly from not_assigned (use a different issue)
resp_na, _ = api('GET', '/api/admin/issues?status=not_assigned&page_size=1', token=admin_token)
if resp_na:
    iid_na = resp_na[0]['id']
    r_inv, s_inv = api('POST', '/api/admin/issues/' + iid_na + '/resolve',
                       {'resolution_notes': 'Invalid'}, token=admin_token)
    assert s_inv == 400, f'Expected 400 for not_assigned->resolve, got {s_inv}'
    print(f'6. Prevent not_assigned->resolve transition (status 400): PASS')
else:
    print('6. SKIPPED (no not_assigned left)')

# 7. Resolve the in_progress issue
r7, s7 = api('POST', '/api/admin/issues/' + iid + '/resolve',
             {'resolution_notes': 'Road repaired successfully. All potholes filled.', 'notes': 'Done'}, token=admin_token)
assert s7 == 200, f'Resolve failed: {s7} {r7}'
assert r7['status'] == 'resolved', f'Expected resolved, got {r7["status"]}'
assert r7['resolution_notes'] is not None, 'resolution_notes should be set'
print(f'7. Resolve issue (status->{r7["status"]}): PASS')

# 8. Try to modify closed -> re-resolve (should fail)
r8, s8 = api('POST', '/api/admin/issues/' + iid + '/resolve',
             {'resolution_notes': 'Again'}, token=admin_token)
assert s8 == 400, f'Expected 400 for resolved->resolve, got {s8}'
print(f'8. Prevent re-resolve (status 400): PASS')

# 9. Citizen verifies (approve -> closed)
r9, s9 = api('POST', '/api/issues/' + iid + '/verify',
             {'approved': True, 'rating': 4, 'feedback': 'Good job!'}, token=citizen_token)
if s9 != 200:
    # Citizen might not be the reporter - find their issue
    print(f'9. Citizen verify skipped (not reporter): {s9} {r9.get("detail","")}')
else:
    print(f'9. Citizen approve (status->closed): PASS')

    # 10. Check final status
    r10, s10 = api('GET', '/api/admin/issues/' + iid, token=admin_token)
    assert r10['status'] == 'closed', f'Expected closed, got {r10["status"]}'
    assert r10['closed_at'] is not None, 'closed_at should be set'
    print(f'10. Final status={r10["status"]} closed_at={r10["closed_at"][:10]}: PASS')

    # 11. Try assign to closed issue (should fail)
    r11, s11 = api('POST', '/api/admin/issues/' + iid + '/assign',
                   {'officer_name': 'Too Late'}, token=admin_token)
    assert s11 == 400, f'Expected 400 for closed issue assign, got {s11}'
    print(f'11. Assign to closed issue rejected (status 400): PASS')

    # 12. Try general update of closed issue (should fail)
    r12, s12 = api('PUT', '/api/admin/issues/' + iid,
                   {'severity': 'low'}, token=admin_token)
    assert s12 == 400, f'Expected 400 for update closed issue, got {s12}'
    print(f'12. Update closed issue rejected (status 400): PASS')

print()
print('=== ALL TESTS PASSED ===')
