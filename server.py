# -*- coding: utf-8 -*-
"""
خادم ويب محلي خفيف لنظام المَذْخُورَة (Python)
Local HTTP Server for Al-Madkhoorah Dates System
"""

import http.server
import socketserver
import socket
import webbrowser
import os
import json

PORT = 8080

def get_local_ips():
    ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith('127.') and not ip.startswith('169.254'):
                ips.append(ip)
    except Exception:
        pass
    if not ips:
        # Fallback socket connection method
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
            s.close()
        except Exception:
            ips.append("127.0.0.1")
    return list(set(ips))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/server-info':
            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            data = json.dumps({'port': PORT, 'ips': get_local_ips()})
            self.wfile.write(data.encode('utf-8'))
            return
        return super().do_GET()

os.chdir(os.path.dirname(os.path.abspath(__file__)))

local_ips = get_local_ips()
print("=" * 64)
print("🌴 تم تشغيل خادم موقع «المَذْخُورَة» بنجاح على شبكة الواي فاي!")
print("=" * 64)
print(f"\n💻 من هذا الكمبيوتر:  http://localhost:{PORT}/")
print("\n📱 من أي جوال أو آيباد متصل بنفس الواي فاي:")
for ip in local_ips:
    print(f"   👉 http://{ip}:{PORT}/")
print("\n" + "=" * 64)
print("جاري فتح الموقع في المتصفح تلقائياً... (اضغط Ctrl + C للإيقاف)")

webbrowser.open(f"http://localhost:{PORT}/")

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        httpd.serve_forever()
except OSError:
    PORT = 8085
    print(f"\n⚠️ المنفذ 8080 مشغول، جاري المحاولة على المنفذ {PORT}...")
    webbrowser.open(f"http://localhost:{PORT}/")
    with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
        httpd.serve_forever()
