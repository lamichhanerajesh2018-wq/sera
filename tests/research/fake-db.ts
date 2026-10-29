/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObjectId, type Db } from "mongodb";

type StoredDocument = Record<string, any> & { _id?: ObjectId };

function matches(document: StoredDocument, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some((item: Record<string, any>) => matches(document, item));
    if (key.startsWith("$")) return true;
    if (value && typeof value === "object" && !(value instanceof ObjectId)) {
      return Object.entries(value).every(([operator, operand]) => {
        const compared = operand as any;
        if (operator === "$exists") return compared ? document[key] !== undefined : document[key] === undefined;
        if (operator === "$lt") return document[key] < compared;
        if (operator === "$gt") return document[key] > compared;
        if (operator === "$gte") return document[key] >= compared;
        if (operator === "$lte") return document[key] <= compared;
        if (operator === "$ne") return document[key]?.toString?.() !== compared?.toString?.();
        if (operator === "$in") return compared.some((item: unknown) => document[key]?.toString?.() === String(item));
        return true;
      });
    }
    return document[key]?.toString?.() === value?.toString?.();
  });
}

class FakeCursor {
  constructor(private values: StoredDocument[]) {}
  sort(specification: Record<string, 1 | -1>) {
    const entries = Object.entries(specification);
    this.values.sort((left, right) => {
      for (const [field, direction] of entries) {
        const a = left[field]; const b = right[field];
        const comparison = a instanceof Date && b instanceof Date ? a.getTime() - b.getTime()
          : String(a ?? "").localeCompare(String(b ?? ""), undefined, { numeric: true });
        if (comparison) return comparison * direction;
      }
      return 0;
    });
    return this;
  }
  skip(count: number) { this.values = this.values.slice(count); return this; }
  limit(limit: number) { this.values = this.values.slice(0, limit); return this; }
  async toArray() { return this.values; }
}

class FakeCollection {
  readonly documents: StoredDocument[] = [];
  readonly collectionName: string;
  failSourceId?: string;

  constructor(name: string) {
    this.collectionName = name;
  }

  async createIndex() { return "index"; }

  async insertOne(document: StoredDocument) {
    if (this.failSourceId !== undefined && document.sourceId === this.failSourceId) {
      throw new Error("simulated database failure");
    }
    if (
      this.collectionName === "research_raw_signals" &&
      this.documents.some(
        (current) =>
          (current.source === document.source && current.sourceId === document.sourceId) ||
          current.contentHash === document.contentHash,
      )
    ) {
      throw Object.assign(new Error("duplicate key"), { code: 11000 });
    }
    if (
      this.collectionName === "research_problem_mentions" &&
      this.documents.some((current) => current.rawSignalId?.toString() === document.rawSignalId?.toString())
    ) {
      throw Object.assign(new Error("duplicate key"), { code: 11000 });
    }
    if (
      this.collectionName === "research_unique_problems" &&
      this.documents.some((current) => current.normalizedKey === document.normalizedKey)
    ) {
      throw Object.assign(new Error("duplicate key"), { code: 11000 });
    }
    if (
      this.collectionName === "research_human_reviews" &&
      this.documents.some((current) =>
        current.targetType === document.targetType &&
        current.targetId?.toString() === document.targetId?.toString() &&
        current.reviewRound === document.reviewRound)
    ) throw Object.assign(new Error("duplicate key"), { code: 11000 });
    if (
      this.collectionName === "research_correction_audits" &&
      this.documents.some((current) => current.reviewId?.toString() === document.reviewId?.toString())
    ) throw Object.assign(new Error("duplicate key"), { code: 11000 });
    const insertedId = new ObjectId();
    document._id = insertedId;
    this.documents.push(document);
    return { acknowledged: true, insertedId };
  }

  async findOne(filter: Record<string, any>, options?: Record<string, any>) {
    const values = this.documents.filter((document) => matches(document, filter));
    if (options?.sort?.startedAt === -1) {
      values.sort((a, b) => Number(b.startedAt) - Number(a.startedAt));
    }
    return values[0] || null;
  }

