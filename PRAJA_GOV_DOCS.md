# PrajaGov - Technical & Functional Documentation

## 1. EXECUTIVE SUMMARY
**PrajaGov** is a modern, AI-powered civic governance platform designed to bridge the gap between citizens, administrators, and government officials. The platform allows citizens to easily report civic issues—such as infrastructure damage, sanitation problems, or service disruptions—using multimodality (text and images) and geolocation. 

By leveraging advanced Artificial Intelligence (Google Gemini), PrajaGov automatically categorizes problems, assesses severity, assigns priority, and weeds out irrelevant complaints. Real government officers receive optimized assignments based on department mapping, and citizens can actively vote on or verify the resolution of their reported issues. Administrators get a bird's-eye view of operations through a rich analytics dashboard. The ultimate goal is to facilitate transparent, accountable, and rapid civic issue resolution.

## 2. SYSTEM OVERVIEW
The system is built on a robust, asynchronous full-stack architecture:
- **Frontend**: Built with React and Vite for rapid development and high performance. It utilizes Tailwind CSS for responsive styling, React Router for seamless navigation, and Recharts/Leaflet for dynamic analytics and maps.
- **Backend**: An asynchronous Python API built with **FastAPI**, featuring JWT authentication and robust input validation via Pydantic. 
- **Database**: **PostgreSQL** hosted on **NeonDB**, connected via SQLAlchemy's `asyncpg` driver to handle concurrent requests efficiently in a Serverless environment.
- **External Integrations**:
  - **Google Gemini 2.5 Flash**: Multimodal AI for dynamic issue classification, reasoning, and bogus complaint detection.
  - **Cloudinary**: Cloud-based media storage for issue images, utilizing base64 or multipart upload.
  - **SMTP**: Asynchronous email delivery system for real-time notifications via standard Python `smtplib`.

## 3. CORE FEATURES

**Citizen Portal**
- **Registration & Authentication**: Secure sign-up and login utilizing JWT tokens.
- **Multimodal Issue Reporting**: Submit complaints with a title, description, GPS location/address, and contextual images.
- **Real-Time Tracking**: Monitor issue progression (e.g., in-progress, resolved) through an interactive dashboard map and list view.
- **Verification & Rating**: When an officer marks an issue as "resolved", the citizen receives a notification to either verify (close) or reject (reopen) the claim, and optionally submit a rating.

**Admin Dashboard**
- **Triage & Management**: Override AI predictions, assign officers manually, and adjust issue severity.
- **Officer Management**: Create and manage `Officer` profiles, including department assignment and availability toggles (e.g., suspension, on leave).
- **Analytics Interface**: Gain macroscopic insights via charts mapping regional dispute frequency, department performance, and turnaround times.
- **AI Verification**: Review AI decisions and provide feedback (`is_ai_correct`) to improve future system prompts or trigger retraining.

**Officer Interface**
- **Dedicated Authentication**: Separate login flow emphasizing security.
- **Task Pipeline**: Review assigned tickets, including mapped coordinates and AI reasoning.
- **Resolution Submission**: Submit completion notes and evidence when marking a task resolved.
- **Performance Metrics**: Officers build a performance profile based on citizen ratings and avoid accumulating "negative tickets."

## 4. AI SYSTEM
Instead of relying strictly on hardcoded dropdown menus, PrajaGov uses a semantic AI pipeline:
- **Dynamic Issue Classification**: Gemini 2.5 Flash dynamically interprets complaints and generates concise `issue_type` labels (e.g., "Transformer Explosion Risk") or matches against 59 predefined civic categories.
- **Department Mapping**: The AI explicitly maps the complaint to one of 8 real government departments (e.g., *Health, Medical & Family Welfare*, *Panchayat Raj and Rural Development*).
- **Severity & Priority Detection**: Multidimensional assessment factoring visual proof (Cloudinary images), public safety risk, and demographic impact. Returns an overarching priority integer and standardized string (critical, high, medium, low).
- **Bogus Complaint Detection**: Actively shields the database by flagging (`is_irrelevant=True`) spam, insults, or strictly non-civic statements, assigning them low severity to prevent resource waste.

## 5. ISSUE WORKFLOW
1. **Creation**: Citizen creates a new report.
2. **AI Analysis**: Backend routes the complaint string and image to the `ai_service`. AI populates the issue type, sets severity/priority, and matches the correct department.
3. **Status: `not_assigned`**: The issue waits in the global queue.
4. **Officer Assignment**: Admins (or an automatic rule engine) assign the ticket to an available Officer within the respective department. Status switches to `in_progress`.
5. **Resolution**: The Officer completes the task in the field and updates the portal with notes. Status updates to `resolved`. 
6. **Citizen Verification**: The Citizen is notified (via SMTP email). If the citizen approves, the issue moves to `closed` (immutable). If rejected due to unsatisfactory work, it is explicitly `reopened` and returned to the officer.

## 6. OFFICER SYSTEM
Departing from legacy "text label" concepts, the platform features a complete Entity-Relational Officer System:
- **Real Entity Architecture**: Officers have concrete credentials, hashed passwords, contact information, and explicit relationships to particular departments.
- **Assignment Rules**: Officers can only be assigned to an issue if `is_available` is true and they are not `is_on_leave` or `is_suspended`.
- **Negative Tickets & Suspension**: If an Officer repeatedly drops tickets or if citizens reject their resolution (reopen the issue), the Officer accumulates `negative_tickets`. Elevated negative scores can trigger administrative suspension (`is_suspended`).
- **Rating System**: When citizens close a ticket, they submit a numeric rating which updates the Officer's global aggregate (`avg_rating`), gamifying efficient urban management.

