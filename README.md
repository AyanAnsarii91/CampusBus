# CampusBus

**Know where your bus is. Know when it arrives.**

CampusBus is a production-oriented real-time college bus tracking system built with React + Vite on the frontend and Node.js + Express + MongoDB + Socket.IO on the backend.

## Features

- JWT authentication with student, driver, and admin roles
- Real-time GPS streaming through Socket.IO
- Server-side GPS validation and driver-to-bus authorization
- Leaflet + OpenStreetMap live maps
- Ordered routes and bus stops
- Rolling-speed ETA fallback with approximate minute display
- Stale/offline handling
- Browser arrival notifications with de-duplication
- Driver `watchPosition()` tracking
- Admin fleet, route, stop, user and trip views
- Complete admin driver lifecycle and existing-bus assignment
- Safe one-time admin account provisioning
- Development GPS simulator
- Helmet, CORS, rate limiting, compression and environment-based configuration
- Responsive mobile-first UI

## Project structure

```text
campusbus/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── backend/
    ├── config/
    ├── controllers/
  ├── create-admin.js
    ├── middleware/
    ├── models/
    ├── routes/
    ├── services/
    ├── sockets/
    ├── server.js
    ├── seed.js
    └── package.json
```

## Requirements

- Node.js 20+
- MongoDB 7+ (local or hosted)
- Modern browser with Geolocation API support for driver devices

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set `MONGO_URI` and `JWT_SECRET` in `.env` before starting the backend. Use `npm run seed` only when you intentionally want to reset a disposable demo database.

> **Warning:** `npm run seed` deletes and recreates users, buses, routes, stops, and trips. Use it only when intentionally resetting a demo database. Do not use it to create drivers in a database with data you want to keep.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

For local development, copy `frontend/.env.example` to `frontend/.env`. The frontend also automatically defaults to the localhost backend on localhost and the Render backend on deployed hosts.

Frontend environment variables:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

For the Render frontend service, set these build-time environment variables in Render and redeploy:

```env
VITE_API_URL=https://campusbus-1czm.onrender.com/api
VITE_SOCKET_URL=https://campusbus-1czm.onrender.com
```

For the Render backend service, set `CLIENT_URL`, `CORS_ORIGINS`, and `SOCKET_IO_ORIGINS` to include the production frontend and local development origins. Set `MONGO_URI` and `JWT_SECRET` directly in Render's environment settings; never put real values in `.env.example` or commit a `.env` file. `backend/.env.example` contains safe local placeholders and documents the allowed origins.

## Demo accounts (after seed)

All demo passwords are `password123`.

| Role | Email |
|---|---|
| Admin | `admin@campusbus.demo` |
| Driver | `driver@campusbus.demo` |
| Student | `student@campusbus.demo` |

## Safe admin setup

If the database has no active admin account, provision the first one from `backend` without clearing any existing records. In PowerShell, set the account name and email, enter the password at the secure prompt, then run the command:

