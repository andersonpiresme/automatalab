#!/usr/bin/env python3
"""Servidor estático para desenvolvimento local.

O projeto usa ES modules nativos, que o navegador recusa carregar via file://.
Qualquer servidor estático resolve; este existe só para não depender de nada
além do Python que já vem no macOS e no Linux.

    python3 tools/serve.py [porta]
"""

import functools
import http.server
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173


class Handler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler servindo a raiz do projeto, sem cache."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.address_string()} {fmt % args}\n")


def main():
    # o diretório de trabalho herdado pode ser inacessível; fixe-o na raiz
    os.chdir(ROOT)
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"AutomataLab em http://127.0.0.1:{PORT}/ (Ctrl+C para parar)")
    server.serve_forever()


if __name__ == "__main__":
    main()
