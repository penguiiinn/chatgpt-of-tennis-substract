import http.server
import socketserver

handler = http.server.SimpleHTTPRequestHandler
handler.directory = r'D:\realonlineruler.com\aceintel'

with socketserver.TCPServer(('', 3001), handler) as httpd:
    print("Serving on port 3001")
    httpd.serve_forever()