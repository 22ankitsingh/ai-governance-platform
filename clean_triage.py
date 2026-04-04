import os
path = r'd:\Downloads\project1\frontend\src\pages\admin\TriageQueue.jsx'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Fix encoding garbage
text = text.replace('Ã—', '×')
text = text.replace('â€”', '—')
text = text.replace('ï¿½', '—')

# Fix extra </td> tag
bad_chunk = '''                  <td style={{ fontSize: '0.82rem' }}>
                  </td>'''
text = text.replace(bad_chunk, '')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)