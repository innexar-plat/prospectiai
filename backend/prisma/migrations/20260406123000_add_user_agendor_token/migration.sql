-- Store Agendor API token per user (encrypted)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agendorApiTokenEncrypted" TEXT;
