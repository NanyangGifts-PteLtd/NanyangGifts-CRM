<p align="center"> <img width="760" height="216" alt="Screenshot 2026-07-29 160313" src="https://github.com/user-attachments/assets/6e1bcb00-fd11-4052-ac2d-bb682c3a2df7" /> </p>

<p align="center"># 🌐 [NanyangGifts CRM Web App](https://nanyanggifts.vercel.app)</p>

<p align="center">A custom CRM and operations workspace built with Next.js, React, TypeScript, Supabase, and modern component-driven UI patterns. The app is designed around a grouped board workflow similar to Monday.com, with client rows, nested subitems, assignments, activity tracking, document generation, and external collaboration flows for clients and suppliers. </p>

## Core Features

### Board-based CRM

- Grouped CRM board inspired by Monday.com-style sections and collapsible groups.
- Client rows with inline editing for business and contact fields.
- Expandable rows with nested subitems for project-level or line-item tracking.
- Bulk row selection and deletion for faster board management.
- Search and filtering across client and subitem data.
- Drag-and-drop movement of clients between groups, with status-aware grouping behavior discussed during implementation.

### One source of truth: Project Manager and Sales Staff use 1 board 

- Sales staff can access the subitem markup, qty, etc. columns while Project Managers can click on a payment icon to switch to their relevant columns and input the necessary information, or click on the timeline icon for tracking project timeline.
  <br>
  <img width="800" height="332" alt="ScreenRecording2026-07-29141422-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/e8f29f05-002d-48ba-8731-fc2816ed2457" />
  
  <img width="800" height="321" alt="ScreenRecording2026-07-29144352-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/53779200-bd8b-4ad4-a97a-0ac8afb4c0b2" />

- Sales staff can select subitem(s) to view total price, total cost, total markup without scrolling to the right.
  <br>
  <img width="706" height="266" alt="ScreenRecording2026-07-29141659-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/d55e950c-aadb-44a2-9ef3-29e6a3613770" />

### Status and workflow management

- Custom client statuses such as New Lead, Contacted, Quoted, Follow Up, Shortlisted, Project Started, Project Done, Closed, and Unqualified were used as the core board workflow model during development.
- Reply status tracking for outreach follow-up and reassignment flows.
- Follow-up date handling for timing-sensitive pipeline management.
- Option management for status fields.
  <br>
  <img width="800" height="375" alt="ScreenRecording2026-07-29142353-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/d4332abb-a569-40ca-a4cc-e2ad2a5ed827" />

### Filters for client status and subitem progress status
- Sales staff can easily filter for clients and Project Managers can filter for late subitems, for example.

  <img width="800" height="385" alt="ScreenRecording2026-07-29152536-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/f1ce8bb9-cde1-40c3-8f7d-1364fbbb541e" />


### Drag and drop clients to move them to different groups

- Status auto-changes if there is a group with the same name that exists
  <img width="800" height="250" alt="Screen Recording 2026-07-27 172146" src="https://github.com/user-attachments/assets/228bbf4c-6ac8-41e9-8c21-b1e0222e29c8" />


### Users get assigned to clients/subitems in a round robin

- Multi-user assignee support at both the client and subitem levels.

  <img width="800" height="428" alt="ScreenRecording2026-07-29145438-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/68861572-f4f4-44d5-9009-1869dca76e6a" />

- Round-robin assignment: director can take users out of the pool, or move users up to adjust current pointer.
  <img width="800" height="337" alt="ScreenRecording2026-07-29145758-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/ddedb8d9-fd4e-44b2-9e14-e459fe7fb4e7" />

- When a new client is created, the client is auto-assigned to the user with the current pointer in the pool.
  
### Activity logging

- Per-client activity log with user attribution and change descriptions.
- Tracking for field updates, subitem creation, subitem deletion, and nested item changes.
- Internal audit trail design to show who changed what and when across client records.

### Auto-generate estimate in Quickbooks

- Generate Estimate workflow integrated with QuickBooks-oriented logic and external accounting considerations. Change 'Local/Overseas?' status to Oversas to apply Out of Scope tax, change to Local to apply SR 9% GST for the specific subitem.

### Auto-generate Order Confirmation Form, with editable web-form for staff and clients (client token link & internal link)

- Sales staff can generate a Order Confirmation Form with just a click, view a dedicated modal with editable field (estimated delivery), subitem images as attachments at the end of the form, internal page, and public client-facing signing/review flow.
  <br>
  <img width="471.5" height="402.5" alt="Screenshot 2026-07-28 162840" src="https://github.com/user-attachments/assets/c3fddeba-9c8f-4090-8547-bfd57a54df9e" />

- Order Confirmation Form flow designed with editable internal fields, public tokenized sharing, and client-side signature with submission.
  <br>
  <img width="400" height="363.5" alt="ScreenRecording2026-07-29143123-ezgif com-video-to-gif-converter (2)" src="https://github.com/user-attachments/assets/517e7d24-ced2-40af-b60f-a5f56ca5ba16" />

- After client submission, internal Order Confirmation Form page will be updated to include: client signed at (date & time), client submitted at (date & time) and client IP address.

- Order confirmation form configuration settings page only visible to director to edit 'Important Notes' section of form.

  <img width="800" height="418" alt="ScreenRecording2026-07-29151159-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/7f8dacc8-d433-434f-b4b6-afe12eed729b" />
  

### Shipper sites for Project Managers to oversee shipping progress & liaise with shippers

- Shipper-facing site/master-view for Project Managers: a table-based external workflow for selected subitem data (when Project Manager clicks 'Push' button for selected subitem, shipper site pulls subitem's corresponding name, quantity, unit price, value, tracking number).
  <br>
  <img width="800" height="379" alt="ScreenRecording2026-07-29141026-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/c2709dd0-55dd-404b-9581-a9d5d301af77" />

- Shipper site only shows relevant fields for specific shipper using token links to protect internal operational data.

### Gantt Chart view synced with subitem timeline for Project Managers (using [Bitnoise React Scheduler](https://github.com/Bitnoise/react-scheduler))
- Gantt chart syncs with subitem and its subprogress as well as its status (Awarded, Quoted, etc.)

  <img width="800" height="373" alt="ScreenRecording2026-07-29154535-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/143eb28d-35b4-4713-b92a-949c4e178afa" />
 


### Export CRM board to CSV 
- Only visible to Director for an easily accessible master-view of every client and their subitems

## Tech Stack

| Layer | Tools |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind-style utility classes, Lucide icons, Radix UI patterns, custom reusable row components |
| Backend | Supabase |
| Database | PostgreSQL via Supabase |
| Auth / access patterns | Supabase auth for internal users, tokenized access for selected external parties (client, supplier) |
| Integrations | QuickBooks |
