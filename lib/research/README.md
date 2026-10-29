# SERA/Hush Research Module

This isolated backend module stores and audits raw, public problem signals relevant to people in the United States. It does not change the SERA/Hush social product and does not expose a page or API.

## Current scope: Phases 1–5

Phase 1 provides configuration, typed MongoDB documents and indexes, normalization, strict input validation, idempotent persistence, collection-run auditing, a manual JSON importer, statistics, seed lists, structured logs, and tests.

Phase 2 adds authenticated, read-only Reddit post search for explicitly selected public communities. It stores only normalized post signals through the Phase 1 repository. It does not collect comments, private communities, user profiles, private messages, or inferred user locations.

Phase 3 atomically claims pending signals and uses OpenRouter strict structured output to classify grounded, practical problems. Accepted and reviewable results become one linked `ProblemMention`; irrelevant or uncertain records become `no_problem`; bounded failures become `failed`. Embeddings, semantic deduplication, problem clustering, opportunity scoring, Firecrawl, dashboards, and other user-facing features remain intentionally unimplemented.

Phase 4 embeds eligible accepted mentions, retrieves exact and compatible semantic candidates, asks a strict OpenRouter duplicate judge before merging, and links each processed mention to one auditable `UniqueProblem`. Opportunity scoring, demand/trend analysis, business generation, dashboards, and user-facing features remain intentionally unimplemented.

Phase 5 adds CLI-only human review, corrections with immutable audit history, versioned fixture evaluation, threshold analysis, reviewer agreement, report-only quality and cluster audits, and configurable scale-readiness gates. It does not add collectors, UI, automatic repairs, automatic threshold changes, or paid evaluation calls.

The next bounded source addition is the official CFPB Consumer Complaint Database API. It imports only public complaints with non-empty consumer narratives through the existing Phase 1 `RawSignal` and collection-run safeguards; it does not add or change extraction, embeddings, deduplication, review, or UI behavior.

## Structure

```text
lib/research/
  collectors/manual-import.ts  Manual JSON collector
  collectors/redditCollector.ts Authenticated Reddit post collector
  collectors/cfpbCollector.ts  Official CFPB API pagination and run orchestration
  cfpb/client.ts               Timeouts, bounded retries, filters, and API pages
  cfpb/normalization.ts        Narrative-only privacy-safe RawSignal mapping
  extraction/client.ts          OpenRouter structured-output client and retries
  extraction/prompt.ts          Versioned injection-resistant instructions
  extraction/schema.ts          Strict response and grounding validation
  extraction/geography.ts       Conservative Phase 2 geography merge
  extraction/repository.ts      Atomic claims, mentions, runs, and recovery
  extraction/service.ts         Bounded extraction pipeline
  deduplication/text.ts         Versioned embedding text, exact keys, cosine, merge utilities
  deduplication/clients.ts      OpenRouter embeddings and strict duplicate judge
  deduplication/repository.ts   Claims, candidates, transactional linking, audit history
  deduplication/service.ts      Phase 4 orchestration and consistency controls
  quality/schema.ts            Versioned review codes and strict input schemas
  quality/repository.ts        Queues, reviews, imports, and controlled corrections
  quality/metrics.ts           Evaluation, calibration, and agreement mathematics
  quality/evaluation.ts        Fixture-only, production-safe evaluation runner
  quality/audit.ts             Report-only record and cluster audits
  quality/readiness.ts         Configurable research quality gates
  reddit/client.ts             OAuth client, pacing, retries, and error categories
  reddit/normalization.ts      Reddit filtering, English check, and geography rules
  config.ts                    Environment-backed configuration
  logger.ts                    Structured, body-safe JSON logs
  models.ts                    MongoDB collection names and indexes
  normalization.ts             Text, URL, ID, language, date, and hash utilities
  repository.ts                Persistence and statistics service
  types.ts                     Database and result types
  validation.ts                Strict Zod input schema
data/research/                  Industries, audiences, Reddit seeds, and sample input
scripts/research-*.ts           CLI entry points
tests/research/                 Unit and repository tests
```

## Database models

`research_raw_signals` stores the normalized signal, traceability URL, optional source and seed context, engagement, metadata, SHA-256 content hash, optional `ObjectId` collection-run relation, processing state, retry state, and timestamps.

Indexes:

- Unique compound `{ source, sourceId }`
- Unique `{ contentHash }`
- `{ processingStatus }`, `{ source }`, `{ sourceCommunity }`, `{ collectedAt }`, `{ publishedAt }`, `{ geographyEvidence }`, `{ industrySeed }`, and `{ collectionRunId }`

`research_collection_runs` stores collector configuration and timestamps, fetched/inserted/duplicate/skipped/failed counters, status, dry-run state, and an optional error.

Indexes: `{ source }`, `{ status }`, `{ startedAt }`, and `{ completedAt }`.

`research_problem_mentions` stores the structured accepted or reviewable problem, its required `rawSignalId` and extraction-run links, derived source/community context, evidence, confidence, model/prompt audit fields, usage/cost metadata where returned, and timestamps. Its unique `{ rawSignalId }` index is the final duplicate guard. Supporting indexes cover run, status, industry, affected user, problem type, geography, source, and creation time.

`research_extraction_runs` stores model and prompt version, safe configuration, attempted/accepted/no-problem/review/failed/retry counters, token usage, reported cost, dry-run state, status, and timestamps. It never stores the API key. Indexes cover status, model, start time, and completion time.

