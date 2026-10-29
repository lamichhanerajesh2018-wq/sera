import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ObjectId } from "mongodb";
import {
  ADMIN_PAGE_SIZE_MAX,
  ResearchAdminAccessError,
  ResearchAdminRepository,
  assertResearchAdmin,
  overviewCards,
  parseAdminPage,
  readinessDisplayState,
  sanitizeSearch,
} from "../../lib/research/admin/core.ts";
import { QualityRepository } from "../../lib/research/quality/repository.ts";
import type { HumanReviewDocument, ProblemMentionDocument, ResearchStats, UniqueProblemDocument } from "../../lib/research/types.ts";
import { SafeText } from "../../app/admin/research/_components.tsx";
import { FakeResearchDb } from "./fake-db.ts";
import { signal, validProblem } from "./extraction-fixtures.ts";

test("research admin authorization denies unauthenticated requests", async () => {
  await assert.rejects(assertResearchAdmin(async () => false), ResearchAdminAccessError);
});

test("research admin authorization denies authenticated normal users without admin authorization", async () => {
  const normalUserIsAdmin = async () => false;
  await assert.rejects(assertResearchAdmin(normalUserIsAdmin), /administrator authorization required/);
  await assert.doesNotReject(assertResearchAdmin(async () => true));
});

test("pagination is bounded and text input is sanitized", () => {
  assert.deepEqual(parseAdminPage("2", "500"), { page: 2, pageSize: ADMIN_PAGE_SIZE_MAX, skip: ADMIN_PAGE_SIZE_MAX });
  assert.equal(sanitizeSearch("  hello\u0000   world  "), "hello world");
  assert.throws(() => parseAdminPage("-1", "20"), /Invalid page/);
});

test("raw signal pagination, filtering, stable safe sorting, detail access and privacy omission", async () => {
  const fake = new FakeResearchDb();
  const first = signal({ sourceId: "one", contentHash: "one", source: "cfpb", title: "First", createdAt: new Date("2026-01-01"),
    metadata: { product: "Mortgage", company: "Example bank", zipCode: "12345", email: "private@example.com" }, authorName: "hidden-user" });
  const second = signal({ sourceId: "two", contentHash: "two", source: "cfpb", title: "Second", createdAt: new Date("2026-01-02") });
  await fake.rawSignals.insertOne(first); await fake.rawSignals.insertOne(second);
  const repository = new ResearchAdminRepository(fake.asDb());
  const page = await repository.listRawSignals({ status: "pending", page: 2, pageSize: 1, sort: "not-allowed" });
  assert.equal(page.total, 2); assert.equal(page.rows.length, 1); assert.equal(page.pageSize, 1);
  const detail = await repository.getRawSignalDetail(first._id!.toString());
  assert.equal(detail?.title, "First"); assert.equal(detail?.metadata.product, "Mortgage");
  assert.equal("zipCode" in (detail?.metadata || {}), false); assert.equal("email" in (detail?.metadata || {}), false);
  assert.equal("authorName" in (detail || {}), false);
  assert.equal(await repository.getRawSignalDetail(new ObjectId().toString()), null);
});

function mention(rawSignalId: ObjectId, overrides: Partial<ProblemMentionDocument> = {}): ProblemMentionDocument {
  const now = new Date("2026-07-13T00:00:00Z");
  return { _id: new ObjectId(), rawSignalId, extractionRunId: new ObjectId(), source: "cfpb", sourceCommunity: "Mortgage",
    status: "accepted", ...validProblem(), model: "provider/model", promptVersion: "problem-extraction-v1",
    createdAt: now, updatedAt: now, ...overrides } as ProblemMentionDocument;
}

function unique(overrides: Partial<UniqueProblemDocument> = {}): UniqueProblemDocument {
  const now = new Date("2026-07-13T00:00:00Z");
  return { _id: new ObjectId(), canonicalProblem: "Night-shift workers struggle to find childcare because providers close early.", shortLabel: "Night childcare",
    industry: "Childcare", subIndustries: [], affectedUsers: ["night-shift workers"], affectedRoles: [], organizationTypes: [], workflows: ["find childcare"],
    problemTypes: ["availability"], currentWorkarounds: [], triggeringSituations: [], desiredOutcomes: [], negativeConsequences: [], geography: "united_states",
    normalizedKey: "night childcare", embedding: [0.1,0.2], embeddingModel: "embed/model", embeddingDimensions: 2, embeddingVersion: "problem-embedding-v1",
    mentionCount: 1, evidenceCount: 1, sourceCount: 1, sources: ["cfpb"], communities: ["Mortgage"], averageConfidence: .9, highestConfidence: .9,
    firstSeenAt: now, lastSeenAt: now, status: "active", createdAt: now, updatedAt: now, ...overrides };
}

