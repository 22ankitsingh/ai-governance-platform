# PrajaGov — Complete Technical Summary

> **Purpose**: This document is a full technical reference for the platform. It is written so that any AI or developer can fully understand the system without any prior context.

---

## 1. Project Overview

A full-stack civic issue reporting and management platform with:
- **Citizens** who report public problems (potholes, water leaks, garbage, etc.)
- **Admins** who triage, assign, and resolve reported issues
- **AI** that auto-classifies each new issue by category, severity, priority, and department
- **Verification loop**: When an issue is resolved, the citizen gets notified and must approve or reject the resolution — which drives the final status transition

**Development started**: ~April 1, 2026  
**Development spanned**: 4 major conversation sessions

---

## 2. Architecture

### 2.1 Frontend

| Item | Value |
|------|-------|
| Framework | React 19 + Vite 8 |
| Routing | React Router DOM v7 |
| HTTP Client | Axios (with interceptors) |
| Charts | Recharts |
| Maps | Leaflet + React-Leaflet |
| CSS | Vanilla CSS (`index.css` with custom design system) |
| Dev port | `5173` |
| Build command | `npm run dev` |

**Proxy config** (`vite.config.js`):  
All `/api/*` and `/uploads/*` requests are proxied to `http://127.0.0.1:8001`, so the frontend uses relative URLs only. No CORS issues in dev.

### 2.2 Backend

| Item | Value |
|------|-------|
| Framework | FastAPI 0.115.0 |
| Server | Uvicorn with `--host 0.0.0.0 --port 8001` |
| ORM | SQLAlchemy 2.0 async (`aiosqlite`) |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Token expiry | 1440 minutes (24 hours) |
| Password hashing | bcrypt |
| Image storage | Local (`uploads/` dir) OR Cloudinary (if env vars set) |
| AI | Google Gemini 1.5 Flash OR keyword-based demo fallback |
| Email | SendGrid OR in-app notifications (if env vars set) |
| Runtime | Python venv at `backend/venv/` |

### 2.3 Database

| Item | Value |
|------|-------|
| Engine | SQLite (file: `backend/governance.db`) |
| Access | Async via `aiosqlite` |
| ORM | SQLAlchemy `create_async_engine` + `async_sessionmaker` |
| Schema creation | Auto via `Base.metadata.create_all` on startup |
| Seeding | `app/seed.py` runs on every startup (idempotent) |

> **Note**: Multiple stale DB files exist (`app.db`, `database.db`, `local.db`) from early experiments. The **active** database is `governance.db`.

---

## 3. Key Database Tables and Fields

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) UUID | PK |
| `email` | String(255) | Unique, indexed |
| `hashed_password` | String(255) | bcrypt |
| `full_name` | String(255) | |
| `phone` | String(20) | Nullable |
| `role` | String(20) | `"citizen"` or `"admin"` |
| `is_active` | Boolean | Default `True` |
| `is_deleted` | Boolean | **Soft delete flag** — default `False` |
| `deleted_at` | DateTime | Nullable |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |

### `issues`
| Column | Type | Notes |
|--------|------|-------|
| `id` | String(36) UUID | PK |
| `title` | String(500) | |
| `description` | Text | |
| `latitude` | Float | Optional GPS |
| `longitude` | Float | Optional GPS |
| `address` | Text | Optional |
| `context` | String(20) | Optional contextual tag |
| `category` | String(100) | AI-predicted or manual |
| `subcategory` | String(100) | |
| `department_id` | FK → departments | Nullable |
| `officer_label_id` | FK → officer_labels | Legacy FK, kept for DB compatibility |
| `officer_name` | String(255) | **Free-text string** (replaced legacy foreign key ID system) |
| `severity` | String(20) | `low`, `medium`, `high`, `critical` |
| `priority` | Integer | 1 (highest) to 5 (lowest) |
| `status` | String(30) | See lifecycle below |
| `ai_confidence` | Float | 0.0–1.0 |
| `ai_reasoning` | Text | AI explanation |
| `resolution_notes` | Text | Admin's resolution text |
| `reopen_count` | Integer | Increments each citizen rejection |
| `citizen_rating` | Integer | 1–5 star rating from citizen |
| `citizen_feedback` | Text | |
| `reporter_id` | FK → users | |
| `created_at` | DateTime | |
| `updated_at` | DateTime | |
| `resolved_at` | DateTime | Nullable |
| `closed_at` | DateTime | Nullable |
| `is_deleted` | Boolean | **Soft delete flag** |
| `deleted_at` | DateTime | Nullable |

