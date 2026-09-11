#!/usr/bin/env python3
"""Empacota o AutomataLab num único arquivo HTML, sem dependências.

O projeto usa módulos ES nativos, que exigem servir os arquivos por HTTP.
Este script resolve os imports em tempo de build e produz um HTML autossuficiente
que abre com duplo clique — útil para publicar em lugares que aceitam um arquivo
só, ou para mandar por e-mail.

    python3 tools/build-single.py [saida.html]

Não é minificador nem transpilador: o código sai como está, apenas envelopado
num registro de módulos para preservar o escopo de cada arquivo.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = "src/ui/app.js"
SAIDA_PADRAO = RAIZ / "dist" / "automatalab.html"

# import { a, b } from '...';  — aceita quebras de linha entre as chaves
RE_IMPORT = re.compile(r"^import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"];?\s*$", re.M)
RE_EXPORT = re.compile(r"^export\s+(function|const|class|let|var)\s+([A-Za-z_$][\w$]*)", re.M)


def resolver(origem: str, alvo: str) -> str:
    """Resolve um caminho relativo de import para um id de módulo."""
    base = pathlib.PurePosixPath(origem).parent
    return str(pathlib.PurePosixPath(*(base / alvo).parts)).replace("./", "")


def normalizar(caminho: pathlib.PurePosixPath) -> str:
    partes: list[str] = []
    for parte in caminho.parts:
        if parte == "..":
            partes.pop()
        elif parte not in (".", ""):
            partes.append(parte)
    return "/".join(partes)


def coletar(entrada: str) -> dict[str, str]:
    """Percorre o grafo de imports a partir da entrada."""
    modulos: dict[str, str] = {}
    pilha = [entrada]
    while pilha:
        ident = pilha.pop()
        if ident in modulos:
            continue
        codigo = (RAIZ / ident).read_text(encoding="utf-8")
        modulos[ident] = codigo
        for _, alvo in RE_IMPORT.findall(codigo):
            base = pathlib.PurePosixPath(ident).parent / alvo
            pilha.append(normalizar(base))
    return modulos


def transformar(ident: str, codigo: str) -> str:
    """Converte um módulo ES num factory do registro."""
    exportados: list[str] = [nome for _, nome in RE_EXPORT.findall(codigo)]

    def troca_import(m: re.Match) -> str:
        nomes = " ".join(m.group(1).split())
        base = pathlib.PurePosixPath(ident).parent / m.group(2)
        return f"const {{ {nomes} }} = __req('{normalizar(base)}');"

    corpo = RE_IMPORT.sub(troca_import, codigo)
    corpo = re.sub(r"^export\s+", "", corpo, flags=re.M)
    lista = ", ".join(exportados)
    return (
        f"__def('{ident}', function (__exports) {{\n{corpo}\n"
        f"Object.assign(__exports, {{ {lista} }});\n}});\n"
    )


REGISTRO = """
// Registro de módulos gerado por tools/build-single.py.
// Cada módulo roda dentro da sua própria função, o que preserva o escopo e
// evita colisão entre nomes internos de arquivos diferentes.
var __mods = {}, __cache = {};
function __def(id, fn) { __mods[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id];
  var exports = {};
  __cache[id] = exports;
  if (!__mods[id]) throw new Error('módulo não encontrado: ' + id);
  __mods[id](exports);
  return exports;
}
"""


def main() -> None:
    saida = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else SAIDA_PADRAO
    html = (RAIZ / "index.html").read_text(encoding="utf-8")
    css = (RAIZ / "src" / "styles.css").read_text(encoding="utf-8")

    modulos = coletar(ENTRADA)
    partes = [REGISTRO]
    for ident in sorted(modulos):
        partes.append(transformar(ident, modulos[ident]))
    partes.append(f"__req('{ENTRADA}');\n")
    script = "\n".join(partes)

    html = html.replace(
        '<link rel="stylesheet" href="./src/styles.css">',
        f"<style>\n{css}\n</style>",
    )
    html = html.replace(
        '<script type="module" src="./src/ui/app.js"></script>',
        f"<script>\n{script}\n</script>",
    )

    # procura a referência externa em si, não o nome do arquivo: os ids dos
    # módulos aparecem de propósito dentro do registro
    sobrou = re.search(r"""(src|href)=["']\.?/?src/""", html)
    if sobrou:
        raise SystemExit(f"erro: sobrou referência externa no HTML gerado: {sobrou.group(0)}")

    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(html, encoding="utf-8")
    print(f"{saida} — {len(modulos)} módulos, {len(html) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
