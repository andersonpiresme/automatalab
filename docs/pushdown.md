---
title: Autômato com pilha
subtitle: Uma pilha entre a entrada e os estados — o reconhecedor das linguagens livres de contexto
is-pda: true
prev: Máquinas de Moore
prev-href: moore.html
next: Máquinas de Turing
next-href: turing.html
---

## O que é

Um **autômato com pilha** (PDA, de *pushdown automaton*) é um autômato finito
com uma memória a mais: uma **pilha**. A cada passo ele olha o símbolo da
entrada e o **topo da pilha**, e decide para onde ir, o que remover do topo e o
que colocar de volta. É essa pilha que lhe dá poder para contar de forma
irrestrita — e por isso os PDA reconhecem exatamente as **linguagens livres de
contexto**, uma classe acima dos autômatos finitos e abaixo das máquinas de
Turing.

O exemplo clássico é `aⁿbⁿ`: empilha-se um símbolo para cada `a` e desempilha-se
um para cada `b`; se a pilha volta ao fundo exatamente quando a entrada acaba, as
quantidades batiam. Um autômato finito não consegue fazer isso — não tem onde
guardar a contagem.

## A convenção da ferramenta

O AutomataLab segue a mesma convenção do JFLAP, para manter a compatibilidade de
arquivos:

- A pilha começa com **um único símbolo de fundo**, o `Z`. Ele marca o fundo e
  pode ser lido e removido como qualquer outro.
- Cada transição tem três partes: **o que lê** da entrada, **o que desempilha**
  do topo e **o que empilha** de volta.
- No painel de simulação, a pilha é mostrada com o **topo à esquerda**. Empilhar
  `aZ` deixa o `a` no topo e o `Z` embaixo.

## As transições

O rótulo de uma transição tem o formato `lido, desempilha ; empilha`. Ao criar
uma transição, digite as três partes separadas por vírgula ou ponto e vírgula;
`λ`, `lambda` ou vazio valem para "não ler", "não desempilhar" ou "não empilhar".

| Rótulo | Significado |
|---|---|
| `a, Z ; aZ` | lê `a`, desempilha `Z`, empilha `aZ` (troca o `Z` por `aZ` — o `a` fica no topo) |
| `a, a ; aa` | lê `a`, desempilha um `a`, empilha dois — a pilha cresce |
| `b, a ; λ` | lê `b`, desempilha um `a`, não empilha nada — a pilha encolhe |
| `λ, Z ; Z` | não lê nada; só confere que o `Z` está no topo (transição espontânea) |

Uma transição só é aplicável quando **o símbolo lido casa com a entrada** (ou é
`λ`) **e o topo da pilha começa com o que ela desempilha**. Empilhar uma string
coloca o **primeiro caractere no topo**; desempilhar uma string exige que o topo,
lido de cima para baixo, seja exatamente aquela string.

## Como a máquina aceita

Há duas convenções, e o menu **Exibir → Pilha: alternar aceitação** troca entre
elas. A escolha aparece no painel de seleção.

| Modo | Aceita quando… |
|---|---|
| **Estado final** (padrão) | a entrada acabou **e** a máquina está num estado final — a pilha pode ter qualquer conteúdo |
| **Pilha vazia** | a entrada acabou **e** a pilha ficou vazia — não é preciso ter estado final |

As duas convenções reconhecem a mesma classe de linguagens; muda só como se
escreve a máquina. Ao **abrir** um `.jff`, como o formato não guarda essa
escolha, a ferramenta infere: uma máquina **sem estado final** só pode aceitar
por pilha vazia.

## Não-determinismo

O PDA é, por natureza, não-determinístico: do mesmo estado, lendo o mesmo símbolo
e com o mesmo topo, pode haver **mais de uma** transição — e as transições `λ`
disparam sem consumir entrada. A simulação percorre **todas as computações ao
mesmo tempo**, em largura, como nos autômatos finitos e nas máquinas de Turing.

No passo a passo, cada configuração viva aparece como uma linha — estado, entrada
restante e pilha — e o contador indica quantas computações correm em paralelo. A
cadeia é **aceita** se **alguma** delas aceita; é **rejeitada** quando todas
morrem (nenhuma transição aplicável) sem aceitar. Para proteger contra máquinas
que empilham para sempre, há um teto de passos: atingi-lo é reportado como
"possível loop", não como rejeição.

## Um exemplo: `aⁿbⁿ`

O menu **Arquivo → Exemplo: PDA para aⁿbⁿ** carrega esta máquina, com aceitação
por estado final:

| De | `lido, desempilha ; empilha` | Para |
|---|---|---|
| →*q0 | `a, Z ; aZ` | q1 |
| q1 | `a, a ; aa` | q1 |
| q1 | `b, a ; λ` | q2 |
| q2 | `b, a ; λ` | q2 |
| q2 | `λ, Z ; Z` | *q3 |

A ideia: `q0`/`q1` empilham um `a` para cada `a` lido; ao primeiro `b`, começa-se
a desempilhar um `a` por `b`. O estado final `q3` só é alcançado pela transição
`λ, Z ; Z`, que exige o `Z` no topo — ou seja, a pilha de volta ao fundo. É esse
detalhe que impede aceitar sobras: em `aab`, sobra um `a` no topo e a máquina
não chega a `q3`. Como `q0` também é final e é alcançado com a entrada vazia, a
cadeia vazia (`n = 0`) é aceita.

Experimente `ab`, `aabb`, `aaabbb` (aceitas) e `a`, `aab`, `abb`, `ba`
(rejeitadas). Troque para **aceitação por pilha vazia** no menu Exibir e veja
como o critério muda.

## O que ainda não há

Esta versão edita e simula PDA, mas ainda **não** converte entre PDA e gramática
livre de contexto (nem faz *parsing* CYK/LL/SLR). Essas conversões são o próximo
passo natural do lado das linguagens livres de contexto.