### `status_history`
Records every status transition.
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `issue_id` | FK → issues | CASCADE delete |
| `from_status` | String(30) | Nullable (null for creation event) |
| `to_status` | String(30) | |
| `changed_by` | FK → users | Nullable |
| `notes` | Text | Human-readable note |
| `created_at` | DateTime | |

### `verification_votes`
One row per citizen verification action.
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `issue_id` | FK → issues | CASCADE delete |
| `voter_id` | FK → users | |
| `approved` | Boolean | `True` = approve → close; `False` = reject → reopen |
| `rating` | Integer | Optional 1–5 stars |
| `feedback` | Text | |
| `rejection_reason` | Text | |
| `created_at` | DateTime | |

### `notifications`
In-app notification system.
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | FK → users | |
| `title` | String | |
| `message` | Text | |
| `notification_type` | String | `status_change`, `verification`, etc. |
| `reference_id` | UUID | Issue ID this refers to |
| `is_read` | Boolean | |
| `created_at` | DateTime | |

### Other tables
- `departments` — id, name, code, description, is_active
- `officer_labels` — legacy table, still in schema for FK compatibility
- `issue_media` — id, issue_id, url, media_type, upload_phase (`before`/`after`)
- `ai_predictions` — full AI prediction record per issue
- `assignment_history` — tracks officer assignment events
- `issue_types` — reference list of issue types (seeded)

---

## 4. Issue Lifecycle (Status Machine)

### Five Valid Statuses
```
not_assigned → in_progress → resolved → closed      (final, permanently locked)
                                      ↘ reopened → in_progress
```

### Allowed Transitions (enforced in backend)
```python
ALLOWED_TRANSITIONS = {
    "not_assigned": ["in_progress"],
    "in_progress":  ["resolved"],
    "resolved":     ["closed", "reopened"],
    "reopened":     ["in_progress"],
    "closed":       [],  # FINAL — no transitions allowed
}
```

### Who triggers what transition
| Transition | Triggered by | Endpoint |
|-----------|-------------|---------|
| `not_assigned` → `in_progress` | Admin assigns officer | `POST /api/admin/issues/{id}/assign` |
| `in_progress` → `resolved` | Admin marks resolved | `POST /api/admin/issues/{id}/resolve` |
| `resolved` → `closed` | Citizen approves resolution | `POST /api/issues/{id}/verify` with `approved: true` |
| `resolved` → `reopened` | Citizen rejects resolution | `POST /api/issues/{id}/verify` with `approved: false` |
| `reopened` → `in_progress` | Admin reassigns officer | `POST /api/admin/issues/{id}/assign` |

### Business rules on transitions
- `closed` issues are **completely immutable** — no updates, no re-assignment
- When a citizen **rejects**, the system: increments `reopen_count`, increases priority (decrements priority integer by 1, min 1), clears `officer_name`, sets `resolved_at = None`
- A citizen can only verify **their own** issue and only when it is in `resolved` status
- Only admins can assign and resolve
- Only citizens (reporters) can verify

---

## 5. API Structure

### Base URL: `http://localhost:8001`

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Register citizen, returns JWT + user |
| POST | `/api/auth/login` | None | Login, returns JWT + user |
| GET | `/api/auth/me` | Bearer | Get current user |

