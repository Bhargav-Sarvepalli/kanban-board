<div align="center">

<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
<img src="https://img.shields.io/badge/Framer_Motion-Animations-FF0055?style=for-the-badge&logo=framer&logoColor=white" />
<img src="https://img.shields.io/badge/Three.js-3D-000000?style=for-the-badge&logo=three.js&logoColor=white" />

<br/><br/>

# NexTask — AI-Powered Kanban Board

**A full-stack task management platform with real-time collaboration, AI features, and a cinematic landing experience.**

[Live Demo](https://kanban-board-beige-seven.vercel.app) · [GitHub](https://github.com/Bhargav-Sarvepalli/kanban-board)

</div>

---

## Overview

NexTask is a production-grade Kanban board I built from scratch, combining modern frontend engineering with backend architecture. The goal was to go beyond a typical CRUD app — I wanted to build something that feels like a real product, with thoughtful UX, AI-powered workflows, and enterprise-level features like real-time collaboration and row-level security.

The project started as an internship assessment but grew into a full portfolio piece as I kept pushing the feature set further.

---

## Features

### Core Board
- **4-column Kanban** — To Do, In Progress, In Review, Done
- **Drag & drop** — built with `@dnd-kit/core` with pointer sensors and activation constraints to prevent accidental drags
- **Optimistic updates** — UI updates instantly before the database confirms, making interactions feel snappy
- **Search & filter** — real-time search across all tasks

### AI Features
- **AI description generator** — generates a detailed task description from just the title
- **AI priority suggestion** — analyzes the task title and recommends a priority level
- **AI subtask breakdown** — breaks complex tasks into actionable subtasks

### Task Management
- **2-step task creation modal** — clean UX with title/description on step 1, priority/status/date on step 2
- **Inline task editing** — click any task to open a detail panel with full editing
- **Due date management** — create and edit due dates with timezone-safe parsing
- **Recurring tasks** — set weekly or monthly repeats; completing one auto-creates the next
- **Priority system** — Low / Normal / High with color-coded borders and badges

### Calendar View
- **Monthly calendar** — visualize all tasks by due date
- **Day detail panel** — click any day to see tasks and their status
- **Month summary** — total, completed, and overdue stats per month
- **Timezone-safe dates** — custom date parsing to avoid off-by-one timezone issues

### Collaboration
- **Workspaces** — create named workspaces and invite team members by email
- **Real-time updates** — Supabase Realtime pushes task changes to all connected clients instantly
- **Personal + shared boards** — switch between your private board and shared workspaces

### Auth
- **Google OAuth** — one-click sign in with Google
- **Email/password** — traditional auth with signup/login flow
- **Protected routes** — `/app` redirects to `/auth` if not authenticated
- **Row Level Security** — Supabase RLS policies ensure users only access their own data

### Landing Page
- **3D hero** — Three.js scene with distorted orbs, particle field, and rotating rings that react to mouse movement
- **Smooth scroll** — Lenis-powered smooth scrolling
- **Scroll-driven animations** — product mockup rotates in 3D as you scroll down
- **Live product demo** — actual working board embedded inside a browser mockup on the landing page
- **Liquid cursor** — custom cursor that stretches and morphs based on velocity
- **Fully mobile responsive** — optimized for all screen sizes

---

## Tech Stack

| Category | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, Framer Motion, inline styles |
| **3D / Animation** | Three.js, @react-three/fiber, @react-three/drei |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, RLS) |
| **AI** | Anthropic API |
| **Drag & Drop** | @dnd-kit/core |
| **Routing** | React Router DOM v6 |
| **Dates** | date-fns |
| **Smooth Scroll** | Lenis |
| **Deployment** | Vercel |

---

## Architecture Decisions

**Optimistic UI for drag & drop**
Rather than waiting for the database to confirm a status change, I update the local state immediately and roll back only if the server returns an error. This makes the board feel instant.

**Timezone-safe date handling**
JavaScript's `new Date(dateString)` applies local timezone offsets, causing off-by-one errors when displaying dates. I wrote a custom parser that splits the ISO string manually: `const [y, m, d] = dateStr.split('-').map(Number)` to construct dates without timezone conversion.

**Row Level Security**
All database tables have RLS enabled. Policies are written directly in PostgreSQL to ensure data isolation at the database level — not just at the application layer.

**Real-time subscriptions**
Supabase Realtime channels are scoped per workspace or user to minimize unnecessary event processing. The subscription filters events client-side based on workspace membership.

**PKCE OAuth flow**
Google OAuth uses the PKCE (Proof Key for Code Exchange) flow via a dedicated `/auth/callback` route that exchanges the authorization code for a session, rather than relying on implicit token passing in URL fragments.

---

## Database Schema

```sql
-- Users managed by Supabase Auth

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('todo','in_progress','in_review','done')),
  priority TEXT CHECK (priority IN ('low','normal','high')),
  due_date DATE,
  recurring TEXT CHECK (recurring IN ('weekly','monthly')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace Members
CREATE TABLE workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase account
- An Anthropic API key

### Setup

```bash
# Clone the repo
git clone https://github.com/Bhargav-Sarvepalli/kanban-board.git
cd kanban-board

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Fill in your `.env`:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

```bash
# Run locally
npm run dev
```

### Supabase Setup
1. Create a new Supabase project
2. Run the SQL schema above in the SQL editor
3. Enable Row Level Security on all tables
4. Enable Google OAuth under Authentication → Providers
5. Add your redirect URLs under Authentication → URL Configuration

---

## Project Structure
src/
├── components/
│   ├── CalendarView.tsx      # Monthly calendar with task visualization
│   ├── Column.tsx            # Kanban column with drop zone
│   ├── ConfirmDialog.tsx     # Reusable confirmation modal
│   ├── CreateTaskModal.tsx   # 2-step task creation flow
│   ├── DemoBoard.tsx         # Live demo for landing page
│   ├── TaskCard.tsx          # Draggable task card
│   ├── TaskDetailPanel.tsx   # Side panel for task editing
│   └── WorkspacePanel.tsx    # Workspace management UI
├── lib/
│   └── ai.ts                 # AI feature integrations
├── pages/
│   ├── Auth.tsx              # Login / signup page
│   ├── AuthCallback.tsx      # OAuth callback handler
│   └── Landing.tsx           # Marketing landing page
├── types/
│   └── index.ts              # TypeScript types
├── App.tsx                   # Main board application
├── main.tsx                  # Router setup
└── supabase.ts               # Supabase client

---

## What I Learned

Building NexTask pushed me into areas I hadn't worked with deeply before:

- **WebGL / Three.js** — building the 3D landing page required learning the React Three Fiber ecosystem, shader materials, and how to animate 3D objects reactively based on mouse input
- **Real-time architecture** — designing Supabase Realtime subscriptions that scale correctly with workspaces required thinking carefully about channel scoping and event filtering
- **OAuth flows** — implementing PKCE-based Google OAuth across localhost and production taught me a lot about how auth redirects actually work
- **Database-level security** — writing RLS policies in PostgreSQL rather than handling auth in application code was a mindset shift that I think is the right approach for any multi-user app
- **Performance** — optimistic updates, proper React state management, and minimizing re-renders were all things I had to think about carefully as the feature set grew

---

## Roadmap

- [ ] Mobile drag & drop support
- [ ] Email notifications for due dates
- [ ] Task attachments
- [ ] Activity log per workspace
- [ ] Keyboard shortcuts (N for new task, Escape to close)
- [ ] Dark / light theme toggle

---

<div align="center">

Built by [Sree Sai Bhargav Sarvepalli](https://bhargav.tech)

</div>