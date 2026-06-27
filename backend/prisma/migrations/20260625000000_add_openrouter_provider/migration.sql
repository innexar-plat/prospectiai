-- AlterEnum (IF NOT EXISTS: safe when enum value was added manually or re-applied)
ALTER TYPE "AiConfigProvider" ADD VALUE IF NOT EXISTS 'OPENROUTER';
