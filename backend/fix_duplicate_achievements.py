#!/usr/bin/env python3
"""
Script to fix duplicate exclusive achievements in the database.
Run this to remove duplicate achievement records and refresh user achievements.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine
from models import ExclusiveAchievement, PlayerExclusiveAchievement
from sqlalchemy import text

def check_duplicates():
    """Check for duplicate exclusive achievements by slug."""
    db = SessionLocal()
    try:
        # Check for duplicates
        result = db.execute(text("""
            SELECT slug, COUNT(*) as count
            FROM exclusive_achievements
            GROUP BY slug
            HAVING COUNT(*) > 1
        """))
        duplicates = result.fetchall()
        
        if duplicates:
            print("Found duplicate achievements:")
            for slug, count in duplicates:
                print(f"  - {slug}: {count} records")
            return True
        else:
            print("No duplicate achievements found.")
            return False
    finally:
        db.close()

def remove_duplicates():
    """Remove duplicate exclusive achievements, keeping the first one."""
    db = SessionLocal()
    try:
        # Delete duplicates, keeping the one with the lowest ID
        db.execute(text("""
            DELETE FROM exclusive_achievements
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM exclusive_achievements
                GROUP BY slug
            )
        """))
        db.commit()
        print("Duplicate achievements removed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error removing duplicates: {e}")
        raise
    finally:
        db.close()

def refresh_user_achievements(user_id=None):
    """Remove all player achievements and let them be recalculated."""
    db = SessionLocal()
    try:
        if user_id:
            db.query(PlayerExclusiveAchievement).filter(
                PlayerExclusiveAchievement.user_id == user_id
            ).delete()
            print(f"Removed achievements for user {user_id}.")
        else:
            db.query(PlayerExclusiveAchievement).delete()
            print("Removed all player achievements.")
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error removing player achievements: {e}")
        raise
    finally:
        db.close()

def main():
    print("=== Fixing Duplicate Achievements ===\n")
    
    # Step 1: Check for duplicates
    print("Step 1: Checking for duplicate achievements...")
    has_duplicates = check_duplicates()
    
    if has_duplicates:
        # Step 2: Remove duplicates
        print("\nStep 2: Removing duplicate achievements...")
        remove_duplicates()
    else:
        print("\nNo duplicates to remove.")
    
    # Step 3: Refresh player achievements
    print("\nStep 3: Refreshing player achievements...")
    user_id = input("Enter user ID to refresh (or press Enter for all users): ").strip()
    if user_id:
        refresh_user_achievements(int(user_id))
    else:
        refresh_user_achievements()
    
    print("\n=== Done ===")
    print("Please restart your application to recalculate achievements.")

if __name__ == "__main__":
    main()
