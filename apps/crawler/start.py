#!/usr/bin/env python
"""
Startup script for Crawl4AI microservice
Handles Python environment setup and runs the main app
"""
import sys
import os
import subprocess
import venv
from pathlib import Path

def ensure_venv():
    """Create venv if it doesn't exist"""
    venv_path = Path(__file__).parent / "venv"

    if not venv_path.exists():
        print(f"Creating Python virtual environment at {venv_path}...")
        venv.create(venv_path, with_pip=True)

        # Upgrade pip
        pip_executable = venv_path / ("Scripts" if os.name == "nt" else "bin") / ("pip.exe" if os.name == "nt" else "pip")
        subprocess.run([str(pip_executable), "install", "--upgrade", "pip"], check=True)

        # Install dependencies
        req_file = Path(__file__).parent / "requirements.txt"
        if req_file.exists():
            print(f"Installing dependencies from {req_file}...")
            subprocess.run([str(pip_executable), "install", "-r", str(req_file)], check=True)

        print("✓ Virtual environment setup complete")

def run_main():
    """Run the main application"""
    main_py = Path(__file__).parent / "main.py"
    python_executable = Path(__file__).parent / "venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")

    print(f"Starting Crawl4AI microservice using {python_executable}...")
    subprocess.run([str(python_executable), str(main_py)])

if __name__ == "__main__":
    ensure_venv()
    run_main()
