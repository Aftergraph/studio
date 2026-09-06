"""Capture the canonical V4 reference states by running the rendered smoke harness.

The smoke harness owns the bundling/runtime setup so visual reference capture cannot
silently drift from the behavior that is actually verified.
"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('browser_smoke.py')), run_name='__main__')