  find(filter: Record<string, any>, _options?: Record<string, any>) {
    void _options;
    return new FakeCursor(this.documents.filter((document) => matches(document, filter)));
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>) {
    const document = this.documents.find((item) => matches(item, filter));
    if (!document) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    Object.assign(document, update.$set || {});
    for (const [key, amount] of Object.entries(update.$inc || {})) {
      document[key] = (document[key] || 0) + Number(amount);
    }
    for (const key of Object.keys(update.$unset || {})) delete document[key];
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    const documents = this.documents.filter((item) => matches(item, filter));
    for (const document of documents) {
      Object.assign(document, update.$set || {});
      for (const [key, amount] of Object.entries(update.$inc || {})) {
        document[key] = (document[key] || 0) + Number(amount);
      }
      for (const key of Object.keys(update.$unset || {})) delete document[key];
    }
    return { acknowledged: true, matchedCount: documents.length, modifiedCount: documents.length };
  }

  async replaceOne(filter: Record<string, any>, replacement: StoredDocument) {
    const index = this.documents.findIndex((item) => matches(item, filter));
    if (index < 0) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    this.documents[index] = replacement;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(filter: Record<string, any>) {
    const index = this.documents.findIndex((item) => matches(item, filter));
    if (index < 0) return { acknowledged: true, deletedCount: 0 };
    this.documents.splice(index, 1);
    return { acknowledged: true, deletedCount: 1 };
  }

  async findOneAndUpdate(filter: Record<string, any>, update: Record<string, any>, options?: Record<string, any>) {
    const values = this.documents.filter((document) => matches(document, filter));
    if (options?.sort?.collectedAt === 1) {
      values.sort((a, b) => Number(a.collectedAt) - Number(b.collectedAt));
    }
    const document = values[0];
    if (!document) return null;
    Object.assign(document, update.$set || {});
    for (const key of Object.keys(update.$unset || {})) delete document[key];
    return document;
  }

  async countDocuments(filter: Record<string, any> = {}) {
    return this.documents.filter((document) => matches(document, filter)).length;
  }

  async distinct(field: string, filter: Record<string, any> = {}) {
    return [...new Set(this.documents.filter((document) => matches(document, filter)).map((document) => document[field]))];
  }
}

export class FakeResearchDb {
  readonly rawSignals = new FakeCollection("research_raw_signals");
  readonly collectionRuns = new FakeCollection("research_collection_runs");
  readonly problemMentions = new FakeCollection("research_problem_mentions");
  readonly extractionRuns = new FakeCollection("research_extraction_runs");
  readonly uniqueProblems = new FakeCollection("research_unique_problems");
  readonly deduplicationDecisions = new FakeCollection("research_deduplication_decisions");
  readonly deduplicationRuns = new FakeCollection("research_deduplication_runs");
  readonly humanReviews = new FakeCollection("research_human_reviews");
  readonly correctionAudits = new FakeCollection("research_correction_audits");
  readonly evaluationItems = new FakeCollection("research_evaluation_items");
  readonly evaluationRuns = new FakeCollection("research_evaluation_runs");
  readonly readinessReports = new FakeCollection("research_readiness_reports");

  collection(name: string) {
    if (name === "research_raw_signals") return this.rawSignals;
    if (name === "research_collection_runs") return this.collectionRuns;
    if (name === "research_problem_mentions") return this.problemMentions;
    if (name === "research_extraction_runs") return this.extractionRuns;
    if (name === "research_unique_problems") return this.uniqueProblems;
    if (name === "research_deduplication_decisions") return this.deduplicationDecisions;
    if (name === "research_deduplication_runs") return this.deduplicationRuns;
    if (name === "research_human_reviews") return this.humanReviews;
    if (name === "research_correction_audits") return this.correctionAudits;
    if (name === "research_evaluation_items") return this.evaluationItems;
    if (name === "research_evaluation_runs") return this.evaluationRuns;
    if (name === "research_readiness_reports") return this.readinessReports;
    throw new Error(`Unexpected collection: ${name}`);
  }

  asDb(): Db {
    return this as unknown as Db;
  }
}
