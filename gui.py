import os
import sys
import threading
import time
import subprocess
import webbrowser
from server import app

def open_browser():
    time.sleep(1.5)
    url = "http://127.0.0.1:5000"
    
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
    ]
    
    launched = False
    for browser in chrome_paths:
        if os.path.exists(browser):
            subprocess.Popen([browser, "--app=" + url, "--kiosk", "--start-fullscreen", "--disable-infobars", "--no-first-run"])
            launched = True
            break
            
    if not launched:
        try:
            os.system('start msedge --app="' + url + '" --kiosk')
        except Exception:
            webbrowser.open(url)

if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
