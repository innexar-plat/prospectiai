-- Reset tokens are stored hashed (resetTokenHash); drop any legacy plaintext values.
UPDATE "User" SET "resetToken" = NULL WHERE "resetToken" IS NOT NULL;
