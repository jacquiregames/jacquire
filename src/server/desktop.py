# desktop.py
import threading
import uvicorn
import webview
import time
import requests
from src.server.main import app

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=3000, log_level="warning")

if __name__ == "__main__":
    # Start the FastAPI server in a background thread
    t = threading.Thread(target=run_server, daemon=True)
    t.start()

    # Wait up to 3 seconds for the server to spin up
    for _ in range(30):
        try:
            if requests.get("http://127.0.0.1:3000/").status_code == 200:
                break
        except requests.ConnectionError:
            time.sleep(0.1)

    # Launch the native Desktop UI (uses WebView2 on Windows 11)
    webview.create_window("jAcquire", "http://127.0.0.1:3000", width=1280, height=800)
    webview.start()