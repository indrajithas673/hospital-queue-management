<div align="center">

# 🏥 MediQueue
### Smart Hospital Queue Management System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6-black?style=flat-square&logo=socket.io)](https://socket.io)
[![JWT](https://img.shields.io/badge/JWT-Auth-orange?style=flat-square)](https://jwt.io)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

A production-grade real-time hospital queue management system with 3-level priority queuing, multi-department booking, pause & resume mechanics, and a comprehensive security layer.

**[Live Demo](#)** · **[Demo Video](#)** · **[Report Bug](#)**

</div>

---

## 📊 Load Test Results

Tested with Apache JMeter:

| Metric | Result |
|--------|--------|
| Concurrent Users | **500** |
| Error Rate | **0%** |
| Avg Response Time | **6ms** |
| Max Response Time | **30ms** |
| Throughput | **8.3 req/sec** |

---

## ✨ Features

### Core Queue Engine
- **3-Level Priority System** — P1 Emergency → P2 Priority → P3 Normal (FIFO within each bucket)
- **State Machine** — `WAITING → IN_CONSULTATION → DONE / NO_SHOW / CANCELLED`
- **ON_HOLD State** — pause and resume without losing position
- **Auto Token Generation** — format: `GEN-001`, `CAR-002` per department per day
- **Dynamic Wait Time** — calculated from doctor's last 20 real consultations

### Pause & Resume — ON_HOLD System
- **Multi-department conflict resolution** — patient books General + Cardiology simultaneously. When called IN_CONSULTATION in General → Cardiology automatically goes ON_HOLD. Position preserved. When done in General → Cardiology auto-resumes
- **Skip & Return** — doctor skips absent patient → patient goes ON_HOLD → queue continues → patient clicks "I'm back" → doctor gets real-time 🔔 notification
- **Patient Step Away** — patient proactively pauses own position (top 3 only, max 2 uses, 15 min window)
- **Position preservation** — ON_HOLD never modifies `createdAt` so original position is restored exactly on resume

### Real-Time (Socket.io)
- Live queue updates per department room
- Emergency broadcast to all waiting patients when P1 arrives
- Doctor availability sync across dashboards
- ON_HOLD / resume notifications
- Patient returned notifications
- Step away expiry notifications
- Priority escalation alerts
- PII stripped from all socket broadcasts (Attack 18)

### Patient Features
- Multi-department booking — one active appointment per department simultaneously
- Department busy indicator — colour-coded load on selection
- Auto-assign to least busy doctor (load balancing)
- QR code for tracking link
- Share tracking link (clipboard)
- Public token tracking `/track/:token` — no login required
- Estimated completion time — "Your Turn: 2:45 PM"
- Star rating after consultation
- Cancel with custom confirm dialog
- Step Away button (top 3 only, 2 uses max, 15 min window)
- I'm back button — API-backed with 5 min cooldown, 2 min minimum hold

### Doctor Features
- Live priority queue with P1/P2/P3 colour coding
- Consultation timer — warns red after 10 minutes
- ⏭ Skip button — patient goes ON_HOLD, queue continues immediately
- ▶ Call Back — resumes ON_HOLD patient
- 🔔 Patient is back! badge — real-time notification when patient returns
- Separate ON_HOLD section showing reason (skipped vs in consultation elsewhere)
- Doctor notes on current patient
- Availability toggle — auto-reassigns patients
- Today's history tab

### Admin Features
- Department overview — live P1/P2/P3 counts per department
- 📺 Waiting room display link per department
- Analytics dashboard:
  - Summary stats (total, done, waiting, avg rating, emergencies)
  - Doctor load cards with progress bars
  - Average wait time by department (colour coded)
  - Doctor ratings (App Store style distribution bars)
  - Peak hours chart (busiest hour highlighted)
  - **🚨 NO_SHOW Rate Monitor** — flags doctors above 30% for collusion detection
- Create doctor and patient accounts
- Toggle doctor availability → auto-reassigns WAITING patients to least busy doctor
- Manual patient reassign (fallback)

### Background / Smart Features
- **Auto-escalation** — P3 patients waiting > 60 min auto-upgraded to P2 (only if `notifiedAt3 = true` — prevents abuse by patients who left)
- **Midnight reset** — cancels stale appointments at 00:00 IST
- **Step-away expiry** — after 15 min → moved to back of priority bucket (not No Show)
- **Notification retry** — email/SMS retries 3× with exponential backoff (1s → 2s → 4s)
- **Rate limiting** — IP-based for public routes, user ID-based for authenticated routes

---

## 🔒 Security

13 attack vectors identified and mitigated:

| Attack | Fix |
|--------|-----|
| Book early, go home + Step Away | Step Away top 3 only, 15 min max window |
| Multiple accounts same phone | One appointment per phone per dept per day |
| Cancel and re-register | 10 min cooldown after cancellation |
| False P1 Emergency | Patient cannot select P1 — doctor/admin only |
| I'm back spam | DB-level 5 min cooldown via `patientNotifiedReturnAt` |
| Re-register after NO_SHOW | Blocked same dept same day |
| Step Away just before turn | 2 min minimum hold before I'm back |
| Doctor collusion | NO_SHOW rate monitor — flags >30% |
| Appointment flooding | Max 50 active per doctor per day |
| Auto-escalation abuse | Only escalates if `notifiedAt3 = true` |
| Socket room hijacking | `sanitizeQueueForBroadcast` strips all PII |
| Multi-dept Step Away abuse | One Step Away at a time across all appointments |
| Admin brute force | 5 attempts → 15 min account lock |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 18 |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Auth | JWT + bcryptjs |
| Email | NodeMailer (Gmail SMTP) |
| SMS | Twilio |
| Scheduler | node-cron |
| Rate Limiting | express-rate-limit |
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| HTTP Client | Axios |

---

## 📁 Project Structure

hospital-queue/
├── docker-compose.yml
├── README.md
│
├── backend/
│   ├── server.js                      ← Express + Socket.io entry point
│   ├── seed.js                        ← Full demo data — all features covered
│   ├── package.json
│   ├── Dockerfile
│   ├── .env.example
│   │
│   ├── config/
│   │   └── db.js                      ← MongoDB connection
│   │
│   ├── middleware/
│   │   └── auth.js                    ← JWT protect + role authorize
│   │
│   ├── models/
│   │   ├── User.js                    ← Brute force protection (loginAttempts, lockUntil)
│   │   └── Appointment.js             ← State machine + ON_HOLD + stepAwayCount + patientNotifiedReturnAt
│   │
│   ├── controllers/
│   │   ├── authController.js          ← Login with brute force lockout (5 attempts → 15 min lock)
│   │   ├── appointmentController.js   ← Queue ops, state machine, security checks, pause, notify-return
│   │   ├── analyticsController.js     ← Wait time, peak hours, doctor load, ratings, NO_SHOW monitor
│   │   └── adminController.js         ← Doctor/patient management, auto-reassign
│   │
│   ├── services/
│   │   ├── queueEngine.js             ← 3-bucket priority sort, bulkWrite, ON_HOLD, sanitizeQueueForBroadcast
│   │   ├── notificationService.js     ← Email + SMS with 3x exponential backoff retry
│   │   └── schedulerService.js        ← Midnight reset, auto-escalation, step-away expiry
│   │
│   └── routes/
│       ├── authRoutes.js
│       ├── appointmentRoutes.js       ← /register /emergency /auto-assign /my /queue/:dept
│       │                                 /track/:token /:id/status /:id/cancel /:id/rate
│       │                                 /:id/notes /:id/pause /:id/notify-return
│       ├── analyticsRoutes.js         ← /wait-time /peak-hours /doctor-load
│       │                                 /department-summary /doctor-ratings /noshow-rate
│       └── adminRoutes.js             ← /doctors /patients /doctors/:id/availability
│                                         /doctors/my-availability /doctors/by-department/:dept
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── Dockerfile
    ├── nginx.conf
    ├── .env.example
    │
    └── src/
        ├── index.jsx                  ← React entry point
        ├── App.jsx                    ← Routes + protected routes + 404 catch-all
        │
        ├── context/
        │   └── AuthContext.jsx        ← Global auth state, login/logout/register
        │
        ├── utils/
        │   ├── api.js                 ← Axios instance with JWT auto-attach
        │   ├── socket.js              ← Shared Socket.io instance
        │   └── validate.js            ← Frontend form validation (all forms)
        │
        ├── components/
        │   ├── Navbar.jsx             ← Role-coloured badge, MediQueue logo
        │   └── ProtectedRoute.jsx     ← Role-based route guard
        │
        └── pages/
            ├── Login.jsx              ← Split layout, demo credentials
            ├── Register.jsx           ← Split layout, visual role selector
            ├── PatientDashboard.jsx   ← Queue position, multi-dept booking, Step Away,
            │                             I'm back, QR code, share link, ON_HOLD display
            ├── DoctorDashboard.jsx    ← Priority queue, consultation timer, Skip button,
            │                             Call Back, 🔔 patient returned badge, ON_HOLD section
            ├── AdminPanel.jsx         ← Overview, analytics, NO_SHOW monitor,
            │                             doctor management, auto-reassign
            ├── TrackToken.jsx         ← Public token tracking (no login)
            ├── WaitingRoomDisplay.jsx ← TV waiting room board (/display/:department)
            └── NotFound.jsx           ← 404 page with Go Back + Dashboard buttons
---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### Installation
```bash
git clone https://github.com/yourusername/hospital-queue-management.git
cd hospital-queue-management

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### Environment Setup
```bash
# Backend
cd backend
cp .env.example .env
# Fill in MongoDB URI, JWT secret, Gmail and Twilio credentials

# Frontend
cd ../frontend
cp .env.example .env
# Set VITE_API_URL and VITE_SOCKET_URL
```

### Seed Demo Data
```bash
cd backend
node seed.js
```

### Run
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hospital.com | admin123 |
| Doctor (General) | ramesh@hospital.com | doctor123 |
| Doctor (Cardiology) | arjun@hospital.com | doctor123 |
| Doctor (Neurology) | sunita@hospital.com | doctor123 |
| Patient | meena@example.com | patient123 |
| Patient | ravi@example.com | patient123 |

**What each demo patient shows:**
- `meena@example.com` — WAITING in General + Cardiology (multi-dept demo)
- `ravi@example.com` — IN_CONSULTATION in General + ON_HOLD in Neurology (pre-seeded ON_HOLD)

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Private |

### Appointments
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/appointments/register` | Patient |
| POST | `/api/appointments/emergency` | Doctor/Admin |
| POST | `/api/appointments/auto-assign` | Patient |
| GET | `/api/appointments/my` | Patient |
| GET | `/api/appointments/queue/:department` | Doctor/Admin |
| GET | `/api/appointments/track/:token` | **Public** |
| PATCH | `/api/appointments/:id/status` | Doctor |
| PATCH | `/api/appointments/:id/cancel` | Patient |
| POST | `/api/appointments/:id/rate` | Patient |
| PATCH | `/api/appointments/:id/notes` | Doctor |
| PATCH | `/api/appointments/:id/pause` | Patient |
| POST | `/api/appointments/:id/notify-return` | Patient |

### Analytics
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/analytics/wait-time` | Admin |
| GET | `/api/analytics/peak-hours` | Admin |
| GET | `/api/analytics/doctor-load` | Admin |
| GET | `/api/analytics/department-summary` | Admin |
| GET | `/api/analytics/doctor-ratings` | Admin |
| GET | `/api/analytics/noshow-rate` | Admin |

### Admin
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/admin/doctors` | Admin |
| POST | `/api/admin/patients` | Admin |
| GET | `/api/admin/doctors` | Admin |
| GET | `/api/admin/patients` | Admin |
| PATCH | `/api/admin/doctors/:id/availability` | Admin |
| PATCH | `/api/admin/doctors/my-availability` | Doctor |

---

## 🏗️ Architecture Decisions

| Decision | Reason |
|----------|--------|
| MongoDB | Document model fits queue data. `sort({ priority, createdAt })` gives 3-bucket priority in 1 query |
| Socket.io | Persistent connection. Per-department rooms for targeted broadcasts. PII stripped before broadcast |
| JWT | Stateless auth. No server-side session storage |
| ON_HOLD via `createdAt` preservation | Never modifying `createdAt` means sort naturally restores exact original position on resume |
| bulkWrite for positions | Single atomic DB call updates all positions — no N+1 queries |
| User ID rate limiting | Multiple patients on same hospital WiFi share IP — unfair to use IP limiting for auth routes |
| Exponential backoff | Transient notification failures don't lose alerts |
| `notifiedAt3` guard on escalation | Prevents patients who booked early and left from getting auto-upgraded to P2 |
| `sanitizeQueueForBroadcast` | Anyone can join a Socket.io room — never broadcast patient names/phones/emails |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built by Indrajith AS · B.E. Information Science · CMR Institute of Technology, Bengaluru
</div>
