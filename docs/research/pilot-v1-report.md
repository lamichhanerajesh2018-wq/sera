# Research Pilot v1 Report

## Decision

**Phase 6 must not begin.** The Phase 5.5 live pilot is blocked at preflight because the required Reddit and OpenRouter credentials and model selections are not configured. No credential was bypassed, no live Reddit or OpenRouter request was made, and no paid workload was started.

- Configuration version: `research-pilot-v1`
- Report date: 2026-07-13 (Asia/Kathmandu)
- Readiness result: `INSUFFICIENT_REVIEW_DATA`
- Completed human reviews: 0 (minimum 30; preferred 100)
- Total live-pilot model cost: USD 0

## Preflight

| Check | Result |
| --- | --- |
| `REDDIT_CLIENT_ID` | Missing |
| `REDDIT_CLIENT_SECRET` | Missing |
| `REDDIT_USER_AGENT` | Missing |
| `RESEARCH_COLLECTOR_REDDIT_ENABLED` | Disabled |
| `OPENROUTER_API_KEY` | Missing |
| `OPENROUTER_EXTRACTION_MODEL` | Missing |
| `OPENROUTER_EMBEDDING_MODEL` | Missing |
| `OPENROUTER_DUPLICATE_JUDGE_MODEL` | Missing (no extraction-model fallback exists either) |
| MongoDB connection | Passed; database `hush` reachable |
| Research indexes | Passed; idempotently reconciled |
| Atlas Vector Search | Not active; bounded application-side cosine fallback is configured |
| Quality audit | Passed report-only; 0 critical, 0 warning, 0 info findings |
| Stale/failed records | 0 |
| Unresolved critical audit findings | 0 |
| Extraction live dry run | Blocked by missing OpenRouter configuration |
| Deduplication live dry run | Blocked by missing OpenRouter configuration |

Dry-run behavior remains covered by the automated research suite, but this is not a substitute for the required credentialed smoke test.

## Planned pilot configuration

The full machine-readable snapshot is in `data/research/research-pilot-v1.json`. It contains no secrets.

The planned general-user communities are Parenting, workingmoms, personalfinance, povertyfinance, jobs, Teachers, HomeImprovement, renters, and HealthInsurance. The two existing pain-query seeds are `struggling with` and `hard to find`. Nine communities by two queries requires 18 Reddit searches; with OAuth the hard request plan is 19 requests and at most 450 returned posts at 25 posts per query. This stays within the existing 10-community and 20-request ceilings.

The smoke plan is capped at 5 Reddit posts, 3 extraction records, and 3 deduplication records, with concurrency 1 and USD 0.10 response-reported cost caps for extraction and deduplication. The first pilot batch is planned as bounded runs of at most 100 extraction/deduplication records, concurrency 1, and USD 1 per stage per run. Because models are not selected, a model-price estimate cannot yet be calculated. The current configured maximum for one extraction plus one deduplication run is USD 2. The existing cost control stops new work after reported cost reaches the cap; it is not a prepaid reservation, so the selected model's worst-case single-call cost must be checked before live execution.

## Baseline data

- Raw signals: 2, both existing manual-import records
- Reddit raw signals: 0
- Pending raw signals: 2
- Problem mentions: 0
- Unique problems: 0
- Pending/completed reviews: 0/0
- Existing model tokens and cost: 0 / USD 0
- Sources represented: 1 (`manual_import`)
- Geography evidence: 1 `explicit_us`, 1 `us_context`

## Smoke and live execution results

Reddit collection, extraction, and deduplication smoke tests were not executed because preflight requires stopping when any credential is missing. Therefore there are no live collection, filtering, model, token, confidence, similarity, judge, or cost results to report. The 500-post pilot was not started.

## Human review

A deterministic stratified dry-run requested 100 items and selected 0 because no extraction or deduplication records exist. Privacy-safe JSON and CSV exports were generated, but they are empty (`[]` and an empty CSV). Reviews were not fabricated or automatically approved. No second-review agreement measurement is possible.

After live records exist, generate and export the real batch:

```bash
npm run research:review:generate -- --sample-size 100 --stratified --seed research-pilot-v1
npm run research:review:export -- --status pending --format json --file docs/research/research-pilot-v1-review-batch-complete.json
npm run research:review:export -- --status pending --format csv --file docs/research/research-pilot-v1-review-batch-complete.csv
```

Import completed human annotations only after a dry-run passes:

```bash
npm run research:review:import -- --file ./completed-reviews.json --dry-run
npm run research:review:import -- --file ./completed-reviews.json
```

For at least 20 second reviews, generate an explicit second round after choosing the targets:

```bash
npm run research:review:generate -- --sample-size 20 --stratified --seed research-pilot-v1-round-2 --review-round 2
```

## Fixture evaluation and calibration

The non-live fixture evaluation passed:

