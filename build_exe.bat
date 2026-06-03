@echo off
cd /d "%~dp0"
python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm --onefile --windowed --icon="icon.ico" --add-data "index.html;." --add-data "style.css;." --add-data "app.js;." --add-data "server.py;." --name "Zentic" gui.py
pause
