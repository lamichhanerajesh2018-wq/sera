import type { CfpbComplaint } from "./client.ts";

export function cfpbCsvRowToComplaint(row: Record<string, string>): CfpbComplaint {
  return {
    complaint_id: row["Complaint ID"],
    complaint_what_happened: row["Consumer complaint narrative"],
    date_received: row["Date received"],
    product: row.Product,
    sub_product: row["Sub-product"],
    issue: row.Issue,
    sub_issue: row["Sub-issue"],
    company: row.Company,
    state: row.State,
    submitted_via: row["Submitted via"],
    company_response: row["Company response to consumer"],
    company_public_response: row["Company public response"],
  };
}
