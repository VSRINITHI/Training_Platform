#!/usr/bin/env python
"""
Run this script ONCE to apply the user_invitations migration to the Supabase database.
Usage:
    cd backend
    .venv\Scripts\python scripts\apply_migration.py
"""
import sys
import os

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
import psycopg2
from app.core.config import settings


def apply_migration():
    sql_path = Path(__file__).parent.parent / "migrations" / "001_create_user_invitations.sql"
    if not sql_path.exists():
        print(f"ERROR: Migration file not found at {sql_path}")
        sys.exit(1)

    sql = sql_path.read_text(encoding="utf-8")

    # Use psycopg2 directly with the configured DATABASE_URL
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    if db_url.startswith("postgresql+psycopg2://"):
        db_url = db_url.replace("postgresql+psycopg2://", "postgresql://", 1)

    print("Connecting to Supabase database...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cursor = conn.cursor()

        print("Applying migration: 001_create_user_invitations.sql ...")
        cursor.execute(sql)

        # Verify table was created
        cursor.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_invitations' AND table_schema = 'public'")
        count = cursor.fetchone()[0]

        if count > 0:
            print("SUCCESS: Migration applied successfully: user_invitations table created.")
        else:
            print("WARN: Migration may have failed - table not found after execution.")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"ERROR during migration: {e}")
        sys.exit(1)


if __name__ == "__main__":
    apply_migration()
