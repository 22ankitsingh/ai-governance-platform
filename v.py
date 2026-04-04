import httpx, json
login = httpx.post('http://localhost:8001/api/auth/login', json={'email':'admin@gov.in','password':'admin123'})
token = login.json()['access_token']
headers={'Authorization': f'Bearer {token}'}
resp = httpx.get('http://localhost:8001/api/admin/issues?page_size=3', headers=headers)
issues = resp.json()
print('Number of issues:', len(issues))
for i, issue in enumerate(issues):
    print(f'\nIssue {i+1}: {issue.get("title")[:30]}...')
    print(f'  category: {issue.get("category")}')
    print(f'  issue_type: {issue.get("issue_type")}')
    # Check if category key even exists
    print(f'  "category" in keys: {"category" in issue}')