---
title: Introdução
subtitle: O que é o AutomataLab, de onde veio e como se usa
is-index: true
next: Interface e menus
next-href: interface.html
---

## Introdução

O AutomataLab é um editor e simulador de autômatos que roda inteiro no
navegador. Cobre autômatos finitos (determinísticos e não-determinísticos, com
transições λ), máquinas de Moore, autômatos com pilha e máquinas de Turing de
uma fita. Lê e grava o formato `.jff` do JFLAP, de modo que o material didático
já existente continua servindo.

Nasceu na disciplina de Teoria da Computação do mestrado em Computação Aplicada
da Univali, no segundo semestre de 2026. O JFLAP — a ferramenta de referência
da área, mantida pela Duke University desde os anos 1990 — é um programa Java
de desktop, e rodá-lo num Mac atual exige instalar um ambiente Java que o
sistema já não traz. Diante dessa dificuldade prática, e com a intenção de fixar
o conteúdo construindo em vez de só usando, começou-se uma reimplementação para
a web.

O modelo foi o [Web-GALS](https://lia-univali.github.io/Web-GALS/), da própria
Univali: uma versão web do gerador de analisadores GALS que manteve o formato de
arquivo da ferramenta original e eliminou a instalação local. O AutomataLab
segue a mesma proposta com o JFLAP. Não contém código do JFLAP — é uma
implementação independente, publicada sob licença MIT — mas conversa com ele
pelo formato de arquivo.

Uma decisão de projeto atravessa tudo: onde a literatura diverge, a ferramenta
segue **a definição usada nas aulas**. A máquina de Turing, em particular,
implementa a 8-upla de Menezes — com o marcador de início `Δ`, o branco `ß`, os
movimentos `E`/`D` e as três condições de parada — em vez da variante do JFLAP,
que tem fita infinita nos dois lados e nenhum marcador. A convenção do JFLAP
existe como alternativa, para abrir arquivos feitos nele.

## Uso geral

A ferramenta está em <https://andersonpiresme.github.io/automatalab/>. Não há
instalação, cadastro nem servidor: tudo acontece no navegador, e os arquivos
ficam na sua máquina.

A tela tem três regiões:

**Barra de menus**, no alto. Seis menus — Arquivo, Entrada, Testar, Converter,
Exibir e Ajuda — organizados como no JFLAP, para que quem conhece um se oriente
no outro. À direita ficam as quatro ferramentas de edição (Selecionar, Estado,
Transição, Apagar), os botões de desfazer e refazer e o nome do arquivo aberto.

**Área de desenho**, o centro. É onde o autômato aparece e é editado. Estados são
círculos; o inicial recebe uma seta à esquerda, os finais têm círculo duplo;
transições são arestas rotuladas. Laços, arestas em sentidos opostos e arestas
que precisam contornar outro estado são curvadas automaticamente. No canto
inferior fica a linha de status, que responde a cada ação.

**Painel lateral**, à direita. Tem três seções: **Simulação**, com o campo de
entrada e o resultado da execução — inclusive a fita, no caso da máquina de
Turing; **Seleção**, que mostra e edita o que está selecionado no desenho; e a
**Tabela de transições**, sempre sincronizada com o diagrama.

O fluxo típico é: abrir um `.jff` ou desenhar do zero, digitar uma cadeia no
campo de simulação, clicar em **Testar** ou acompanhar passo a passo pelo menu
Entrada, e salvar. Os capítulos seguintes detalham cada parte.

## O que este manual cobre

| Capítulo | Conteúdo |
|---|---|
| [Interface e menus](interface.html) | Cada item de menu, as ferramentas de edição, os atalhos de teclado |
| [Autômatos finitos](automatos-finitos.html) | Edição, simulação, conversões (DFA, mínimo, ER, gramática), equivalência |
| [Máquinas de Moore](moore.html) | Saída nos estados, execução como transdutor |
| [Autômato com pilha](pushdown.html) | Pilha, pop/push, não-determinismo, aceitação por estado final ou pilha vazia |
| [Máquinas de Turing](turing.html) | A definição de Menezes, convenções de fita, transições, condições de parada, passo a passo |
| [O formato .jff](formato-jff.html) | O que é lido e gravado, os dialetos do JFLAP, o que não é suportado |
| [Como foi construído](arquitetura.html) | Arquitetura, decisões, testes, o uso de IA no desenvolvimento |
| [Roadmap](roadmap.html) | O que já existe e as melhorias planejadas, em ordem de prioridade |
| [Informações](sobre.html) | Versão, changelog, créditos e licença |