test("ProblemMention detail links the safe RawSignal and existing review without embeddings", async () => {
  const fake = new FakeResearchDb(); const raw = signal({ sourceId: "mention-raw", contentHash: "mention-raw" }); await fake.rawSignals.insertOne(raw);
  const item = mention(raw._id!); await fake.problemMentions.insertOne(item);
  const review: HumanReviewDocument = { targetType:"problem_mention",targetId:item._id!,reviewRound:1,reviewStatus:"pending",riskScore:2,strata:["source:cfpb"],createdAt:new Date(),updatedAt:new Date() };
  await fake.humanReviews.insertOne(review);
  const detail = await new ResearchAdminRepository(fake.asDb()).getProblemMentionDetail(item._id!.toString());
  assert.equal(detail?.rawSignal?.id, raw._id!.toString()); assert.equal(detail?.reviews.length, 1); assert.equal("embedding" in (detail || {}), false);
});

test("UniqueProblem detail returns bounded linked evidence and no raw vector", async () => {
  const fake = new FakeResearchDb(); const raw = signal({sourceId:"unique-raw",contentHash:"unique-raw"}); await fake.rawSignals.insertOne(raw);
  const problem = unique(); await fake.uniqueProblems.insertOne(problem); const item=mention(raw._id!,{uniqueProblemId:problem._id}); await fake.problemMentions.insertOne(item);
  const detail=await new ResearchAdminRepository(fake.asDb()).getUniqueProblemDetail(problem._id!.toString());
  assert.equal(detail?.mentions.length,1); assert.match(detail?.mentions[0].evidenceText||"",/childcare/); assert.equal("embedding" in (detail||{}),false);
});

test("review submission validates input, preserves model output, and creates only one second-review round", async () => {
  const fake=new FakeResearchDb(); const raw=signal({sourceId:"review-raw",contentHash:"review-raw"}); await fake.rawSignals.insertOne(raw); const item=mention(raw._id!); await fake.problemMentions.insertOne(item);
  const assignment:HumanReviewDocument={targetType:"problem_mention",targetId:item._id!,reviewRound:1,reviewStatus:"pending",riskScore:3,strata:["risky"],createdAt:new Date(),updatedAt:new Date()}; await fake.humanReviews.insertOne(assignment);
  const repository=new QualityRepository(fake.asDb());
  await assert.rejects(repository.submitReview(assignment._id!,{reviewerDecision:"made_up"}),/Invalid option/);
  await repository.submitReview(assignment._id!,{reviewerDecision:"partially_correct",extractionDecision:"valid_problem",correctedValues:{canonicalProblem:"Night workers cannot access childcare during late working hours."},reviewerId:"admin-reviewer"});
  assert.equal((await fake.problemMentions.findOne({_id:item._id}))?.canonicalProblem,item.canonicalProblem,"submission must not overwrite model output");
  const firstSecond=await repository.createSecondReview(assignment._id!); const rerun=await repository.createSecondReview(assignment._id!);
  assert.equal(firstSecond.created,true); assert.equal(rerun.created,false); assert.equal(firstSecond.review.reviewRound,2);
});

test("overview cards map existing statistics without inventing metrics", () => {
  const stats={totalRawSignals:12,byProcessingStatus:{pending:4,processing:1},extraction:{acceptedProblems:3,needsReviewMentions:1,noProblemSignals:2,failedExtractions:1,totalTokens:100,estimatedCost:.01},deduplication:{uniqueProblemCount:2,mergedMentions:1,reviewCount:1,totalTokens:50,estimatedCost:.02},quality:{pendingReviews:2,completedReviews:1}} as unknown as ResearchStats;
  const cards=Object.fromEntries(overviewCards(stats)); assert.equal(cards["Total RawSignals"],12); assert.equal(cards["Total model tokens"],150); assert.equal(cards["Reported model cost"],.03);
});

test("React escapes untrusted HTML and script source text", () => {
  const html=renderToStaticMarkup(createElement(SafeText,{text:'<script>alert("x")</script><b>unsafe</b>'}));
  assert.doesNotMatch(html,/<script>/); assert.match(html,/&lt;script&gt;/); assert.match(html,/&lt;b&gt;/);
});

test("readiness status rendering explains missing and blocked states", () => {
  assert.deepEqual(readinessDisplayState(null),{status:"INSUFFICIENT_REVIEW_DATA",explanation:"No saved readiness report is available."});
  assert.deepEqual(readinessDisplayState({status:"NOT_READY",unresolvedIssues:["critical audit finding"]}),{status:"NOT_READY",explanation:"critical audit finding"});
});
