# Phase 01 — OAVS PGT Computer Science prep app foundation

Build only the foundation: accounts, exam records, syllabus structure, and the two learner screens that can run on real data. No question bank, no mocks, no AI, no invented numbers.

## What you get

**Sign-in**
- Email + password sign-in and sign-up page.
- Every app screen requires being signed in.
- Two kinds of account: normal learner and admin. Admin screens are only reachable by admin accounts; the first account you create can be promoted to admin.

**Sidebar navigation** (desktop sidebar, collapsible drawer on mobile)
- Today, Roadmap
- separator — Learn, PYQs, Mocks, Revision
- separator — Analytics
- Bottom label: "OAVS PGT CS / 120-Day Preparation"
- Admin section visible only to admins: Exams, Syllabus, Sources

**Today**
- Header: OAVS PGT Computer Science, 6-hour daily target.
- Neutral note: "Study plan will be generated after the syllabus is configured."
- Roadmap progress, topics completed, topics remaining — computed only from real syllabus rows and your saved progress. Zero state shown honestly when the syllabus is empty.

**Roadmap**
- Hierarchical OAVS syllabus: Subject → Topic → Subtopic, expand/collapse.
- Completion state you can toggle per topic/subtopic; estimated study time shown when set.
- Selecting a topic opens a detail side panel: title, subject, description, status, estimated time, exam coverage ticks (OAVS/KVS/NVS/SSB/EMRS), plus "Lessons — coming in a later phase" and "PYQs — coming in a later phase" placeholders.

**Admin → Exams**
- Table of the five exams; create, edit, enable/disable, and set which one is primary (exactly one).

**Admin → Syllabus**
- Tree editor: create, edit, delete and reorder subjects, topics and subtopics.
- Map any concept to one or more exams with checkboxes.
- Search box and filters (by subject, by exam, by status).
- Import JSON / Export JSON of the whole hierarchy, shaped so a full official syllabus can be imported later without changes.

**Placeholder screens**
- Learn, PYQs, Mocks, Revision, Analytics, Admin → Sources: a clean, consistent empty state saying the feature arrives in a later phase. No fake charts or counts anywhere.

**Design**
- Background #F7F8F6, surface #FFFFFF, text #111412, muted #68706A, border #E3E7E3, accent #0E8F74; Inter. Dense workbench feel: flat surfaces, thin borders, small radii, table-first. No gradients, glassmorphism, oversized cards or gamification.

## Starting data

- Five exam records seeded: OAVS (primary), KVS, NVS, SSB Odisha, EMRS.
- Syllabus starts empty — you add subjects/topics via the admin screen or JSON import.

## Technical notes

- Enable Lovable Cloud (Postgres + auth) and email/password sign-in.
- Tables: `profiles` (auto-created on signup), `user_roles` + `has_role()` security-definer function (roles never on profiles), `exams`, `exam_patterns`, `subjects`, `topics` (with `parent_topic_id`, `display_order`, `estimated_minutes`, `status`), `subtopics`, `exam_syllabus_mapping` (polymorphic: exam_id + entity type/id so one concept maps to many exams without duplication), `user_topic_progress`.
- Row-level security on all tables: authenticated users read syllabus/exams; only admins write; progress rows scoped to `auth.uid()`; explicit GRANTs alongside each table.
- Routes: public `/auth`; everything else under the `_authenticated` layout, with a nested admin gate checking `has_role(uid,'admin')`. Admin writes go through server functions that re-verify the admin role server-side.
- No priority/importance values stored or displayed — reserved for real PYQ data in a later phase.
