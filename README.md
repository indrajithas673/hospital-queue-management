<div align="center">

# 🏥 MediQueue
### Smart Hospital Queue Management System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?style=flat-square&logo=react)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.6-black?style=flat-square&logo=socket.io)](https://socket.io)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

A real-time hospital queue management system with 3-level priority queuing, live position tracking, and analytics dashboard.

**[Live Demo](#)** · **[Demo Video](#)** · **[Report Bug](#)**

</div>

---

## 📊 Performance

| Metric | Result |
|--------|--------|
| Concurrent Users | **500** |
| Error Rate | **0%** |
| Avg Response Time | **6ms** |
| Max Response Time | **30ms** |
| Throughput | **8.3 req/sec** |
| Load Test Tool | Apache JMeter |

---

## ✨ Features

### Core Queue Engine
- **3-Level Priority System** — P1 Emergency → P2 Priority → P3 Normal (FIFO)
- **State Machine** — `WAITING → IN_CONSULTATION → DONE / NO_SHOW / CANCELLED`
- **Auto Token Generation** — Format: `GEN-0402-001` (dept + date + sequence)
- **Dynamic Wait Time** — Calculated from doctor's last 20 real consultations

### Real-Time (Socket.io)
- Live queue position updates without page refresh
- Emergency broadcast — all waiting patients alerted when P1 arrives
- Doctor availability sync across admin and doctor dashboards
- Priority escalation notifications
- Waiting room TV display updates instantly

### Patient Features
- Department busy indicator — colour-coded load on selection
- Auto-assign to least busy doctor (load balancing)
- QR code for tracking link
- Share tracking link with family
- Public token tracking at `/track/:token` — no login required
- Estimated completion time — shows "Your Turn: 2:45 PM"
- Star rating after consultation
- Cancel appointment with custom confirm dialog

### Doctor Features
- Live priority queue with P1/P2/P3 colour coding
- Consultation timer — warns red after 10 minutes
- Doctor notes on current patient (visible to admin only)
- Availability toggle — auto-reassigns patients when going unavailable
- Today's history tab with ratings indicator

### Admin Features
- Department overview — P1/P2/P3 bucket counts per department, live
- 📺 Open Display link per department → waiting room TV board
- Analytics dashboard:
  - Summary stats (total patients, done, waiting, avg rating, emergencies)
  - Doctor load cards with progress bars
  - Wait time by department (colour coded)
  - Doctor ratings with App Store style distribution bars
  - Peak hours chart with busiest hour highlighted
- Create doctor and patient accounts
- Toggle doctor availability (triggers auto-reassign)
- Manual patient reassign (fallback if needed)

### Smart Background Features
- **Auto-escalation** — P3 patients waiting > 60 min auto-upgraded to P2
- **Midnight reset** — stale appointments auto-cancelled at 00:00 IST
- **Auto-reassign** — doctor goes unavailable → patients auto-moved to least busy doctor
- **Retry logic** — email/SMS retries 3x with exponential backoff (1s → 2s → 4s)
- **Rate limiting** — IP-based for public routes, user ID-based for authenticated routes

### Notifications
- Email via NodeMailer — HTML templates — at position 3 and position 1
- SMS via Twilio — at position 3 and position 1

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
| Fonts | Inter (Google Fonts) |

---

## 📁 Project Structure

```
hospital-queue/
├── backend/
│   ├── server.js                    ← Express + Socket.io entry point
│   ├── seed.js                      ← Demo data seeder
│   ├── config/db.js                 ← MongoDB connection + .env validation
│   ├── models/
│   │   ├── User.js                  ← Patient / Doctor / Admin schema
│   │   └── Appointment.js           ← State machine + priority + auto token
│   ├── middleware/auth.js           ← JWT protect + role authorize
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── appointmentController.js ← Queue ops, state machine, load balancing
│   │   ├── analyticsController.js   ← Computed metrics, ratings, peak hours
│   │   └── adminController.js       ← Doctor/patient management + auto-reassign
│   ├── services/
│   │   ├── queueEngine.js           ← 3-bucket priority sort + bulkWrite
│   │   ├── notificationService.js   ← Email + SMS with retry logic
│   │   └── schedulerService.js      ← Midnight reset + auto-escalation
│   └── routes/
│       ├── authRoutes.js
│       ├── appointmentRoutes.js
│       ├── analyticsRoutes.js
│       └── adminRoutes.js
└── frontend/
    └── src/
        ├── context/AuthContext.jsx
        ├── utils/
        │   ├── api.js               ← Axios + JWT auto-attach
        │   ├── socket.js            ← Shared Socket.io instance
        │   └── validate.js          ← Frontend form validation
        ├── components/
        │   ├── Navbar.jsx
        │   └── ProtectedRoute.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── PatientDashboard.jsx
            ├── DoctorDashboard.jsx
            ├── AdminPanel.jsx
            ├── TrackToken.jsx       ← Public token tracking
            ├── WaitingRoomDisplay.jsx ← TV waiting room board
            └── NotFound.jsx
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/hospital-queue.git
cd hospital-queue

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Environment Setup

```bash
# Backend
cd backend
cp .env.example .env
# Fill in your MongoDB URI, JWT secret, Gmail and Twilio credentials

# Frontend
cd frontend
cp .env.example .env
# Set VITE_API_URL and VITE_SOCKET_URL
```

### Seed Demo Data

```bash
cd backend
node seed.js
```

This creates:
- Admin: `admin@hospital.com` / `admin123`
- 6 Doctors (one per department): `ramesh@hospital.com` / `doctor123`
- 6 Patients: `anil@example.com` / `patient123`
- 12 sample appointments

### Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173`

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Private |

### Appointments (19 endpoints)
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/appointments/register` | Patient |
| POST | `/api/appointments/emergency` | Doctor/Admin |
| POST | `/api/appointments/auto-assign` | Patient |
| POST | `/api/appointments/reassign` | Admin |
| GET | `/api/appointments/my` | Patient |
| GET | `/api/appointments/history` | Doctor |
| GET | `/api/appointments/queue/:department` | Doctor/Admin |
| GET | `/api/appointments/track/:token` | **Public** |
| GET | `/api/appointments/:id/position` | Private |
| PATCH | `/api/appointments/:id/status` | Doctor |
| PATCH | `/api/appointments/:id/cancel` | Patient |
| POST | `/api/appointments/:id/rate` | Patient |
| PATCH | `/api/appointments/:id/notes` | Doctor |

### Analytics
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/analytics/wait-time` | Admin |
| GET | `/api/analytics/peak-hours` | Admin |
| GET | `/api/analytics/doctor-load` | Admin |
| GET | `/api/analytics/department-summary` | Admin |
| GET | `/api/analytics/doctor-ratings` | Admin |

### Admin
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/admin/doctors` | Admin |
| POST | `/api/admin/patients` | Admin |
| GET | `/api/admin/doctors` | Admin |
| GET | `/api/admin/patients` | Admin |
| PATCH | `/api/admin/doctors/:id/availability` | Admin |
| PATCH | `/api/admin/doctors/my-availability` | Doctor |
| GET | `/api/admin/doctors/by-department/:dept` | Private |

---

## 🏗️ Architecture Decisions

| Decision | Reason |
|----------|--------|
| MongoDB over MySQL | Document model fits queue data. Sort index on `{priority, createdAt}` gives priority queue in 1 query |
| Socket.io over polling | Persistent connection. Zero polling overhead. Per-department rooms for targeted broadcasts |
| JWT over sessions | Stateless. No server-side session storage. Works across multiple instances |
| User ID rate limiting | Multiple patients on same hospital WiFi share IP — unfair to use IP limiting |
| bulkWrite for positions | Single atomic DB call updates all positions. No N+1 queries |
| Dynamic wait time | Calculated from doctor's last 20 real consultations — not hardcoded |
| Exponential backoff | Transient notification failures don't lose alerts or crash queue |
| Auto-reassign | Doctor goes unavailable → patients immediately reassigned — no manual admin action needed |

---

## 🧪 Load Testing

Tested with Apache JMeter:
- **500 concurrent users**, 60-second ramp-up
- **0% error rate**
- **6ms average response time**
- **30ms max response time**
- **8.3 requests/second throughput**

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built by Indrajith AS · B.E. Information Science · CMR Institute of Technology, Bengaluru
</div>
