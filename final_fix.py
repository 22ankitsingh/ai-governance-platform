import os
path = r'd:\Downloads\project1\frontend\src\pages\admin\TriageQueue.jsx'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

import re
# Regex to replace the entire table body row content for robustness
pattern = r'<tr key={issue\.id}>.*?</tr>'
replacement = \"\"\"<tr key={issue.id}>
                  <td><PriorityBadge priority={issue.priority} /></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {issue.title.length > 45 ? issue.title.slice(0, 45) + '...' : issue.title}
                    </div>
                    {issue.reopen_count > 0 && (
                      <span className=\"badge badge-reopened\" style={{ marginTop: '0.25rem' }}>Reopened ×{issue.reopen_count}</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {issue.reporter?.full_name || '-'}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {issue.category || issue.issue_type?.name || '-'}
                      {!issue.issue_type_id && issue.category && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.35rem', background: 'rgba(51,129,255,0.1)', color: 'var(--primary-500)', borderRadius: '3px' }}>AI</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {issue.department?.name ? issue.department.name.split('&')[0].trim() : '-'}
                  </td>
                  <td><StatusBadge status={issue.status} /></td>
                  <td><SeverityBadge severity={issue.severity} /></td>
                  <td style={{ minWidth: 120 }}><ConfidenceMeter value={issue.ai_confidence} /></td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(issue.created_at)}</td>
                  <td>
                    <Link to={/admin/issues/} className=\"btn btn-sm btn-ghost\">Manage</Link>
                  </td>
                </tr>\"\"\"

text = re.sub(pattern, replacement, text, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)