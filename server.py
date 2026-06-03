import xml.etree.ElementTree as ET
import os
import sys
import json
import subprocess
import threading
import time
import glob
import struct
import winreg
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import requests
import vdf
import psutil

static_dir = getattr(sys, '_MEIPASS', os.path.abspath(os.path.dirname(__file__)))
app = Flask(__name__, static_folder=static_dir)
CORS(app)

hide_steam_enabled = False

def get_steam_path():
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam")
        path, _ = winreg.QueryValueEx(key, "SteamPath")
        winreg.CloseKey(key)
        return path.replace("/", "\\")
    except Exception:
        fallbacks = [
            r"C:\Program Files (x86)\Steam",
            r"C:\Program Files\Steam",
        ]
        for p in fallbacks:
            if os.path.exists(p):
                return p
    return None

def get_steam_user_id():
    steam_path = get_steam_path()
    if steam_path is None: return None
    config_path = os.path.join(steam_path, "config", "loginusers.vdf")
    if not os.path.exists(config_path): return None
    try:
        with open(config_path, "r", encoding="utf-8") as f: data = vdf.load(f)
    except Exception:
        return None
    users = data.get("users", data.get("Users", {}))
    for uid in list(users.keys()):
        info = users[uid]
        if str(info.get("MostRecent", "0")) == "1" or str(info.get("mostrecent", "0")) == "1":
            steam64 = int(uid)
            steam32 = steam64 - 76561197960265728
            name = info.get("PersonaName", info.get("personaname", "User"))
            avatar_url = ""
            try:
                r = requests.get("https://steamcommunity.com/profiles/" + str(steam64) + "?xml=1", timeout=3)
                if r.status_code == 200:
                    root = ET.fromstring(r.text)
                    anode = root.find("avatarFull")
                    if anode is not None: avatar_url = anode.text
            except Exception: pass
            return {"steam64": str(steam64), "steam32": str(steam32), "name": name, "avatar": avatar_url}
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
            if proc.info['name'] and proc.info['name'].lower() == 'steam.exe':
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return False

def launch_game(app_id):
    try:
        subprocess.Popen(
            ["cmd", "/c", "start steam://rungameid/" + str(app_id)],
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        return True
    except Exception:
        try:
            steam_path = get_steam_path()
            steam_exe = os.path.join(steam_path, "steam.exe") if steam_path else "steam"
            subprocess.Popen([steam_exe, "-applaunch", str(app_id)])
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

@app.route('/api/invalidate-cache', methods=['POST'])
def api_invalidate():
    global _games_cache, _cache_time
    _games_cache = None
    _cache_time = 0
    return jsonify({"ok": True})

@app.route('/api/media')
def api_media():
    pictures_dir = os.path.join(os.environ.get('USERPROFILE', ''), 'Pictures')
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

@app.route('/')
def index():
    return send_from_directory(static_dir, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(static_dir, filename)

def hide_steam_loop():
    global hide_steam_enabled
    try:
        EnumWindows = ctypes.windll.user32.EnumWindows
        EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        GetWindowThreadProcessId = ctypes.windll.user32.GetWindowThreadProcessId
        ShowWindow = ctypes.windll.user32.ShowWindow
        IsWindowVisible = ctypes.windll.user32.IsWindowVisible

        steam_pids = set()

        def foreach_window(hwnd, lParam):
            pid = ctypes.c_ulong()
            GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if pid.value in steam_pids:
                if IsWindowVisible(hwnd):
                    ShowWindow(hwnd, 0)
            return True

        cb_foreach = EnumWindowsProc(foreach_window)
    except Exception:
        pass

    while True:
        try:
            if hide_steam_enabled:
                steam_pids.clear()
                for p in psutil.process_iter(['name', 'pid']):
                    if p.info['name'] and p.info['name'].lower() == 'steam.exe':
                        steam_pids.add(p.info['pid'])

                if steam_pids:
                    EnumWindows(cb_foreach, 0)
        except Exception:
            pass
        time.sleep(1.5)

threading.Thread(target=hide_steam_loop, daemon=True).start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
