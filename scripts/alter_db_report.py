import asyncio
import os
import sqlite3
import sys

# Modify SQLite DB directly to avoid SQLAlchemy async weirdness with DDL in some versions
db_path = "ev_check.db"

def alter_db():
    if not os.path.exists(db_path):
        print("DB not found, skipping alter.")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if reports table exists
        cursor.execute("SELECT count(name) FROM sqlite_master WHERE type='table' AND name='check_reports'")
        if cursor.fetchone()[0] == 1:
            print("check_reports table already exists.")
        else:
            # We don't need to manually create check_reports because SQLAlchemy Base.metadata.create_all will do it.
            # But we must add the column.
            pass
            
        # Check if column exists
        cursor.execute("PRAGMA table_info(check_results)")
        columns = [info[1] for info in cursor.fetchall()]
        if 'report_id' not in columns:
            cursor.execute("ALTER TABLE check_results ADD COLUMN report_id INTEGER REFERENCES check_reports(id) ON DELETE CASCADE")
            print("Successfully added report_id column to check_results.")
        else:
            print("report_id column already exists in check_results.")
            
        conn.commit()
    except Exception as e:
        print(f"Error altering DB: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    alter_db()