```powershell
$env:ADMIN_NAME = "CampusBus Admin"
$env:ADMIN_EMAIL = "admin@example.edu"
$securePassword = Read-Host "Initial admin password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run admin:create
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The password must be at least 12 characters. The command hashes it with bcrypt and creates an account only when no active admin exists; otherwise, it reports that no changes were made. It never modifies or deletes users, buses, routes, stops, or trips. It does not reset an existing admin password.

## End-to-end test

1. Start MongoDB.
2. Run `npm run seed` in `backend`.
3. Start backend on port 5000.
4. Start frontend on port 5173.
5. Open two browser windows.
6. Log into one as the demo student.
7. Log into the other as the demo driver.
8. Driver: open **Trip**, press **START TRIP**, and grant GPS permission.
9. Student: open **Dashboard**. The bus marker and ETA update through Socket.IO without page refresh.
10. For development without GPS, use **Admin → Simulator**. The simulator moves the selected bus along its configured stops.

## Manage drivers

Sign in as an admin and open **Drivers** (`/admin/drivers`). The page shows account status, assigned bus and route, current trip, and last activity. **Add Driver** creates a driver with a name, email, password (at least 8 characters), and optional phone number. Admins can edit details, activate or deactivate an account, reset its password, and delete it only when inactive, unassigned, and without trip history. Passwords are hashed with bcrypt; password hashes are never returned.

Assign a driver to an existing bus from the Drivers or Buses page. A driver can be assigned to only one bus; unassign them before moving them to another. The driver signs in with the credentials set by the admin, opens **Trip** (`/driver/trip`), allows browser location access, and presses **START TRIP**. Students tracking that bus receive its location through Socket.IO. Deactivated drivers cannot sign in or send GPS updates, and accounts with an active trip cannot be deactivated. Deletion requires an inactive, unassigned driver with no trip history; otherwise, deactivate the account to preserve records.

Driver creation is available through the admin-only API:

```http
POST /api/users/drivers
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "Asha Driver",
  "email": "asha@example.com",
  "password": "a-strong-password",
  "phone": "+91 98765 43210"
}
```

The `phone` field is optional. A successful request returns `201` with the new driver's public profile (ID, name, email, role, phone, and creation time); it does not include the password or password hash. Validation errors return `400`, duplicate email returns `409`, and authentication/authorization failures return `401` or `403`.

## API

Authentication:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Buses:
- `GET /api/buses`
- `GET /api/buses/:id`
- `POST /api/buses`
- `PUT /api/buses/:id`
- `DELETE /api/buses/:id`
- `GET /api/buses/:id/location`

Routes:
- `GET /api/routes`
- `GET /api/routes/:id`
- `POST /api/routes`
- `PUT /api/routes/:id`
- `DELETE /api/routes/:id`

Stops:
- `GET /api/stops`
- `POST /api/stops`
- `PUT /api/stops/:id`
- `DELETE /api/stops/:id`

Trips:
- `POST /api/trips/start`
- `POST /api/trips/stop`
- `GET /api/trips/active`
- `GET /api/trips/:id`

Users:
- `GET /api/users?role=student|driver|admin` (admin only)
- `GET /api/users/drivers` (admin only; driver status, bus, route, current trip, and activity)
- `POST /api/users/drivers` (admin only; creates a driver account)
- `PATCH /api/users/drivers/:id` (admin only; edit name, email, or phone)
- `PATCH /api/users/drivers/:id/status` (admin only; `{ "isActive": false }` deactivates)
- `PATCH /api/users/drivers/:id/password` (admin only; `{ "password": "new-password" }`)
- `DELETE /api/users/drivers/:id` (admin only; only inactive, unassigned drivers without trip history)

All driver-management endpoints require a valid admin JWT. Password values must be at least 8 characters; password hashes are never serialized to API responses.

Driver-to-bus assignment:
- `PUT /api/buses/:id/driver` (admin only; `{ "driverId": "DRIVER_ID" }`; pass `null` to unassign)

Development simulator:
- `POST /api/simulator/start` (admin only)
- `POST /api/simulator/stop` (admin only)

## Socket.IO contract

Driver sends `driver:location`:

```json
{
  "busId":"BUS_ID",
  "tripId":"TRIP_ID",
  "latitude":22.7196,
  "longitude":75.8577,
  "speed":32,
  "heading":120,
  "timestamp":"2026-10-06T10:30:00Z",
  "accuracy":8
}
```

Students emit `student:track-bus` with `{ "busId": "..." }` and receive `bus:location` events.

The development simulator uses `simulator:location` and is accepted only from authenticated admins.

## ETA behavior

ETA uses the current GPS point, ordered stop geometry, and a rolling average of recent speeds. If recent speed samples are unavailable, it uses a 30 km/h fallback. ETA is intentionally rounded to whole minutes and displayed as `~8 min` rather than fake second-level precision.

For a future production deployment, replace the straight-line distance fallback with a routing/traffic provider or precomputed road-network distances, and move live location state to Redis when horizontal scaling requires it.

## Production checklist

- Use HTTPS/WSS.
- Set a strong random `JWT_SECRET`.
- Restrict `CLIENT_URL` to the deployed frontend origin.
- Use a managed MongoDB deployment with backups.
- Put Socket.IO behind a load balancer and add the Redis adapter when running multiple backend instances.
- Add persistent notification preferences and a service worker if native push notifications are required.
- Add audit logging for admin actions.
- Add stricter schema validation (for example Zod/Joi) if the API surface expands.
- Configure monitoring and alerting for GPS staleness, socket errors and API latency.