### Users (`/api/users`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/me` | Bearer | Get own profile |
| PUT | `/api/users/me` | Bearer | Update name + phone |
| PUT | `/api/users/me/password` | Bearer | Change password (requires current password) |
| DELETE | `/api/users/me` | Bearer | Soft-delete own account |

### Issues (`/api/issues`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/issues` | Bearer | Create issue (`multipart/form-data` with optional images) |
| GET | `/api/issues` | Bearer | List issues; citizens see only their own |
| GET | `/api/issues/{id}` | Bearer | Get issue detail; citizens blocked from others' issues |
| POST | `/api/issues/{id}/verify` | Bearer (citizen only) | Verify resolved issue — approve or reject |
| POST | `/api/issues/{id}/upload` | Bearer | Upload additional media |
| DELETE | `/api/issues/{id}` | Bearer | Soft-delete issue (own or admin) |

### Admin (`/api/admin`) — all require `role == "admin"`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/issues` | List all issues with filters + pagination |
| GET | `/api/admin/issues/{id}` | Get full issue detail |
| PUT | `/api/admin/issues/{id}` | Update category/severity/priority/department (no status directly) |
| POST | `/api/admin/issues/{id}/assign` | Assign officer — transitions to `in_progress` |
| POST | `/api/admin/issues/{id}/resolve` | Mark resolved — transitions to `resolved` + notifies citizen |
| POST | `/api/admin/issues/{id}/after-image` | Upload after-resolution image |
| GET | `/api/admin/departments` | List active departments |
| GET | `/api/admin/officers` | List officers (from legacy `officer_labels` table) |
| GET | `/api/admin/audit-log` | Status change history, filterable by issue_id |
| GET | `/api/admin/users` | List all non-deleted citizens (searchable) |
| DELETE | `/api/admin/users/{id}` | **DISABLED** — returns 403 always |

### Analytics (`/api/analytics`) — admin only
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/overview` | Totals, rates, avg resolution hours |
| GET | `/api/analytics/by-department` | Issue count per department |
| GET | `/api/analytics/by-category` | Issue count per category |
| GET | `/api/analytics/by-status` | Issue count per status |
| GET | `/api/analytics/by-severity` | Issue count per severity |
| GET | `/api/analytics/ai-accuracy` | AI prediction accuracy vs final categorization |
| GET | `/api/analytics/geographic` | lat/lng/status/category for map display |
| GET | `/api/analytics/timeline` | Daily issue creation counts (7–365 days) |

### Notifications (`/api/notifications`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List own notifications (paginated, optional unread_only) |
| GET | `/api/notifications/unread-count` | `{ count: N }` |
| POST | `/api/notifications/mark-read` | Mark specific IDs as read |
| POST | `/api/notifications/mark-all-read` | Mark all as read |

### Reference (`/api/reference`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reference/departments` | Public list of departments |
| GET | `/api/reference/issue-types` | Public list of issue types |
| GET | `/api/reference/categories` | Hardcoded list of AI categories |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | App health, AI mode, storage mode, email mode |

---

## 6. AI Classification System

### Two Modes

**Mode 1: Gemini 1.5 Flash** (used when `GEMINI_API_KEY` is set)
- Sends title + description as a structured prompt
- Optionally includes first uploaded image (multimodal)
- Returns JSON with category, subcategory, department, severity (1–4), priority (1–5), confidence, reasoning
- Strips markdown fences from response before parsing
- Falls back to demo mode on any exception

**Mode 2: Keyword demo mode** (default when no API key)
- Maps keywords to 6 categories:
  - `Road & Infrastructure`, `Water Issues`, `Sanitation`, `Public Safety`, `Environment`, `Health`
- Each category has a `severity_bias` and associated department
- Confidence proportional to keyword match count
- `model_version` is set to `"demo-keyword-v1"` or `"demo-fallback-v1"`

### AI Result Application
On issue creation:
1. Full `AIPrediction` row saved
2. `issue.ai_confidence`, `issue.ai_reasoning` updated
3. If the user didn't pre-select a category, the AI's predicted category is applied
4. Severity and priority always applied from AI

