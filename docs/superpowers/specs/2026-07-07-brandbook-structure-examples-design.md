# Brandbook e Exemplos de Estrutura — Design

**Data:** 2026-07-07
**Escopo:** Duas extensões ao Config Layer do motor de geração: (1) exemplos de estrutura anexados a um perfil de voz, via arquivo `.md`/`.txt`; (2) uma área de Brandbook — identidade única por conta de quem produz o post — que passa a influenciar o Redator e o Revisor.

## Motivação

Os perfis de voz hoje descrevem tom, nicho, objetivo e um `template` em texto livre. Isso não é suficiente para dois casos:
1. **Estrutura concreta**: é mais fácil mostrar um exemplo real de formatação (parágrafos curtos, bullet points, quebra de linha antes do gancho) do que descrevê-la em texto.
2. **Identidade**: os posts precisam soar como *alguém específico* — sua bio, seus valores, o que essa pessoa defende ou evita — não só um "tom de voz" abstrato.

## Relação entre entidades

- Existe **um único Brandbook por conta** (identidade de quem produz os posts). Todos os perfis de voz compartilham o mesmo Brandbook — não há seleção por perfil.
- Cada **perfil de voz** pode ter até **5 exemplos de estrutura** anexados (arquivos `.md`/`.txt`), independentes uns dos outros e independentes do Brandbook.
- Ambos são aditivos: se o Brandbook ainda não foi criado, ou um perfil não tem exemplos, o pipeline roda normalmente — nada disso bloqueia a geração.

## Modelo de dados (Supabase — migração `0002_brandbook_and_examples.sql`)

### `brandbook`
Linha única por conta (a aplicação sempre lê/atualiza a primeira linha existente; não há seleção por id na API).
- `id` uuid primary key default `gen_random_uuid()`
- `name` text not null
- `role` text not null (cargo/função)
- `company` text not null
- `industry` text not null (setor/segmento)
- `bio` text not null default `''` (biografia e trajetória, texto livre)
- `values` text not null default `''` (valores e posicionamento, texto livre)
- `voice_references` text not null default `''` (expressões recorrentes, hashtags, frases de assinatura)
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

### `profile_structure_examples`
- `id` uuid primary key default `gen_random_uuid()`
- `config_profile_id` uuid not null references `config_profiles(id)`
- `filename` text not null
- `content` text not null (conteúdo do `.md`/`.txt`, extraído no navegador antes do upload)
- `created_at` timestamptz not null default `now()`
- índice em `config_profile_id` (mesma lógica de `stage_results`/`pipeline_executions`: toda listagem é "todos os exemplos de um perfil")
- limite de 5 exemplos por perfil é validado na camada de API (não no banco), retornando erro claro quando excedido

Sem Supabase Storage e sem upload binário: como só `.md`/`.txt` são aceitos, o arquivo é lido no navegador via `FileReader` e enviado como `{ filename, content }` em JSON — o servidor nunca lida com multipart/form-data.

## Integração com o pipeline

- **Orquestrador** (`runPipeline`): no início da execução, além de já receber o `ConfigProfile`, busca o Brandbook (`getBrandbook`, pode retornar `null`) e os exemplos de estrutura do perfil (`listStructureExamples(configProfileId)`, pode retornar `[]`). Essas duas buscas são independentes uma da outra e do restante do fluxo — uma falha em qualquer uma delas propaga como erro não estruturado (mesmo comportamento já aceito para `createExecution` falhar antes de qualquer `runStage`, ver spec original).
- **Redator (Estágio 4)**: recebe `brandbook: Brandbook | null` e `structureExamples: string[]` como input adicional (além de `thesis`, `pov`, `facts`, `template`, `toneOfVoice` já existentes). O prompt passa a incluir, quando presentes: a identidade do Brandbook (nome, cargo, empresa, bio, valores, referências de voz) e os exemplos de estrutura como referência de **formatação**, com instrução explícita de seguir o padrão estrutural (tamanho de parágrafo, uso de bullets, quebras de linha) sem copiar o conteúdo dos exemplos.
- **Revisor (Estágio 6)**: recebe `brandbook: Brandbook | null` como input adicional (além de `finalPost`, `objective`, `toneOfVoice` já existentes). Quando o Brandbook existe, o prompt pede para validar se o post condiz com os valores e o posicionamento descritos, além das checagens de tom/objetivo já existentes.
- **Os demais 4 estágios (Estrategista, Pesquisador, Definidor de Ângulo, Editor de Gancho) não mudam** — o pedido original é especificamente sobre estrutura e tom, que são responsabilidade do Redator e do Revisor.
- Quando `brandbook` é `null` ou `structureExamples` é `[]`, os prompts do Redator/Revisor simplesmente omitem essas seções — nenhuma lógica condicional complexa, só monta o prompt com o que existir.

