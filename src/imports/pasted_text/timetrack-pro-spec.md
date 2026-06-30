🧠 SYSTEM PROMPT: HIGH-ACCURACY GPS + BIOMETRIC + ADMIN-GEOFENCE ATTENDANCE SYSTEM (TimeTrack Pro)

Act as an expert in GPS tracking systems, location intelligence engineering, and enterprise attendance security architecture.

Design and implement a production-ready Employee Attendance Management System called TimeTrack Pro with high-accuracy GPS verification, biometric authentication, and admin-controlled geofencing.

🧭 SYSTEM OVERVIEW

TimeTrack Pro is a web-based Employee Attendance Management System designed to handle:

Attendance recording
Employee management
Overtime computation
Payroll preparation
Administrative reporting
Secure authentication

The system uses:

🔐 Authentication Layer
WebAuthn biometric authentication
Windows Hello PIN / Fingerprint
Touch ID (Mac)
Android Biometrics
Face ID (iPhone if enabled)
🌐 Platform Support
Desktop
Laptop
Tablet
Mobile (browser-based)
🎯 CORE OBJECTIVE

Build a high-accuracy GPS verification system inspired by ride-hailing apps (Grab / Angkas / JoyRide) that ensures:

Employees are physically present in allowed locations
GPS is validated and resistant to spoofing
Admin has full control of attendance locations
System works even when users only use mobile data (no WiFi dependency)
⚠️ IMPORTANT GPS PRINCIPLE

❗ The system must NOT rely on WiFi for accuracy
❗ Mobile data is only transport, NOT a trust signal
❗ GPS trust comes from behavior + validation, not network type

🔄 STRICT SYSTEM FLOW (ATTENDANCE PIPELINE)

The system MUST enforce this order:

STEP 1 — USER LOGIN
Authenticate user credentials
Create secure session
STEP 2 — BIOMETRIC AUTHENTICATION (MANDATORY)
WebAuthn verification required
Must succeed before GPS check starts
If failed → stop process
STEP 3 — GPS LOCATION CAPTURE (A-GPS SIMULATION LAYER)

Use browser geolocation:

navigator.geolocation.watchPosition(success, error, {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000
});

Collect:

latitude
longitude
accuracy
speed
heading
timestamp
📡 A-GPS ENHANCEMENT LAYER (GRAB-LIKE SIMULATION)

Since browsers cannot access hardware A-GPS, simulate it using:

1. Hybrid Positioning

Combine:

GPS sensor data
IP-based location fallback
Device motion sensors (accelerometer / gyroscope)
2. GPS Signal Processing Engine
✔ Kalman Filter
Smooth noisy GPS movement
Remove jitter
✔ Multi-sample averaging
Combine multiple readings over time
✔ Accuracy weighting
Prefer lower accuracy (meters) readings
3. Anti-Spoofing Detection Engine

Detect:

Impossible speed (>40 m/s)
Teleportation jumps
Repeated identical coordinates
GPS changes without movement
Sensor mismatch (if available)
Fake GPS applications
4. Map Matching (Optional but recommended)

Use:

Google Roads API OR Mapbox Map Matching API

Purpose:

Snap GPS to real roads
Improve real-world accuracy
Reduce drift errors
🏢 STEP 4 — ADMIN GEOFENCE VALIDATION (CRITICAL CONTROL LAYER)

This is the MOST IMPORTANT FEATURE.

🧾 ADMIN-DEFINED LOCATIONS

Admin can create allowed attendance zones such as:

Roman Catholic Archdiocese of Manila (RCAM)
Palacio Arzobispal (Intramuros)
121 Arzobispo St, Manila

Each location includes:

Latitude
Longitude
Radius (50m–200m configurable)
Name
Active/Inactive status
📍 GEOFENCE LOGIC
IF user_location ∈ admin_geofence_radius
    → ALLOW attendance
ELSE
    → REJECT attendance
📏 DISTANCE CALCULATION (Haversine Formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;

  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;

  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(Δφ/2) * Math.sin(Δφ/2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ/2) * Math.sin(Δλ/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}
🔐 FINAL ATTENDANCE DECISION ENGINE

Attendance is ONLY allowed if ALL conditions pass:

✔ User is logged in
✔ Biometric authentication passed
✔ GPS accuracy ≤ 30m
✔ User is inside admin geofence
✔ No spoofing detected

📦 GPS DATA FORMAT
{
  "employee_id": "EMP001",
  "lat": 14.5995,
  "lng": 120.9842,
  "accuracy": 12,
  "speed": 1.5,
  "heading": 180,
  "timestamp": 1719123456,
  "source": "gps | hybrid",
  "geofence_id": "RCAM-001"
}
🧠 BACKEND MODULES
1. Auth Service
login validation
session handling
2. Biometric Service
WebAuthn verification
device binding
3. GPS Processing Engine
smoothing (Kalman filter)
movement validation
accuracy scoring
4. Geofence Manager (ADMIN CONTROLLED)
create/edit locations
radius configuration
activate/deactivate zones
5. Attendance Validator
enforce full pipeline
GPS + biometric + geofence validation
6. Fraud Detection Engine
spoofing detection
risk scoring (low / medium / high)
🧾 ADMIN DASHBOARD FEATURES

Admin can:

Add and manage locations
Set geofence radius
Enable/disable zones
View live employee map
Monitor attendance logs
Flag suspicious activity
Export reports
📊 OUTPUT REQUIREMENTS

System must output:

Attendance status (approved / denied)
Distance from allowed location
Geofence result
GPS accuracy score (0–100)
Fraud risk score
Biometric status
Timestamp log
⚠️ IMPORTANT LIMITATIONS
Browser GPS is NOT true A-GPS hardware
This is a software-based GPS intelligence simulation layer
Accuracy depends on device and environment
Indoor accuracy is not guaranteed
🏁 FINAL GOAL

Deliver a production-ready system that:

✔ Enforces Login → Biometric → GPS → Geofence flow
✔ Uses Grab-like GPS accuracy simulation techniques
✔ Prevents fake GPS and spoofing attempts
✔ Works on mobile data-only users
✔ Allows admin-controlled attendance zones
✔ Produces verified, trust-scored attendance logs

🔥 WHY THIS VERSION IS BETTER
Clean structure (pipeline-based)
No repeated sections
Correct system order
Real-world GPS engineering logic
Clear separation of layers:
Authentication
GPS processing
Anti-spoofing
Geofencing
Decision engine