### Citizen Privacy
Citizens **cannot see** `ai_confidence`, `ai_reasoning`, or raw `ai_predictions` in any response. These fields are stripped server-side before returning to citizen role.

---

## 7. Frontend Structure

### Routes
```
/                      → Landing page (public)
/login                 → Login (redirects if already authed)
/register              → Register (redirects if already authed)

/dashboard             → Citizen area (requires role=citizen)
  /dashboard/submit    → Submit new issue
  /dashboard/issues    → My Issues list
  /dashboard/issues/:id → Issue detail + verification panel
  /dashboard/notifications → Notifications
  /dashboard/profile   → Profile management

/admin                 → Admin area (requires role=admin)
  /admin/triage        → TriageQueue — unassigned/reopened issues
  /admin/issues/:id    → IssueManage — full admin management panel
  /admin/analytics     → Analytics dashboard
  /admin/users         → UserManage — citizen list
  /admin/audit-log     → Status change audit log
  /admin/notifications → Admin notifications
```

### Key Components
| File | Purpose |
|------|---------|
| `AuthContext.jsx` | Global auth state; holds user, token, login/logout/register functions |
| `ProtectedRoute.jsx` | Wraps routes; redirects if not authenticated or wrong role |
| `DashboardLayout.jsx` | Shell with sidebar + outlet |
| `Sidebar.jsx` | Role-aware navigation sidebar |
| `StatusBadge.jsx` | Color-coded status chip |
| `Timeline.jsx` | Status history timeline |
| `MapPicker.jsx` | Leaflet map for selecting issue location |
| `ImageUpload.jsx` | Drag-and-drop image upload widget |

### API Client (`src/api/client.js`)
- Single Axios instance with `baseURL: '/api'`
- **Request interceptor**: Attaches `Authorization: Bearer <token>` from `localStorage`
- **Response interceptor**: On 401, clears localStorage and redirects to `/login`
- Grouped exports: `authAPI`, `usersAPI`, `issuesAPI`, `adminAPI`, `analyticsAPI`, `notificationsAPI`, `referenceAPI`

### Auth State Management
- Token and user object stored in `localStorage`
- On app mount, `AuthContext` calls `/api/auth/me` to validate the token
- If invalid, calls `logout()` which clears localStorage and state
- `isAuthenticated = !!user && !!token`

---

## 8. Implemented Features

### Citizen Features
- [x] Register and login (JWT auth)
- [x] Submit issue with title, description, optional GPS, optional category, optional photos
- [x] View own issue list with status filters
- [x] View full issue detail including status timeline
- [x] Receive in-app notifications for status changes
- [x] Verify a resolved issue — approve (→ closed) or reject (→ reopened)
- [x] Rate resolution (1–5 stars) and leave feedback
- [x] Edit profile (name + phone)
- [x] Change password
- [x] Soft-delete own account

### Admin Features
- [x] View all issues with advanced filters (status, category, department, severity, priority, confidence, search)
- [x] Issue triage queue (unassigned + reopened issues)
- [x] Assign officer to issue (free-text name) → auto-transitions to `in_progress`
- [x] Mark issue as resolved with resolution notes
- [x] Override category, severity, priority, department
- [x] Upload after-resolution photos
- [x] View full audit log of status transitions
- [x] Analytics dashboard (charts by dept, category, status, severity, AI accuracy, timeline, geographic map)
- [x] View all citizen users (searchable)
- [x] Admin **cannot** delete users (endpoint exists but returns 403)

### System Features
- [x] AI auto-classification on every issue creation
- [x] Dual AI mode: Gemini 1.5 Flash or keyword fallback
- [x] Automatic in-app notifications on status changes
- [x] Photo storage: local filesystem or Cloudinary
- [x] Soft delete: issues and users are flagged `is_deleted=True`, never physically removed
- [x] Ordered issue lists: closed issues always sorted to the bottom
- [x] Complete status history with notes for every transition

