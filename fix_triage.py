import os
path = r'd:\Downloads\project1\frontend\src\pages\admin\TriageQueue.jsx'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i, line in enumerate(lines):
    if '<td style={{ fontSize: \'0.82rem\', color: \'var(--text-secondary)\' }}>' in line and i > 120:
        new_lines.append('                  <td style={{ fontSize: \'0.82rem\', color: \'var(--text-secondary)\' }}>\n')
        new_lines.append('                    {issue.reporter?.full_name || \'-\'}\n')
        new_lines.append('                  </td>\n')
        new_lines.append('                  <td style={{ fontSize: \'0.82rem\' }}>\n')
        new_lines.append('                    <div style={{ display: \'flex\', alignItems: \'center\', gap: \'0.35rem\' }}>\n')
        new_lines.append('                      {issue.category || (issue.issue_type && issue.issue_type.name) || \'-\'}\n')
        new_lines.append('                      {!issue.issue_type_id && issue.category && (\n')
        new_lines.append('                        <span style={{ fontSize: \'0.65rem\', fontWeight: 700, padding: \'0.1rem 0.35rem\', background: \'rgba(51,129,255,0.1)\', color: \'var(--primary-500)\', borderRadius: \'3px\' }}>AI</span>\n')
        new_lines.append('                      )}\n')
        new_lines.append('                    </div>\n')
        new_lines.append('                  </td>\n')
        skip = 15 # skip until the next known stable line
    elif '<span className=\"badge badge-reopened\"' in line:
        new_lines.append('                      <span className=\"badge badge-reopened\" style={{ marginTop: \'0.25rem\' }}>Reopened ×{issue.reopen_count}</span>\n')
    elif 'abbreviate long names' in line:
        new_lines.append('                    {issue.department?.name ? issue.department.name.split(\'&\')[0].trim() : \'-\'}\n')
        skip = 0
    elif skip > 0:
        skip -= 1
        continue
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)