`research_unique_problems` stores the canonical aggregate, grounded value arrays, conservative geography, normalized key, compatible embedding metadata, evidence/source counters, confidence aggregates, observation dates, and lifecycle status. `normalizedKey` is unique. `research_deduplication_decisions` preserves every candidate judgment and canonical change, and `research_deduplication_runs` records safe counters, models, versions, tokens, cost, and configuration.

Phase 5 adds `research_human_reviews`, `research_correction_audits`, `research_evaluation_items`, `research_evaluation_runs`, and `research_readiness_reports`. Reviews have a unique `{ targetType, targetId, reviewRound }` index, so an assignment cannot be duplicated; an explicit `--review-round 2` enables second review. Supporting indexes cover review status/decision/date, priority, model and prompt/embedding/judge versions, evaluation dataset/category/difficulty, run completion, and readiness status/time. Correction audits have a unique review ID and retain previous and applied values.

Run `npm run research:indexes` to create or reconcile these idempotent indexes. The importer also ensures them before processing a file.

## Environment variables

All variables are server-only. `MONGODB_URI` is required by database commands. Reddit collection additionally requires `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and a descriptive `REDDIT_USER_AGENT`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEARCH_BATCH_SIZE` | `100` | Import batch size |
| `RESEARCH_MAX_BODY_LENGTH` | `20000` | Maximum stored body length in Unicode code points |
| `RESEARCH_DEFAULT_LANGUAGE` | `en` | Language used when input omits it |
| `RESEARCH_TARGET_COUNTRY` | `united_states` | Fixed to the Phase 1 target |
| `RESEARCH_RETRY_LIMIT` | `3` | Processing retry ceiling for later workers |
| `RESEARCH_COLLECTION_CONCURRENCY` | `4` | Per-batch insertion concurrency |
| `RESEARCH_DRY_RUN` | `false` | Default manual-import dry-run mode |
| `RESEARCH_COLLECTOR_<SOURCE>_ENABLED` | manual only | Enable a collector (`REDDIT`, `CFPB`, `NHTSA`, `APP_STORE`, `GOOGLE_PLAY`, `TRUSTPILOT`, `FORUM`, `YOUTUBE`, or `MANUAL_IMPORT`) |

Reddit-specific variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEARCH_COLLECTOR_REDDIT_ENABLED` | `false` | Explicit collector safety gate |
| `REDDIT_CLIENT_ID` | required | Confidential Reddit application client ID |
| `REDDIT_CLIENT_SECRET` | required | Confidential Reddit application secret |
| `REDDIT_USER_AGENT` | required | Descriptive API user agent, e.g. `sera-research/1.0 by owner` |
| `REDDIT_USERNAME` / `REDDIT_PASSWORD` | unset | Optional reserved credentials; not used by the application-only flow |
| `REDDIT_REQUEST_TIMEOUT_MS` | `10000` | Per-request timeout |
| `REDDIT_MAX_REQUESTS_PER_RUN` | `20` | Absolute HTTP request ceiling, including OAuth and retries |
| `REDDIT_POSTS_PER_QUERY` | `25` | Maximum post listing size per query |
| `REDDIT_COLLECTION_CONCURRENCY` | `2` | Query workers; request starts remain centrally paced |
| `REDDIT_RETRY_LIMIT` | `3` | Transient retry count |
| `REDDIT_RETRY_BASE_DELAY_MS` | `750` | Exponential retry base delay |
| `REDDIT_REQUEST_PACING_MS` | `1000` | Minimum spacing between request starts |
| `REDDIT_MIN_POST_BODY_LENGTH` | `40` | Minimum normalized self-text length |
| `REDDIT_MAX_POST_AGE_DAYS` | `365` | Maximum accepted post age |
| `REDDIT_DEFAULT_SORT` | `relevance` | Safe default sort |
| `REDDIT_DEFAULT_TIME_FILTER` | `month` | Safe default search time filter |
| `REDDIT_DRY_RUN` | `true` | Default to no signal writes |
| `REDDIT_MAX_COMMUNITIES_PER_RUN` | `10` | Community ceiling |
| `REDDIT_MAX_QUERIES_PER_COMMUNITY` | `10` | Query ceiling per community |
| `REDDIT_SELF_TEXT_ONLY` | `true` | Exclude link-only posts |
| `REDDIT_EXCLUDE_NSFW` | `true` | Exclude NSFW posts |

OpenRouter extraction variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | required | Server-only bearer credential |
| `OPENROUTER_EXTRACTION_MODEL` | required | Explicit OpenRouter model ID; none is hardcoded |
| `OPENROUTER_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout |
| `OPENROUTER_RETRY_LIMIT` | `2` | Transient retries after the initial request |
| `OPENROUTER_RETRY_BASE_DELAY_MS` | `750` | Exponential retry base; `Retry-After` takes precedence |
| `OPENROUTER_MAX_INPUT_LENGTH` | `12000` | Maximum source code points sent to the model |
| `OPENROUTER_MAX_EVIDENCE_LENGTH` | `500` | Maximum validated evidence excerpt length |
| `OPENROUTER_MAX_OUTPUT_TOKENS` | `1200` | Output token ceiling |
| `OPENROUTER_EXTRACTION_BATCH_SIZE` | `10` | Atomic claims processed per worker batch |
| `OPENROUTER_EXTRACTION_CONCURRENCY` | `2` | Maximum concurrent model calls |
| `OPENROUTER_MAX_RECORDS_PER_RUN` | `100` | Hard record ceiling for one run |
| `OPENROUTER_STALE_PROCESSING_MINUTES` | `30` | Age at which abandoned claims are recovered |
| `OPENROUTER_ACCEPT_CONFIDENCE` | `0.75` | Accepted threshold |
| `OPENROUTER_REVIEW_CONFIDENCE` | `0.55` | Needs-review lower threshold |
| `OPENROUTER_MAX_COST_PER_RUN` | `1` | Stop starting work when reported run cost reaches this amount |
| `OPENROUTER_EXTRACTION_DRY_RUN` | `true` | Default to no signal-status or mention writes |
| `OPENROUTER_SITE_URL` | unset | Optional OpenRouter attribution URL |
| `OPENROUTER_APP_NAME` | `SERA Research` | Optional OpenRouter attribution title |

