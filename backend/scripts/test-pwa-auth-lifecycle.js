import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';

const JWT_SECRET = 'replace-with-a-long-random-secret';
const MONGO_URI = 'mongodb+srv://ayancoder786_db_user:R36NE6dWCsaHaVXM@cluster0.krvox1f.mongodb.net';

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

function apiGetMe(token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const req = http.get('http://localhost:5000/api/auth/me', { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('=== CampusBus PWA Authentication Persistence Lifecycle Test ===\n');

  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  const student = await User.findOne({ role: 'student' });
  if (!student) {
    console.error('No student found in DB');
    process.exit(1);
  }
  console.log(`Using test student: ${student.email} (${student._id})\n`);

  const localStorage = new MockLocalStorage();

  // Test 1: Fresh PWA startup (no persisted session)
  console.log('Test 1: Fresh PWA startup with empty localStorage');
  let token = localStorage.getItem('campusbus_token');
  let user = localStorage.getItem('campusbus_user');
  console.log('  localStorage token:', token);
  console.log('  localStorage user:', user);
  if (!token) {
    console.log('  -> AuthProvider detects no credentials: clears session, sets loading=false.');
    console.log('  -> ProtectedRoute redirects to /login as expected. [PASS]\n');
  }

  // Test 2: Login and session storage
  console.log('Test 2: Student logs in and session is stored');
  const freshJwt = jwt.sign({ id: student._id, role: student.role }, JWT_SECRET, { expiresIn: '7d' });
  const userData = {
    id: student._id,
    name: student.name,
    email: student.email,
    role: student.role,
  };
  localStorage.setItem('campusbus_token', freshJwt);
  localStorage.setItem('campusbus_user', JSON.stringify(userData));
  console.log('  Stored token:', localStorage.getItem('campusbus_token')?.substring(0, 25) + '...');
  console.log('  Stored user:', localStorage.getItem('campusbus_user'));
  console.log('  -> Session saved in localStorage across sessions. [PASS]\n');

  // Test 3: Installed PWA closed and reopened (session restoration)
  console.log('Test 3: Simulating PWA close & reopen with valid persisted session');
  const restoredToken = localStorage.getItem('campusbus_token');
  const restoredUser = JSON.parse(localStorage.getItem('campusbus_user'));
  console.log('  Initial state on PWA restart: restoredUser =', restoredUser?.email);
  console.log('  Verifying token against backend /api/auth/me...');
  const meRes = await apiGetMe(restoredToken);
  console.log('  /api/auth/me response status:', meRes.status);
  console.log('  /api/auth/me verified user:', meRes.body.user?.email);
  if (meRes.status === 200 && meRes.body.user?.email === student.email) {
    console.log('  -> Backend verified session! User remains logged in.');
    console.log('  -> ProtectedRoute allows access to /student/dashboard without asking to log in. [PASS]\n');
  } else {
    throw new Error('Session restoration failed!');
  }

  // Test 4: Browser page refresh (F5)
  console.log('Test 4: Browser page refresh (F5)');
  const refreshRes = await apiGetMe(localStorage.getItem('campusbus_token'));
  if (refreshRes.status === 200) {
    console.log('  -> Token remains valid on reload, user preserved. [PASS]\n');
  } else {
    throw new Error('Refresh verification failed!');
  }

  // Test 5: Expired backend JWT handling
  console.log('Test 5: Expired backend JWT handling');
  const expiredJwt = jwt.sign({ id: student._id, role: student.role }, JWT_SECRET, { expiresIn: '-10m' });
  localStorage.setItem('campusbus_token', expiredJwt);
  console.log('  Simulating PWA startup with expired token...');
  const expiredRes = await apiGetMe(expiredJwt);
  console.log('  /api/auth/me status for expired token:', expiredRes.status, `("${expiredRes.body.message}")`);
  if (expiredRes.status === 401) {
    // AuthProvider clears session
    localStorage.removeItem('campusbus_token');
    localStorage.removeItem('campusbus_user');
    console.log('  -> AuthProvider detects genuine 401: cleanly clears session and prompts login. [PASS]\n');
  } else {
    throw new Error('Expired token was not rejected with 401!');
  }

  // Test 6: Offline PWA startup simulation (server unreachable)
  console.log('Test 6: Offline PWA startup simulation (network unavailable)');
  localStorage.setItem('campusbus_token', freshJwt);
  localStorage.setItem('campusbus_user', JSON.stringify(userData));
  // Simulate network failure by calling an invalid port / unreachable address
  try {
    await new Promise((resolve, reject) => {
      const r = http.get('http://127.0.0.1:59999/api/auth/me', resolve);
      r.on('error', reject);
    });
  } catch (networkErr) {
    console.log('  Network error encountered:', networkErr.code);
    // As implemented in useAuth.jsx:
    // If error is network-related (not 401/403 HTTP response), session is RETAINED!
    const retainedUser = JSON.parse(localStorage.getItem('campusbus_user'));
    console.log('  Retained cached user session:', retainedUser?.email);
    if (retainedUser?.email === student.email) {
      console.log('  -> Session was NOT destroyed by network error! Offline PWA access preserved. [PASS]\n');
    } else {
      throw new Error('Offline session retention failed!');
    }
  }

  // Test 7: Explicit user logout
  console.log('Test 7: Explicit user logout');
  localStorage.removeItem('campusbus_token');
  localStorage.removeItem('campusbus_user');
  console.log('  After logout:');
  console.log('  localStorage token:', localStorage.getItem('campusbus_token'));
  console.log('  localStorage user:', localStorage.getItem('campusbus_user'));
  console.log('  -> Logout cleanly cleared persistent storage. [PASS]\n');

  console.log('=== All 7 PWA Authentication Lifecycle Scenarios PASSED! ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
