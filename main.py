"""Serve the MensTrack PWA from ./static on the local network."""

import mimetypes
import socket
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8000
STATIC_DIR = Path(__file__).parent / "static"

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")


def lan_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))  # UDP connect sends no packets
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(STATIC_DIR))
    with ThreadingHTTPServer(("0.0.0.0", PORT), handler) as server:
        print(f"Local:   http://localhost:{PORT}")
        print(f"Network: http://{lan_ip()}:{PORT}")
        server.serve_forever()


if __name__ == "__main__":
    main()
