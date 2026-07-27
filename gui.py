import os
import sys
import threading
import time
import subprocess
import webbrowser
import json
from server import app

# Conditionally import platform-specific modules to support Windows registry lookups 
# while maintaining buildability/runnability for developers on Linux/macOS.
if sys.platform == 'win32':
    try:
        import winreg
    except ImportError:
        winreg = None
else:
    winreg = None

def get_default_browser_path():
    """
    Queries the Windows registry to find the absolute file path of the 
    user's currently configured default web browser.
    """
    if sys.platform != 'win32' or winreg is None:
        return None
    try:
        # Step 1: Find the default HTTP protocol handler ProgID
        key_path = r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            prog_id, _ = winreg.QueryValueEx(key, "ProgId")
        
        # Step 2: Query the open shell command for that ProgID
        cmd_path = f"{prog_id}\\shell\\open\\command"
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, cmd_path) as key:
            cmd, _ = winreg.QueryValueEx(key, "")
            
        # Step 3: Parse the executable path out of the command (handling quoted paths)
        cmd = cmd.strip()
        if cmd.startswith('"'):
            end = cmd.find('"', 1)
            if end != -1:
                return cmd[1:end]
        else:
            return cmd.split()[0]
    except Exception:
        pass
    return None

def reset_browser_crash_state(profile_dir):
    """
    Forcefully modifies the Chrome/Edge profile Preferences file to prevent
    the "Restore pages? Browser closed unexpectedly" infobar from appearing.
    """
    for subfolder in ["Default", ""]:
        pref_path = os.path.join(profile_dir, subfolder, "Preferences")
        try:
            if os.path.exists(pref_path):
                with open(pref_path, "r", encoding="utf-8") as f:
                    try:
                        data = json.load(f)
                    except Exception:
                        continue
            else:
                os.makedirs(os.path.dirname(pref_path), exist_ok=True)
                data = {}
                
            if not isinstance(data, dict):
                data = {}
                
            if "profile" not in data or not isinstance(data["profile"], dict):
                data["profile"] = {}
                
            data["profile"]["exit_type"] = "Normal"
            data["profile"]["exited_cleanly"] = True
            
            with open(pref_path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            pass

def open_browser():
    """
    Launches the user's default browser (or fallbacks) in a dedicated
    isolated kiosk / fullscreen window to ensure a console-grade experience.
    """
    time.sleep(1.5)
    url = "http://127.0.0.1:5000"
    
    # Create an isolated browser profile folder to force kiosk mode independent of existing sessions
    profile_dir = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'MewStationBrowserProfile')
    try:
        os.makedirs(profile_dir, exist_ok=True)
    except Exception:
        pass
    
    # Reset any crash flags in the browser profile before launch to silence "Restore pages?" popups
    reset_browser_crash_state(profile_dir)
    
    # Default Chromium search paths
    fallback_chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe")
    ]
    
    # 1. Try to find the Windows default browser executable path
    default_browser = get_default_browser_path()
    
    if default_browser and os.path.exists(default_browser):
        # Place default browser at the front of our evaluation queue
        browsers_to_try = [default_browser] + [p for p in fallback_chrome_paths if p.lower() != default_browser.lower()]
    else:
        browsers_to_try = fallback_chrome_paths
        
    launched = False
    for browser in browsers_to_try:
        if os.path.exists(browser):
            browser_lower = browser.lower()
            args = [browser, "--app=" + url]
            
            # Apply optimal isolated kiosk/fullscreen arguments based on browser family
            if any(x in browser_lower for x in ["chrome", "msedge", "brave", "opera", "vivaldi"]):
                args.extend([
                    "--user-data-dir=" + profile_dir,
                    "--kiosk", 
                    "--start-fullscreen", 
                    "--disable-infobars", 
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-features=Translate,EdgeTranslate",
                    "--hide-crash-restore-bubble",
                    "--no-session-restore",
                    "--disable-session-crashed-bubble",
                    "--noerrordialogs",
                    "--disable-web-security",
                    "--allow-running-insecure-content"
                ])
            elif "firefox" in browser_lower:
                args.extend([
                    "--kiosk",
                    "-profile", os.path.join(profile_dir, "firefox")
                ])
                
            try:
                subprocess.Popen(args)
                launched = True
                break
            except Exception:
                pass
            
    if not launched:
        try:
            if default_browser:
                subprocess.Popen([default_browser, url])
            else:
                webbrowser.open(url)
        except Exception:
            webbrowser.open(url)

if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)