Store credentials only in ignored local or managed deployment environment settings. Never commit them. The implemented flow is Reddit application-only OAuth using `grant_type=client_credentials`; username/password are not sent. Tokens are held only in memory, reused until shortly before expiry, and never logged. App-only tokens do not include refresh tokens, so renewal requests a new app-only token.

## Manual import schema

The file must be a JSON array. Unknown fields are rejected. Each object accepts:

```json
{
  "source": "manual_import",
  "sourceId": "source-stable-id",
  "sourceUrl": "https://example.com/public-source",
  "sourceCommunity": "optional community",
  "title": "optional title",
  "body": "required meaningful source text",
  "authorName": "optional public display name",
  "authorId": "optional public source ID",
  "publishedAt": "2026-01-01T12:00:00Z",
  "collectedAt": "2026-01-02T12:00:00Z",
  "language": "en-US",
  "targetCountry": "united_states",
  "geographyEvidence": "us_context",
  "industrySeed": "Childcare",
  "audienceSeed": "Parents",
  "searchQuery": "optional traceability query",
  "engagement": { "score": 1, "likes": 1, "replies": 0, "comments": 0, "views": 10, "rating": 4.5 },
  "metadata": { "publicContext": "source-specific values only" }
}
```

Supported sources are `reddit`, `cfpb`, `app_store`, `google_play`, `trustpilot`, `forum`, `youtube`, and `manual_import`. Geography evidence is `explicit_us`, `us_context`, `unknown`, or `non_us`.

Whitespace and null bytes are normalized without removing punctuation. Overlong bodies are truncated on Unicode code-point boundaries; `metadata.originalBodyLength` and `metadata.bodyTruncated` retain the audit facts. The content hash uses normalized title plus normalized body.

## Commands and workflow

```bash
npm run research:indexes
npm run research:import -- --file ./data/research/sample-signals.json --dry-run
npm run research:import -- --file ./data/research/sample-signals.json
npm run research:stats
npm test
```

Use `--batch-size 25` to override the configured batch size. A dry run validates records and checks existing duplicates without writing raw signals; it still writes a `dryRun: true` collection-run audit record. Invalid records are reported by array index, while valid records in the same batch continue. Re-importing the same file reports duplicates and does not create duplicate signals.

## Reddit collection

Enable the collector and configure a confidential Reddit application before running it:

```bash
RESEARCH_COLLECTOR_REDDIT_ENABLED=true
REDDIT_CLIENT_ID=your-client-id
REDDIT_CLIENT_SECRET=your-client-secret
REDDIT_USER_AGENT="sera-research/1.0 by your-reddit-name"
```

Start with the tiny dry-run preset. It uses `Parenting`, one pain-language query, at most five returned posts, and at most two HTTP requests including OAuth:

```bash
npm run research:collect:reddit:test
```

Explicit examples:

```bash
npm run research:collect:reddit -- \
  --community Parenting \
  --query "struggling with" \
  --industry "Parenting and Childcare" \
  --audience Parents \
  --sort relevance \
  --time month \
  --limit 5 \
  --max-age-days 365 \
  --max-requests 2 \
  --dry-run

npm run research:collect:reddit -- \
  --communities Parenting,personalfinance,Teachers \
  --query "hard to find" \
  --max-requests 4 \
  --dry-run
```

`reddit-communities.json` is a grouped catalog and `reddit-pain-queries.json` is a JSON string array. The CLI also accepts `--communities-file` and `--queries-file`, but it intentionally rejects a full Cartesian product that exceeds configured community, query, or request ceilings. Make smaller curated files for bounded runs. Seed names are syntax-validated; inclusion does not assert that a community exists, is public, or is currently accessible.

The client uses only Reddit's authenticated API. It applies a timeout, in-memory token reuse, serialized request pacing, capped concurrency, exponential transient retries, `Retry-After`, and `X-Ratelimit-*` information. Missing, banned, restricted, quarantined, or inaccessible communities are reported without terminating other community/query pairs. Authentication failures fail the run.

Posts are skipped when removed/deleted, empty, too short, non-self posts when self-only mode is enabled, NSFW when excluded, stickied/moderator announcements, conservatively obvious promotions/giveaways, non-English, too old, invalid, or unsafe for the `RawSignal` schema. Phrase matches are search seeds only and are not treated as evidence that a valid problem exists.

Geography is deliberately conservative:

- `explicit_us`: direct first-person US/state location language.
- `us_context`: explicit US systems such as IRS, 401(k), Medicaid, Medicare, FAFSA, state DMV, W-2, FICO, deductibles/copays, or HOA.
- `non_us`: direct first-person non-US country or national-system language.
- `unknown`: everything else.

The collector never infers location from username, posting time, writing style, or sensitive characteristics. `targetCountry` remains the research target and is not a claim that every `unknown` author lives in the US.

The final report contains counters, skip reasons, geography distribution, community availability, and safe optional previews. It omits tokens, credentials, client IDs, full bodies, and author details. `research:stats` retains Phase 1 totals and adds Reddit totals by community, geography, processing state, latest run, duplicates, and failed runs.

