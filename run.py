"""Run the portfolio locally with no third-party dependencies."""

from __future__ import annotations

import argparse
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = PROJECT_ROOT / "static"
TEMPLATES_ROOT = PROJECT_ROOT / "templates"


class PortfolioHandler(SimpleHTTPRequestHandler):
    """Serve the site's templates and public files at their expected URLs."""

    ROUTES = {
        "/": TEMPLATES_ROOT / "index.html",
        "/index.html": TEMPLATES_ROOT / "index.html",
        "/coming-soon": TEMPLATES_ROOT / "coming-soon.html",
        "/coming-soon.html": TEMPLATES_ROOT / "coming-soon.html",
        "/Lucas-Ang-Resume.pdf": PROJECT_ROOT / "Lucas-Ang-Resume.pdf",
        "/favicon.svg": STATIC_ROOT / "img" / "favicon.svg",
    }

    def do_GET(self) -> None:
        path = unquote(urlsplit(self.path).path)
        file_path = self.ROUTES.get(path)

        if file_path is None:
            for url_prefix, directory in (
                ("/css/", STATIC_ROOT / "css"),
                ("/js/", STATIC_ROOT / "js"),
                ("/img/", STATIC_ROOT / "img"),
                ("/mp3/", STATIC_ROOT / "mp3"),
            ):
                if path.startswith(url_prefix):
                    relative_path = path.removeprefix(url_prefix)
                    candidate = (directory / relative_path).resolve()

                    if candidate.is_relative_to(directory.resolve()):
                        file_path = candidate
                    break

        if file_path is None or not file_path.is_file():
            self.send_error(404, "File not found")
            return

        self._send_file(file_path)

    def _send_file(self, file_path: Path) -> None:
        content_type, _ = mimetypes.guess_type(file_path)
        content = file_path.read_bytes()

        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    parser = argparse.ArgumentParser(description="Preview the portfolio locally.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), PortfolioHandler)
    print(f"Portfolio available at http://{args.host}:{args.port}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
