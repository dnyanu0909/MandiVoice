import os
import sys

current_dir = os.path.dirname(__file__)

# 1. Local backend inside api/ (if bundled directly inside lambda)
local_backend = os.path.abspath(os.path.join(current_dir, "backend"))
if os.path.exists(local_backend) and local_backend not in sys.path:
    sys.path.insert(0, local_backend)

# 2. Parent backend in monorepo root
parent_backend = os.path.abspath(os.path.join(current_dir, "..", "backend"))
if os.path.exists(parent_backend) and parent_backend not in sys.path:
    sys.path.insert(0, parent_backend)

root_dir = os.path.abspath(os.path.join(current_dir, ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

try:
    from backend.main import app
except ImportError:
    from main import app

__all__ = ["app"]