Because `REDDIT_DRY_RUN` defaults to `true`, an intentional write also requires setting it to `false` in the server environment and omitting `--dry-run`. Newly inserted records remain `pending`; the collector never analyzes them.

## CFPB Consumer Complaint Database collection

This collector uses only the CFPB's official public Consumer Complaint Database search API at `https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/`. It does not scrape CFPB HTML. The CFPB database updates generally daily, is not a statistical sample of consumer experiences, and recent complaint records may not yet contain all narratives eligible for publication. See the [official database description](https://www.consumerfinance.gov/data-research/consumer-complaints/) and [official API schema](https://cfpb.github.io/ccdb5-api/documentation/).

Only API results selected by `has_narrative=true` and containing a non-empty public consumer narrative are eligible. Mapping is deterministic:

- `complaint_id` becomes `sourceId` and the official complaint-detail URL.
- Product plus issue becomes the safe title.
- `complaint_what_happened` becomes the body.
- `date_received` becomes `publishedAt`; full API timestamps are preserved and date-only export values use UTC midnight.
- Product, sub-product, issue, sub-issue, company, state, submission method, company response, and optional company public response become allowlisted metadata.
- ZIP code, tags, authors, contact details, and all unrelated API fields are discarded.
- A recognized US state, DC, or US territory code produces `explicit_us`; other valid CFPB complaints produce `us_context` because CFPB is a US federal consumer complaint database.
- Product is also stored as `industrySeed`; all accepted records remain `pending` and reuse the existing normalized hash, unique indexes, batch insertion, and collection-run audit.

Although CFPB publishes narratives only after consumer consent and its own personal-information scrubbing, the local privacy filter independently rejects residual email addresses and North American phone numbers. Missing narratives, malformed IDs/dates/product/issue, and privacy-filtered records are counted separately. Raw ZIP codes are never copied into input, logs, previews, or metadata.

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `RESEARCH_COLLECTOR_CFPB_ENABLED` | `false` | Explicit collector gate |
| `CFPB_DRY_RUN` | `true` | Default to validation/deduplication without RawSignal writes |
| `CFPB_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout |
| `CFPB_RETRY_LIMIT` | `3` | Bounded network/429/5xx retries |
| `CFPB_RETRY_BASE_DELAY_MS` | `750` | Exponential retry base; `Retry-After` takes precedence |
| `CFPB_PAGE_SIZE` | `50` | Page size; official API and code ceiling is 100 |
| `CFPB_MAX_RECORDS_PER_RUN` | `500` | Configured ceiling, additionally capped to an absolute pilot maximum of 500 |
| `CFPB_MAX_REQUESTS_PER_RUN` | `20` | Request-attempt ceiling including retries |
| `CFPB_INSERT_CONCURRENCY` | `2` | Existing repository batch-insert concurrency |
| `CFPB_USER_AGENT` | `sera-hush-research/1.0` | Descriptive request identifier |

Commands:

```bash
# Mandatory first step: one page, at most five records, always dry-run
RESEARCH_COLLECTOR_CFPB_ENABLED=true npm run research:collect:cfpb:test

# Explicit bounded dry run with date and repeatable product filters
RESEARCH_COLLECTOR_CFPB_ENABLED=true npm run research:collect:cfpb -- \
  --date-min 2026-01-01 --date-max 2026-07-01 \
  --product "Mortgage" --product "Debt collection" \
  --limit 100 --page-size 50 --max-requests 2 --dry-run

# Intentional import additionally requires CFPB_DRY_RUN=false and omission of --dry-run
RESEARCH_COLLECTOR_CFPB_ENABLED=true CFPB_DRY_RUN=false npm run research:collect:cfpb -- \
  --date-min 2026-01-01 --date-max 2026-07-01 --limit 100 --page-size 50 --max-requests 2
```

Dates use `YYYY-MM-DD`; the API defines the lower bound as inclusive and upper bound as exclusive. `--product` may be repeated. Pagination uses `frm`/`size`, requests JSON without export format so pagination remains active, disables aggregations/highlights, requests narratives only, and stops on the first of API exhaustion, the record ceiling, or the request ceiling. The safe-test command enables previews of at most five shortened narratives without company or ZIP details. Dry runs still create a `dryRun: true` collection-run audit but never write raw signals.

`research:stats` includes CFPB totals by product, issue, state, geography evidence, processing status, latest run, duplicates, and failed runs. Product/issue wording can change across CFPB form releases, and complaint counts must not be interpreted as company performance or population prevalence without appropriate denominators and context.

## Official bulk raw-data collectors

Large raw-data acquisition uses only official downloadable ZIP files, streams records without extracting archives to disk, preserves the existing validation/hash/index/run safeguards, and defaults to dry-run. A run can request at most 50,000 new records and scan at most 500,000 source rows. It continues past existing source-ID/content duplicates until the requested number of new records is reached or the scan ceiling/source ends.

CFPB bulk mode reads the Bureau's official `complaints.csv.zip`, maps the same allowlisted fields as the API collector, requires a non-empty public narrative, and never stores ZIP codes, tags, or contact details.

NHTSA mode reads the official tab-delimited complaint archive. `CMPLID` is the source ID, `CDESCR` is the body, received date is `publishedAt`, and vehicle year/make/model plus component form the title. Safe metadata may contain manufacturer, component, product/complaint type, incident date, state, crash/fire/injury/death counts, occurrences, mileage, medical-attention flag, and towing flag. The collector explicitly discards city, VIN, purchase details, dealer identity/address/phone/ZIP, tire identifier, and vehicle-operator name. Residual email addresses and North American phone numbers in narratives are rejected.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CFPB_BULK_DRY_RUN` | `true` | Default CFPB bulk mode to no RawSignal writes |
| `NHTSA_DRY_RUN` | `true` | Default NHTSA mode to no RawSignal writes |
| `NHTSA_DOWNLOAD_URL` | official 2025–2026 ZIP | Override only with another official NHTSA complaint ZIP |
| `RESEARCH_BULK_REQUEST_TIMEOUT_MS` | `600000` | Whole-download stream timeout |
| `RESEARCH_BULK_MAX_RECORDS_PER_RUN` | `50000` | Hard new-record ceiling |
| `RESEARCH_BULK_MAX_ROWS_SCANNED_PER_RUN` | `500000` | Hard source-row scan ceiling |
| `RESEARCH_BULK_BATCH_SIZE` | `250` | Repository insertion batch size |
| `RESEARCH_BULK_INSERT_CONCURRENCY` | `4` | Per-record repository workers inside each batch |

