import xml.etree.ElementTree as ET
import os
import sys
import json
import subprocess
import threading
import time
import glob
import struct
from pathlib import Path

# Platform specific imports
if sys.platform == 'win32':
    try:
        import winreg
        import ctypes
    except ImportError:
        winreg = None
        ctypes = None
else:
    winreg = None
    ctypes = None

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import requests
import vdf
import psutil

static_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
app = Flask(__name__, static_folder=static_dir)
CORS(app)

hide_steam_enabled = False
last_heartbeat_time = time.time()

@app.route('/api/heartbeat', methods=['POST'])
def api_heartbeat():
    global last_heartbeat_time
    last_heartbeat_time = time.time()
    return jsonify({"ok": True})

def heartbeat_monitor():
    global last_heartbeat_time
    time.sleep(15)
    while True:
        time.sleep(2)
        if time.time() - last_heartbeat_time > 8:
            os._exit(0)

threading.Thread(target=heartbeat_monitor, daemon=True).start()

def get_steam_path():
    if sys.platform == 'win32' and winreg is not None:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
            path, _ = winreg.QueryValueEx(key, "SteamPath")
            winreg.CloseKey(key)
            return path.replace("/", "\\")
        except Exception:
            pass
            
    if sys.platform == 'win32':
        fallbacks = [
            r"C:\Program Files (x86)\Steam",
            r"C:\Program Files\Steam",
        ]
        for p in fallbacks:
            if os.path.exists(p):
                return p
    else:
        home = str(Path.home())
        linux_fallbacks = [
            os.path.join(home, ".steam", "steam"),
            os.path.join(home, ".local", "share", "Steam"),
            os.path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
            os.path.join(home, "Library", "Application Support", "Steam"),  # macOS
        ]
        for p in linux_fallbacks:
            if os.path.exists(p):
                return p
    return None

def get_steam_user_id():
    steam_path = get_steam_path()
    if steam_path is None: return None
    
    steam64 = None
    steam32 = None
    
    # Try Registry on Windows first (it is 100% accurate for the active session)
    if sys.platform == 'win32' and winreg is not None:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
            active_user, _ = winreg.QueryValueEx(key, "ActiveUser")
            winreg.CloseKey(key)
            if active_user and active_user > 0:
                steam32 = active_user
                steam64 = active_user + 76561197960265728
        except Exception:
            pass

    # Read loginusers.vdf to find the username / avatar
    config_path = os.path.join(steam_path, "config", "loginusers.vdf")
    name = "User"
    avatar_url = ""
    
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = vdf.load(f)
            users = data.get("users", data.get("Users", {}))
            
            # If we got steam64 from registry, find that user
            user_info = None
            if steam64 and str(steam64) in users:
                user_info = users[str(steam64)]
            else:
                # Fallback 1: Find MostRecent
                for uid in list(users.keys()):
                    info = users[uid]
                    if str(info.get("MostRecent", "0")) == "1" or str(info.get("mostrecent", "0")) == "1":
                        steam64 = int(uid)
                        steam32 = steam64 - 76561197960265728
                        user_info = info
                        break
                
                # Fallback 2: Just take the first user if none is marked most recent
                if not user_info and users:
                    first_uid = list(users.keys())[0]
                    steam64 = int(first_uid)
                    steam32 = steam64 - 76561197960265728
                    user_info = users[first_uid]
            
            if user_info:
                name = user_info.get("PersonaName", user_info.get("personaname", "User"))
        except Exception:
            pass
            
    # If we still have a steam64 ID, try fetching the avatar and real name from Steam Community XML
    if steam64:
        try:
            r = requests.get(f"https://steamcommunity.com/profiles/{steam64}?xml=1", timeout=3)
            if r.status_code == 200:
                root = ET.fromstring(r.text)
                anode = root.find("avatarFull")
                if anode is not None: 
                    avatar_url = anode.text
                nnode = root.find("steamID")
                if nnode is not None and name == "User": 
                    name = nnode.text
        except Exception:
            pass
            
        return {
            "steam64": str(steam64), 
            "steam32": str(steam32), 
            "name": name, 
            "avatar": avatar_url
        }
        
    return None

def get_library_folders(steam_path):
    folders = [os.path.join(steam_path, "steamapps")]
    vdf_path = os.path.join(steam_path, "steamapps", "libraryfolders.vdf")
    try:
        with open(vdf_path, "r", encoding="utf-8") as f:
            data = vdf.load(f)
        lf = data.get("libraryfolders", data.get("LibraryFolders", {}))
        for key, val in lf.items():
            if key.isdigit():
                if isinstance(val, dict):
                    path = val.get("path", "")
                else:
                    path = val
                folder = os.path.join(path, "steamapps")
                if os.path.exists(folder):
                    folders.append(folder)
    except Exception:
        pass
    return folders

