-- Sales routine: next follow-up date per saved lead
ALTER TABLE "LeadAnalysis" ADD COLUMN "nextFollowUpAt" TIMESTAMP(3);

CREATE INDEX "LeadAnalysis_workspaceId_nextFollowUpAt_idx" ON "LeadAnalysis"("workspaceId", "nextFollowUpAt");
