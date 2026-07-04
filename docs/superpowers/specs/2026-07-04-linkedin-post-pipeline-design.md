# Motor de Geração de Posts para LinkedIn — Design

**Data:** 2026-07-04
**Escopo:** Motor de geração (Config Layer + Orquestrador + pipeline de 6 estágios). Autenticação, multi-tenant, billing e dashboard ficam para sub-projetos futuros.

## Visão geral

Um pipeline sequencial de 6 estágios que transforma um tema (ou nicho) em um post de LinkedIn pronto, com variações de gancho. Cada estágio é uma etapa determinística de transformação de estado — não um agente autônomo — orquestrada por um módulo central que gerencia o fluxo, o estado acumulado e os erros.

```
[Config Layer] → [Orquestrador] → Estágio 1..6 → [Output]
```

## Arquitetura e stack

- **Next.js (App Router)** na Vercel, TypeScript.
- **Vercel AI SDK + OpenRouter** como único provider de LLM. Cada estágio pode declarar seu próprio modelo (string de model ID do OpenRouter, ex: `"anthropic/claude-..."`, `"openai/gpt-..."`), com fallback para um default por tipo de tarefa se não especificado no config profile (ver seção "Resolução de modelo").
- **Supabase** para persistência: perfis de config, execuções do pipeline, resultados de cada estágio (trace) e posts gerados.
- **Orquestrador**: módulo TypeScript que roda os 6 estágios em sequência, acumulando um `PipelineState`, persistindo cada estágio concluído no Supabase, e falhando imediatamente (sem retry automático) se algum estágio quebrar — retornando o estágio exato e o erro.
- **Profundidade por estágio**: 5 dos 6 estágios (Estrategista, Ângulo, Redator, Editor de Gancho, Revisor) são uma única chamada estruturada (prompt + schema Zod) — são transformações diretas, não exigem múltiplos passos. O **Pesquisador é o único agente de verdade**: roda um loop interno (planeja buscas → chama a tool Tavily → sintetiza fatos com fonte → verifica confiança) porque fundamentação factual real exige múltiplos passos e uma capacidade externa (dado vivo da web) que nenhuma chamada única de LLM entrega.
- **SaaS de terceiros avaliados e descartados** para os estágios 1, 3, 4, 5, 6 (Jasper, Copy.ai, Writesonic, Grammarly, Taplio, Supergrow): sem evidência de vantagem sobre um modelo frontier bem prompt-ado via OpenRouter, e ferramentas LinkedIn-específicas (Taplio, Supergrow) são concorrentes diretas deste produto — integrá-las significaria depender de um concorrente para gerar o conteúdo central.
- Execução **síncrona**: uma chamada `POST /api/generate` roda o pipeline inteiro e devolve o resultado final + trace completo, dentro do timeout padrão de função da Vercel (300s).

## Modelo de dados (Supabase)

### `config_profiles`
Perfis reutilizáveis de configuração (Config Layer).
- `id`, `name`
- `tone_of_voice` (jsonb — adjetivos, exemplos de referência)
- `objective` (text — ex: "gerar autoridade", "gerar leads")
- `niche` (text)
- `template` (jsonb — estrutura/formato do post: storytelling, lista, contraste, etc.)
- `model_overrides` (jsonb — modelo por estágio; chaves: `theme`, `research`, `angle`, `writer`, `hook`, `reviewer`; valores são model IDs do OpenRouter, ex: `"anthropic/claude-..."`. Chaves ausentes resolvem para o default do estágio — ver "Resolução de modelo")
- `created_at`

### `pipeline_executions`
Cada rodada do pipeline.
- `id`, `config_profile_id` (FK → `config_profiles`)
- `input_theme` (nullable — se o usuário passou um tema ou deixou o Estágio 1 gerar a partir do nicho)
- `status` (`running` / `success` / `failed`)
- `failed_stage` (nullable), `error_message` (nullable)
- `created_at`, `finished_at`

### `stage_results`
Trace de cada estágio, persistido incrementalmente (mesmo se o pipeline falhar depois).
- `id`, `execution_id` (FK → `pipeline_executions`), `stage_name`
- `input` (jsonb), `output` (jsonb)
- `model_used`, `duration_ms`, `created_at`

### `generated_posts`
Resultado final.
- `id`, `execution_id` (FK → `pipeline_executions`)
- `final_post` (text)
- `hook_variations` (jsonb array — 2-3 variações de gancho)
- `created_at`

## Contratos dos estágios

Cada estágio é uma função pura `async (state, config) => output`, com schema Zod validando o output via `generateObject` (estágios estruturados) ou `generateText` (estágios de prosa). O `PipelineState` acumula o output de todos os estágios anteriores conforme avança.

| Estágio | Input relevante | Output | Método AI SDK |
|---|---|---|---|
| **1. Estrategista de Tema** | `theme?` (opcional), `niche`, `objective` | `{ theme, rationale }` | `generateObject` |
| **2. Pesquisador** (agente) | `theme` | `{ facts: [{ claim, sources: [{title, url}], confidence: "high"\|"low" }] }` — loop interno: planeja 2-4 buscas a partir do tema, chama a tool de busca (Tavily) para cada uma, sintetiza os resultados em fatos com fonte; alegações sem fonte confiável ficam com `confidence: "low"` em vez de serem descartadas | `generateObject` + tool calling (Tavily) |
| **3. Definidor de Ângulo** | `theme`, `facts` | `{ thesis, pov }` | `generateObject` |
| **4. Redator** | `thesis`, `pov`, `facts`, `template`, `tone_of_voice` | `{ draft }` | `generateText` |
| **5. Editor de Gancho** | `draft` | `{ finalPost, hookVariations: string[] }` — reescreve só as 2-3 primeiras linhas, gera 2-3 variações do gancho mantendo o resto do post igual | `generateText` |
| **6. Revisor/Crítico** | `finalPost`, `objective`, `tone_of_voice` | `{ finalPost, notes: string[], passed: boolean }` — corta gordura, valida voz/objetivo, pode reescrever o `finalPost` | `generateObject` |

