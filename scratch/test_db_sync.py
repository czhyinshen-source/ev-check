from sqlalchemy import create_engine, text
from app.config import settings

def test_sync():
    print(f"URL: {settings.DATABASE_URL}")
    sync_url = settings.DATABASE_URL.replace("aiomysql", "pymysql").replace("aiosqlite", "")
    print(f"Sync URL: {sync_url}")
    try:
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            query = text("SELECT id, name, cron_expression FROM check_rules WHERE is_active = 1 AND cron_expression IS NOT NULL")
            result = conn.execute(query)
            rows = result.fetchall()
            print(f"Found {len(rows)} matching rules.")
            for row in rows:
                print(f"Rule: {row}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_sync()
