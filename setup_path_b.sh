#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python}"
VENV_DIR=".venv-path-b"

echo "Using Python: $($PYTHON_BIN -c 'import sys; print(sys.executable)')"
echo "Python version: $($PYTHON_BIN --version)"

if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo
echo "Path B environment is ready."
echo "Activate it with:"
echo "  source $VENV_DIR/bin/activate"
