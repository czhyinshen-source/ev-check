import sys
import os

# Add root to sys.path just in case
sys.path.append(os.getcwd())

try:
    from app.models.snapshot import Snapshot
    print("Snapshot import successful")
except ImportError as e:
    print(f"Snapshot import failed: {e}")
except Exception as e:
    print(f"An error occurred: {e}")
