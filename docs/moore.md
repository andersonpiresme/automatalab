---
title: Máquinas de Moore
subtitle: Quando o autômato produz saída em vez de aceitar
is-moore: true
prev: Autômatos finitos
prev-href: automatos-finitos.html
next: Máquinas de Turing
next-href: turing.html
---

## O modelo

Uma máquina de Moore é um transdutor: em vez de aceitar ou rejeitar, emite uma
saída. Na variante de Moore, a saída pertence ao **estado** — cada estado tem
um valor associado, e a máquina emite o valor do estado em que está.

Consequências diretas no editor:

- não há estado final; onde estaria *Marcar final* aparece **Definir saída**;
- a saída de cada estado é desenhada em azul abaixo do círculo, como `/hora`;
- a tabela de transições ganha uma coluna **saída** antes das colunas de
  símbolos;
- a validação deixa de exigir estado final e passa a apontar estados sem saída
  definida.

## Execução

A máquina emite a saída do estado inicial antes de ler qualquer símbolo e, a
partir daí, uma saída por transição percorrida. Para uma entrada de *n*
símbolos, a fita de saída tem *n* + 1 valores.

A execução é determinística: havendo mais de uma transição possível, a
ferramenta segue a primeira e **avisa** no painel — não escolhe em silêncio.
Quando não há transição para o símbolo lido, a execução trava, e o painel diz
em que estado e para qual símbolo.

O passo a passo mostra a saída acumulada até o passo atual; a execução em lote
mostra a fita de saída completa de cada entrada.

## Compatibilidade com o JFLAP

Os arquivos `.jff` do tipo `moore` gravam a saída em `<output>` dentro de cada
estado — e repetem-na em `<transout>` dentro de cada transição, redundantemente.
O AutomataLab lê o `<output>`, ignora o `<transout>` na leitura e o reconstrói
na gravação a partir do estado de destino. O arquivo continua abrindo no JFLAP,
mas a fonte da verdade é uma só.

## O que falta

**Máquinas de Mealy** — a variante em que a saída fica na transição — não estão
implementadas. Arquivos `.jff` do tipo `mealy` são recusados com uma mensagem
explícita, em vez de abertos como se fossem outra coisa.
