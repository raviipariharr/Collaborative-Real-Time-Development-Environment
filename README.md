# 🚀 CodeCollab — Collaborative Real-Time Development Environment

CodeCollab is a full-stack collaborative coding platform built for real-time teamwork. It enables multiple developers to write and manage code together with sub-50ms latency, fine-grained permissions, and integrated team communication — all inside the browser.
Why CodeCollab?
✅ Real-time collaboration - Multiple developers editing simultaneously
✅ Granular permissions - Control access at project, folder, and file levels
✅ Live team chat - Text and voice messaging with threading
✅ Professional code editor - Monaco Editor (VSCode's editor engine)
✅ Mobile responsive - Works on desktop, tablet, and mobile devices
✅ Secure authentication - Google OAuth 2.0 with JWT tokens

# ✨ Features
**🔥 Core Features**

**1. Real-Time Collaborative Editing**

Multiple users can edit the same file simultaneously
Sub-50ms synchronization latency via WebSocket (Socket.IO)
Live cursor tracking and user presence indicators
Automatic conflict resolution with debounced auto-save (3s intervals)
Manual save with Ctrl+S (Cmd+S on Mac)

**2. Advanced Permission System**

Three-tier permission hierarchy for precise access control:
Project-Level Roles:
👑 Owner: Full control, can delete project
🔑 Admin: Manage members, full file access
✏️ Editor: Can edit files (with permissions)
👁️ Viewer: Read-only access

Folder-Level Permissions:
Grant specific users edit/delete access to entire folders
Automatically applies to all nested files and subfolders
Override project-level role restrictions

File-Level Permissions:

Individual file access for precise control
Useful for sensitive configuration files
Highest priority in permission hierarchy

**3. Project & File Organization**

Hierarchical folder structure with unlimited nesting
Create, rename, delete files and folders
Right-click context menus for quick actions
File tree explorer with expand/collapse functionality
Support for multiple programming languages (JavaScript, Python, HTML, CSS, TypeScript, JSON, Markdown)

**4. Live Team Chat**

Real-time text messaging
🎤 Voice messaging: Record and send audio notes
📌 Pin messages: Highlight important conversations (Admin only)
💬 Reply threads: Keep conversations organized
🔔 Unread badges: Never miss a message
Message deletion (own messages or admin)
Persistent chat history

**5. Team Management**

Send email invitations to collaborate
View and manage team members
Change member roles dynamically
Remove members from projects
Accept/reject project invitations
Track invitation status (pending/accepted/rejected/expired)

**6. Professional Code Editor**

Monaco Editor (same as VSCode)
Syntax highlighting for 10+ languages
IntelliSense and autocomplete
Multi-cursor editing
Find and replace
Minimap navigation
Customizable themes (light/dark mode)

# 🛠️ Tech Stack
**Frontend**

React 18 - UI framework
TypeScript - Type-safe JavaScript
Monaco Editor - Code editor component
Socket.IO Client - Real-time communication
Axios - HTTP client
React Router - Navigation
Google OAuth - Authentication

**Backend**

Node.js - Runtime environment
Express.js - Web framework
TypeScript - Type safety
Socket.IO - WebSocket server
Prisma ORM - Database toolkit
PostgreSQL - Relational database
JWT - Token-based authentication
Google OAuth 2.0 - User authentication

**DevOps & Tools**

Docker - Containerization
Render - Backend hosting
Vercel - Frontend hosting
Git - Version control
ESLint & Prettier - Code quality

# 🚀 Installation

Prerequisites
Before you begin, ensure you have the following installed:

Node.js (v18 or higher) - Download
npm or yarn - Comes with Node.js
PostgreSQL (v14 or higher) - Download
Git - Download
Google Cloud Account - For OAuth credentials


**Step 1:** Clone the Repository

bashgit clone https://github.com/yourusername/codecollab.git
cd codecollab

**Step 2:** Setup Google OAuth

Go to Google Cloud Console
Create a new project or select existing
Enable Google+ API
Go to Credentials → Create Credentials → OAuth 2.0 Client ID
Configure OAuth consent screen
Add authorized redirect URIs:
http://localhost:3000 (development)
Your production URL (when deploying)
Copy Client ID and Client Secret

**Step 3**: Setup PostgreSQL Database

Option A: Local PostgreSQL
Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

 Create database
psql postgres
CREATE DATABASE codecollab;
Step 4: Backend Setup
bashcd backend

Install dependencies
npm install

Create .env file
cp .env.example .env
Run Prisma Migrations:
bashnpx prisma generate
npx prisma migrate dev --name init
Start Backend Server:
bash# Development mode (with hot reload)
npm run dev

 Production mode
npm run build
npm start

**Step 5:**
Frontend Setup
Open a new terminal window:
bashcd frontend

Install dependencies
npm install

Create .env file
cp .env.example .env
Edit frontend/.env:
env# Backend API URL
REACT_APP_API_BASE_URL=http://localhost:3001/api
REACT_APP_BACKEND_URL=http://localhost:3001

 Google OAuth Client ID (same as backend)
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
Start Frontend:
bashnpm start

**Step 6:** Verify Installation
Open browser: Navigate to http://localhost:3000
Login: Click "Sign in with Google"
Create project: Click "+ New Project"
Create file: Right-click in explorer → "New File"
Test real-time: Open same project in incognito window, edit file
Test chat: Send a message in the chat panel