Cada estágio recebe seu modelo via `model_overrides` do config profile (fallback para um modelo default por tipo de tarefa se não especificado). O Orquestrador não conhece os detalhes internos de cada estágio — apenas os chama na ordem certa e trata estado/erro, o que mantém os estágios substituíveis e testáveis isoladamente.

## Resolução de modelo

- Todo acesso a LLM passa pelo **OpenRouter** (via AI SDK), permitindo plugar qualquer modelo/provider disponível na plataforma sem mudar código de integração.
- Se `config_profiles.model_overrides` não especificar um modelo para um estágio, o Orquestrador resolve para `DEFAULT_STAGE_MODELS[stage]` — uma constante de código (fora do banco), mantida separada da lógica de negócio.
- Os IDs exatos de `DEFAULT_STAGE_MODELS` são decididos na implementação, não fixados nesta spec: o catálogo do OpenRouter muda com frequência, e travar versões de modelo num documento de design geraria informação obsoleta rapidamente. A implementação deve escolher, para cada estágio, o modelo com melhor relação custo/qualidade disponível no momento (ex: um modelo mais leve/rápido para o Pesquisador que já se apoia na tool de busca para a factualidade, um modelo mais forte em escrita para Redator/Editor de Gancho).
- `stage_results.model_used` sempre grava o model ID efetivamente usado (default ou override), permitindo auditar e comparar custo/qualidade entre execuções.

## API

### CRUD de config profiles
- `POST /api/config-profiles`
- `GET /api/config-profiles`
- `GET /api/config-profiles/:id`
- `PATCH /api/config-profiles/:id`

### Geração
`POST /api/generate`
- Body: `{ configProfileId: string, theme?: string }`
- Response (sucesso, 200): `{ executionId, finalPost, hookVariations, trace: { theme: {...}, research: {...}, angle: {...}, draft: {...}, hook: {...}, review: {...} } }`
- Response (falha, 500): `{ executionId, error, failedStage }` — o trace parcial (estágios já concluídos) fica salvo em `stage_results` e pode ser consultado por `executionId`.

### Fluxo do Orquestrador (`runPipeline(configProfileId, theme?)`)
1. Cria registro em `pipeline_executions` com `status: running`.
2. Carrega o `config_profile`.
3. Roda os 6 estágios em sequência; após cada estágio bem-sucedido, persiste em `stage_results` e atualiza o `PipelineState` acumulado.
4. Se um estágio lançar erro: marca `pipeline_executions.status = failed`, define `failed_stage` e `error_message`, propaga o erro para a API (sem retry automático).
5. Se todos os estágios passarem: salva em `generated_posts`, marca `status = success`, retorna o resultado.

## Tratamento de erros

- Cada estágio é chamado dentro de um wrapper que captura qualquer exceção (erro de API do LLM, timeout, output que falha na validação Zod) e relança como `StageError { stage, cause }`.
- Falha de validação de schema (LLM devolve JSON malformado) conta como falha do estágio — mesmo tratamento, sem retry.
- O Orquestrador captura `StageError`, persiste o estado de falha no Supabase e propaga para a rota da API, que responde com `failedStage` e a mensagem de erro.
- Não há fallback silencioso: se o Revisor (Estágio 6) marcar `passed: false`, isso não é um erro de pipeline — é um resultado válido que vai no output, cabendo ao consumidor decidir o que fazer (exibir alerta, permitir regenerar).

## Testes

- **Unitários por estágio**: mock do AI SDK (`generateObject`/`generateText`), verificando construção do prompt, validação de schema e propagação de erro quando o mock falha.
- **Agente Pesquisador**: mock da tool Tavily, verificando o planejamento de buscas, a síntese de fatos com fontes e a marcação correta de `confidence: "low"` quando não há fonte confiável.
- **Orquestrador**: teste de fluxo feliz (6 estágios mockados em sucesso) e teste de fluxo com falha no meio (ex: Estágio 4 falha), verificando que os estágios 1-3 foram persistidos e o pipeline parou corretamente.
- **Schemas Zod**: testes de contrato garantindo que outputs malformados são rejeitados.
- Sem testes end-to-end contra LLM real nesta fase (custo/flakiness) — ficam para uma iteração de QA manual.

## Fora de escopo (fases futuras)

- Autenticação e multi-tenant.
- Billing/assinaturas.
- Dashboard/UI de usuário final.
- Loops agentivos multi-passo nos estágios 1, 3, 4, 5, 6 (avaliado e descartado — tarefas de transformação direta não precisam disso).
- Integração com SaaS de terceiros (Jasper, Copy.ai, Writesonic, Grammarly, Taplio, Supergrow) — avaliado e descartado por falta de vantagem comprovada e/ou conflito de interesse (concorrência direta).
- Streaming de progresso da execução.
- Retry automático em falha de estágio.