---

## 9. Bugs Encountered and How They Were Fixed

### Bug 1: Issues List Broke After Delete
**Problem**: After soft-deleting an issue, the admin issue list was returning deleted issues because the initial list query didn't filter `is_deleted == False`.  
**Fix**: Added `Issue.is_deleted == False` to every query in `admin.py` and `issues.py`. Also the delete endpoint now does `issue.is_deleted = True` + commit, not a physical DELETE.

### Bug 2: `officer_label` Foreign Key System — Rigid and Broken UX
**Problem**: The original design required admins to select officers from a pre-seeded `officer_labels` table using a dropdown. This was inflexible and caused assignment to fail when no labels existed.  
**Fix**: Replaced with `officer_name = Column(String(255))` free-text field on the `Issue` model. The `officer_label_id` FK is still in the schema (to avoid migration pain) but is effectively unused. The `/assign` endpoint now only takes `{ officer_name: str }`.

### Bug 3: Status Transitions — No Validation → Illegal State Changes
**Problem**: The `PUT /api/admin/issues/{id}` endpoint accepted any status value without checking whether the transition was valid (e.g., going from `closed` → `in_progress`).  
**Fix**: Implemented `ALLOWED_TRANSITIONS` dict in `admin.py`. All status changes are validated against this map. Attempts to make invalid transitions return HTTP 400 with a descriptive message. Dedicated `/assign` and `/resolve` endpoints enforce their own specific pre-conditions.

### Bug 4: Verification Endpoint — Status Check Was Backwards
**Problem**: The `/verify` endpoint was accepting verification calls on issues that were NOT in `resolved` status, and was not properly guarding against double-verification on already `closed` issues.  
**Fix**: Added explicit checks:
```python
if issue.status == "closed":
    raise HTTPException(400, "Issue is already closed")
if issue.status != "resolved":
    raise HTTPException(400, "Issue must be in 'resolved' status to verify")
```

### Bug 5: Verify Response Was Empty / Wrong Schema
**Problem**: After a citizen verified an issue, the response body was malformed because the re-fetch query after `db.flush()` didn't include the `officer_label` relationship, causing a Pydantic validation error.  
**Fix**: Added `selectinload(Issue.officer_label)` to the re-fetch query in the `verify_issue` endpoint. Also confirmed `IssueDetailOut` correctly declares `officer_label` as `Optional`.

### Bug 6: Frontend Verification UI — Stale State After Submit
**Problem**: After a citizen submitted their verification (approve/reject), the `IssueDetail` page was still showing the old status and the verification panel, because the local React state was not updated from the API response.  
**Fix**: The verify handler now updates `setIssue(res.data)` directly from the API response data (which includes the updated status), rather than refetching or relying on a re-render cycle.

### Bug 7: `GET /admin/users` Returned Empty List
**Problem**: The `UserManage` admin page was returning zero users. The query was filtering `User.role == "citizen"` but the registration endpoint wasn't explicitly setting `role = "citizen"`, so some users had `None` role.  
**Fix**: Confirmed `register()` explicitly sets `role="citizen"`. Also ensured the seeded admin user always has `role="admin"`. The filter was correct; missing was that early dev users in the DB had null roles. A DB re-seed fixed prod.

### Bug 8: `admin.py` `PUT /issues/{id}` Re-fetch After Flush Was Fetching Stale Data
**Problem**: After updating an issue with `db.flush()`, the re-fetch query reused the same query object from before the flush, which in some SQLAlchemy async sessions returned the old cached state.  
**Fix**: Changed to re-execute the same `_full_issue_query()` helper after every flush, which forces a fresh DB read.

### Bug 9: `Profile.jsx` — Password Update Cleared User State
**Problem**: After updating password via `PUT /users/me/password`, the frontend was trying to update the user state from the response, but the endpoint returns `{ detail: "..." }` not a user object — causing a crash.  
**Fix**: Separated password update handling to only show a success toast, not attempt to `setUser()` from the response.