def parse_acf_files(steam_path):
    games = {}
    folders = get_library_folders(steam_path)
    for folder in folders:
        acf_files = glob.glob(os.path.join(folder, "appmanifest_*.acf"))
        for acf_path in acf_files:
            try:
                with open(acf_path, "r", encoding="utf-8") as f: data = vdf.load(f)
                state = data.get("AppState", {})
                app_id = str(state.get("appid", "")).strip()
                if app_id != "" and app_id != "0" and app_id not in games:
                    games[app_id] = {
                        "appid": app_id,
                        "name": state.get("name", "Unknown"),
                        "install_dir": state.get("installdir", ""),
                        "size_on_disk": int(state.get("SizeOnDisk", 0)),
                        "last_played": int(state.get("LastPlayed", 0)),
                        "playtime": int(state.get("Playtime", state.get("playtime", 0))),
                        "library_folder": folder
                    }
            except Exception: pass
    result = list(games.values())
    def get_lp(x): return x["last_played"]
    result.sort(key=get_lp, reverse=True)
    return result

def get_game_artwork(app_id, steam_path):
    grid_path = os.path.join(steam_path, "userdata")
    artwork = {}

    for user_dir in glob.glob(os.path.join(grid_path, "*", "config", "grid")):
        extensions = ["jpg", "jpeg", "png", "webp"]

        for ext in extensions:
            hero = os.path.join(user_dir, f"{app_id}_hero.{ext}")
            if os.path.exists(hero):
                artwork["hero"] = hero
                break

        for suffix in ["p", ""]:
            for ext in extensions:
                cap = os.path.join(user_dir, f"{app_id}{suffix}.{ext}")
                if os.path.exists(cap):
                    artwork["capsule"] = cap
                    break
            if "capsule" in artwork:
                break

        for ext in extensions:
            logo = os.path.join(user_dir, f"{app_id}_logo.{ext}")
            if os.path.exists(logo):
                artwork["logo"] = logo
                break

    artwork.setdefault("hero", "https://cdn.akamai.steamstatic.com/steam/apps/" + str(app_id) + "/library_hero.jpg")
    artwork.setdefault("capsule", "https://cdn.akamai.steamstatic.com/steam/apps/" + str(app_id) + "/library_600x900.jpg")
    artwork.setdefault("capsule_small", "https://cdn.akamai.steamstatic.com/steam/apps/" + str(app_id) + "/header.jpg")
    artwork.setdefault("logo", "https://cdn.akamai.steamstatic.com/steam/apps/" + str(app_id) + "/logo.png")
    artwork.setdefault("background", "https://cdn.akamai.steamstatic.com/steam/apps/" + str(app_id) + "/page_bg_generated_v6b.jpg")

    return artwork

def is_steam_running():
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name']:
                proc_name = proc.info['name'].lower()
                if sys.platform == 'win32' and proc_name == 'steam.exe':
                    return True
                elif sys.platform != 'win32' and proc_name == 'steam':
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False

def is_game_running(install_dir):
    if not install_dir:
        return False
    install_dir_lower = install_dir.lower()
    for proc in psutil.process_iter(['name', 'exe']):
        try:
            exe_path = proc.info.get('exe')
            if exe_path:
                if install_dir_lower in exe_path.lower():
                    return True
            else:
                cmdline = proc.cmdline()
                if cmdline:
                    cmdline_str = " ".join(cmdline).lower()
                    if install_dir_lower in cmdline_str:
                        return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False

def is_any_steam_game_running():
    steam_path = get_steam_path()
    if not steam_path:
        return False
    try:
        games = parse_acf_files(steam_path)
        for g in games:
            if is_game_running(g["install_dir"]):
                return True
    except Exception:
        pass
    return False

