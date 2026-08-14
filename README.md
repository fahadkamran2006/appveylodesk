# Veylodesk OS

You are a Senior Principal Software Architect and Full-Stack Engineer.
Your task is to build **Veylodesk**: A production-ready, multi-tenant Agency Operating System (SaaS).

**CRITICAL INSTRUCTION:**
This is NOT a prototype. This is a real product.
Do not use mock data where a database should be.
Do not use "lorem ipsum" — use real, psychologically optimized copy for Video Editing Agencies.

---

### 1. THE LANDING PAGE (Entry Point)
**Route:** `/`
**Design Philosophy:** "The Command Center." Dark mode default (or high-contrast professional light), Deep Indigo branding (`#4B4BE1`), Glassmorphism accents.
**Target Audience:** Video Agency Owners who are tired of "playing traffic cop" with files and clients.

**Key Sections & Copywriting Psychology:**
1.  **Hero Section:**
    * **Headline:** "Run Your Agency From One Command Center."
    * **Subheadline:** "Stop managing chaos. Start scaling. The first OS built specifically for Video Agencies to manage Clients, Editors, and Projects in one tab."
    * **CTA:** "Start Your Free Trial" (Links to `/auth/signup`) & "Login" (Links to `/auth/login`).
    * **Visual:** A massive, sleek screenshot of the Admin Dashboard (Kanban board + Revenue metrics).
2.  **The Problem (The "Hell" State):**
    * Visual representation of fragmented tools (Slack icon + Trello icon + Drive icon = Chaos).
    * **Copy:** "Drowning in tabs? 14-hour days? That's not scaling. That's surviving."
3.  **The Solution (The "Heaven" State - 3 Dashboards):**
    * Show tabs/toggle for: **Admin View** (Total Control) | **Client View** (Simple Approvals) | **Editor View** (Clear Tasks).
    * **Copy:** "Your clients see progress. Your editors see tasks. You see peace."
4.  **Social Proof:** "Built by Agency Owners, for Agency Owners."
5.  **Pricing/Founders:** Tease a "Lifetime Access" or "Founders Program" badge.

---

### 2. AUTHENTICATION & ONBOARDING
**Tech:** Supabase Auth or NextAuth (JWT).
**Flow:**
1.  **Sign Up:** User enters Email/Password.
2.  **Onboarding Wizard (Agency Creation):**
    * "What is your Agency Name?"
    * "Upload Logo" (Used on Client Dashboards).
    * "Team Size."
    * **Result:** Creates a new `Agency` record and assigns this user as `AGENCY_ADMIN`.
3.  **Sign In:** Standard login.
    * **Redirect Logic (Crucial):**
        * If Role = `ADMIN` → Go to `/admin/dashboard`
        * If Role = `CLIENT` → Go to `/client/portal`
        * If Role = `EDITOR` → Go to `/editor/workspace`

---

### 3. APP ARCHITECTURE (Multi-Tenant)
**Stack:** Next.js (App Router), Tailwind CSS (Shadcn/UI components), Supabase (Postgres + Auth + Storage).

**Database Schema (PostgreSQL):**
* **Agencies:** id, name, logo_url, created_at
* **Users:** id, email, role (admin/client/editor), agency_id (FK), avatar_url
* **Projects:** id, agency_id, title, status (Backlog/In Progress/Review/Done), client_id (FK), editor_ids (Array of FKs)
* **Invoices:** id, project_id, amount, status (Unpaid/Paid), pdf_url, payment_proof_url
* **Messages:** id, project_id, sender_id, content, is_internal (visible to team only)

**Security Rules (RLS):**
* Users can ONLY access data where `agency_id` matches their own.
* Clients can ONLY access Projects where `client_id` == their ID.
* Editors can ONLY access Projects where they are assigned.

---

### 4. CORE FEATURES BY ROLE

#### A. Agency Admin Dashboard (`/admin`)
* **Overview:** Total Revenue, Active Projects count, Pending Invoices.
* **Kanban Board:** Drag-and-drop projects between statuses.
* **Client Management:** "Add Client" button (triggers email invite).
* **Editor Management:** "Add Editor" button (triggers email invite).
* **Invoicing:** Create PDF invoice (generate simple layout), Upload manual payment proof if client paid via bank transfer.

#### B. Client Portal (`/client`)
* **View:** Clean, simple list of their active projects.
* **Action:** Click project → View status, download delivered files.
* **Billing:** View unpaid invoices → Button to "Upload Payment Proof" (Phase 1 manual payment).

#### C. Editor Workspace (`/editor`)
* **View:** List of projects assigned to them specifically.
* **Action:** Upload files to "Delivered" column.
* **Earnings:** Simple view of "Completed Jobs" x "Rate".

---

### 5. DESIGN SYSTEM (Veylodesk Brand)
* **Font:** Inter or Plus Jakarta Sans.
* **Primary Color:** Deep Indigo (`#4B4BE1`).
* **Backgrounds:**
    * Landing Page: Dark/Black background with Indigo glows.
    * App: Clean White/Gray (Light Mode) or Slate (Dark Mode) for readability.
* **UI Components:** Use Shadcn/UI cards, tables, and dialogs. Buttons should have subtle gradients.

---

### EXECUTION STEPS
1.  **Setup:** Initialize Next.js project with Supabase.
2.  **Database:** Generate the SQL migration for the schema described above.
3.  **Landing Page:** Build the high-converting landing page at root.
4.  **Auth:** Implement Sign Up/Login flows with the Role-based redirect.
5.  **Dashboards:** Build the 3 separate layouts (Admin, Client, Editor).
6.  **Logic:** Connect the Kanban board and File Uploads (Supabase Storage).

**Start by scaffolding the Database Schema and the Landing Page.**

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://appveylodesk.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/20bad592-ee9a-41fd-8ceb-1db3cf54c871).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
