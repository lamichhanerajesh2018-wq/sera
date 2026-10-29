# MongoDB Atlas Vector Search setup (optional Phase 4 acceleration)

Phase 4 currently uses the explicit application-side cosine fallback. It filters active records by the exact
`embeddingModel`, `embeddingDimensions`, and `embeddingVersion` before comparing vectors. It does **not** claim
that an Atlas vector index is active.

Atlas setup remains an external deployment step because vector dimensions depend on the configured
`OPENROUTER_EMBEDDING_MODEL` response and Atlas Search availability depends on the MongoDB deployment/tier.

1. Run a mocked/small embedding test and inspect one compatible record:

```javascript
db.research_unique_problems.findOne(
  { status: "active" },
  { embeddingModel: 1, embeddingDimensions: 1, embeddingVersion: 1 }
)
```

2. In Atlas, open `research_unique_problems` → Search Indexes → Create Search Index → JSON Editor.
3. Name the index `unique_problem_embedding_v1`, select **Vector Search**, and use this definition, replacing
   `ACTUAL_DIMENSIONS` with the integer stored in `embeddingDimensions`:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": ACTUAL_DIMENSIONS,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "embeddingModel" },
    { "type": "filter", "path": "embeddingDimensions" },
    { "type": "filter", "path": "embeddingVersion" }
  ]
}
```

4. Wait until Atlas reports the index as `READY`.
5. Before switching retrieval code to `$vectorSearch`, verify the query filters all four compatibility fields and
   compare its top-k results with the existing cosine fallback evaluation set.

Creating this index alone does not switch the application to Atlas retrieval. That switch requires a reviewed code
change and deployment verification. Never create one index across mixed dimensions. A new model/dimension family
requires its own reviewed rebuild and index definition.