## 7. DATABASE DESIGN
Key relational schema designed for scale:
- `users`: Stores citizen and admin records, passwords, roles (`citizen`, `admin`).
- `officers`: Stores government employee profiles, contact info, availability, and performance aggregates (`avg_rating`, `negative_tickets`).
- `issues`: Central hub containing legacy classifications, dynamic `issue_type_id`, `department_id`, spatial coordinates, status, AI confidence parameters (`is_irrelevant`), and foreign keys mapping to the `officer_id` and `reporter_id`.
- `departments`: Static dictionaries grouping Officers and Issues.
- `issue_types`: Normalization table adapting previously free-form Gemini strings.
- `ratings` / `verification_votes`: Tracks citizen approval and rating post-resolution.

## 8. API STRUCTURE
Built with FastAPI, exposing heavily documented, asynchronous REST endpoints:
- **`/auth`**: Login, citizen registration, refresh tokens (`/auth/login`, `/auth/register`).
- **`/issues`**: CRUD operations, multi-part form submissions for media, citizen verifications (`POST /issues/`, `PATCH /issues/{id}/verify`).
- **`/admin`**: Highly privileged endpoints for overriding AI classifications, retrieving system-wide metrics, and officer lifecycle management (`POST /admin/officers`, `PATCH /admin/issues/{id}/assign`).
- **`/officer`**: Endpoints enabling officials to claim tickets, submit resolutions, and check personal stats (`PATCH /officers/issues/{id}/resolve`).
- **`/ai`**: Internal utility endpoints for on-the-fly re-evaluations and bulk testing.

## 9. UI/UX OVERVIEW
- **Role-Based Interfaces**: The frontend dynamically loads distinct Dashboard layouts depending on the JWT `role` claims (Citizen Map view, Admin Grid view, Officer Ticket Queue).
- **Responsiveness**: Leveraging Tailwind CSS flexible grids and column stacks ensures forms, data tables, and interactive maps are completely usable on strict mobile viewports (preventing horizontal overflows on data-rich admin screens).
- **Design System**: Focuses on professional, modern aesthetics combining stark contrasts, soft glassmorphism for floating cards, clean typography (e.g., Inter), and color-coded status pills (Red for Critical, Green for Closed).

## 10. NOTIFICATION SYSTEM
- **SMTP Engine**: Designed to decouple slow network IO from fast HTTP requests, utilizing background tasks.
- **Triggers**: Citizens immediately receive HTML-formatted emails when their issues transition to `resolved` by an Officer. The email instructs them to utilize their dashboard to verify or reopen the ticket. Future iterations handle automatic "New Assignment" emails for Officers.

## 11. DEPLOYMENT
- **Hosting Environment**: Frontend optimally suited for Edge-networks like **Vercel** or Netlify. The Python backend is designed for containerized deployment or PaaS providers like **Render** or Heroku.
- **NeonDB**: Serverless PostgreSQL implementation drastically isolates development and staging layers and intelligently scales compute during burst civic-reporting periods (e.g., monsoons/floods).
- **Configuration Security**: Twelve-factor app principles used, isolating `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, and `SMTP` variables within environments without risking source control leaks.

## 12. CHALLENGES & SOLUTIONS
- **Migration & Temporal Syntax Compatibility**: Moving from SQLite to NeonDB introduced syntax incompatibilities (e.g., SQLite's `julianday()` vs PostgreSQL temporal functions). **Solution**: Audited all raw SQL within `analytics.py` and converted backend queries to ORM-agnostic paradigms or dialect-specific branches.
- **Bogus Data Pollution**: Malicious or nonsensical issues corrupted analytics. **Solution**: Promoted AI responsibility. Implemented multimodal constraints explicitly instructing the LLM to output an `is_irrelevant` flag, sequestering bad actors automatically.
- **Database Normalization (Officer Labels to Entities)**: Initial prototypes used simple string labels indicating responsible personnel. **Solution**: Executed a comprehensive database migration (`migrate_officers.py`), transferring isolated string records into fully relational `Officer` and `Department` models to unblock authentication and analytics.
- **Mobile Viewport Breaking**: Admin dashboards suffered from severe UI crunching on mobile devices. **Solution**: Refactored fixed grid counts into `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` logic, shifting horizontal tables to responsive list-cards on mobile.

## 13. FUTURE ENHANCEMENTS
- **Native Mobile Apps**: Utilize React Native to deliver a dedicated app leveraging native device capabilities (camera, deeper GPS integration, push notifications).
- **Predictive ML Prioritization**: Train custom Random Forest models on historical SLA (Service Level Agreements) to proactively alert officials of tickets likely to breach completion deadlines.
- **Geo-fenced Auto Assignment**: Rather than relying purely on department availability, automatically assign tickets to the closest available officer based on active GPS tracking and polygon ward boundaries.
- **Public Leaderboards**: Display ward/zone efficiency publicly to foster healthy competition amongst local governing bodies.

## 14. CONCLUSION
PrajaGov successfully transforms conventional, bureaucratic grievance redressal into a transparent, rapidly actionable timeline. By shifting the classification and prioritization burden onto modern AI models, human administrators can focus solely on the logistics of task execution. With a hardened PostgreSQL infrastructure, intuitive React interface, and strict role-based controls, PrajaGov stands as a robust architectural blueprint for next-generation smart city governance.
