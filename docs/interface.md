---
title: Interface e menus
subtitle: Cada comando, cada ferramenta, cada atalho
is-interface: true
prev: Introdução
prev-href: index.html
next: Autômatos finitos
next-href: automatos-finitos.html
---

## Ferramentas de edição

Os quatro botões à direita da barra de menus mudam o que um clique na área de
desenho faz. A linha de status lembra o que a ferramenta ativa espera.

| Ferramenta | Clique no vazio | Clique num estado | Outros |
|---|---|---|---|
| **Selecionar** | limpa a seleção | seleciona; arrastar move | clique numa aresta seleciona a transição; duplo clique num estado renomeia |
| **Estado** | cria um estado | — | o primeiro estado criado vira inicial |
| **Transição** | cancela a origem | primeiro clique marca a origem, segundo marca o destino e abre o diálogo | clicar duas vezes no mesmo estado cria um laço |
| **Apagar** | — | remove o estado e suas transições | clique numa aresta remove todas as transições dela |

### Menu de contexto (botão direito)

Clicar com o **botão direito** num estado, numa transição ou no espaço vazio abre
um menu com as edições daquele elemento, no espírito do JFLAP:

- **Estado**: renomear, tornar inicial, marcar/remover final (ou definir a saída,
  em Moore), criar uma transição a partir dali, excluir.
- **Transição**: adicionar outra transição àquele par, editar no painel, excluir.
- **Espaço vazio**: criar um estado ali, enquadrar, reposicionar.

Funciona em qualquer ferramenta, sem precisar trocar de modo na barra.

## O diálogo de transição

Ao criar uma transição, a ferramenta pergunta o rótulo. O que se digita depende
do tipo de máquina:

- **Autômato finito e Moore**: o símbolo lido. Vazio, `λ` ou `lambda` criam
  uma transição vazia. Vírgulas criam várias transições de uma vez: `a,b`
  cria duas, uma lendo `a` e outra lendo `b`.
- **Máquina de Turing**: a tripla `lido,gravado,movimento`, na notação das
  aulas — `a,A,D`. Aceita `E`/`D` (esquerda/direita) ou `L`/`R`/`S`; `ß`, `□`,
  `_` ou vazio para o branco; `Δ` ou `^` para o marcador de início. Ponto e
  vírgula separa várias: `a,A,D; b,B,E`.
- **Autômato com pilha**: a tripla `lido, desempilha ; empilha`, na notação do
  JFLAP — `a, Z ; aZ`. O primeiro caractere de *empilha* fica no topo. `λ`,
  `lambda` ou vazio significam não ler nada, não desempilhar ou não empilhar.
  Uma transição por diálogo.

Se a tripla vier malformada, o diálogo recusa com a mensagem do erro e nada é
alterado.

## Painel de seleção

Com um **estado** selecionado: renomear, tornar inicial, marcar ou remover
final (autômatos finitos, PDA e MT) ou definir a saída (Moore), excluir.

Com uma **transição** selecionada: a lista dos rótulos entre aquele par de
estados, cada um com o botão para removê-lo, e o botão para adicionar outro.

## Menu Arquivo

| Item | O que faz |
|---|---|
| Novo autômato finito / Moore / Turing / autômato com pilha | começa um documento vazio do tipo escolhido |
| Abrir .jff… | lê um arquivo do JFLAP ou do próprio AutomataLab |
| Mesclar .jff… | traz os estados e transições de outro arquivo para o documento atual, sem conectá-los — a "união disjunta" que o JFLAP chama de *Combine Automata*. Os tipos precisam coincidir |
| Salvar .jff | grava o documento no formato do JFLAP |
| Salvar imagem SVG / PNG | exporta o diagrama, na paleta clara, recortado no conteúdo |
| Imprimir… | abre o diálogo de impressão com só o diagrama, em preto e branco |
| Exemplo: AF que termina em 01 | carrega o DFA das cadeias binárias terminadas em `01` |
| Exemplo: MT para aⁿbⁿ / aⁿbⁿcⁿ / somador unário | carregam máquinas de Turing prontas |
| Exemplo: PDA para aⁿbⁿ | carrega o autômato com pilha que reconhece `aⁿbⁿ`, com aceitação por estado final |

