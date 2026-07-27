
# [NanyangGifts CRM Web App] (nanyanggifts.vercel.app)

A custom CRM and operations workspace built with Next.js, React, TypeScript, Supabase, and modern component-driven UI patterns. The app is designed around a grouped board workflow similar to Monday.com, with client rows, nested subitems, assignments, activity tracking, document generation, and external collaboration flows for clients and suppliers.

## Core Features

### Board-based CRM

- Grouped CRM board inspired by Monday.com-style sections and collapsible groups.
- Client rows with inline editing for business and contact fields.
- Expandable rows with nested subitems for project-level or line-item tracking.
- Bulk row selection and deletion for faster board management.
- Search and filtering across client and subitem data.
- Drag-and-drop movement of clients between groups, with status-aware grouping behavior discussed during implementation.

### Status and workflow management

- Custom client statuses such as New Lead, Contacted, Quoted, Follow Up, Shortlisted, Project Started, Project Done, Closed, and Unqualified were used as the core board workflow model during development.
- Reply status tracking for outreach follow-up and reassignment flows.
- Follow-up date handling for timing-sensitive pipeline management.
- Option management for status fields

### One source of truth: Project Manager and Sales Staff use 1 board 
- Sales staff can access the subitem markup, qty, etc. columns while Project Managers can click on a payment icon to switch to their relevant columns and input the necessary information, or click on the timeline icon for tracking project timeline
- Sales staff can select subitem(s) to view total price, total cost, total markup without scrolling to the right  
<img width="461" height="283" alt="Screenshot 2026-07-27 174105" src="https://github.com/user-attachments/assets/e3cee982-22e3-450f-8db8-f7169bb796f4" class="align-center" />



### Drag and drop function
- For moving clients from group to group (and auto-changing of status according to the group name)
<img width="800" height="250" alt="Screen Recording 2026-07-27 172146" src="https://github.com/user-attachments/assets/228bbf4c-6ac8-41e9-8c21-b1e0222e29c8" />


### Collaboration and assignments

- Multi-user assignee support at both the client and subitem levels.
- Assignee data modeled through join tables linked to user profiles in Supabase.
- Round-robin assignment was a major design influence earlier in the project, especially for lead ownership and response workflows.

### Activity logging

- Per-client activity log with user attribution and change descriptions.
- Tracking for field updates, subitem creation, subitem deletion, and nested item changes.
- Internal audit trail design to show who changed what and when across client records.

### Generate estimate in Quickbooks, generate Order Confirmation Form for internal view & client view 

- Generate Estimate workflow integrated with QuickBooks-oriented logic and external accounting considerations. Change 'Local/Overseas?' status to Oversas to apply Out of Scope tax, change to Local to apply SR 9% GST for the specific subitem.
- Generate Order Confirmation Form workflow with a dedicated modal, internal page, and public client-facing signing/review flow.
- OCF flow designed with editable internal fields, public tokenized sharing, and client-side review/signoff behavior.
- Order confirmation form configuration settings page only visible to director to edit 'Important Notes' section of form

### Client collaboration

- Public client-facing OCF page accessible through a tokenized link rather than requiring standard app authentication.
- Shipper-facing site/view for Project Managers: a table-based external workflow for selected subitem data (when Project Manager clicks 'Push' button for selected subitem, shipper site syncs data.
- Shipper site only shows relevant fields for specific shipper using token links to protect internal operational data.

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind-style utility classes, Lucide icons, Radix UI patterns, custom reusable row components |
| Backend | Supabase |
| Database | PostgreSQL via Supabase |
| Auth / access patterns | Supabase auth for internal users, tokenized access for selected external parties (client, supplier) |
| Integrations | QuickBooks |