### Bug 10: Citizen Registration Bug — `full_name` Not Required
**Problem**: Registration form allowed empty `full_name`, causing a DB constraint error instead of a user-friendly validation error.  
**Fix**: Added frontend validation that all required fields (`email`, `password`, `full_name`) are non-empty before submitting.

### Bug 11: Soft Delete — Citizens Could Still See Deleted Issues
**Problem**: After a citizen deleted one of their issues, `/api/issues` was still returning it.  
**Fix**: Added `Issue.is_deleted == False` filter to the citizen list query in `issues.py`.

---

## 10. Important Constraints and Business Rules

1. **`closed` is permanently final** — no code path can move an issue out of `closed` status
2. **Only the reporter can verify** — enforced with `issue.reporter_id != current_user.id` check
3. **Citizens cannot see AI data** — `ai_confidence`, `ai_reasoning`, `ai_predictions` are always stripped from citizen responses server-side
4. **Soft deletes only** — neither issues nor users are ever physically removed from DB; `is_deleted=True` is set instead
5. **Admin cannot delete citizens** — `DELETE /api/admin/users/{id}` always returns 403
6. **Officer assignment is free-text** — admin types any string for officer name; no lookup table required
7. **Priority is an integer 1–5** — 1 is highest priority, 5 is lowest
8. **Re-open increases priority** — each citizen rejection decrements the priority integer by 1 (minimum 1), and clears the officer name
9. **Token expiry is 24 hours** — `ACCESS_TOKEN_EXPIRE_MINUTES = 1440`
10. **DB file is `governance.db`** — not `app.db`, `database.db`, or `local.db` (those are legacy artifacts)
11. **CORS is configured for** `http://localhost:5173`, `http://localhost:3000`, and `settings.FRONTEND_URL`
12. **Issue ordering**: Closed issues always pushed to the bottom of lists (using SQLAlchemy `case()` expression)
13. **Gemini fallback**: If `GEMINI_API_KEY` is unset OR if Gemini throws any error, the system silently falls back to keyword-based analysis without crashing

---

## 11. Environment Variables (`.env`)

