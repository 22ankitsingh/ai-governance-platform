import sqlite3
conn = sqlite3.connect('governance.db')
c = conn.cursor()

# Migrate old statuses to new ones
c.execute("UPDATE issues SET status='in_progress' WHERE status IN ('assigned', 'in_process')")
print('Issues updated:', c.rowcount)

c.execute("UPDATE status_history SET to_status='in_progress' WHERE to_status IN ('assigned', 'in_process')")
c.execute("UPDATE status_history SET from_status='in_progress' WHERE from_status IN ('assigned', 'in_process')")
conn.commit()

# Verify
rows = c.execute('SELECT status, COUNT(*) FROM issues GROUP BY status').fetchall()
print('Status distribution:')
for r in rows:
    print(' ', r)

conn.close()
print('Migration complete')
