"""Shared visual tokens used by the dashboard and its machine workspace."""
import json
from pathlib import Path

TOKENS = json.loads((Path(__file__).resolve().parents[1] / 'assets/harvestshield_theme.json').read_text())
CSS_VARIABLES = ':root {' + ''.join(f'--{name}:{value};' for name, value in TOKENS.items()) + '}'
