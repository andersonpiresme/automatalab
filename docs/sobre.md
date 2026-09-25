---
title: Informações
subtitle: Editor e simulador de autômatos para a web
is-sobre: true
prev: Como foi construído
prev-href: arquitetura.html
---

## AutomataLab

Editor e simulador de autômatos que roda inteiro no navegador — autômatos
finitos, máquinas de Moore, autômatos com pilha e máquinas de Turing —
compatível com o formato `.jff` do JFLAP.

**Versão 2026.09.24**

- Ferramenta: <https://andersonpiresme.github.io/automatalab/>
- Documentação: [Introdução](index.html)
- Código-fonte: <https://github.com/andersonpiresme/automatalab>
- Licença: MIT (código aberto)

## Changelog

### 2026.09.24

- **Autômato com pilha (PDA)**: edição, simulação não-determinística (busca em
  largura, com transições `λ`), aceitação por estado final ou por pilha vazia,
  exemplo `aⁿbⁿ` e leitura/gravação `.jff` (`<read>`/`<pop>`/`<push>`).
- **Edição por menu de contexto** (botão direito) em estados, transições e no
  espaço vazio do diagrama.

### 2026.09.15

- **Documentação** (este manual) e publicação em GitHub Pages.
- Parâmetros de execução na URL (`?open=`, `?input=`, `?run=`, `?theme=`) e
  ajustes de desenho (laços e arestas que contornam estados).

### 2026.09 — versão inicial

- **Autômatos finitos** (determinísticos, não-determinísticos e com transições
  `λ`): edição, simulação rápida e passo a passo, equivalência.
- **Conversões**: AFN → AFD, minimização, AF ↔ expressão regular, AF ↔ gramática
  regular, remoção de estados inalcançáveis/inúteis, estado de erro.
- **Máquinas de Moore** (transdutoras) e **máquinas de Turing** de uma fita, na
  convenção de Menezes (marcador `Δ`) e na do JFLAP.
- Leitura e gravação de `.jff` (dialetos do JFLAP 4, 6.4 e 7); exportação SVG e
  PNG; impressão.

## Créditos

**Desenvolvimento** — Anderson Pires, mestrando em Computação Aplicada
(PPGCA/Univali).

**Contexto** — iniciativa da disciplina de **Teoria da Computação** (MCA 1001),
ministrada pelo Prof. André Raabe, no segundo semestre de 2026. É um projeto
acadêmico independente, não um produto oficial da instituição.

**Inspiração** — o [Web-GALS](https://lia-univali.github.io/Web-GALS/), do
Laboratório de Inteligência Aplicada (LIA) da Univali, que trouxe o gerador GALS
para a web mantendo o formato de arquivo da ferramenta original. O AutomataLab
segue a mesma proposta com o JFLAP. *(Web-GALS: desenvolvimento de Vinícius
Schütz Piva e Daniel Akira Nakamura Gullich; orientação do Prof. Eduardo Alves
da Silva.)*

**Compatibilidade** — o formato `.jff` é o do
[JFLAP](https://www.jflap.org/), de Susan H. Rodger e colaboradores (Duke
University). O AutomataLab **não contém código do JFLAP**: é uma implementação
independente que apenas lê e grava o mesmo formato de arquivo. Não é afiliado
nem endossado pelo projeto JFLAP ou pela Duke University.

## Licença

Publicado sob a licença **MIT**: qualquer pessoa pode usar, estudar, modificar e
redistribuir, inclusive a Univali e a própria disciplina, sem pedir autorização.
