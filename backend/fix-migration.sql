-- Fix migration by removing old check types before migration runs
-- Run this BEFORE running prisma migrate dev

-- Delete check results for old check types
DELETE FROM "CheckResult" WHERE "checkId" IN (
  SELECT id FROM "Check" WHERE type IN ('UPTIME', 'SSL_CERTIFICATE', 'RESPONSE_TIME', 'FILE_CHANGE_DETECTION')
);

-- Delete checks with old types
DELETE FROM "Check" WHERE type IN ('UPTIME', 'SSL_CERTIFICATE', 'RESPONSE_TIME', 'FILE_CHANGE_DETECTION');

-- Now you can run: npx prisma migrate resolve --applied "20260121053022"
-- Then: npx prisma migrate dev
