## Module Template (Backend)

Copy an existing module (e.g. `hr-recruitment/`) as the baseline:
- Add Prisma models with `company_id`, timestamps, `created_by_user_id`, indexes.
- Add controller with `JwtAuthGuard` + `PermissionsGuard` + `zod` validation.
- Add service that calls `AuditService` and `AnalyticsService`.


