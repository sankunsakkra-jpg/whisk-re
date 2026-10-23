import sys
import webbrowser
import threading
import time
import uvicorn

def open_browser():
    time.sleep(1.2)
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("✨ Whisk AI - Image to Reverse Prompt Server")
    print("🌐 Running at: http://localhost:8000")
    print("=" * 60)
    
    # Launch browser in a separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    uvicorn.run("api.index:app", host="127.0.0.1", port=8000, reload=True)
