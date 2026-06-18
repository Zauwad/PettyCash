# Pitch Deck & Product Demo Guide

This guide is prepared to help you deliver a winning pitch and product demonstration. It showcases your design decisions, the quality of the user journey, and real-world usability across all three tenant companies.

---

## 1. The Core Pitch: What is OMS?

> **The Problem**: Small-to-medium businesses (15–20 employees) are often forced to choose between complex, expensive enterprise software or chaotic, manual spreadsheets to manage daily logistics like petty cash and leave requests.
>
> **The Solution**: **OMS (Operations Management System)** is a lightweight, blazing-fast, tenant-isolated operations desk built specifically for high-efficiency teams. It replaces heavy infrastructure with serverless execution, providing robust governance, gorgeous aesthetics, and zero overhead.

---

## 2. Walkthrough & Demo Script

Follow this structured flow to demonstrate the live product to judges.

### Phase 1: Login & Theme Adaptation
1. **Show the Login Page**: Highlight the sleek, modern **Aceternity UI Grid background** with the custom radial fade mask. Toggle the theme (Light/Dark mode) to show how clean and responsive the layout is.
2. **Log in as Employee** (e.g., `amaze_des_emp1` / `password123`):
   * Point out the **Typewriter Welcome Animation** on the dashboard greeting the employee professionally (*"Good morning, Jane UI/UX Designer!"*).
   * Note that there are no generic "Staff" tags to demean employees.

### Phase 2: The Requisition Flow (Petty Cash)
1. **Create a Request**: Navigate to **Petty Cash**, click "New Requisition", and add a line item (e.g., office tools).
   * *Highlight*: The system automatically calculates total prices and validates the request against the department's remaining cycle budget (Monthly/Quarterly/Yearly) before allowing submission.
2. **Submit & Route**: Submit the request. It transitions to `pending_tl_approval`.
3. **Log in as CEO** (`amaze_ceo` / `password123`):
   * Go to the **Approvals Desk** tab.
   * *Show approvals*: You will see the **Approvals Desk** displaying all pending requests in the organization.
   * *Superpower*: Demonstrate that the CEO can either approve standard requests or use **direct approval superpower** to clear requests immediately.
   * *Bulk Actions*: Check multiple items and show the **Mobile-Responsive Bulk Action Bar** that slides up cleanly on mobile viewports and allows bulk approvals/rejections with a single click.

### Phase 3: The Payout Flow (HR Disbursement)
1. **Log in as HR** (`amaze_hr` / `password123`):
   * Navigate to the **Approvals Desk** -> **Petty Cash** tab. The approved requests show as `Pending HR Disbursement`.
   * Click **Disburse**, input notes, and record a cash payout.
   * *Behind the Scenes*: The disbursement immediately deducts from the department's active cycle budget and registers on the spending charts.

### Phase 4: The Leave Flow (Governance & Calendar)
1. **Leave Balance & Request**: Show how the employee requests leaves. The system dynamically counts working days, automatically skipping weekends and public holidays (pre-populated with Bangladesh national holidays).
2. **Team Calendar**: Navigate to the **Team Calendar** to show the live interactive schedule where leads and managers can view upcoming absences across the organization to plan capacity.

---

## 3. Design Thinking & Technical Choices

Here is the rationale behind the key product decisions to highlight during your Q&A:

### A. Minimalist, High-Performance UI (Aesthetics)
* **Tailored Themes**: Instead of basic generic colors, each of the three companies (**A Maze Venture**, **mYnt Connect**, and **Braincount**) has a custom, vibrant color palette configured via CSS variables. 
* **Minimalist Sonner (Toaster) & Badges**: Integrated clean, border-adaptive **Shadcn UI Zinc-style badges and spinners**. Removed chaotic blinking icons from status fields to reduce cognitive load and CPU rendering lag on older devices.
* **Typing Animation**: The welcome greeting types itself smoothly on load, creating a premium first impression that makes the app feel "alive".

### B. Architecture Tailored for Vercel Serverless Hosting
* **No Redis/Celery Overhead**: Rather than forcing a small company to pay for heavy Redis servers and Celery worker daemons, we built a **thread-based background task runner** in Python that executes async emails safely in memory without blocking server threads.
* **Vercel Cron Integration**: Exposed a secure `/api/cron/daily-tasks/` endpoint protected by a Vercel `CRON_SECRET` header token. Scheduled daily cron runs via Vercel to handle budget resets and delegation cleanups, giving you zero-cost enterprise scheduling.
* **SQL BLOB receipt storage**: Receipts are uploaded and stored directly as binary data (BLOB) inside the database. This eliminates the need for setting up external AWS S3 buckets or static storage configurations on serverless instances.

### C. True Multi-Tenancy (Real-World Usability)
* Data is completely isolated at two levels:
  1. **Level 1 Middleware**: Asserts that every incoming request is mapped to the current host user's organization.
  2. **Level 2 Query Isolation**: Automatically scopes database filter queries to the active organization, making it completely impossible for employees of *mYnt Connect* to view budget details or requests from *Braincount*.

---

## 4. Key Metrics to Highlight

* **17 Automated Tests**: All unit and system integration tests run and pass locally with 100% success.
* **Flexible Budgets**: Budgets can be configured as **Monthly**, **Quarterly**, or **Yearly** cycles depending on how each department manages spending, with custom thresholds for Team Lead approvals.