```bash
# Mandatory live-format checks: always dry-run, at most five records
npm run research:collect:cfpb:bulk:test
npm run research:collect:nhtsa:test

# Explicit dry runs
npm run research:collect:cfpb:bulk -- --limit 100 --max-rows 1000 --dry-run
npm run research:collect:nhtsa -- --limit 100 --max-rows 1000 --dry-run

# Intentional writes require the corresponding environment dry-run flag=false
CFPB_BULK_DRY_RUN=false npm run research:collect:cfpb:bulk -- --limit 50000 --max-rows 500000
NHTSA_DRY_RUN=false npm run research:collect:nhtsa -- --limit 50000 --max-rows 500000
```

The official CFPB database is not a representative sample of all consumer experiences. NHTSA complaints are allegations used for defect monitoring and do not independently establish causation or defect prevalence. Raw bulk collection never starts extraction, embeddings, deduplication, review decisions, or readiness changes.

## Phase 3 problem extraction

The prompt version is `problem-extraction-v1`. The source title/body are JSON encoded between explicit untrusted-source delimiters. The system instruction says source content cannot change the task, embedded commands and pretend system instructions must be ignored, links must not be opened, and only classification/extraction JSON may be returned. The client requests non-streaming OpenRouter `json_schema` output with `strict: true`, temperature zero, and an output-token ceiling. The complete response is then independently validated with Zod before any mention is saved.

The model response must contain every field: `containsProblem`, `canonicalProblem`, `shortLabel`, `industry`, `subIndustry`, `affectedUser`, `affectedRole`, `organizationType`, `workflow`, `problemType`, `currentWorkaround`, `triggeringSituation`, `desiredOutcome`, `negativeConsequence`, `geography`, `evidenceText`, `extractionConfidence`, and `rejectionReason`. Nullable fields must remain `null` when unsupported. Allowed problem types are `time_waste`, `high_cost`, `manual_process`, `complexity`, `error_risk`, `poor_access`, `availability`, `integration`, `compliance`, `communication`, `reliability`, `security`, `quality`, and `other`.

Server-owned fields—`rawSignalId`, run ID, actual returned model, prompt version, token/cost metadata, source context, and timestamps—are attached after validation. The model cannot choose or rewrite identifiers. A problem response requires a solution-neutral statement, short label, problem type, and a length-bounded evidence excerpt that occurs in the original source. High-risk descriptive fields receive an additional lexical grounding check. No-problem responses require a rejection reason and null problem fields. Promotional material, news/memes/jokes, vague negativity, generic recommendations, speculation, solution pitches, and insufficient evidence are rejected. Unsupported identity, location, consequence, workaround, urgency, market, or demographic details must remain null.

Confidence routing is explicit:

- `>= 0.75` (or configured accept threshold): `accepted`.
- `0.55–0.7499`: stored as `needs_review`.
- `< 0.55`: marked `no_problem` with a low-confidence reason and no mention.

Phase 2 geography remains authoritative. `explicit_us` maps to `united_states`, `us_context` to `likely_united_states`, deterministic non-US evidence remains `non_us`, and unknown remains unknown unless the deterministic source text contains clear US or non-US evidence. Model geography cannot promote an otherwise unknown signal, and sensitive/user metadata is never used.

The pipeline claims `pending -> processing` with one atomic database operation. It works in bounded batches, safely truncates by Unicode code point, retries only network/timeouts, rate limits, and server failures, honors `Retry-After`, and never retries authentication/payment/authorization/schema failures. Stale claims are returned to pending with an incremented retry count. Failed records can be requeued only while below the configured retry limit. Existing mentions and the unique index make reruns idempotent.

Commands:

```bash
# Safe preview: at most three pending records, one worker, no signal/mention writes
npm run research:extract:test

# Explicit dry run and filters
npm run research:extract -- --limit 10 --batch-size 5 --concurrency 2 \
  --source reddit --community Parenting --min-confidence 0.75 \
  --max-input-length 8000 --max-cost 0.25 --dry-run

# Intentional write requires OPENROUTER_EXTRACTION_DRY_RUN=false
npm run research:extract -- --limit 10 --max-cost 0.25

# Requeue eligible failed signals, then process them
npm run research:extract:retry -- --limit 10 --max-cost 0.25

# Safe shortened review sample (maximum 50)
npm run research:inspect:mentions -- --limit 10
npm run research:stats
```

Dry-run still creates an `extraction_runs` audit record, matching the existing research convention, and records model usage/cost there; it does not claim or alter raw signals and does not save mentions. `--max-cost 0` performs no model calls. For positive ceilings, stopping is based on cost reported after responses; already in-flight concurrent calls can make the final amount slightly exceed the ceiling. Use concurrency `1` for the tightest small paid test. OpenRouter may omit cost/usage fields, in which case zero is recorded rather than guessed.

