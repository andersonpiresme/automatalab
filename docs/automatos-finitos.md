---
title: Autômatos finitos
subtitle: Edição, simulação e as conversões do menu Converter
is-af: true
prev: Interface e menus
prev-href: interface.html
next: Máquinas de Moore
next-href: moore.html
---

## O modelo

Um autômato finito no AutomataLab é o quíntuplo usual (Q, Σ, δ, q₀, F): um
conjunto de estados, um alfabeto de entrada, uma relação de transição, um único
estado inicial e um conjunto de estados finais. Não há restrição de
determinismo na edição — o mesmo editor serve para DFA, NFA e NFA-λ — e é a
ferramenta que diz, quando perguntada, em qual caso o autômato está.

Uma transição lê um símbolo. A **transição vazia**, exibida como `λ`, muda de
estado sem consumir entrada. Várias transições entre o mesmo par de estados são
desenhadas numa única aresta, rotulada `a, b, λ`.

O alfabeto é inferido: é o conjunto dos símbolos que aparecem em alguma
transição. A tabela de transições no painel lateral tem uma coluna por símbolo
(mais uma para λ, se houver) e uma linha por estado, com `→` marcando o inicial
e `*` os finais.

## Simulação

A simulação de um autômato não-determinístico acompanha **todas** as
computações ao mesmo tempo. Uma configuração é um par (estado, posição na
entrada); a cada passo, o conjunto de configurações vivas é substituído pelo
conjunto de sucessoras. A cadeia é aceita se alguma configuração termina em
estado final com a entrada inteira consumida.

Os dois modos do menu Entrada diferem no tratamento de λ, exatamente como no
JFLAP:

- **Com fecho**: cada passo consome um símbolo e o conjunto resultante é
  fechado sob λ. É a leitura de δ* dos livros; a primeira geração já inclui
  tudo que o estado inicial alcança por λ.
- **Por estado**: uma transição λ é um passo próprio. Mostra ao aluno o custo
  real do não-determinismo; um ciclo de λ não trava a simulação, porque
  configurações repetidas são descartadas.

A **execução rápida** faz o mesmo e, quando aceita, mostra o caminho:
`q0 —1→ q0 —0→ q1 —1→ q2`.

Se a entrada tiver símbolos que não aparecem em nenhuma transição, a ferramenta
avisa — costuma ser um erro de digitação, não uma rejeição de verdade.

## As conversões

Todas as conversões calculam o resultado e o mostram; nenhuma pede ao aluno
que construa passo a passo, como faz o JFLAP. Essa é a diferença mais
importante em relação ao original e está listada como trabalho futuro.

### NFA para DFA

Construção de subconjuntos. Cada estado do DFA é um conjunto de estados do
NFA, já fechado sob λ, e é nomeado pela concatenação dos nomes de origem —
`q0q1`. Quando o nome não cabe no círculo, a fonte encolhe; quando não cabe de
jeito nenhum, o estado vira `d3` e o conjunto aparece como rótulo abaixo dele.

O conjunto vazio **não** vira estado: o DFA sai parcial, como no JFLAP. Para
completá-lo, use *Adicionar estado de erro*.

### Minimização

Refinamento de partições (Moore). Estados inalcançáveis são removidos antes. O
estado morto implícito entra na partição como um pseudo-estado e é descartado
no fim, de modo que um DFA parcial continua parcial e um completo continua
completo. Os nomes dos estados do resultado indicam quais foram fundidos.

O comando recusa autômatos não-determinísticos: converta para DFA primeiro.

### Equivalência

*Comparar equivalência com .jff…* percorre o produto dos dois DFAs a partir dos
estados iniciais. Se algum par alcançável discorda quanto a ser final, as
linguagens diferem — e a ferramenta devolve a menor cadeia que as distingue,
dizendo qual dos dois a aceita. Autômatos não-determinísticos são
determinizados antes da comparação.

Esse é o teste mais forte que a ferramenta oferece: enquanto a simulação mostra
que uma cadeia é aceita, a equivalência prova que **todas** são.

### Expressões regulares

A sintaxe é a do JFLAP: `+` (ou `|`) para união, justaposição para
concatenação, `*` para o fecho de Kleene, parênteses, e `λ` ou `!` para a
cadeia vazia. Nada de classes de caracteres, quantificadores `{n}` ou
metacaracteres de regex prática — é a expressão regular da teoria.

- **ER para autômato** usa a construção de Thompson. O resultado tem
  transições λ de sobra, de propósito: é a construção do livro. Converta para
  DFA e minimize para enxugar.
- **Autômato para ER** usa eliminação de estados. A ordem de eliminação não
  muda a linguagem, mas muda o tamanho da expressão; a ferramenta elimina
  primeiro os estados de menor produto grau de entrada × grau de saída.

### Gramáticas regulares

*Converter para gramática regular* produz uma gramática linear à direita: cada
estado vira uma variável (o inicial é `S`, os demais `A`, `B`, …), cada
transição `p —a→ q` vira `P → aQ`, e cada estado final `p` ganha `P → λ`.

*Autômato a partir de gramática…* faz o caminho inverso a partir de texto, uma
variável por linha:

```
S -> aS | bA
A -> λ
```

Aceita `->`, `→` ou `::=` como seta, `|` para alternativas e `λ` ou `!` para a
cadeia vazia. Produções que terminam em terminal (`A → ab`) levam a um estado
final único, criado só quando necessário.

## Um roteiro de sala

O encadeamento que a ferramenta foi feita para suportar:

1. Desenhe o NFA de um enunciado e teste algumas cadeias.
2. *Converter para DFA*, depois *Minimizar DFA*. O número de estados do mínimo
   é uma resposta verificável.
3. *Converter para expressão regular*. A expressão sai feia — é normal — mas é
   provadamente correta.
4. Escreva a expressão que você acha elegante, gere o autômato dela e use
   *Comparar equivalência* contra o mínimo. Se divergir, o contraexemplo diz
   onde.

O passo 4 é o que transforma "acho que está certo" em "está certo".