def launch_game(app_id):
    try:
        if sys.platform == 'win32':
            subprocess.Popen(
                ["cmd", "/c", "start steam://rungameid/" + str(app_id)],
                shell=False,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            import webbrowser
            webbrowser.open("steam://rungameid/" + str(app_id))
        return True
    except Exception:
        try:
            steam_path = get_steam_path()
            if sys.platform == 'win32':
                steam_exe = os.path.join(steam_path, "steam.exe") if steam_path else "steam"
                subprocess.Popen([steam_exe, "-applaunch", str(app_id)])
            else:
                subprocess.Popen(["steam", "-applaunch", str(app_id)])
            return True
        except Exception:
            return False

_games_cache = None
_cache_time = 0
CACHE_TTL = 30

@app.route('/api/settings', methods=['POST'])
def api_settings():
    global hide_steam_enabled
    data = request.json or {}
    if 'hide_steam' in data:
        hide_steam_enabled = bool(data['hide_steam'])
    return jsonify({"success": True, "hide_steam": hide_steam_enabled})

@app.route('/api/status')
def api_status():
    steam_path = get_steam_path()
    user = get_steam_user_id()
    return jsonify({
        "steam_found": steam_path is not None,
        "steam_path": steam_path,
        "steam_running": is_steam_running(),
        "user": user,
    })

@app.route('/api/games')
def api_games():
    global _games_cache, _cache_time
    now = time.time()
    if _games_cache and (now - _cache_time) < CACHE_TTL:
        return jsonify({"games": _games_cache, "cached": True, "total": len(_games_cache)})

    steam_path = get_steam_path()
    if not steam_path:
        return jsonify({"error": "Steam not found", "games": []}), 404

    games = parse_acf_files(steam_path)
    for game in games:
        game["artwork"] = get_game_artwork(game["appid"], steam_path)

    _games_cache = games
    _cache_time = now
    return jsonify({"games": games, "total": len(games)})

@app.route('/api/launch/<app_id>', methods=['POST'])
def api_launch(app_id):
    success = launch_game(app_id)
    return jsonify({"success": success, "app_id": app_id})

@app.route('/api/running/<app_id>')
def api_game_running(app_id):
    steam_path = get_steam_path()
    if not steam_path:
        return jsonify({"running": False})
    games = parse_acf_files(steam_path)
    for g in games:
        if str(g["appid"]) == str(app_id):
            running = is_game_running(g["install_dir"])
            return jsonify({"running": running, "appid": app_id})
    return jsonify({"running": False, "error": "Game not found"})

@app.route('/api/invalidate-cache', methods=['POST'])
def api_invalidate():
    global _games_cache, _cache_time
    _games_cache = None
    _cache_time = 0
    return jsonify({"ok": True})

@app.route('/api/media')
def api_media():
    pictures_dir = os.path.join(os.environ.get('USERPROFILE', ''), 'Pictures') if sys.platform == 'win32' else os.path.expanduser('~/Pictures')
    images = []
    if os.path.exists(pictures_dir):
        search_exts = ['*.jpg', '*.jpeg', '*.png', '*.webp']
        for ext in search_exts:
            for path in glob.glob(os.path.join(pictures_dir, '**', ext), recursive=True):
                images.append(path)
                if len(images) >= 40:
                    break
            if len(images) >= 40:
                break
    return jsonify({"images": images})

@app.route('/api/local_image')
def api_local_image():
    path = request.args.get('path')
    if not path or not os.path.exists(path):
        return "Not found", 404
    return send_file(path)

@app.route('/api/quit', methods=['POST'])
def api_quit():
    def shutdown():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=shutdown).start()
    return jsonify({"success": True})

@app.route('/')
def index():
    return send_from_directory(static_dir, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(static_dir, filename)

def hide_steam_loop():
    global hide_steam_enabled
    if sys.platform != 'win32' or ctypes is None:
        return
    try:
        EnumWindows = ctypes.windll.user32.EnumWindows
        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        GetWindowThreadProcessId = ctypes.windll.user32.GetWindowThreadProcessId
        ShowWindow = ctypes.windll.user32.ShowWindow
        IsWindowVisible = ctypes.windll.user32.IsWindowVisible
        GetWindowTextW = ctypes.windll.user32.GetWindowTextW
        GetClassNameW = ctypes.windll.user32.GetClassNameW
        PostMessageW = ctypes.windll.user32.PostMessageW
        
        WM_KEYDOWN = 0x0100
        WM_KEYUP = 0x0101
        VK_RETURN = 0x0D

        steam_pids = set()

        def foreach_window(hwnd, lParam):
            pid = ctypes.c_ulong()
            GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if pid.value in steam_pids:
                title_buf = ctypes.create_unicode_buffer(512)
                GetWindowTextW(hwnd, title_buf, 512)
                title = title_buf.value.lower()
                
                class_buf = ctypes.create_unicode_buffer(512)
                GetClassNameW(hwnd, class_buf, 512)
                class_name = class_buf.value.lower()
                
                is_dialog = class_name == "#32770" or "dialog" in class_name
                is_steam_pop = any(w in title for w in [
                    "warning", "cloud sync", "preparing to launch", "update", "conflict", 
                    "error", "launching", "arguments", "sync conflict", "preparing"
                ])
                
                if is_dialog or is_steam_pop:
                    PostMessageW(hwnd, WM_KEYDOWN, VK_RETURN, 0)
                    PostMessageW(hwnd, WM_KEYUP, VK_RETURN, 0)
                    ShowWindow(hwnd, 0)
                else:
                    if hide_steam_enabled:
                        if IsWindowVisible(hwnd):
                            ShowWindow(hwnd, 0)
            return True

        cb_foreach = EnumWindowsProc(foreach_window)
    except Exception:
        pass

    while True:
        try:
            # Standard Steam and SteamWebHelper window/popup handling
            steam_pids.clear()
            for p in psutil.process_iter(['name', 'pid']):
                if p.info['name']:
                    pname = p.info['name'].lower()
                    if pname in ['steam.exe', 'steamwebhelper.exe']:
                        steam_pids.add(p.info['pid'])

            if steam_pids:
                EnumWindows(cb_foreach, 0)
                    
        except Exception:
            pass
        time.sleep(0.5)

threading.Thread(target=hide_steam_loop, daemon=True).start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
