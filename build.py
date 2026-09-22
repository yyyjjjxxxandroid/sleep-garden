"""Default build creates the 3D demo. Previous illustration builder: build2d.py."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('build3d.py')),run_name='__main__')
