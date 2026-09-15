#!/usr/bin/env python3
"""Servidor estático para desenvolvimento local.

O projeto usa ES modules nativos, que o navegador recusa carregar via file://.
Qualquer servidor estático resolve; este existe só para não depender de nada
além do Python que já vem no macOS e no Linux.

    python3 tools/serve.py [porta]

Além de servir, aceita POST em /.tmp-save/<nome> gravando o corpo em
.tmp-jff/<nome> — usado pelas ferramentas de build para receber imagens
geradas pelo navegador. Só aceita nomes simples e só grava dentro de .tmp-jff.
"""

import functools
import http.server
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
SAVE_DIR = ROOT / ".tmp-jff"
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,80}$")


class Handler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler servindo a raiz do projeto, sem cache."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.address_string()} {fmt % args}\n")

    def do_POST(self):
        prefix = "/.tmp-save/"
        if not self.path.startswith(prefix):
            self.send_error(404)
            return
        # só páginas servidas por este mesmo servidor podem gravar: um site
        # qualquer aberto no navegador consegue disparar um POST para
        # localhost, e o cabeçalho Origin é o que o denuncia
        origin = self.headers.get("Origin", "")
        host = self.headers.get("Host", "")
        if origin and origin != f"http://{host}":
            self.send_error(403, "origem não permitida")
            return
        name = self.path[len(prefix):]
        if not SAFE_NAME.match(name):
            self.send_error(400, "nome inválido")
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        SAVE_DIR.mkdir(exist_ok=True)
        (SAVE_DIR / name).write_bytes(body)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f"{len(body)}".encode())


def main():
    # o diretório de trabalho herdado pode ser inacessível; fixe-o na raiz
    os.chdir(ROOT)
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"AutomataLab em http://127.0.0.1:{PORT}/ (Ctrl+C para parar)")
    server.serve_forever()


if __name__ == "__main__":
    main()
