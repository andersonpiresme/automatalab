#!/usr/bin/env python3
"""Gera o HTML da documentação a partir do Markdown, com pandoc.

    python3 tools/build-docs.py

Os arquivos .md em docs/ são a fonte (o GitHub os renderiza sozinho); os .html
gerados ao lado são o que o site serve. O template e o CSS ficam em docs/.
"""

import pathlib
import shutil
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"

PANDOC = shutil.which("pandoc") or "/opt/homebrew/bin/pandoc"


def main() -> None:
    if not pathlib.Path(PANDOC).exists():
        sys.exit("pandoc não encontrado — instale com: brew install pandoc")

    fontes = sorted(DOCS.glob("*.md"))
    for md in fontes:
        html = md.with_suffix(".html")
        subprocess.run(
            [
                PANDOC,
                str(md),
                "--from", "markdown+yaml_metadata_block+pipe_tables",
                "--to", "html5",
                "--standalone",
                "--template", str(DOCS / "template.html"),
                "--toc", "--toc-depth=2",
                "--output", str(html),
            ],
            check=True,
        )
        print(f"{html.relative_to(RAIZ)}  ({html.stat().st_size // 1024} KB)")
    print(f"{len(fontes)} página(s)")


if __name__ == "__main__":
    main()
