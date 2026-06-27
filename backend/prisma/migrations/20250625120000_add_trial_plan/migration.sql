-- Add TRIAL plan enum value (must be in its own migration for PostgreSQL)
ALTER TYPE "Plan" ADD VALUE IF NOT EXISTS 'TRIAL';