A ferramenta também aceita `?open=<url>` no endereço para abrir um arquivo
direto — útil para compartilhar um exercício por link.

## Menu Entrada

Espelha o menu *Input* do JFLAP.

| Item | O que faz |
|---|---|
| Execução rápida… | roda a cadeia do campo de simulação até o fim e mostra o veredito; para MT, mostra também a fita final e o número de passos |
| Passo a passo com fecho… | para autômatos finitos, cada passo consome um símbolo e o conjunto de estados já vem fechado sob λ — a leitura clássica de δ*; para MT e Moore, é o passo a passo comum |
| Passo a passo por estado… | para autômatos finitos, cada transição λ é um passo próprio, que não consome entrada |
| Várias entradas… | uma cadeia por linha; devolve a tabela de vereditos (ou de saídas, para Moore; com contagem de passos, para MT) |

No passo a passo, os botões ⏮ ◀ ▶ ⏭ e as setas ← → do teclado navegam entre
os passos, e os estados ativos ficam destacados no diagrama.

## Menu Testar

| Item | O que faz |
|---|---|
| Comparar equivalência com .jff… | abre outro autômato finito e verifica se os dois reconhecem a mesma linguagem; se não, mostra a **menor cadeia que os distingue** e a deixa no campo de simulação |
| Destacar transições λ | marca no diagrama as arestas com transição vazia |
| Destacar não-determinismo | marca os estados com mais de uma transição para o mesmo símbolo, ou com transição λ |
| Limpar destaques | remove as marcações e o resultado da simulação |

## Menu Converter

Vale para autômatos finitos; com Moore ou MT abertos, os itens respondem com
um aviso. O resultado substitui o documento atual — desfazer recupera o
anterior.

| Item | O que faz |
|---|---|
| Converter para DFA | construção de subconjuntos; cada estado novo é nomeado pelo conjunto de origem, como `q0q1` |
| Minimizar DFA | refinamento de partições; exige um DFA |
| Converter para expressão regular | eliminação de estados |
| Converter para gramática regular | gramática linear à direita, com `S` como variável inicial |
| Autômato a partir de expressão regular… | construção de Thompson; sintaxe do JFLAP: `+` ou `\|`, `*`, parênteses, `λ` |
| Autômato a partir de gramática… | uma produção por linha: `S -> aS \| b` |
| Remover estados inalcançáveis | os que nenhum caminho a partir do inicial atinge |
| Remover estados inúteis | os de onde nenhum final é alcançável |
| Adicionar estado de erro | completa a função de transição com um sumidouro — o *trap state* do JFLAP |

## Menu Exibir

| Item | O que faz |
|---|---|
| Enquadrar | ajusta o zoom para caber todo o autômato |
| Reposicionar automaticamente | reorganiza os estados por força dirigida — o resultado é sempre o mesmo para o mesmo autômato |
| Fita: alternar Menezes (Δ) / JFLAP | só para MT; troca a convenção da fita (ver o capítulo de máquinas de Turing) |
| Pilha: alternar aceitação (final / vazia) | só para PDA; troca entre aceitar por estado final e por pilha vazia |

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>⌘</kbd>+<kbd>Z</kbd> | desfazer |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | refazer |
| <kbd>Delete</kbd> ou <kbd>Backspace</kbd> | exclui o que está selecionado |
| <kbd>Esc</kbd> | cancela a transição em criação, limpa a seleção, fecha menus |
| <kbd>Enter</kbd> no campo de simulação | execução rápida |
| <kbd>←</kbd> <kbd>→</kbd> durante o passo a passo | passo anterior / próximo |

O desfazer guarda até 60 alterações, incluindo conversões e movimentos de
estados. Um clique que não move nada não entra no histórico.
