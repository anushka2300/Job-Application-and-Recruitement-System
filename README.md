# Job-Application-and-Recruitement-System

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