```env
# Required
DATABASE_URL=sqlite+aiosqlite:///./governance.db
SECRET_KEY=<your-random-secret>

# Optional — AI
GEMINI_API_KEY=<google-gemini-api-key>

# Optional — Image storage (falls back to local if unset)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Optional — Email (falls back to in-app notifications if unset)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@governance.local

# App
FRONTEND_URL=http://localhost:5173
UPLOAD_DIR=uploads
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

## 12. Assumptions Made During Development

1. **SQLite is sufficient for dev** — The schema is designed to be portable to PostgreSQL by changing `DATABASE_URL` only (no SQLite-specific types used except `julianday()` in analytics queries, which would need updating for Postgres).
2. **Single admin user** — Platform assumes one or a fixed set of admin accounts seeded via `seed.py`. There is no admin registration endpoint.
3. **No email verification** — Users are immediately active after registration. Emails are not verified.
4. **A citizen can verify only once** — There's no guard against multiple verification votes from the same user, but the frontend only shows the verify panel when status == `resolved`. Multiple votes are technically possible via direct API calls.
5. **No real-time updates** — Notifications and issue status updates require page refresh or navigation. No WebSockets/SSE.
6. **`officer_label_id` FK kept for schema compatibility** — The column is in the DB but not used in the UI or business logic. Could be migrated away in a future version.
7. **Image uploads are permanent** — Deleting an issue (soft delete) does not delete the media files from disk/Cloudinary.
8. **Resolution notifications are always sent** — When admin resolves, a `verification` notification is sent to the citizen. No opt-out mechanism.
9. **Admin is not notified** — Notifications are only created for citizens (the reporter). Admins have no notification system.
10. **`reopen_count` is cumulative** — It increments on every rejection and is never reset, even after the issue is re-resolved and closed.

---

## 13. File Map Summary

```
project1/
├── docker-compose.yml           # Not actively used; stub for containerization
├── backend/
│   ├── .env                     # Active env config
│   ├── governance.db            # Active SQLite database
│   ├── requirements.txt         # Python dependencies
│   ├── migrate_statuses.py      # One-off migration script (historical)
│   ├── test_workflow.py         # Manual API test script
│   ├── uploads/                 # Local image storage
│   └── app/
│       ├── main.py              # FastAPI app factory + router registration
│       ├── config.py            # Settings (pydantic-settings)
│       ├── database.py          # Async SQLAlchemy engine + session
│       ├── seed.py              # DB seed: admin user, departments, officer labels, issue types
│       ├── middleware/auth.py   # JWT decode, bcrypt, get_current_user, require_admin
│       ├── models/              # SQLAlchemy ORM models (12 models)
│       ├── schemas/             # Pydantic request/response schemas
│       ├── routers/             # FastAPI route handlers
│       │   ├── auth.py          # /api/auth/*
│       │   ├── users.py         # /api/users/*
│       │   ├── issues.py        # /api/issues/*
│       │   ├── admin.py         # /api/admin/*
│       │   ├── analytics.py     # /api/analytics/*
│       │   ├── notifications.py # /api/notifications/*
│       │   └── reference.py     # /api/reference/*
│       └── services/
│           ├── ai_service.py    # Gemini + keyword fallback
│           ├── upload_service.py # Cloudinary + local fallback
│           └── notification_service.py # create_notification helper
└── frontend/
    ├── vite.config.js           # Dev server + proxy config
    ├── package.json
    └── src/
        ├── App.jsx              # Router + route tree
        ├── main.jsx             # React entry point
        ├── index.css            # Global styles + design system
        ├── api/client.js        # Axios instance + all API call groups
        ├── context/AuthContext.jsx  # Global auth state
        ├── components/          # Shared UI components
        └── pages/
            ├── Landing.jsx
            ├── Login.jsx
            ├── Register.jsx
            ├── citizen/         # Dashboard, SubmitIssue, MyIssues, IssueDetail, Notifications, Profile
            └── admin/           # AdminDashboard, TriageQueue, IssueManage, Analytics, AuditLog, UserManage
```

---

## 14. Running the Project Locally

### Backend
```powershell
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

### Frontend
```powershell
cd frontend
npm run dev
```

### Access
- Frontend: `http://localhost:5173`
- Backend API docs: `http://localhost:8001/docs`
- Health check: `http://localhost:8001/api/health`

### Default seeded admin credentials
- **Email**: set in `backend/app/seed.py` (check `seed_database` function)
- **Role**: `admin`

---

## 15. Known Current Issues / Limitations

1. **Multiple DB files** — `app.db`, `database.db`, `local.db` are leftover stale files from early dev. They can be deleted safely.
2. **`delete_account` for citizens does not log them out** — The `DELETE /users/me` sets `is_deleted=True` and `is_active=True` remains, but the `get_current_user` middleware checks `user.is_deleted`, so subsequent requests will fail with 401. However, the frontend doesn't clear localStorage automatically after calling the delete API.
3. **No pagination on admin user list** — `GET /api/admin/users` returns all non-deleted citizens with no pagination.
4. **`officer_label_id` is a dead column** — Present in schema, never written to in any active code path.
5. **Analytics uses `julianday()`** — This is SQLite-specific. Switching to PostgreSQL requires rewriting the `avg_resolution_hours` calculation.
6. **Citizen can vote multiple times** — No database constraint prevents a citizen from calling `/verify` multiple times on the same issue. Business logic only prevents it via status guard.
7. **Debug `print()` statements left in code** — `users.py` and `issues.py` have `print(f"DEBUG: ...")` statements that should be removed before production.
8. **`docker-compose.yml` is not fully configured** — It exists as a stub but is not used in the current dev workflow.
