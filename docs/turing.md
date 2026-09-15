---
title: Máquinas de Turing
subtitle: A definição das aulas, implementada célula a célula
is-turing: true
prev: Máquinas de Moore
prev-href: moore.html
next: O formato .jff
next-href: formato-jff.html
---

## A definição

A ferramenta implementa a máquina de Turing como a disciplina a define — a
8-upla de Menezes:

> M = (Σ, Q, Π, q₀, F, V, ß, Δ)

| Componente | Significado | No AutomataLab |
|---|---|---|
| Σ | alfabeto de entrada | inferido das transições: minúsculas e dígitos |
| Q | estados | os círculos do diagrama |
| Π | função programa: Q × (Σ ∪ V ∪ {ß, Δ}) → Q × (Σ ∪ V ∪ {ß, Δ}) × {E, D} | as transições; a tabela Π no painel lateral |
| q₀ | estado inicial | seta à esquerda |
| F | estados finais | círculo duplo |
| V | alfabeto auxiliar | inferido: maiúsculas |
| ß | branco | célula vazia; exibido como `ß` |
| Δ | marcador de início | célula 0 da fita; exibido como `Δ` |

Π é uma **função parcial**: para cada par (estado, símbolo lido) há no máximo
uma tripla (novo estado, símbolo gravado, movimento). A validação avisa quando
o mesmo estado tem duas transições para o mesmo símbolo lido — a máquina passa
a ser não-determinística, o que a definição das aulas não prevê, mas a
simulação continua funcionando (ver abaixo).

## A fita

Na convenção das aulas, a fita é **semi-infinita**: começa na célula 0, que
contém `Δ`, e cresce só para a direita. A entrada ocupa as células 1 a *n*; o
resto é branco. A cabeça de leitura começa **sobre o Δ**, na célula 0.

A ferramenta chama isso de convenção **Menezes** e a adota por padrão. Existe
uma segunda, chamada **JFLAP**, para abrir arquivos feitos lá:

| | Menezes (padrão) | JFLAP |
|---|---|---|
| Célula 0 | `Δ` | primeiro símbolo da entrada |
| Cabeça começa | sobre o `Δ` | sobre o primeiro símbolo |
| Fita | cresce só à direita | infinita nos dois lados |
| Mover à esquerda do início | **rejeita** (movimento inválido) | a fita cresce |
| Branco | `ß` | `□` |
| Movimentos exibidos | `E` / `D` | `L` / `R` / `S` |

Uma máquina desenhada para uma convenção **não roda na outra** sem adaptação:
na Menezes a primeira transição sempre lê `Δ`, e na JFLAP não há `Δ` para ler.
Ao abrir um `.jff`, a ferramenta infere a convenção — máquina que menciona `Δ`
é Menezes — e *Exibir → Fita* permite trocar.

## Transições

Cada transição é uma tripla `(lido, gravado, movimento)`, desenhada assim na
aresta e digitada assim no diálogo: `a,A,D`. Várias transições entre o mesmo
par de estados aparecem uma por linha na aresta.

| Movimento | Digite | Exibido |
|---|---|---|
| esquerda | `E` ou `L` | `E` |
| direita | `D` ou `R` | `D` |
| parado | `S` ou `P` | `S` |

O branco pode ser digitado como `ß`, `□`, `_` ou simplesmente nada (`,,D` lê
branco, grava branco, move à direita). O marcador é `Δ` ou `^`. A letra `b` é
a letra `b` — nunca é interpretada como branco.

A **tabela Π** no painel lateral tem as colunas na ordem dos slides: `Δ`, os
símbolos de entrada, os auxiliares, `ß`. Cada célula mostra `(destino,
gravado, movimento)`.

## Condições de parada

As três do slide 26, nomeadas no veredito:

| Condição | O que acontece | Veredito |
|---|---|---|
| **Estado final** | a máquina entra num estado de F | **Aceita** — parou em estado final |
| **Função indefinida** | Π não tem entrada para (estado atual, símbolo lido) | **Rejeita** — função indefinida |
| **Movimento inválido** | a transição manda para a esquerda e a cabeça está na célula 0 | **Rejeita** — movimento inválido à esquerda do Δ |

Há uma quarta situação, que não é parada: a máquina pode **não parar**. A
ferramenta limita a execução a 10.000 passos e, atingido o limite, informa
*"não parou — possível loop"*. Isso é deliberadamente diferente de rejeitar: é
a distinção entre REJEITA(M) e LOOP(M) do slide 38, e é o que separa linguagem
recursiva de recursivamente enumerável.

Um detalhe que costuma gerar dúvida: o estado final aceita **ao ser
alcançado**. A máquina não executa a transição que sairia dele — mesmo que
exista — e não verifica o que está sob a cabeça. Por isso um somador que
termina com a cabeça sobre o `Δ` num estado final aceita sem disparar
"movimento inválido".

## Simulação

A **execução rápida** roda até parar e mostra a fita final, com a cabeça
destacada, o veredito e o número de passos. Se aceitou, mostra também o
conteúdo útil da fita — sem `Δ` e sem brancos nas pontas — que é o resultado
quando a máquina computa uma função.

O **passo a passo** mostra, a cada passo, o estado atual e a fita inteira, com
a célula sob a cabeça destacada. Os botões ⏮ ◀ ▶ ⏭ e as setas do teclado
navegam. O estado atual fica destacado no diagrama.

**Várias entradas** devolve, para cada linha, o veredito e o número de passos.

### Não-determinismo

Se Π não for função, a simulação percorre todas as computações em largura,
como faz para autômatos finitos. O passo a passo mostra todas as configurações
vivas de cada geração e avisa quantas são. A máquina aceita se **alguma**
computação atinge estado final. Isso está fora da definição das aulas, mas o
slide 27 lista o não-determinismo entre as variações que não acrescentam poder
— e a ferramenta deixa isso verificável.

## O exemplo do slide 10

*Arquivo → Exemplo: MT para aⁿbⁿ* carrega a máquina do slide 10 da aula 9, com
os estados na mesma disposição do slide. A estratégia é a clássica: marcar um
`a` como `A`, ir até o primeiro `b` e marcá-lo como `B`, voltar ao `A` e
repetir; quando não há mais `a`, conferir que só restaram `B` até o branco.

Com a entrada `aabb`, o passo a passo reproduz os slides 11 a 25 célula a
célula, e aceita em 14 passos com a fita `Δ A A B B`. Com `aab`, rejeita por
função indefinida no passo 8: a máquina volta procurando um `A` e o que
encontra não tem transição.

Esse exemplo é a verificação mais direta de que a ferramenta implementa a
definição da disciplina, e não outra.

## Escopo

Uma fita, uma cabeça. Arquivos `.jff` com `<tapes>2</tapes>` ou mais são
recusados com uma mensagem clara. Os *building blocks* do JFLAP 7 são
ignorados com aviso. O `~` do JFLAP 7 (grava o que leu) é aceito na leitura.
