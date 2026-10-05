import os
import sys

# Ensure module search paths prioritize local api/backend and project backend
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, ".."))
_local_backend = os.path.join(_current_dir, "backend")
_parent_backend = os.path.join(_root_dir, "backend")

for _path in [_local_backend, _parent_backend, _root_dir, _current_dir]:
    if os.path.exists(_path) and _path not in sys.path:
        sys.path.insert(0, _path)

# Import the FastAPI application
try:
    from backend.main import app as _fastapi_app
except ImportError:
    from main import app as _fastapi_app

# Vercel Python serverless runtime entrypoints require top-level 'app', 'application', or 'handler'
app = _fastapi_app
application = _fastapi_app
handler = _fastapi_app

__all__ = ["app", "application", "handler"]
