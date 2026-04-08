-- AlterTable: add location columns to SearchHistory for replay and filtering
ALTER TABLE "SearchHistory" ADD COLUMN "city" TEXT;
ALTER TABLE "SearchHistory" ADD COLUMN "state" TEXT;
ALTER TABLE "SearchHistory" ADD COLUMN "country" TEXT;
