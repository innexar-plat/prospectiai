-- Unify plan display names: BUSINESS was "Scale" (conflicted with key SCALE). Set to "Business".
UPDATE "PlanConfig" SET name = 'Business' WHERE key = 'BUSINESS';
