-- AlterTable
ALTER TABLE "SearchHistory" ADD COLUMN     "resultsData" JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceMember" ALTER COLUMN "updatedAt" DROP DEFAULT;