## Phase 4 semantic deduplication

Required configuration is `OPENROUTER_API_KEY`, `OPENROUTER_EMBEDDING_MODEL`, and preferably `OPENROUTER_DUPLICATE_JUDGE_MODEL`. The judge falls back to `OPENROUTER_EXTRACTION_MODEL` only when the dedicated variable is absent. No model ID is hardcoded.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_EMBEDDING_VERSION` | `problem-embedding-v1` | Deterministic embedding-text version |
| `OPENROUTER_EMBEDDING_BATCH_SIZE` | `10` | Processing/embedding batch ceiling |
| `OPENROUTER_DEDUP_CONCURRENCY` | `2` | Concurrent mention workers |
| `OPENROUTER_DEDUP_REQUEST_TIMEOUT_MS` | `30000` | Embedding/judge request timeout |
| `OPENROUTER_DEDUP_RETRY_LIMIT` | `2` | Transient retry count |
| `OPENROUTER_DEDUP_RETRY_BASE_DELAY_MS` | `750` | Exponential retry base |
| `OPENROUTER_DEDUP_CANDIDATE_LIMIT` | `5` | Maximum candidates judged per mention |
| `OPENROUTER_DEDUP_CANDIDATE_SCAN_LIMIT` | `5000` | Explicit fallback scan ceiling |
| `OPENROUTER_DEDUP_MIN_SIMILARITY` | `0.70` | Candidate retrieval floor |
| `OPENROUTER_DEDUP_AMBIGUOUS_SIMILARITY` | `0.78` | Audited model-calibration boundary |
| `OPENROUTER_DEDUP_HIGH_SIMILARITY` | `0.92` | Audited high-similarity boundary; still requires verification |
| `OPENROUTER_DUPLICATE_JUDGE_CONFIDENCE` | `0.85` | Minimum safe merge confidence |
| `OPENROUTER_DEDUP_MIN_CONFIDENCE` | `0.75` | Eligible accepted-mention confidence |
| `OPENROUTER_DEDUP_MAX_RECORDS_PER_RUN` | `100` | Hard run ceiling |
| `OPENROUTER_DEDUP_MAX_COST_PER_RUN` | `1` | Reported-cost stop ceiling |
| `OPENROUTER_DEDUP_STALE_PROCESSING_MINUTES` | `30` | Abandoned claim recovery age |
| `OPENROUTER_DEDUP_DRY_RUN` | `true` | Default no-write behavior |

The embedding text builder is `problem-embedding-v1`. It emits fixed labeled lines from canonical problem, affected user, workflow, triggering situation, consequence, industry, and subindustry. It excludes raw bodies, URLs, authors/usernames, engagement, metadata, and prompts. Vectors store requested model, returned dimensions, and text version; semantic comparison filters all three compatibility fields.

Exact retrieval hashes normalized canonical problem + affected user + workflow. Industry or short label alone is never an exact key. Semantic similarity only retrieves candidates. Every candidate—including exact and very-high-similarity candidates—must pass the `duplicate-judge-v1` strict structured judge. `same_problem` requires the same user, job/workflow, and obstacle, configured confidence, and no grounded-field conflict. `related_but_distinct`, `different_problem`, and `uncertain` never merge. Childcare availability/cost, delayed reimbursement/claim denial, tax complexity/preparation cost, internet reliability/cost, and hiring/retention remain separate.

New problems copy only grounded mention values. Merge keeps every mention/evidence record, updates counters/source diversity/confidence/dates atomically, normalizes array uniqueness, preserves first-seen time, and does not routinely rewrite canonical wording. A judge-recommended canonical change requires at least 0.95 confidence plus lexical grounding in accumulated canonical/evidence text, and the previous/new wording is stored in decision history.

Claims are atomic. Replica sets/sharded deployments use MongoDB transactions. Unsupported standalone deployments use guarded operations with compensation; optimistic `mentionCount` matching rejects concurrent counter updates. The unique normalized-key index prevents simultaneous exact duplicate creation. Failed consistency races are retryable and never silently double-link a mention.

Commands:

```bash
npm run research:deduplicate:test
npm run research:deduplicate -- --limit 10 --batch-size 5 --concurrency 1 \
  --source reddit --industry Childcare --candidate-limit 5 \
  --min-confidence 0.75 --min-similarity 0.70 --max-cost 0.25 --dry-run
