---
title: Roadmap
subtitle: O que já existe, o que vem a seguir e em que ordem
is-roadmap: true
prev: Como foi construído
prev-href: arquitetura.html
next: Informações
next-href: sobre.html
---

## Como ler esta página

Este é o mapa das melhorias do AutomataLab: o que já está pronto, o que vem a
seguir e **em que ordem de prioridade**. É um documento vivo — a sequência é uma
proposta e pode mudar conforme a disciplina precisar. Sugestões são bem-vindas
(ver [Como colaborar](#como-colaborar) no fim).

| Marca | Significado |
|---|---|
| ✅ | entregue |
| 🚧 | em desenvolvimento |
| 🔜 | próximo (na fila) |
| 📋 | planejado |
| 💡 | ideia em avaliação |

O **esforço** é uma estimativa grosseira: *Pequeno* (horas), *Médio* (dias),
*Grande* (mais de uma semana).

## Já entregue

- ✅ **Autômatos finitos** — AFD, AFN e λ-AFN; simulação rápida e passo a passo;
  equivalência.
- ✅ **Conversões de regulares** — AFN→AFD, minimização, AF↔expressão regular,
  AF↔gramática regular, remoção de estados inalcançáveis/inúteis, estado de erro.
- ✅ **Máquinas de Moore** (transdutoras).
- ✅ **Máquinas de Turing** de uma fita — convenções de Menezes (Δ) e do JFLAP.
- ✅ **Autômato com pilha (PDA)** — não-determinístico, aceitação por estado
  final ou pilha vazia *(2026.09.24)*.
- ✅ **Edição por menu de contexto** (botão direito) *(2026.09.24)*.
- ✅ **Interoperabilidade `.jff`** com o JFLAP; exportação SVG/PNG; impressão.
- ✅ **Documentação** e esta página de roadmap.

## Próximos passos, em ordem de prioridade

O critério é **valor para a disciplina primeiro** (o que o programa de Teoria da
Computação cobre), depois esforço. Como o PDA acabou de entrar, o eixo principal
agora são as **linguagens livres de contexto** — mas alguns ganhos rápidos podem
se intercalar para manter o ritmo.

| # | Melhoria | Trilha | Por que importa | Esforço | Status |
|---|---|---|---|---|---|
| 1 | **Máquina de Mealy** | Transdutores | completa o par com Moore; a saída fica na transição, não no estado | Pequeno | 🔜 |
| 2 | **Editor de gramática livre de contexto (GLC)** | Livres de contexto | base para todas as conversões e análises abaixo | Médio | 🔜 |
| 3 | **Conversão GLC ↔ PDA** | Livres de contexto | liga gramática e autômato, os dois lados da mesma classe | Médio | 📋 |
| 4 | **GLC → Forma Normal de Chomsky** e transformações | Livres de contexto | remover λ-produções, unitárias e símbolos inúteis | Médio | 📋 |
| 5 | **Análise sintática CYK** | Livres de contexto | decide se a cadeia pertence, com a tabela preenchida | Médio | 📋 |
| 6 | **Lema do bombeamento** (regular e livre de contexto) | Didático | jogo interativo, como no JFLAP | Médio | 📋 |
| 7 | **Operações sobre AF** (união, interseção, complemento, concatenação, estrela) | Regulares | mostra o fecho das linguagens regulares | Médio | 📋 |
| 8 | **Mais algoritmos de layout** (círculo, árvore, GEM) | Usabilidade | organiza autômatos grandes automaticamente | Pequeno | 📋 |
| 9 | **Análise LL(1) / SLR(1)** com árvore de derivação | Livres de contexto | *parsing* preditivo e ascendente, com as tabelas | Grande | 💡 |
| 10 | **MT multifita** | Turing | além da fita única, como no JFLAP | Médio | 💡 |
| 11 | **Conversões guiadas passo a passo** (o aluno monta, a ferramenta corrige) | Didático | aprender construindo, não só vendo o resultado | Grande | 💡 |

## Backlog / ideias

Coisas de menor prioridade para o curso, mas que fariam sentido um dia:

- 💡 **Correção em lote** (*batch grade*) — rodar uma pasta de respostas contra um
  gabarito.
- 💡 **L-System** — os gráficos tartaruga do JFLAP.
- 💡 **Turing por blocos** (*building blocks*) — máquinas hierárquicas.
- 💡 **Exportar a execução** como imagem/animação para colar em slides.

## Como priorizamos

1. **O que a disciplina cobre** vem antes do que é "legal de ter".
2. Entre itens de valor parecido, o de **menor esforço** primeiro.
3. **Ganhos rápidos** (Mealy, layouts) podem entrar entre os grandes para não
   ficar muito tempo sem algo visível.
4. Cada item segue o mesmo método: **núcleo com testes primeiro**, depois a
   interface — como foi com o PDA.

## Como colaborar {#como-colaborar}

Ideias, correções de prioridade e pedidos são bem-vindos. O canal é o
repositório: abra uma *issue* em
<https://github.com/andersonpiresme/automatalab/issues> descrevendo a melhoria e,
se puder, onde ela aparece no programa da disciplina. A ordem desta página é uma
proposta — dizer "isto é mais urgente para a próxima aula" muda a fila.
