-- WHOLESTRA platform report. Read-only: it only SELECTs, nothing is changed.
-- Demo company rows are marked isDemo and are left out of the real counts.

\echo '=== 1. TOTALS ==='
SELECT
  (SELECT count(*) FROM "Organization" WHERE NOT "isDemo")                          AS companies,
  (SELECT count(*) FROM "User" u JOIN "Organization" o ON o.id=u."organizationId" WHERE NOT o."isDemo") AS accounts,
  (SELECT count(*) FROM "User" u JOIN "Organization" o ON o.id=u."organizationId" WHERE NOT o."isDemo" AND u."emailVerifiedAt" IS NOT NULL) AS email_verified,
  (SELECT count(*) FROM "User" u JOIN "Organization" o ON o.id=u."organizationId" WHERE NOT o."isDemo" AND u."totpEnabledAt" IS NOT NULL) AS with_authenticator,
  (SELECT count(*) FROM "AuthIdentity" WHERE provider='google')                      AS google_links,
  (SELECT count(*) FROM "Branch" b JOIN "Organization" o ON o.id=b."organizationId" WHERE NOT o."isDemo") AS branches,
  (SELECT count(*) FROM "Sale" s JOIN "Organization" o ON o.id=s."organizationId" WHERE NOT o."isDemo") AS sales_recorded,
  (SELECT count(*) FROM "DemoVisit")                                                 AS demo_visits,
  (SELECT count(*) FROM "Inquiry")                                                   AS website_inquiries;

\echo ''
\echo '=== 2. COMPANIES ==='
SELECT o.name, o.code, o.plan, o.country, o.email AS company_email, o.phone,
       to_char(o."createdAt",'YYYY-MM-DD HH24:MI') AS registered,
       (SELECT count(*) FROM "User"    x WHERE x."organizationId"=o.id) AS accounts,
       (SELECT count(*) FROM "Branch"  x WHERE x."organizationId"=o.id) AS branches,
       (SELECT count(*) FROM "Product" x WHERE x."organizationId"=o.id) AS products,
       (SELECT count(*) FROM "Sale"    x WHERE x."organizationId"=o.id) AS sales,
       o."setupPending" AS setup_pending
FROM "Organization" o WHERE NOT o."isDemo" ORDER BY o."createdAt";

\echo ''
\echo '=== 3. ACCOUNTS (every person who can sign in) ==='
SELECT o.name AS company, u.email, u.name, u.phone,
       coalesce((SELECT string_agg(r.name, ', ') FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE ur."userId"=u.id),'-') AS roles,
       u.status,
       CASE WHEN u."emailVerifiedAt" IS NULL THEN 'no' ELSE 'yes' END AS email_verified,
       CASE WHEN u."totpEnabledAt"  IS NULL THEN 'no' ELSE 'yes' END AS authenticator,
       coalesce((SELECT string_agg(a.provider, ',') FROM "AuthIdentity" a WHERE a."userId"=u.id),'-') AS linked,
       to_char(u."createdAt",'YYYY-MM-DD HH24:MI') AS joined
FROM "User" u JOIN "Organization" o ON o.id=u."organizationId"
WHERE NOT o."isDemo" ORDER BY o.name, u."createdAt";

\echo ''
\echo '=== 4. WEBSITE INQUIRIES ==='
SELECT to_char("createdAt",'YYYY-MM-DD HH24:MI') AS received, name, email, phone, status, left(message,80) AS message
FROM "Inquiry" ORDER BY "createdAt" DESC LIMIT 50;