## API

### Brandbook
- `GET /api/brandbook` — retorna o Brandbook existente, ou `null` (200) se ainda não foi criado.
- `PUT /api/brandbook` — cria ou atualiza (upsert) a única linha. Body validado por um schema Zod (`name`, `role`, `company`, `industry` obrigatórios; `bio`, `values`, `voiceReferences` opcionais, default `''`).

### Exemplos de estrutura
- `GET /api/config-profiles/:id/examples` — lista os exemplos do perfil.
- `POST /api/config-profiles/:id/examples` — body `{ filename: string, content: string }`. Retorna 400 se o perfil já tem 5 exemplos, ou se `content` estiver vazio.
- `DELETE /api/config-profiles/:id/examples/:exampleId` — remove um exemplo.

## Frontend

- **Nova página `/brandbook`**: formulário único (não uma lista — é a identidade da conta). Campos: nome, cargo, empresa, setor, biografia (textarea), valores e posicionamento (textarea), referências de voz (textarea). Botão "Salvar" chama `PUT /api/brandbook`; ao carregar a página, `GET /api/brandbook` preenche o formulário se já existir. Entra na navegação principal.
- **Página `/perfis`**: cada perfil da listagem ganha uma seção "Exemplos de estrutura" — input de arquivo (`accept=".md,.txt"`), lê o conteúdo via `FileReader` no navegador, envia via `POST /api/config-profiles/:id/examples`, lista os exemplos já enviados (nome do arquivo) com opção de remover. Mostra aviso quando o limite de 5 é atingido.

## Tratamento de erros

- `PUT /api/brandbook`: erro de validação Zod → 400 com o erro `flatten()`, mesmo padrão já usado em `/api/config-profiles`.
- `POST /api/config-profiles/:id/examples`: 404 se o perfil não existir; 400 se `content` vazio ou limite de 5 excedido; 400 se `filename` não terminar em `.md` ou `.txt`.
- `DELETE .../examples/:exampleId`: 404 se o exemplo não existir.
- Nenhum erro de Brandbook/exemplos interrompe `POST /api/generate` — essas buscas não lançam `StageError`; se falharem por um erro real de Supabase, propagam como erro não estruturado (500), mesmo padrão já aceito para outras falhas de infraestrutura fora do `runStage`.

## Testes

- **`brandbook/schema.test.ts`**: validação de campos obrigatórios e defaults.
- **`brandbook/repository.test.ts`**: `getBrandbook` retorna `null` quando não há linha; `upsertBrandbook` cria quando não existe e atualiza quando já existe (testado via mocks do Supabase, com asserção nos argumentos passados, seguindo o padrão já estabelecido nos outros repositórios).
- **`structureExamples/repository.test.ts`**: `listStructureExamples`, `createStructureExample`, `deleteStructureExample` — mesmo padrão de mocks/asserções de argumento.
- **`stages/writer.test.ts`** e **`stages/reviewer.test.ts`**: atualizados para cobrir os novos parâmetros opcionais (`brandbook`/`structureExamples` presentes vs. ausentes), confirmando que o prompt se ajusta sem quebrar quando ausentes.
- **`orchestrator.test.ts`**: atualizado para mockar `getBrandbook`/`listStructureExamples` e confirmar que são chamados e seus resultados repassados ao Redator/Revisor.
- **Rotas novas**: testes de API seguindo o padrão já estabelecido (mock de repository + supabase client, casos de sucesso e erro).

## Fora de escopo

- Upload de imagens/prints e extração via modelo com visão (avaliado e descartado nesta fase — só `.md`/`.txt` são aceitos).
- Upload de PDF.
- Armazenamento do arquivo original (Supabase Storage) — só o texto extraído é persistido.
- Múltiplos Brandbooks por conta (ex: agência atendendo vários clientes) — só um Brandbook por conta nesta fase.
- Mudança nos estágios Estrategista, Pesquisador, Definidor de Ângulo e Editor de Gancho — não recebem Brandbook nem exemplos de estrutura nesta fase.