- Extraction: TP 4, FP 0, TN 3, FN 0; precision 1.0, recall 1.0, F1 1.0
- Deduplication: 1 correct merge, 0 incorrect merges, 2 correct separations, 0 missed duplicates; merge precision 1.0, duplicate recall 1.0
- Geography: 3/3 correct
- Prompt-injection fixture failures: 0

These carefully created fixtures validate mechanics; they do not measure live pilot quality. Field coverage is sparse, including zero reviewed evidence-text fields, so the fixture evidence accuracy value of 0 means insufficient field annotations rather than a demonstrated grounding failure.

Threshold calibration evaluated only three deduplication fixture pairs. It recommended a similarity range of 0.94–0.99 with **low confidence**. The current production threshold remains unchanged at 0.70, as required.

## Audits and readiness

- Quality audit: 0 findings; report-only
- Cluster audit: 0 clusters sampled because no UniqueProblems exist
- Readiness: `INSUFFICIENT_REVIEW_DATA`
- Reviewed sample: 0/30 minimum
- Extraction precision, recall, F1: unavailable from human reviews (represented as 0)
- Grounding and geography accuracy: unavailable from human reviews
- Merge precision and duplicate recall: unavailable from human reviews
- Reviewer agreement: unavailable; empty-sample disagreement is correctly reported as 0

The clean audit does not demonstrate quality because there are no live mentions or clusters to inspect.

## Exact continuation sequence

Configure these values in ignored local or managed server environment settings; never paste them into source control or this report:

```text
RESEARCH_COLLECTOR_REDDIT_ENABLED=true
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USER_AGENT
OPENROUTER_API_KEY
OPENROUTER_EXTRACTION_MODEL
OPENROUTER_EMBEDDING_MODEL
OPENROUTER_DUPLICATE_JUDGE_MODEL
```

Set `REDDIT_DRY_RUN=false`, `OPENROUTER_EXTRACTION_DRY_RUN=false`, and `OPENROUTER_DEDUP_DRY_RUN=false` only when intentionally moving from dry-run to the bounded permanent smoke steps.

Run preflight and dry smoke tests:

```bash
npm run research:indexes
npm run research:audit:quality -- --strict
npm run research:collect:reddit:test
npm run research:extract:test
npm run research:deduplicate:test
```

Then run the tiny permanent smoke in order, stopping immediately on any authentication, payment, malformed-output, or configuration failure:

```bash
npm run research:collect:reddit -- --community Parenting --query "struggling with" --limit 5 --max-requests 2 --time month --max-age-days 365
npm run research:extract -- --limit 3 --batch-size 3 --concurrency 1 --source reddit --max-cost 0.10
npm run research:deduplicate -- --limit 3 --batch-size 3 --concurrency 1 --source reddit --candidate-limit 5 --max-cost 0.10
npm run research:stats
npm run research:audit:quality -- --strict
```

Only after smoke success, collect the first bounded batch:

```bash
npm run research:collect:reddit -- --communities Parenting,workingmoms,personalfinance,povertyfinance,jobs,Teachers,HomeImprovement,renters,HealthInsurance --query "struggling with" --query "hard to find" --limit 25 --max-requests 19 --time month --max-age-days 365
```

Process in repeated batches of at most 100, checking statistics, failures, and cost between runs:

```bash
npm run research:extract -- --limit 100 --batch-size 10 --concurrency 1 --source reddit --max-cost 1
npm run research:deduplicate -- --limit 100 --batch-size 10 --concurrency 1 --source reddit --candidate-limit 5 --max-cost 1
npm run research:stats
```

After at least 30 real human reviews (preferably 100), run:

```bash
npm run research:evaluate:extraction
npm run research:evaluate:deduplication
npm run research:evaluate:geography
npm run research:evaluate:all
npm run research:evaluate:calibrate
npm run research:audit:quality -- --strict
npm run research:audit:clusters -- --limit 10
npm run research:readiness
```

## Limitations and blocking issues

1. All Reddit and OpenRouter credentials/models are missing, so no live pilot evidence exists.
2. Zero completed reviews prevents readiness and reviewer-agreement claims.
3. Fixture results are tiny and deliberately constructed; they are not estimates of live accuracy.
4. No clusters exist, so false-merge, false-split, dominance, and workflow-conflict investigation is impossible.
5. Atlas Vector Search is inactive; the application-side compatible-vector cosine fallback must be reported during the pilot.
6. Model-specific maximum cost cannot be estimated until exact model IDs and their current prices are selected and verified.
7. The current evaluation CLI evaluates versioned fixtures; live reviewed metrics are exposed by review statistics/readiness rather than automatically becoming a new gold dataset.

## Recommendation

Do not begin Phase 6. Configure the exact missing environment variables, verify model pricing, complete the bounded smoke sequence, run the 450-post first batch only after smoke success, complete at least 30 human reviews (preferably 100 plus 20 second reviews), resolve any critical audit or cluster findings through the reviewed correction workflow, and accept the readiness command's result without manual override.