npm run research:deduplicate:retry -- --limit 10 --max-cost 0.25
npm run research:inspect:unique-problems -- --limit 10
npm run research:inspect:dedup-decisions -- --limit 10
npm run research:rebuild-embeddings -- --model provider/model --version problem-embedding-v2 --limit 10 --dry-run
```

The safe test processes at most three mentions with one worker. Phase 4 dry-run creates no run, claim, embedding write, link, unique problem, audit row, or persistent counter. `--max-cost 0` makes no model calls. Positive ceilings stop additional judge calls after reported cost reaches the limit; already in-flight calls can still slightly overshoot. Rebuild requires explicit model/version and defaults to report-only. Actual replacement additionally requires `--confirm-replace`, is bounded by `--limit`, and updates mentions and active unique problems without comparing incompatible vectors.

Atlas Vector Search is optional and currently **not active in code**. Candidate retrieval uses a bounded application-side cosine fallback after exact compatibility filtering. If compatible records exceed the safe scan ceiling, the mention is routed to review instead of creating a potentially duplicated problem. Follow [VECTOR_SEARCH.md](./VECTOR_SEARCH.md) for the exact external index definition and readiness checks. Creating the Atlas index does not silently switch retrieval.

## Phase 5 quality assurance

### Human-review workflow

Queue generation deterministically ranks threshold-adjacent, uncertain, failed, old-version, unusually large, and concentrated records before easy examples. `--stratified` spreads selection across source, industry, geography, status/decision, prompt, judge-prompt, and embedding strata. Generation is idempotent for a target and review round; dry-run selects without writing.

```bash
npm run research:review:generate -- --sample-size 30 --stratified --seed review-v1 --dry-run
npm run research:review:generate -- --target-type problem_mention --status needs_review --sample-size 10
npm run research:review:next -- --reviewer-id reviewer-a
npm run research:review:submit -- --review-id REVIEW_ID --file ./review-submission.json
npm run research:review:skip -- --review-id REVIEW_ID --notes "Insufficient source context"
npm run research:review:stats
```

`next` claims one assignment atomically and displays only a shortened source excerpt, current result, evidence, confidence/geography, safe linkage context, candidate similarity when applicable, and version fields. It omits full bodies, authors, embeddings, secrets, and unrelated IDs.

A submission is a strict JSON object. It requires `reviewerDecision`; optional fields are `extractionDecision`, `deduplicationDecision`, `fieldReviews`, `correctedValues`, `reasonCodes`, `reviewerNotes`, and `reviewerId`. Unknown fields, invalid enums, invalid geography, question-form canonicals, and solution-first canonical corrections are rejected.

Reason-code vocabulary is `review-reasons-v1`:

- Extraction: `false_positive_problem`, `false_negative_problem`, `vague_problem`, `solution_biased`, `unsupported_affected_user`, `unsupported_occupation`, `unsupported_workaround`, `unsupported_consequence`, `incorrect_industry`, `incorrect_workflow`, `incorrect_geography`, `weak_evidence`, `evidence_not_grounded`, `prompt_injection_failure`, `duplicate_problem_mention`.
- Deduplication: `incorrect_merge`, `missed_duplicate`, `related_but_distinct_merged`, `same_problem_split`, `affected_user_conflict`, `workflow_conflict`, `obstacle_conflict`, `consequence_conflict`, `canonical_wording_degraded`, `uncertain_should_review`.

Corrections remain separate from original model output until explicitly applied:

```bash
npm run research:review:apply-corrections -- --review-id REVIEW_ID --confirm --applied-by reviewer-a
```

Only completed reviews with validated corrected values can be applied, and each review can be applied once. The audit row keeps previous and applied values. Meaning-changing mention edits clear incompatible embedding metadata, route deduplication back to review, and flag the linked unique problem; unique-problem edits recalculate the normalized key and clear its vector. This operation never merges or splits clusters.

### Offline export and import

```bash
npm run research:review:export -- --status pending --format json --file ./review-batch.json
npm run research:review:export -- --status pending --format csv --file ./review-batch.csv
npm run research:review:import -- --file ./completed-reviews.json --dry-run
npm run research:review:import -- --file ./completed-reviews.json
```

Files are created without overwriting an existing path. Export rows include the assignment ID required for round-trip import plus necessary review context; they exclude authors, usernames, full bodies, embeddings, metadata, credentials, and SERA/Hush user data. JSON import is an array of `{ "reviewId": "...", "submission": { ... } }`. Every item is schema-checked, the assignment and target must still exist, completed assignments cannot be imported twice, and failures are reported per item without discarding other valid items. CSV is an offline review/report format; completed reviews are imported through strict JSON.

### Evaluation, calibration, and agreement

`data/research/evaluation-fixtures.json` contains carefully created, explicitly annotated cases for `extraction-gold-v1`, `rejection-gold-v1`, `geography-gold-v1`, `deduplication-gold-v1`, and `prompt-injection-gold-v1`. Predictions are separate from expected annotations and are never promoted to ground truth or written to production mentions/clusters.

```bash
npm run research:evaluate:extraction
npm run research:evaluate:deduplication
npm run research:evaluate:geography
npm run research:evaluate:all
npm run research:evaluate:compare -- --previous ./previous-metrics.json
npm run research:evaluate:calibrate
```

Extraction reports TP/FP/TN/FN, precision, recall, F1, accuracy, acceptance/rejection accuracy, review/malformed/grounding/solution-bias/unsupported/prompt-injection rates, evidence accuracy, and field accuracy. It includes source, community, industry, confidence, model, prompt-version, and geography buckets. Deduplication reports correct/incorrect merges, correct separations, missed duplicates, merge precision, duplicate recall, pairwise accuracy, uncertain rate, related-but-distinct accuracy, and canonical improvement/degradation rates, including similarity, judge-confidence, industry, affected-user, embedding model/version, and judge model/prompt buckets. Geography reports overall and per-class accuracy. Zero denominators produce `0`, never `NaN` or inflated accuracy.

Calibration evaluates observed scores across candidate thresholds and reports sample size, precision/recall, false-merge and false-negative risk, a recommended range, and low/medium/high recommendation confidence. It prioritizes a 0.95 merge-precision floor and never edits configuration. Reviewer analysis supports agreement percentage, disagreement rate, and Cohen's kappa; low agreement means the annotation rules or gold set require clarification before model accuracy claims are credible.

Automated and CLI evaluation is fixture-only in Phase 5. It makes no OpenRouter calls. A future real-model evaluator must be a separate explicit, bounded, evaluation-only command with model/prompt selection, record and maximum-cost limits, and dry-run semantics before it may be enabled.

### Audits and readiness

```bash
npm run research:audit:quality
npm run research:audit:quality -- --format csv --file ./quality-audit.csv
npm run research:audit:quality -- --strict
npm run research:audit:clusters -- --limit 10
npm run research:readiness
npm run research:readiness -- --save
```

The quality audit checks evidence grounding, missing evidence, solution bias/vagueness, counter and source/evidence mismatches, orphans, embedding incompatibility, missing run references, stale work, retry-limit breaches, geography conflicts, suspicious cluster size/concentration, repeated canonicals under different normalized keys, and old prompt/vector/judge versions. It is report-only; `--strict` only changes the exit code when critical findings exist. The bounded cluster audit shows shortened mention variants, users, workflows, similarities, decisions, source/community diversity, geography, confidence, and risk flags without repairing clusters.

Readiness gates are labeled `research-quality-gates-v1`, configurable through environment, and default to precision >= 0.90, recall >= 0.80, grounding >= 0.95, unsupported-field rate <= 0.03, merge precision >= 0.95, prompt-injection failures = 0, critical findings = 0, and at least 30 completed reviews. The output is exactly `READY`, `NOT_READY`, or `INSUFFICIENT_REVIEW_DATA`; sample size is checked before any success status. The default command is report-only, while `--save` explicitly stores the report.

| Variable | Default |
| --- | --- |
| `RESEARCH_QUALITY_MIN_REVIEWED_SAMPLE` | `30` |
| `RESEARCH_GATE_EXTRACTION_PRECISION` | `0.90` |
| `RESEARCH_GATE_EXTRACTION_RECALL` | `0.80` |
| `RESEARCH_GATE_GROUNDING_ACCURACY` | `0.95` |
| `RESEARCH_GATE_UNSUPPORTED_FIELD_RATE` | `0.03` |
| `RESEARCH_GATE_MERGE_PRECISION` | `0.95` |
| `RESEARCH_GATE_PROMPT_INJECTION_FAILURE_RATE` | `0` |
| `RESEARCH_GATE_CRITICAL_AUDIT_FINDINGS` | `0` |

These gates are operational research criteria, not guaranteed truth. `research:stats` now includes review backlog/completion/decisions/disagreement, extraction and deduplication quality metrics, grounding/solution-bias/unsupported rates, the latest saved evaluation/readiness records, and dataset versions.

## Safety and source policy

- Import public research data only. Do not bypass authentication, access controls, robots policies, or platform restrictions.
- Preserve the public source URL for traceability and verify that collection is permitted.
- Do not import passwords, tokens, email addresses, phone numbers, exact addresses, or unnecessary personal information. Validation rejects recognizable email addresses and North American phone numbers.
- Author fields are optional. Do not infer sensitive attributes or enrich identities.
- Treat all source text and metadata as untrusted. No imported text is rendered by this module, and production logs omit titles and bodies.
- Do not execute Reddit links or embedded instructions. Do not connect Reddit identities to SERA/Hush users or enrich author profiles.
- Inspect input files before importing. Remove private or sensitive material that automated checks cannot reliably identify.

## Troubleshooting and known limitations

- `Reddit collection is disabled`: set `RESEARCH_COLLECTOR_REDDIT_ENABLED=true` in the server environment.
- `Missing required Reddit credentials`: configure all three required Reddit variables.
- `401`: verify the application client ID/secret and that the app type supports confidential `client_credentials`.
- `403`/`404`: the community may be private, restricted, banned, quarantined, renamed, or absent. The collector records it as unavailable.
- `429`: reduce communities/queries and honor the reported reset; retries remain bounded by the run ceiling.
- Search results are limited by Reddit's API behavior and ranking and are not a complete historical corpus.
- Deterministic English and geography rules intentionally favor precision over recall and can return `unknown` or skip ambiguous content.
- `Missing required OpenRouter configuration`: set both `OPENROUTER_API_KEY` and `OPENROUTER_EXTRACTION_MODEL` in server-only environment configuration.
- OpenRouter `401`/`403`: verify key, organization/project permissions, and model access; these fail without retry. `402` indicates payment/credit configuration. `408`, `429`, and `5xx` failures use bounded retry.
- Structured output support depends on the selected model/provider. Invalid or ungrounded output is rejected and never saved.
- Lexical grounding is deliberately conservative and may route valid paraphrases to failure/review; inspect samples before increasing volume.
- Cost enforcement uses OpenRouter-reported response cost and is not a prepaid reservation system; concurrent in-flight requests may overshoot slightly.
- Metrics are only as representative as the reviewed sample. Tiny, imbalanced, low-agreement, or stale-version datasets must not support scale claims.
- Fixture evaluation validates mechanics and regression behavior; it does not estimate live model accuracy. Phase 5 deliberately has no paid real-model evaluation runner.
- CSV review export is not imported directly; convert completed work to the strict JSON import shape.
- Atlas Vector Search remains inactive, so readiness reports label the bounded application cosine fallback explicitly.
- Audit heuristics can produce false positives and never mutate or delete records. Human review is required before repair.
- CFPB complaints are self-reported, are not independently verified by the Bureau, and are not representative of all consumers or company market share. Recent narratives may lag other complaint fields.
- CFPB API pagination is intentionally capped at 500 records and 20 request attempts per run; use bounded date/product batches rather than increasing those pilot safeguards.

## Deferred to Phase 6 or later

No comment collection, opportunity/demand scoring, market sizing, business generation, competitor/trend analysis, scheduler, dashboard, public endpoint, other-platform collector, or SERA/Hush user integration exists. Before Phase 6, complete a representative multi-review gold set, resolve critical audits and reviewer disagreements, calibrate thresholds per chosen model/version, decide whether to activate Atlas Vector Search, confirm retention/source terms, and provision separate evaluation/production budgets. Unique problems remain research aggregates, not validated market opportunities.
