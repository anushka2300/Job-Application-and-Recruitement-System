# Job-Application-and-Recruitement-System

## Health checks

| Method and path | Purpose | Success response |
| --- | --- | --- |
| `GET /health` | Confirms the API process is running; does not depend on the database. | `200` |
| `GET /ready` | Confirms the API can reach MySQL. | `200` when ready, `503` otherwise |

`GET /api/health` remains available as a compatibility alias for `GET /health`.

## Platform administration API

These endpoints require a bearer token for a `SUPER_ADMIN`.

| Method and path | Purpose |
| --- | --- |
| `GET /api/admin/stats` | Returns `companiesCount`, `adminsCount`, and `pendingInvitationsCount`. |
| `GET /api/companies` | Lists company IDs, names, locations, and statuses. |
| `GET /api/companies/:id` | Returns company details and its associated `ADMIN` users. |
| `GET /api/companies/invitations` | Lists company invitations without exposing invitation tokens. |
| `POST /api/companies/invite_admin` | Creates an admin invitation; `adminEmail` must be a valid email address. |

Company status is stored as `ACTIVE` or `INACTIVE` and defaults to `ACTIVE`.
Invitation status is reported as `EXPIRED` when a pending invitation has passed
its expiry time. Stats count all companies and `ADMIN` users; pending invitation
counts exclude expired invitations.

For an existing database, apply
[`src/database/migrations/001_add_company_status.sql`](./src/database/migrations/001_add_company_status.sql)
once before using the company-list endpoint. New databases get the status column
from [`src/database/schema.sql`](./src/database/schema.sql).

## Continuous deployment

The GitHub Actions workflow deploys to Render after lint and tests pass on a
push to `main`. Pull requests run CI but do not deploy.

To enable deployment:

1. Create a Render Web Service for this repository. Set the build command to
   `npm ci`, the start command to `npm start`, and configure the app's required
   environment variables in Render. The service health check path can be
   `/health`.
   Set `DB_SSL_CA` to the CA certificate PEM contents for the database (Render
   environment variables can contain the PEM directly; escaped `\n` line
   breaks are supported). For a local certificate file, set it to that file's
   path instead.
2. Create a deploy hook for the Render service.
3. In the GitHub repository, add an Actions secret named
   `RENDER_DEPLOY_HOOK` with the deploy hook URL as its value. Keep this URL
   secret and do not commit it to the repository.
4. Disable Render's automatic deploy-on-push setting if you want deployments
   to happen only after this workflow's CI checks pass.

## Jobs API

All endpoints are mounted under `/api/jobs` and require a bearer token.

| Method and path | Access |
| --- | --- |
| `POST /api/jobs` | Recruiter, company admin, or super admin |
| `GET /api/jobs` | Candidate, recruiter, company admin, or super admin |
| `GET /api/jobs/:id` | Candidate, recruiter, company admin, or super admin |
| `PUT /api/jobs/:id` | Recruiter, company admin, or super admin |
| `DELETE /api/jobs/:id` | Recruiter, company admin, or super admin |
| `PATCH /api/jobs/:id/publish` | Recruiter, company admin, or super admin |

Candidates and all staff can view published jobs. Recruiters and company admins
can also view their own company's unpublished jobs; super admins can view all
jobs. Recruiters can update, delete, and publish only jobs they created.
Company admins can manage jobs for their company, and super admins can manage
jobs for any company.

Create a job with `title` and `description`; the following fields are also
supported: `location`, `employment_type`, `experience_min`, `experience_max`,
`salary_min`, `salary_max`, and `skills` (an array of strings). Recruiters and
company admins create jobs for their associated company. Super admins must
include a valid `company_id`.

The publish endpoint expects `{ "published": true }` to publish a job or
`{ "published": false }` to return it to draft status. Job search supports
`q`, `location`, `employment_type`, `status` (staff only), `page`, and `limit`
query parameters. Page size defaults to 20 and is capped at 100.

## Job applications

Candidates submit an application with `POST /api/applications` using
`multipart/form-data`. Include `job_id`, optional `cover_letter`, and a PDF file
in the `resume` field. Resume files are limited to 5 MB and uploaded to
Cloudinary; the application record stores only the Cloudinary public ID, not the
PDF contents.

Authorized users can request a short-lived resume URL with
`GET /api/applications/:id/resume`. The candidate can view their own resume;
recruiters can view resumes for applications to jobs they created, admins can
view resumes for applications in their company, and super admins can view all
resumes. The response contains the temporary URL in `data.url`, which expires
after five minutes.