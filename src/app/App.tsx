import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// Fix for default Leaflet marker icons in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


import { useState, useEffect, useMemo } from "react";
import {
  Clock, Fingerprint, LogOut, LogIn, Users, Calendar, FileText,
  Settings, ChevronRight, Bell, Search, TrendingUp, AlertCircle, CheckCircle2,
  Timer, Sun, BarChart2, Download, Filter, ChevronDown, Activity,
  Plus, Pencil, Trash2, Eye, CheckCheck, X, UserCheck,
  ThumbsUp, ThumbsDown, RefreshCw, ChevronUp, ExternalLink,
  ShieldCheck, ShieldAlert, Info, Smartphone,
  UserPlus, KeyRound, Archive, RotateCcw, ClipboardList, User, Lock,
  MapPin, Navigation, Target, AlertTriangle, CheckCircle, XCircle as XCircleIcon
} from "lucide-react";
import { toast, Toaster } from "sonner";

delete (L.Icon.Default.prototype as any)._getIconUrl;



// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "admin" | "employee";
type AttendanceStatus = "Early" | "On Time" | "Late" | "Absent" | "Holiday" | "On Leave";
type OTStatus = "Pending" | "Approved" | "Rejected";
type EmpStatus = "Active" | "Archived";
type AppPhase = "login" | "signup" | "forgot" | "force-checkin" | "app";
type Platform = "Windows" | "macOS" | "iOS" | "Android" | "Linux" | "Unknown";

interface AuditLog {
  id: string; action: string; adminName: string; adminId: string;
  target?: string; details: string; timestamp: string;
}

interface RegisteredAccount {
  userId: string; email: string; passwordHash: string; role: Role; employeeId: string;
}

interface User {
  id: string; name: string; role: Role; department: string; position: string;
  employeeId: string; avatar: string;
  schedule: { timeIn: string; timeOut: string; breakHours: number; coreHours: number };
}

interface Employee {
  id: string; employeeId: string; firstName: string; lastName: string; email: string;
  department: string; position: string; role: Role; schedule: string;
  fingerprintId: string; contactNumber: string; status: EmpStatus; avatar: string;
}

type RiskLevel = "low" | "medium" | "high";
type GPSSource = "gps" | "ip" | "manual";

interface GeofenceZone {
  id: string; name: string; address: string;
  lat: number; lng: number; radius: number; // meters
  active: boolean; createdAt: string;
}

interface GPSReading {
  lat: number; lng: number; accuracy: number;
  speed: number | null; heading: number | null;
  timestamp: number; source: GPSSource;
}

interface GPSVerificationResult {
  reading: GPSReading;
  accuracyScore: number;       // 0–100 (100 = perfect ≤5m)
  riskLevel: RiskLevel;
  riskReasons: string[];
  geofenceId: string | null;
  geofenceName: string | null;
  distanceFromGeofence: number | null;
  insideGeofence: boolean;
  approved: boolean;
}

interface AttendanceRecord {
  id: string; employeeId: string; date: string;
  timeIn: string; timeOut: string | null;
  totalHours: number | null; overtimeHours: number; holidayHours: number;
  status: AttendanceStatus; late: number; earlyMinutes: number; undertime: number;
  authMethod: string; device: string; otStatus: OTStatus | null;
  gps?: GPSVerificationResult;
}

interface Holiday {
  id: number; name: string; date: string;
  type: "Regular Holiday" | "Special Holiday" | "Company Holiday"; pay: string;
}

interface Notification {
  id: string; type: "checkin" | "checkout" | "ot-request" | "ot-approved" | "ot-rejected" | "manual" | "late";
  message: string; time: string; read: boolean; employee?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORK_START_H = 7;
const WORK_END_H = 16;
const DEPARTMENTS = ["Engineering", "Marketing", "Finance", "HR", "Operations", "Design", "Sales"];
const SCHEDULES = ["7:00 AM – 4:00 PM", "8:00 AM – 5:00 PM", "9:00 AM – 6:00 PM"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPHTDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}
function fmtTimePHT(d: Date): string {
  return d.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}
function fmtTimePHTShort(d: Date): string {
  return d.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDatePHT(d: Date): string {
  return d.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function todayStrPHT(): string {
  return getPHTDate().toISOString().slice(0, 10);
}
function parseTime12(t: string): number {
  const [time, period] = t.split(" ");
  const [h, m] = time.split(":").map(Number);
  return (period === "PM" && h !== 12 ? h + 12 : period === "AM" && h === 12 ? 0 : h) * 60 + m;
}
function getArrivalStatus(h: number, m: number): AttendanceStatus {
  const mins = h * 60 + m;
  if (mins < WORK_START_H * 60) return "Early";
  if (mins === WORK_START_H * 60) return "On Time";
  return "Late";
}
function computeLateMinutes(timeIn: string): number { return Math.max(0, parseTime12(timeIn) - WORK_START_H * 60); }
function computeEarlyMinutes(timeIn: string): number { return Math.max(0, WORK_START_H * 60 - parseTime12(timeIn)); }
function computeOTHours(timeOut: string): number { return Math.max(0, (parseTime12(timeOut) - WORK_END_H * 60) / 60); }
function computeUndertimeMinutes(timeOut: string): number { return Math.max(0, WORK_END_H * 60 - parseTime12(timeOut)); }
function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function initials(name: string): string { return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(); }

// ─── Platform Detection ───────────────────────────────────────────────────────

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}
function isInIframe(): boolean { try { return window.self !== window.top; } catch { return true; } }
function isHTTPS(): boolean { return location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1"; }

// ─── Auth Label Helpers ───────────────────────────────────────────────────────

function getAuthLabel(platform: Platform): string {
  switch (platform) {
    case "iOS": return "Face ID / Touch ID";
    case "Android": return "Fingerprint / Device Unlock";
    case "macOS": return "Touch ID";
    case "Windows": return "Windows Hello";
    default: return "Device Biometrics / PIN";
  }
}

function getAuthInstruction(platform: Platform): string {
  switch (platform) {
    case "iOS": return "Look at your camera (Face ID) or press the Home button (Touch ID) when prompted.";
    case "Android": return "Place your finger on the sensor or use your device unlock when prompted.";
    case "macOS": return "Place your finger on the Touch ID key (top-right of keyboard) when prompted.";
    case "Windows": return "Use your fingerprint sensor, face recognition, or PIN when the Windows Hello prompt appears.";
    default: return "Follow your device's authentication prompt.";
  }
}

// ─── WebAuthn ────────────────────────────────────────────────────────────────

type WebAuthnResult = { success: boolean; method: string; error?: string; errorCode?: string };

// Decode a base64url credential ID back to ArrayBuffer so we can pass it
// in allowCredentials — this is what makes Check Out reuse the Check In credential.
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function getStoredCredentialId(userId: string): string | null {
  try {
    const entry = JSON.parse(localStorage.getItem("webauthn_creds") || "{}")[userId];
    if (!entry) return null;
    // stored as { id, platform, registeredAt } or legacy plain string
    return typeof entry === "string" ? entry : entry.id ?? null;
  } catch { return null; }
}

function hasStoredCredential(userId: string): boolean {
  return !!getStoredCredentialId(userId);
}

// Authenticate using the SAME credential that was registered at Check In.
// Passing allowCredentials with the stored credential ID is the key fix —
// without it the browser searches for a discoverable passkey and finds nothing on mobile.
async function webAuthnAuthenticate(userId: string): Promise<WebAuthnResult> {
  if (!window.PublicKeyCredential) return { success: false, method: "none", errorCode: "unsupported", error: "WebAuthn not supported in this browser" };
  if (isInIframe()) return { success: false, method: "none", errorCode: "iframe", error: "WebAuthn cannot run inside an iframe" };
  if (!isHTTPS()) return { success: false, method: "none", errorCode: "http", error: "WebAuthn requires HTTPS" };
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
    if (!available) return { success: false, method: "none", errorCode: "no_authenticator", error: "No platform authenticator found on this device" };

    const credentialId = getStoredCredentialId(userId);
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      userVerification: "required",
      timeout: 60000,
    };

    // If we have a stored credential ID, tell the browser exactly which credential
    // to use. This resolves "no passkeys available" on Android/iOS during Check Out.
    if (credentialId) {
      getOptions.allowCredentials = [{
        type: "public-key",
        id: base64urlToBuffer(credentialId),
        // "internal" = built-in sensor (fingerprint, face, PIN).
        // Including "hybrid" ensures Android devices can still use their authenticator
        // even when using Chrome's cross-device flow.
        transports: ["internal", "hybrid"] as AuthenticatorTransport[],
      }];
    }

    const credential = await navigator.credentials.get({ publicKey: getOptions }) as PublicKeyCredential | null;
    if (!credential) return { success: false, method: "webauthn", errorCode: "cancelled", error: "Verification was cancelled" };
    return { success: true, method: getAuthLabel(detectPlatform()) };
  } catch (err: unknown) {
    const n = err instanceof DOMException ? err.name : "";
    const m = err instanceof Error ? err.message : "Unknown error";
    if (n === "NotAllowedError") return { success: false, method: "webauthn", errorCode: "dismissed", error: "Biometric prompt dismissed or timed out — please try again" };
    if (n === "SecurityError") return { success: false, method: "webauthn", errorCode: "security", error: "Security context error — HTTPS required" };
    if (n === "InvalidStateError") return { success: false, method: "webauthn", errorCode: "no_credential", error: "No registered credential found — please check in first to register" };
    if (n === "NotFoundError") return { success: false, method: "webauthn", errorCode: "no_credential", error: "Credential not found on this device — try the simulate option or re-register" };
    return { success: false, method: "webauthn", errorCode: "unknown", error: m };
  }
}

// Register a new credential and persist its ID for reuse at Check Out.
async function webAuthnRegister(userId: string, userName: string): Promise<WebAuthnResult> {
  if (!window.PublicKeyCredential) return { success: false, method: "none", errorCode: "unsupported", error: "WebAuthn not supported" };
  if (isInIframe()) return { success: false, method: "none", errorCode: "iframe", error: "WebAuthn cannot run inside an iframe" };
  if (!isHTTPS()) return { success: false, method: "none", errorCode: "http", error: "WebAuthn requires HTTPS" };
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
    if (!available) return { success: false, method: "none", errorCode: "no_authenticator", error: "No platform authenticator found" };
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "TimeTrack Pro" },
        user: { id: userIdBytes, name: userName, displayName: userName },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          // requireResidentKey: false keeps it compatible with all platform authenticators.
          // The credential ID is stored in localStorage so we don't need a discoverable credential.
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      },
    }) as PublicKeyCredential | null;
    if (!credential) return { success: false, method: "webauthn", errorCode: "cancelled", error: "Registration cancelled" };

    // Persist credential ID — this is what webAuthnAuthenticate will use at Check Out
    try {
      const s = JSON.parse(localStorage.getItem("webauthn_creds") || "{}");
      s[userId] = { id: credential.id, platform: detectPlatform(), registeredAt: new Date().toISOString() };
      localStorage.setItem("webauthn_creds", JSON.stringify(s));
    } catch { /* localStorage may be blocked in some environments */ }

    return { success: true, method: getAuthLabel(detectPlatform()) };
  } catch (err: unknown) {
    const n = err instanceof DOMException ? err.name : "";
    const m = err instanceof Error ? err.message : "Unknown error";
    if (n === "NotAllowedError") return { success: false, method: "webauthn", errorCode: "dismissed", error: "Registration prompt dismissed" };
    if (n === "SecurityError") return { success: false, method: "webauthn", errorCode: "security", error: "Security context error" };
    if (n === "InvalidStateError") return { success: false, method: "webauthn", errorCode: "already_registered", error: "A credential is already registered on this device — try authenticating instead" };
    return { success: false, method: "webauthn", errorCode: "unknown", error: m };
  }
}

// ─── GPS Engine ──────────────────────────────────────────────────────────────

/** Haversine formula — returns distance in meters between two coordinates */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** GPS Accuracy Score: 100 = ≤5m perfect, 0 = ≥200m unusable */
function computeAccuracyScore(accuracyMeters: number): number {
  if (accuracyMeters <= 5) return 100;
  if (accuracyMeters >= 200) return 0;
  return Math.round(100 - ((accuracyMeters - 5) / 195) * 100);
}

/** Kalman-like weighted average: combines multiple GPS readings, weighting by accuracy */
function weightedAverageReadings(readings: GeolocationPosition[]): { lat: number; lng: number; accuracy: number } {
  if (readings.length === 0) throw new Error("No readings");
  if (readings.length === 1) return {
    lat: readings[0].coords.latitude,
    lng: readings[0].coords.longitude,
    accuracy: readings[0].coords.accuracy,
  };
  // Weight = 1/accuracy (lower accuracy meters = higher weight)
  let totalWeight = 0; let wLat = 0; let wLng = 0; let bestAcc = Infinity;
  for (const r of readings) {
    const w = 1 / Math.max(r.coords.accuracy, 1);
    totalWeight += w;
    wLat += r.coords.latitude * w;
    wLng += r.coords.longitude * w;
    if (r.coords.accuracy < bestAcc) bestAcc = r.coords.accuracy;
  }
  return { lat: wLat / totalWeight, lng: wLng / totalWeight, accuracy: bestAcc };
}

/** Anti-spoofing detection engine */
function detectSpoofing(
  readings: GeolocationPosition[],
  prev?: { lat: number; lng: number; time: number }
): { riskLevel: RiskLevel; reasons: string[] } {
  const reasons: string[] = [];
  let riskScore = 0;

  // 1. Check for impossible speed (>40 m/s = 144 km/h) relative to last known position
  if (prev && readings.length > 0) {
    const latest = readings[readings.length - 1];
    const dist = haversineDistance(prev.lat, prev.lng, latest.coords.latitude, latest.coords.longitude);
    const elapsedSec = (latest.timestamp - prev.time) / 1000;
    if (elapsedSec > 0) {
      const speed = dist / elapsedSec;
      if (speed > 40) {
        reasons.push(`Impossible speed detected: ${speed.toFixed(1)} m/s (max allowed: 40 m/s)`);
        riskScore += 60;
      }
    }
  }

  // 2. Check for perfectly identical coordinates across all readings (static spoofing)
  if (readings.length >= 2) {
    const allSameLat = readings.every(r => r.coords.latitude === readings[0].coords.latitude);
    const allSameLng = readings.every(r => r.coords.longitude === readings[0].coords.longitude);
    if (allSameLat && allSameLng) {
      reasons.push("Repeated identical coordinates across multiple readings — possible fake GPS");
      riskScore += 40;
    }
  }

  // 3. Suspiciously perfect accuracy (some mock apps report 0 or 1m on desktops)
  if (readings.some(r => r.coords.accuracy < 2 && /Win|Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent))) {
    reasons.push("Unrealistically high GPS accuracy for this device type");
    riskScore += 20;
  }

  // 4. Speed from GPS sensor vs calculated speed mismatch
  if (readings.length > 0) {
    const hasSpeedData = readings.some(r => r.coords.speed !== null && r.coords.speed !== undefined);
    if (hasSpeedData) {
      const highSensorSpeed = readings.some(r => (r.coords.speed ?? 0) > 40);
      if (highSensorSpeed) {
        reasons.push("Device GPS sensor reports high movement speed");
        riskScore += 30;
      }
    }
  }

  const riskLevel: RiskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";
  return { riskLevel, reasons };
}

/** Full GPS verification pipeline: multi-sample → smooth → anti-spoof → geofence */
/** Full Production-Grade GPS Pipeline */
async function runGPSPipeline(
  geofences: GeofenceZone[],
  onProgress: (msg: string, accuracy: number, timeRem: number) => void,
  maxWaitMs = 12000 // Give it 12 seconds to stabilize
): Promise<GPSVerificationResult> {
  return new Promise((resolve) => {
    const rawSamples: GeolocationPosition[] = [];
    let watchId: number;
    let startTime = Date.now();
    let settledPosition: { lat: number, lng: number, accuracy: number } | null = null;

    const finish = () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      processResults();
    };

    const timeout = setTimeout(() => { finish(); }, maxWaitMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const elapsed = Date.now() - startTime;
        
        // 1. WARM-UP PHASE: Ignore the first 2 seconds of data entirely
        // The OS usually dumps a cached, highly inaccurate Wi-Fi location first.
        if (elapsed < 2000) {
            onProgress("Warming up GPS sensor...", pos.coords.accuracy, Math.max(0, (maxWaitMs - elapsed) / 1000));
            return;
        }

        // 2. SPIKE REJECTION: Ignore terrible readings
        if (pos.coords.accuracy > 100 && rawSamples.length > 0) return; 

        rawSamples.push(pos);
        const remaining = Math.max(0, (maxWaitMs / 1000) - (elapsed / 1000));
        
        onProgress("Acquiring precision lock...", pos.coords.accuracy, remaining);

        // 3. EARLY EXIT: If we get a "Grab-level" lock (under 12 meters) with at least 3 samples,
        // we don't need to make the user wait the full 12 seconds.
        if (pos.coords.accuracy <= 12 && rawSamples.length >= 3) {
          clearTimeout(timeout);
          finish();
        }
      },
      (err) => {
        if (rawSamples.length === 0) {
          clearTimeout(timeout);
          if (watchId) navigator.geolocation.clearWatch(watchId);
          resolve(generateErrorResult(
              err.code === 1 ? "Location permission denied." : "GPS signal lost or unavailable."
          ));
        }
      },
      // Crucial Configuration for Production
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    function processResults() {
      if (rawSamples.length === 0) {
        resolve(generateErrorResult("Could not obtain a stable GPS lock. Please step outside."));
        return;
      }

      // 4. WEIGHTED AVERAGE FILTER (Drift Reduction)
      // Gives heavy mathematical preference to readings with low 'accuracy' radiuses
      let totalWeight = 0;
      let wLat = 0;
      let wLng = 0;
      let bestAccuracy = Infinity;

      rawSamples.forEach(sample => {
          // Weight formula: inverse square of the accuracy (penalizes bad readings heavily)
          const weight = 1 / Math.pow(sample.coords.accuracy, 2);
          totalWeight += weight;
          wLat += sample.coords.latitude * weight;
          wLng += sample.coords.longitude * weight;
          if (sample.coords.accuracy < bestAccuracy) bestAccuracy = sample.coords.accuracy;
      });

      settledPosition = {
          lat: wLat / totalWeight,
          lng: wLng / totalWeight,
          accuracy: bestAccuracy
      };

      const latest = rawSamples[rawSamples.length - 1];
      const accuracyScore = computeAccuracyScore(settledPosition.accuracy);
      const { riskLevel, reasons: riskReasons } = detectSpoofing(rawSamples);

      // 5. GEOFENCE VALIDATION WITH DYNAMIC HYSTERESIS BUFFER
      const activeZones = geofences.filter(g => g.active);
      let bestZone: GeofenceZone | null = null;
      let bestDist = Infinity;

      // The Buffer allows a user to be technically outside the circle by a few meters,
      // IF their GPS accuracy margin of error overlaps with the geofence.
      // Cap the grace period at 30 meters to prevent abuse.
      const dynamicBuffer = Math.min(settledPosition.accuracy * 0.6, 30); 

      for (const zone of activeZones) {
        const dist = haversineDistance(settledPosition.lat, settledPosition.lng, zone.lat, zone.lng);
        if (dist < bestDist) { 
          bestDist = dist; 
          bestZone = zone; 
        }
        if (dist <= (zone.radius + dynamicBuffer)) { 
          bestDist = dist; 
          bestZone = zone; 
          break;
        }
      }

      const insideGeofence = bestZone !== null && bestDist <= (bestZone.radius + dynamicBuffer);
      
      // Final Approval Logic: Must be highly accurate (<50m), inside zone, and not spoofing
      const approved = settledPosition.accuracy <= 50 && insideGeofence && riskLevel !== "high";

      resolve({
        reading: { 
          lat: settledPosition.lat, lng: settledPosition.lng, accuracy: settledPosition.accuracy,
          speed: latest.coords.speed ?? null, heading: latest.coords.heading ?? null,
          timestamp: latest.timestamp, source: "gps",
        },
        accuracyScore, riskLevel, riskReasons,
        geofenceId: bestZone?.id ?? null, geofenceName: bestZone?.name ?? null,
        distanceFromGeofence: bestZone ? Math.round(bestDist) : null,
        insideGeofence, approved,
      });
    }

    function generateErrorResult(msg: string): GPSVerificationResult {
      return {
        reading: { lat: 0, lng: 0, accuracy: 999, speed: null, heading: null, timestamp: Date.now(), source: "manual" },
        accuracyScore: 0, riskLevel: "high", riskReasons: [msg],
        geofenceId: null, geofenceName: null, distanceFromGeofence: null, insideGeofence: false, approved: false,
      };
    }
  });
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const USERS: User[] = [
  { id: "1", name: "Maria Santos", role: "employee", department: "Engineering", position: "Software Developer", employeeId: "EMP-0042", avatar: "MS", schedule: { timeIn: "7:00 AM", timeOut: "4:00 PM", breakHours: 1, coreHours: 8 } },
  { id: "2", name: "James Reyes", role: "admin", department: "HR", position: "HR Manager", employeeId: "ADM-0001", avatar: "JR", schedule: { timeIn: "7:00 AM", timeOut: "4:00 PM", breakHours: 1, coreHours: 8 } },
];

const INIT_EMPLOYEES: Employee[] = [
  { id: "1", employeeId: "EMP-0042", firstName: "Maria", lastName: "Santos", email: "maria.santos@techcorp.ph", department: "Engineering", position: "Software Developer", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1042", contactNumber: "09171234567", status: "Active", avatar: "MS" },
  { id: "2", employeeId: "EMP-0043", firstName: "Carlo", lastName: "Mendez", email: "carlo.mendez@techcorp.ph", department: "Marketing", position: "Marketing Specialist", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1043", contactNumber: "09182345678", status: "Active", avatar: "CM" },
  { id: "3", employeeId: "EMP-0044", firstName: "Ana", lastName: "Reyes", email: "ana.reyes@techcorp.ph", department: "Finance", position: "Accountant", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1044", contactNumber: "09193456789", status: "Active", avatar: "AR" },
  { id: "4", employeeId: "EMP-0045", firstName: "Ben", lastName: "Torres", email: "ben.torres@techcorp.ph", department: "Engineering", position: "QA Engineer", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1045", contactNumber: "09204567890", status: "Active", avatar: "BT" },
  { id: "5", employeeId: "EMP-0046", firstName: "Liza", lastName: "Cruz", email: "liza.cruz@techcorp.ph", department: "HR", position: "HR Associate", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1046", contactNumber: "09215678901", status: "Active", avatar: "LC" },
  { id: "6", employeeId: "EMP-0047", firstName: "Rico", lastName: "Dela Cruz", email: "rico.delacruz@techcorp.ph", department: "Operations", position: "Operations Lead", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1047", contactNumber: "09226789012", status: "Active", avatar: "RD" },
  { id: "7", employeeId: "EMP-0048", firstName: "Jenny", lastName: "Park", email: "jenny.park@techcorp.ph", department: "Design", position: "UI/UX Designer", role: "employee", schedule: "8:00 AM – 5:00 PM", fingerprintId: "", contactNumber: "09237890123", status: "Active", avatar: "JP" },
  { id: "8", employeeId: "EMP-0049", firstName: "Mark", lastName: "Villanueva", email: "mark.villanueva@techcorp.ph", department: "Engineering", position: "DevOps Engineer", role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "FP-1049", contactNumber: "09248901234", status: "Archived", avatar: "MV" },
];

const INIT_GEOFENCES: GeofenceZone[] = [
  { id: "gf1", name: "TechCorp HQ — Makati", address: "Ayala Ave, Salcedo Village, Makati City, Metro Manila", lat: 14.5995, lng: 120.9842, radius: 100, active: true, createdAt: "2026-01-15" },
  { id: "gf2", name: "RCAM — Palacio Arzobispal", address: "121 Arzobispo St, Intramuros, Manila", lat: 14.5921, lng: 120.9742, radius: 150, active: true, createdAt: "2026-02-01" },
  { id: "gf3", name: "Remote Office — Quezon City", address: "Quezon Ave, South Triangle, Quezon City", lat: 14.6507, lng: 121.0486, radius: 200, active: false, createdAt: "2026-03-10" },
];

const DEMO_GPS: GPSVerificationResult = {
  reading: { lat: 14.5995, lng: 120.9842, accuracy: 12, speed: 0.3, heading: 180, timestamp: Date.now(), source: "gps" },
  accuracyScore: 95, riskLevel: "low", riskReasons: [],
  geofenceId: "gf1", geofenceName: "TechCorp HQ — Makati",
  distanceFromGeofence: 8, insideGeofence: true, approved: true,
};

const INIT_ATTENDANCE: AttendanceRecord[] = [
  { id: "2", employeeId: "EMP-0042", date: "2026-06-20", timeIn: "07:12 AM", timeOut: "06:45 PM", totalHours: 11.55, overtimeHours: 2.75, holidayHours: 0, status: "Late", late: 12, earlyMinutes: 0, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Chrome", otStatus: "Pending", gps: { ...DEMO_GPS, accuracyScore: 88, riskLevel: "low" } },
  { id: "3", employeeId: "EMP-0042", date: "2026-06-19", timeIn: "06:55 AM", timeOut: "04:05 PM", totalHours: 9.17, overtimeHours: 0.08, holidayHours: 0, status: "Early", late: 0, earlyMinutes: 5, undertime: 0, authMethod: "Attendance PIN", device: "Windows · Edge", otStatus: "Approved", gps: DEMO_GPS },
  { id: "4", employeeId: "EMP-0042", date: "2026-06-18", timeIn: "07:00 AM", timeOut: "04:00 PM", totalHours: 9, overtimeHours: 0, holidayHours: 0, status: "On Time", late: 0, earlyMinutes: 0, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Chrome", otStatus: null, gps: DEMO_GPS },
  { id: "5", employeeId: "EMP-0042", date: "2026-06-17", timeIn: "07:30 AM", timeOut: "03:45 PM", totalHours: 8.25, overtimeHours: 0, holidayHours: 0, status: "Late", late: 30, earlyMinutes: 0, undertime: 15, authMethod: "Attendance PIN", device: "Android · Chrome", otStatus: null, gps: { ...DEMO_GPS, accuracyScore: 72, riskLevel: "medium", riskReasons: ["GPS accuracy lower than ideal (28m)"] } },
  { id: "6", employeeId: "EMP-0042", date: "2026-06-16", timeIn: "06:58 AM", timeOut: "07:30 PM", totalHours: 12.53, overtimeHours: 3.5, holidayHours: 0, status: "Early", late: 0, earlyMinutes: 2, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Chrome", otStatus: "Approved", gps: DEMO_GPS },
  { id: "7", employeeId: "EMP-0042", date: "2026-06-15", timeIn: "07:00 AM", timeOut: "04:00 PM", totalHours: 9, overtimeHours: 0, holidayHours: 0, status: "On Time", late: 0, earlyMinutes: 0, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Chrome", otStatus: null, gps: DEMO_GPS },
  { id: "8", employeeId: "EMP-0042", date: "2026-06-13", timeIn: "07:00 AM", timeOut: "08:00 PM", totalHours: 13, overtimeHours: 4, holidayHours: 13, status: "On Time", late: 0, earlyMinutes: 0, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Chrome", otStatus: "Approved", gps: DEMO_GPS },
  { id: "9", employeeId: "EMP-0043", date: "2026-06-21", timeIn: "07:32 AM", timeOut: null, totalHours: null, overtimeHours: 0, holidayHours: 0, status: "Late", late: 32, earlyMinutes: 0, undertime: 0, authMethod: "Attendance PIN", device: "Android · Chrome", otStatus: null, gps: { ...DEMO_GPS, accuracyScore: 81, distanceFromGeofence: 45 } },
  { id: "10", employeeId: "EMP-0044", date: "2026-06-21", timeIn: "06:55 AM", timeOut: null, totalHours: null, overtimeHours: 0, holidayHours: 0, status: "Early", late: 0, earlyMinutes: 5, undertime: 0, authMethod: "Windows Hello · Fingerprint", device: "Windows · Edge", otStatus: null, gps: DEMO_GPS },
];

const INIT_HOLIDAYS: Holiday[] = [
  { id: 1, name: "Araw ng Kagitingan", date: "2026-04-09", type: "Regular Holiday", pay: "200%" },
  { id: 2, name: "Labor Day", date: "2026-05-01", type: "Regular Holiday", pay: "200%" },
  { id: 3, name: "Independence Day", date: "2026-06-12", type: "Regular Holiday", pay: "200%" },
  { id: 4, name: "Ninoy Aquino Day", date: "2026-08-21", type: "Special Holiday", pay: "130%" },
  { id: 5, name: "National Heroes Day", date: "2026-08-31", type: "Regular Holiday", pay: "200%" },
  { id: 6, name: "Christmas Eve", date: "2026-12-24", type: "Special Holiday", pay: "130%" },
  { id: 7, name: "Christmas Day", date: "2026-12-25", type: "Regular Holiday", pay: "200%" },
  { id: 8, name: "Rizal Day", date: "2026-12-30", type: "Regular Holiday", pay: "200%" },
];

const INIT_NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "checkin", message: "Carlo Mendez checked in late at 07:32 AM", time: "07:32 AM", read: false, employee: "Carlo Mendez" },
  { id: "n2", type: "late", message: "Ana Reyes arrived early at 06:55 AM", time: "06:55 AM", read: false, employee: "Ana Reyes" },
  { id: "n3", type: "ot-request", message: "Carlo Mendez submitted OT request — 1.75 hrs", time: "06:46 PM", read: false, employee: "Carlo Mendez" },
];

// Simple password hash for demo (never use in production — use bcrypt server-side)
function simpleHash(s: string): string { return btoa(unescape(encodeURIComponent(s + "_tt"))); }
function verifyPassword(plain: string, hash: string): boolean { return simpleHash(plain) === hash; }

const INIT_ACCOUNTS: RegisteredAccount[] = [
  { userId: "1", email: "maria.santos@techcorp.ph", passwordHash: simpleHash("password123"), role: "employee", employeeId: "EMP-0042" },
  { userId: "2", email: "james.reyes@techcorp.ph",  passwordHash: simpleHash("password123"), role: "admin",    employeeId: "ADM-0001" },
];

const INIT_AUDIT_LOGS: AuditLog[] = [
  { id: "a1", action: "Employee Created", adminName: "James Reyes", adminId: "ADM-0001", target: "Mark Villanueva (EMP-0049)", details: "New employee account created", timestamp: "2026-06-10 09:14 AM" },
  { id: "a2", action: "Employee Archived", adminName: "James Reyes", adminId: "ADM-0001", target: "Mark Villanueva (EMP-0049)", details: "Employee status set to Archived", timestamp: "2026-06-15 02:30 PM" },
  { id: "a3", action: "OT Approved", adminName: "James Reyes", adminId: "ADM-0001", target: "Maria Santos (EMP-0042)", details: "3.5h overtime approved for 2026-06-16", timestamp: "2026-06-17 10:05 AM" },
  { id: "a4", action: "Holiday Added", adminName: "James Reyes", adminId: "ADM-0001", details: "Independence Day added as Regular Holiday", timestamp: "2026-06-01 08:00 AM" },
];


const DAILY_CHART = [
  { day: "Mon", present: 5, late: 1, early: 1 },
  { day: "Tue", present: 6, late: 0, early: 2 },
  { day: "Wed", present: 5, late: 2, early: 0 },
  { day: "Thu", present: 6, late: 1, early: 1 },
  { day: "Fri", present: 4, late: 2, early: 1 },
];

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-card border border-border rounded-xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`} style={{ scrollbarWidth: "none" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors"><X size={15} className="text-muted-foreground" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-mono text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-input-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition";
const selectCls = "w-full bg-input-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "On Time": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    Early: "bg-sky-500/15 text-sky-400 border-sky-500/25",
    Late: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    Absent: "bg-red-500/15 text-red-400 border-red-500/25",
    Holiday: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
    "On Leave": "bg-violet-500/15 text-violet-400 border-violet-500/25",
    Active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    Inactive: "bg-slate-500/15 text-slate-400 border-slate-500/25",
    Archived: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    Pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    Approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    Rejected: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>{status}</span>;
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string; }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex gap-3 items-start hover:border-primary/30 transition-colors">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}><Icon size={16} /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── PIN Modal ────────────────────────────────────────────────────────────────

// ─── Unified Auth Panel ───────────────────────────────────────────────────────

function BiometricAuthPanel({ userId, userName, onSuccess, onSimulate, title = "Identity Verification" }: {
  userId: string; userName: string;
  onSuccess: (method: string) => void;
  onSimulate: () => void;
  title?: string;
}) {
  const platform = detectPlatform();
  const inIframe = isInIframe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [authAvailable, setAuthAvailable] = useState<boolean | null>(null);

  const authLabel = getAuthLabel(platform);
  const authInstruction = getAuthInstruction(platform);
  const blocked = inIframe || !isHTTPS();

  useEffect(() => {
    if (!blocked && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(setAuthAvailable)
        .catch(() => setAuthAvailable(false));
    } else {
      setAuthAvailable(false);
    }
  }, [blocked]);

  async function handleAuth() {
    setLoading(true); setError(""); setErrorCode("");
    const result = hasStoredCredential(userId)
      ? await webAuthnAuthenticate(userId)   // passes stored credentialId → works at Check Out
      : await webAuthnRegister(userId, userName);
    setLoading(false);
    if (result.success) {
      onSuccess(`${authLabel} · WebAuthn`);
    } else {
      setError(result.error ?? "Authentication failed");
      setErrorCode(result.errorCode ?? "");
      setRetryCount(c => c + 1);
    }
  }

  const envBlocked = errorCode === "iframe" || errorCode === "http" || errorCode === "unsupported";
  const noAuth = errorCode === "no_authenticator" || authAvailable === false;
  const canUseWebAuthn = !blocked && authAvailable === true;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 pb-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">
          {blocked || noAuth
            ? "Use the simulate option below to complete authentication"
            : authAvailable === null
            ? "Checking device capabilities..."
            : `Your device will prompt for ${authLabel}`}
        </p>
      </div>

      {/* Iframe / HTTP warning */}
      {blocked && (
        <div className="flex gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <Info size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-400 font-semibold">
              {inIframe ? "Running in preview iframe" : "HTTPS required"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {inIframe
                ? "Biometric authentication requires a direct browser tab."
                : "Biometric authentication requires a secure HTTPS connection."}
            </p>
            {inIframe && (
              <button onClick={() => window.open(window.location.href, "_blank")}
                className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1">
                <ExternalLink size={9} /> Open in new tab to use {authLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* No authenticator found */}
      {!blocked && authAvailable === false && (
        <div className="flex gap-2.5 p-3 bg-secondary border border-border rounded-xl">
          <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-foreground font-semibold">No authenticator detected</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              This device does not have a fingerprint sensor or compatible biometric. Use the simulate option below.
            </p>
          </div>
        </div>
      )}

      {/* WebAuthn error */}
      {error && !envBlocked && !noAuth && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
          <div className="flex gap-2 items-start">
            <ShieldAlert size={13} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-400 font-semibold">{error}</p>
              {errorCode === "dismissed" && (
                <p className="text-[10px] text-muted-foreground mt-1">{authInstruction}</p>
              )}
              {(errorCode === "no_credential" || errorCode === "unknown") && (
                <p className="text-[10px] text-amber-400 mt-1">
                  The registered credential was not found on this device. This can happen if you switched devices or cleared browser data.
                  Click <strong>Reset stored credential</strong> below, then re-register your fingerprint.
                </p>
              )}
            </div>
          </div>
          {retryCount >= 2 && errorCode === "dismissed" && (
            <p className="text-[10px] text-amber-400">Still having trouble? Use the simulate option below.</p>
          )}
        </div>
      )}

      {/* Primary auth button */}
      {canUseWebAuthn && (
        <button onClick={handleAuth} disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground rounded-xl py-4 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 active:scale-[0.99] transition-all">
          {loading
            ? <><RefreshCw size={18} className="animate-spin" /> Verifying...</>
            : <><Fingerprint size={18} /> {hasStoredCredential(userId) ? `Verify with ${authLabel}` : `Register & Verify with ${authLabel}`}</>}
        </button>
      )}

      {canUseWebAuthn && (
        <p className="text-[10px] text-muted-foreground text-center">{authInstruction}</p>
      )}

      {/* Simulate button — always available */}
      <button onClick={onSimulate}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-semibold transition-all ${
          canUseWebAuthn
            ? "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            : "bg-primary text-primary-foreground border-transparent hover:bg-primary/90 active:scale-[0.99]"
        }`}>
        <Smartphone size={15} />
        {canUseWebAuthn ? "Simulate Authentication (Demo)" : `Continue — Simulate ${authLabel}`}
      </button>

      {/* Reset credential */}
      {hasStoredCredential(userId) && (
        <button onClick={() => {
          try { const s = JSON.parse(localStorage.getItem("webauthn_creds") || "{}"); delete s[userId]; localStorage.setItem("webauthn_creds", JSON.stringify(s)); } catch { /* ignore */ }
          toast.success("Credential cleared — will re-register on next attempt");
          setError(""); setErrorCode(""); setRetryCount(0);
        }} className="w-full text-[10px] font-mono text-muted-foreground hover:text-red-400 transition-colors py-1">
          Reset stored credential
        </button>
      )}
    </div>
  );
}

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage({ onLogin, onSignUp, onForgot, accounts, employees }: {
  onLogin: (u: User) => void;
  onSignUp: () => void;
  onForgot: () => void;
  accounts: RegisteredAccount[];
  employees: Employee[];
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    await new Promise(r => setTimeout(r, 500));
    const account = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!account) { setError("No account found with this email address."); setLoading(false); return; }
    if (!verifyPassword(password, account.passwordHash)) { setError("Incorrect password. Please try again."); setLoading(false); return; }
    const emp = employees.find(e => e.employeeId === account.employeeId);
    if (emp?.status === "Archived") {
      setError("This account has been archived and can no longer access the system. Please contact your administrator.");
      setLoading(false); return;
    }
    const user = USERS.find(u => u.employeeId === account.employeeId) ?? {
      id: account.userId, name: emp ? `${emp.firstName} ${emp.lastName}` : "User",
      role: account.role, department: emp?.department ?? "—", position: emp?.position ?? "—",
      employeeId: account.employeeId, avatar: initials(emp ? `${emp.firstName} ${emp.lastName}` : "U"),
      schedule: { timeIn: "7:00 AM", timeOut: "4:00 PM", breakHours: 1, coreHours: 8 },
    };
    onLogin(user);
    setLoading(false);
  }

  const brandHeader = (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-4">
        <Clock size={26} className="text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">TimeTrack Pro</h1>
      <p className="text-muted-foreground text-sm mt-1">Employee Attendance System</p>
      <div className="flex items-center justify-center gap-1.5 mt-2">
        <Activity size={11} className="text-emerald-400" />
        <span className="text-[11px] font-mono text-emerald-400">System Online · Philippine Time (PHT)</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {brandHeader}
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <Field label="Email Address">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@techcorp.ph" className={inputCls} required />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} required />
          </Field>
          <div className="flex justify-end">
            <button type="button" onClick={onForgot} className="text-[11px] text-primary hover:underline flex items-center gap-1">
              <KeyRound size={11} /> Forgot Password?
            </button>
          </div>
          {error && (
            <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <LogIn size={14} />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="mt-3 text-center">
          <span className="text-xs text-muted-foreground">Don&apos;t have an account? </span>
          <button onClick={onSignUp} className="text-xs text-primary hover:underline font-semibold">Create Account</button>
        </div>
        <div className="mt-4 p-4 bg-card/50 border border-border/50 rounded-lg">
          <p className="text-xs font-mono text-muted-foreground mb-2">DEMO ACCOUNTS</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Employee:</span>
              <button onClick={() => { setEmail("maria.santos@techcorp.ph"); setPassword("password123"); }} className="text-primary font-mono hover:underline">maria.santos@techcorp.ph</button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Admin:</span>
              <button onClick={() => { setEmail("james.reyes@techcorp.ph"); setPassword("password123"); }} className="text-primary font-mono hover:underline">james.reyes@techcorp.ph</button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Password:</span>
              <span className="font-mono text-primary">password123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sign Up Page ─────────────────────────────────────────────────────────────

function SignUpPage({ onBack, onSuccess, accounts, onAddAccount }: {
  onBack: () => void;
  onSuccess: (email: string) => void;
  accounts: RegisteredAccount[];
  onAddAccount: (a: RegisteredAccount, e: Employee) => void;
}) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", department: DEPARTMENTS[0], password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("Full name is required."); setLoading(false); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); setLoading(false); return; }
    if (accounts.find(a => a.email.toLowerCase() === form.email.toLowerCase())) { setError("An account with this email already exists."); setLoading(false); return; }
    const id = String(Date.now());
    const empId = `EMP-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const newAccount: RegisteredAccount = { userId: id, email: form.email, passwordHash: simpleHash(form.password), role: "employee", employeeId: empId };
    const newEmp: Employee = {
      id, employeeId: empId, firstName: form.firstName, lastName: form.lastName,
      email: form.email, department: form.department, position: "Employee",
      role: "employee", schedule: "7:00 AM – 4:00 PM", fingerprintId: "",
      contactNumber: "", status: "Active", avatar: initials(`${form.firstName} ${form.lastName}`),
    };
    onAddAccount(newAccount, newEmp);
    toast.success(`Account created! You can now sign in as ${form.email}`);
    onSuccess(form.email);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-3">
            <UserPlus size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Create Account</h1>
          <p className="text-muted-foreground text-sm mt-1">Register as a new employee</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name"><input value={form.firstName} onChange={set("firstName")} placeholder="Maria" className={inputCls} required /></Field>
            <Field label="Last Name"><input value={form.lastName} onChange={set("lastName")} placeholder="Santos" className={inputCls} required /></Field>
          </div>
          <Field label="Email Address"><input type="email" value={form.email} onChange={set("email")} placeholder="you@techcorp.ph" className={inputCls} required /></Field>
          <Field label="Department">
            <select value={form.department} onChange={set("department")} className={selectCls}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Password"><input type="password" value={form.password} onChange={set("password")} placeholder="Min. 8 characters" className={inputCls} required /></Field>
          <Field label="Confirm Password"><input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" className={inputCls} required /></Field>
          {error && (
            <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" /><p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 mt-1">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <div className="mt-3 text-center">
          <span className="text-xs text-muted-foreground">Already have an account? </span>
          <button onClick={onBack} className="text-xs text-primary hover:underline font-semibold">Sign In</button>
        </div>
      </div>
    </div>
  );
}

// ─── Forgot Password Page ─────────────────────────────────────────────────────

function ForgotPasswordPage({ onBack, accounts, onUpdatePassword }: {
  onBack: () => void;
  accounts: RegisteredAccount[];
  onUpdatePassword: (userId: string, newHash: string) => void;
}) {
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [foundAccount, setFoundAccount] = useState<RegisteredAccount | null>(null);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const acc = accounts.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!acc) { setError("No account found with this email address."); setLoading(false); return; }
    setFoundAccount(acc);
    setStep("reset");
    setLoading(false);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    if (newPw.length < 8) { setError("Password must be at least 8 characters."); setLoading(false); return; }
    if (newPw !== confirm) { setError("Passwords do not match."); setLoading(false); return; }
    onUpdatePassword(foundAccount!.userId, simpleHash(newPw));
    setStep("done");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-3">
            <KeyRound size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">
            {step === "email" ? "Forgot Password" : step === "reset" ? "Set New Password" : "Password Reset"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === "email" ? "Enter your email to reset your password" : step === "reset" ? `Setting new password for ${email}` : "Your password has been updated"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <Field label="Email Address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@techcorp.ph" className={inputCls} required />
              </Field>
              {error && <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {loading ? "Verifying..." : "Continue"}
              </button>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-400 font-semibold">Account verified</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{email}</p>
              </div>
              <Field label="New Password"><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" className={inputCls} required /></Field>
              <Field label="Confirm Password"><input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat new password" className={inputCls} required /></Field>
              {error && <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" /><p className="text-xs text-red-400">{error}</p></div>}
              <button type="submit" disabled={loading}
                className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                {loading ? "Saving..." : "Set New Password"}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCheck size={28} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Password updated successfully!</p>
                <p className="text-xs text-muted-foreground mt-1">You can now sign in with your new password.</p>
              </div>
              <button onClick={onBack} className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90">
                Go to Sign In
              </button>
            </div>
          )}
        </div>

        {step !== "done" && (
          <div className="mt-3 text-center">
            <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto">
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



// ─── Force Check-In Gate ──────────────────────────────────────────────────────

type CheckInStep = "auth" | "gps" | "geofence_result" | "saving" | "done";

// ─── GPS Score Bar ────────────────────────────────────────────────────────────

function AccuracyScoreBar({ score, label }: { score: number; label?: string }) {
  const color = score >= 80 ? "bg-emerald-400" : score >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-muted-foreground">{label ?? "GPS Accuracy Score"}</span>
        <span className={textColor}>{score}/100</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    high: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono ${map[level]}`}>
      {level === "low" && <CheckCircle size={9} />}
      {level === "medium" && <AlertTriangle size={9} />}
      {level === "high" && <XCircleIcon size={9} />}
      {level.toUpperCase()} RISK
    </span>
  );
}

// ─── Function Force Check-In Gate ──────────────────────────────────────────────────────

// ─── Force Check-In Gate ──────────────────────────────────────────────────────

function ForceCheckInGate({ user, geofences, onComplete }: {
  user: User; geofences: GeofenceZone[]; onComplete: (record: AttendanceRecord) => void;
}) {
  const [step, setStep] = useState<CheckInStep>("auth");
  const [authMethod, setAuthMethod] = useState("");
  
  // FIXED: Single declaration of gpsProgress with the updated signature
  const [gpsProgress, setGpsProgress] = useState({ msg: "Initializing GPS…", accuracy: 999, timeRem: 10 });
  const [gpsResult, setGpsResult] = useState<GPSVerificationResult | null>(null);
  const [result, setResult] = useState<{ timeIn: string; status: AttendanceStatus; method: string } | null>(null);
  const [phtNow, setPhtNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setPhtNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const phtTime = fmtTimePHT(phtNow);
  const phtD = getPHTDate();
  const arrivalStatus = getArrivalStatus(phtD.getHours(), phtD.getMinutes());
  const statusColor: Record<string, string> = { Early: "text-sky-400", "On Time": "text-emerald-400", Late: "text-amber-400" };

  // Step 1 complete → trigger GPS pipeline
  async function onBiometricSuccess(method: string) {
    setAuthMethod(method);
    setStep("gps");
    setGpsProgress({ msg: "Requesting device GPS permission…", accuracy: 999, timeRem: 10 });

    let gps: GPSVerificationResult;
    try {
      // FIXED: runGPSPipeline is now properly inside this async function
      gps = await runGPSPipeline(
        geofences,
        (msg, accuracy, timeRem) => setGpsProgress({ msg, accuracy, timeRem }),
        10000
      );
    } catch {
      // GPS pipeline error → use demo GPS for simulation environments
      gps = {
        reading: { lat: 0, lng: 0, accuracy: 999, speed: null, heading: null, timestamp: Date.now(), source: "manual" },
        accuracyScore: 0, riskLevel: "high",
        riskReasons: ["GPS pipeline error — browser may not support geolocation"],
        geofenceId: null, geofenceName: null, distanceFromGeofence: null,
        insideGeofence: false, approved: false,
      };
    }
    setGpsResult(gps);
    setStep("geofence_result");
  }

  function onSimulate() {
    setAuthMethod("Simulated · Demo Mode");
    // Skip GPS, use demo GPS result
    setGpsResult({ ...DEMO_GPS });
    setStep("geofence_result");
  }

  function proceedToRecord() {
    setStep("saving");
    const now = getPHTDate();
    const timeIn = fmtTimePHTShort(now);
    const ua = navigator.userAgent;
    const browser = /Edg/.test(ua) ? "Edge" : /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
    const status = getArrivalStatus(now.getHours(), now.getMinutes());
    const record: AttendanceRecord = {
      id: String(Date.now()), employeeId: user.employeeId, date: todayStrPHT(),
      timeIn, timeOut: null, totalHours: null, overtimeHours: 0, holidayHours: 0,
      status, late: computeLateMinutes(timeIn), earlyMinutes: computeEarlyMinutes(timeIn), undertime: 0,
      authMethod, device: `${detectPlatform()} · ${browser}`, otStatus: null,
      gps: gpsResult ?? undefined,
    };
    setResult({ timeIn, status, method: authMethod });
    setTimeout(() => { setStep("done"); setTimeout(() => onComplete(record), 1800); }, 600);
  }

  const pipelineSteps = [
    { label: "Login", done: true },
    { label: "Biometric", done: ["gps", "geofence_result", "saving", "done"].includes(step) },
    { label: "GPS", done: ["geofence_result", "saving", "done"].includes(step) },
    { label: "Geofence", done: ["saving", "done"].includes(step) },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 mb-3">
            <Clock size={26} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Check In for Today</h1>
          <p className="text-muted-foreground text-sm mt-1">Login → Biometric → GPS → Geofence</p>
        </div>

        {/* Pipeline indicator */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {pipelineSteps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1">
              {i > 0 && <div className={`w-6 h-px ${s.done ? "bg-primary" : "bg-border"}`} />}
              <span className={`flex items-center gap-1 text-[10px] font-mono ${s.done ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold ${s.done ? "border-primary bg-primary/20 text-primary" : "border-border"}`}>
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Employee + PHT header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">{user.avatar}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{user.employeeId} · {user.department}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-mono font-bold text-primary">{phtTime}</p>
              <p className={`text-[10px] font-mono font-bold ${statusColor[arrivalStatus] ?? "text-muted-foreground"}`}>{arrivalStatus} · PHT</p>
            </div>
          </div>

          {/* STEP 1: Biometric Auth */}
          {step === "auth" && (
            <>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-muted-foreground">Work schedule</span>
                <span className="font-mono text-foreground">7:00 AM – 4:00 PM · Mon–Fri</span>
              </div>
              <BiometricAuthPanel
                userId={user.id} userName={user.name}
                title="Step 1 — Identity Verification"
                onSuccess={onBiometricSuccess}
                onSimulate={onSimulate}
              />
            </>
          )}

          {/* STEP 2: GPS Acquiring */}
          {step === "gps" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 gap-4">
                {/* Radar Animation */}
                <div className="relative flex items-center justify-center h-24">
                  <div className="absolute w-24 h-24 rounded-full border border-primary/30 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <div className="absolute w-16 h-16 rounded-full border border-primary/50 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <div className="relative w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                    <Navigation size={20} className="text-primary-foreground animate-pulse" />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Acquiring Precision GPS</p>
                  <p className="text-xs text-muted-foreground">{gpsProgress.msg}</p>
                </div>

                <div className="w-full bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-muted-foreground uppercase tracking-wider">Current Accuracy</span>
                    <span className={
                      gpsProgress.accuracy <= 20 ? "text-emerald-400 font-bold" : 
                      gpsProgress.accuracy <= 65 ? "text-amber-400" : "text-red-400"
                    }>
                      {gpsProgress.accuracy < 999 ? `±${Math.round(gpsProgress.accuracy)}m` : "Calculating..."}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                      <span>Filtering Signal</span>
                      <span>{gpsProgress.timeRem}s remaining max</span>
                    </div>
                    <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-1000 ease-linear" 
                        style={{ width: `${100 - ((gpsProgress.timeRem) / 10) * 100}%` }} 
                      />
                    </div>
                  </div>
                  
                  <p className="text-[9px] text-muted-foreground/70 text-center pt-1 leading-tight">
                    Please stand still and ensure clear view of the sky. Will auto-resolve early if high accuracy is achieved.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Geofence Result */}
          {step === "geofence_result" && gpsResult && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-foreground">Step 3 — Geofence Validation</p>

              {/* GPS Reading Details */}
              <div className="bg-secondary/50 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">GPS Data</span>
                  <RiskBadge level={gpsResult.riskLevel} />
                </div>
                <AccuracyScoreBar score={gpsResult.accuracyScore} />
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div><span className="text-muted-foreground">Accuracy: </span><span className="text-foreground">{gpsResult.reading.accuracy > 500 ? "N/A" : `±${Math.round(gpsResult.reading.accuracy)}m`}</span></div>
                  <div><span className="text-muted-foreground">Source: </span><span className="text-foreground capitalize">{gpsResult.reading.source}</span></div>
                  {gpsResult.reading.lat !== 0 && <>
                    <div><span className="text-muted-foreground">Lat: </span><span className="text-foreground">{gpsResult.reading.lat.toFixed(5)}</span></div>
                    <div><span className="text-muted-foreground">Lng: </span><span className="text-foreground">{gpsResult.reading.lng.toFixed(5)}</span></div>
                  </>}
                </div>
                {gpsResult.riskReasons.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border">
                    {gpsResult.riskReasons.map((r, i) => (
                      <div key={i} className="flex gap-1.5 items-start">
                        <AlertTriangle size={10} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-400">{r}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Geofence Result */}
              <div className={`rounded-xl p-3 border ${gpsResult.insideGeofence ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Target size={14} className={gpsResult.insideGeofence ? "text-emerald-400" : "text-red-400"} />
                  <span className={`text-xs font-semibold ${gpsResult.insideGeofence ? "text-emerald-400" : "text-red-400"}`}>
                    {gpsResult.insideGeofence ? "Inside Allowed Zone ✓" : "Outside Allowed Zone ✗"}
                  </span>
                </div>
                {gpsResult.geofenceName ? (
                  <div className="text-[10px] font-mono space-y-0.5">
                    <p className="text-foreground font-semibold">{gpsResult.geofenceName}</p>
                    {gpsResult.distanceFromGeofence !== null && (
                      <p className="text-muted-foreground">{gpsResult.distanceFromGeofence}m from zone center</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No active geofence zones found near your location.</p>
                )}
              </div>

              {/* Decision */}
              {gpsResult.approved ? (
                <button onClick={proceedToRecord}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.99]">
                  <CheckCheck size={16} /> Confirm Check-In
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 space-y-1">
                    <p className="font-semibold">Attendance Denied</p>
                    {!gpsResult.insideGeofence && <p>You are outside all authorized attendance zones.</p>}
                    {gpsResult.riskLevel === "high" && <p>High fraud risk detected — attendance cannot be recorded.</p>}
                    {gpsResult.reading.accuracy > 100 && <p>GPS accuracy too low ({Math.round(gpsResult.reading.accuracy)}m) — minimum 100m required.</p>}
                  </div>
                  <button onClick={proceedToRecord}
                    className="w-full flex items-center justify-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl py-2.5 text-xs font-semibold hover:bg-amber-500/25 transition-all">
                    Request Manual Override (Admin Approval Required)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Saving */}
          {step === "saving" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <RefreshCw size={26} className="text-primary animate-spin" />
              <p className="text-sm font-semibold text-foreground">Recording attendance...</p>
              <p className="text-xs text-muted-foreground">Philippine Time · {todayStrPHT()}</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-3 gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
                  <CheckCheck size={32} className="text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">Check-In Successful!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your attendance has been recorded</p>
                </div>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 grid grid-cols-2 gap-3">
                {[
                  ["Time In", result.timeIn],
                  ["Status", result.status],
                  ["Auth", result.method.split(" · ")[0]],
                  ["Date", todayStrPHT()],
                  ["GPS Score", gpsResult ? `${gpsResult.accuracyScore}/100` : "—"],
                  ["Geofence", gpsResult?.geofenceName ?? "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">{k}</p>
                    <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{v}</p>
                  </div>
                ))}
              </div>
              {gpsResult && (
                <div className="flex items-center justify-between">
                  <AccuracyScoreBar score={gpsResult.accuracyScore} label="GPS Accuracy" />
                  <div className="ml-3 shrink-0"><RiskBadge level={gpsResult.riskLevel} /></div>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center animate-pulse">Redirecting to dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Check-Out Modal ──────────────────────────────────────────────────────────

function CheckOutModal({ user, todayRecord, onComplete, onClose }: {
  user: User; todayRecord: AttendanceRecord;
  onComplete: (updated: AttendanceRecord) => void; onClose: () => void;
}) {
  const [step, setStep] = useState<"auth" | "saving" | "done">("auth");
  const [summary, setSummary] = useState<{ timeOut: string; totalHours: number; ot: number } | null>(null);

  function completeCheckout(method: string) {
    setStep("saving");
    const now = getPHTDate();
    const timeOut = fmtTimePHTShort(now);
    const inMins = parseTime12(todayRecord.timeIn);
    const outMins = now.getHours() * 60 + now.getMinutes();
    const totalHours = parseFloat(((outMins - inMins) / 60).toFixed(2));
    const ot = computeOTHours(timeOut);
    const updated: AttendanceRecord = {
      ...todayRecord, timeOut, totalHours,
      overtimeHours: parseFloat(ot.toFixed(2)),
      undertime: computeUndertimeMinutes(timeOut),
      otStatus: ot > 0 ? "Pending" : null,
    };
    setSummary({ timeOut, totalHours, ot });
    setTimeout(() => {
      setStep("done");
      setTimeout(() => {
        onComplete(updated);
        toast.success(`Checked out at ${timeOut} · ${totalHours}h worked${ot > 0 ? ` · ${ot.toFixed(2)}h OT pending` : ""}`);
      }, 1200);
    }, 600);
  }

  return (
    <Modal title="Check Out" onClose={onClose}>
      <div className="space-y-4">
        {/* Current session info */}
        <div className="bg-secondary/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-[10px] font-mono text-muted-foreground">CHECKED IN</p><p className="font-bold text-foreground mt-0.5">{todayRecord.timeIn}</p></div>
          <div><p className="text-[10px] font-mono text-muted-foreground">STATUS</p><div className="mt-0.5"><StatusBadge status={todayRecord.status} /></div></div>
        </div>

        {step === "auth" && (
          <BiometricAuthPanel
            userId={user.id}
            userName={user.name}
            title="Verify Identity to Check Out"
            onSuccess={completeCheckout}
            onSimulate={() => completeCheckout("Simulated · Demo Mode")}
          />
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <RefreshCw size={24} className="text-primary animate-spin" />
            <p className="text-sm text-foreground font-semibold">Recording check-out...</p>
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4 gap-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center">
                <CheckCheck size={28} className="text-emerald-400" />
              </div>
              <p className="text-base font-bold text-foreground">Check-Out Successful!</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-[9px] font-mono text-muted-foreground uppercase">Time Out</p><p className="text-sm font-bold text-foreground mt-1">{summary.timeOut}</p></div>
              <div><p className="text-[9px] font-mono text-muted-foreground uppercase">Total Hrs</p><p className="text-sm font-bold text-primary mt-1">{summary.totalHours}h</p></div>
              <div><p className="text-[9px] font-mono text-muted-foreground uppercase">OT Hrs</p><p className={`text-sm font-bold mt-1 ${summary.ot > 0 ? "text-indigo-400" : "text-muted-foreground"}`}>{summary.ot > 0 ? summary.ot.toFixed(2) + "h" : "—"}</p></div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

type EmployeePage = "dashboard" | "checkout" | "history" | "schedule" | "profile";
type AdminPage = "dashboard" | "employees" | "attendance" | "holidays" | "payroll" | "settings" | "audit-logs" | "geofences";
type AnyPage = EmployeePage | AdminPage;

function Sidebar({ user, page, setPage, onLogout }: { user: User; page: AnyPage; setPage: (p: AnyPage) => void; onLogout: () => void; }) {
  const employeeNav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart2 },
    { id: "checkout", label: "Check Out", icon: LogOut },
    { id: "history", label: "Attendance History", icon: Calendar },
    { id: "schedule", label: "My Schedule", icon: Timer },
    { id: "profile", label: "My Profile", icon: User },
  ];
  const adminNav = [
    { id: "dashboard", label: "Dashboard", icon: BarChart2 },
    { id: "employees", label: "Employees", icon: Users },
    { id: "attendance", label: "Attendance Logs", icon: Clock },
    { id: "holidays", label: "Holiday Config", icon: Sun },
    { id: "payroll", label: "Payroll Cutoff", icon: FileText },
    { id: "geofences", label: "Geofence Zones", icon: Target},
    { id: "audit-logs", label: "Audit Logs", icon: ClipboardList },
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const nav = user.role === "admin" ? adminNav : employeeNav;

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center"><Clock size={14} className="text-primary" /></div>
          <div><p className="text-sm font-bold text-foreground leading-none">TimeTrack</p><p className="text-[10px] font-mono text-muted-foreground">PRO · PHT System</p></div>
        </div>
      </div>
      <div className="px-3 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user.avatar}</div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">{user.employeeId}</p>
          </div>
          <div className={`ml-auto w-1.5 h-1.5 rounded-full ${user.role === "admin" ? "bg-amber-400" : "bg-emerald-400"}`} />
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <p className="px-2 py-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
          {user.role === "admin" ? "Admin Panel" : "My Workspace"}
        </p>
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPage(id as AnyPage)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${page === id ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
            <Icon size={14} />{label}
            {page === id && <ChevronRight size={10} className="ml-auto" />}
          </button>
        ))}
      </nav>
      <div className="px-3 py-3 border-t border-sidebar-border">
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile Bottom Nav ────────────────────────────────────────────────────────

function MobileBottomNav({ user, page, setPage }: { user: User; page: AnyPage; setPage: (p: AnyPage) => void; }) {
  const employeeNav = [
    { id: "dashboard", label: "Home", icon: BarChart2 },
    { id: "checkout", label: "Out", icon: LogOut },
    { id: "history", label: "History", icon: Calendar },
    { id: "schedule", label: "Schedule", icon: Timer },
    { id: "profile", label: "Profile", icon: User },
  ];
  const adminNav = [
    { id: "dashboard", label: "Home", icon: BarChart2 },
    { id: "employees", label: "People", icon: Users },
    { id: "attendance", label: "Logs", icon: Clock },
    { id: "geofences", label: "Zones", icon: Target},
    { id: "settings", label: "Settings", icon: Settings },
  ];
  const nav = user.role === "admin" ? adminNav : employeeNav;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-card/95 backdrop-blur-md border-t border-border">
      <div className="flex items-center justify-around px-2 py-2">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setPage(id as AnyPage)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[52px] ${page === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon size={18} /><span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ title, user, unreadCount, onBell }: { title: string; user: User; unreadCount: number; onBell: () => void; }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <header className="h-12 px-5 flex items-center justify-between border-b border-border bg-card/40 backdrop-blur-sm shrink-0">
      <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          <Activity size={12} className="text-emerald-400" />
          <span className="text-foreground">{fmtTimePHT(time)}</span>
          <span className="text-[10px] hidden sm:inline">PHT</span>
        </div>
        <button onClick={onBell} className="relative p-1.5 hover:bg-muted rounded-lg transition-colors">
          <Bell size={14} className="text-muted-foreground" />
          {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center">{unreadCount}</span>}
        </button>
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user.avatar}</div>
      </div>
    </header>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({ notifications, onUpdate, onClose }: { notifications: Notification[]; onUpdate: (n: Notification[]) => void; onClose: () => void; }) {
  const unread = notifications.filter(n => !n.read).length;
  const iconMap: Record<string, React.ElementType> = { checkin: CheckCircle2, checkout: LogOut, "ot-request": TrendingUp, "ot-approved": ThumbsUp, "ot-rejected": ThumbsDown, manual: FileText, late: AlertCircle };
  const colorMap: Record<string, string> = { checkin: "text-emerald-400", checkout: "text-sky-400", "ot-request": "text-amber-400", "ot-approved": "text-emerald-400", "ot-rejected": "text-red-400", manual: "text-indigo-400", late: "text-amber-400" };
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-80 bg-card border-l border-border h-full flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && <button onClick={() => onUpdate(notifications.map(n => ({ ...n, read: true })))} className="text-[10px] font-mono text-primary hover:underline">Mark all read</button>}
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X size={13} className="text-muted-foreground" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/40" style={{ scrollbarWidth: "none" }}>
          {notifications.length === 0 && <div className="flex flex-col items-center justify-center h-32 text-muted-foreground"><CheckCheck size={20} className="mb-2 opacity-40" /><p className="text-xs">All caught up!</p></div>}
          {notifications.map(n => {
            const Icon = iconMap[n.type] ?? Info;
            return (
              <div key={n.id} className={`px-4 py-3 flex gap-3 items-start hover:bg-secondary/20 ${!n.read ? "bg-primary/5" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-card border border-border mt-0.5 ${colorMap[n.type] ?? ""}`}><Icon size={12} /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.message}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">{n.time}</p>
                </div>
                <button onClick={() => onUpdate(notifications.filter(x => x.id !== n.id))} className="p-1 hover:bg-red-500/10 rounded"><X size={10} className="text-muted-foreground hover:text-red-400" /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────

function SparkLine({ data, dataKey, color, height = 60 }: { data: Record<string, number>[]; dataKey: string; color: string; height?: number; }) {
  const W = 400; const PAD = 4;
  const iW = W - PAD * 2; const iH = height - PAD * 2;
  const vals = data.map(d => d[dataKey] ?? 0);
  const max = Math.max(...vals, 1);
  if (vals.length < 2) return null;
  const step = iW / (vals.length - 1);
  const pts = vals.map((v, i) => `${PAD + i * step},${PAD + iH - (v / max) * iH}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function EmployeeDashboard({ user, attendance, onNavigateTo }: { user: User; attendance: AttendanceRecord[]; onNavigateTo: (p: AnyPage) => void; }) {
  const [phtNow, setPhtNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setPhtNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const myRecords = attendance.filter(r => r.employeeId === user.employeeId);
  const todayStr = todayStrPHT();
  const todayRecord = myRecords.find(r => r.date === todayStr);
  const totalHours = myRecords.reduce((s, r) => s + (r.totalHours ?? 0), 0);
  const totalOT = myRecords.reduce((s, r) => s + r.overtimeHours, 0);

  const workedMs = todayRecord && !todayRecord.timeOut ? (() => {
    const phtNow2 = getPHTDate();
    const mins = parseTime12(todayRecord.timeIn);
    const ref = new Date(phtNow2); ref.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return Math.max(0, phtNow2.getTime() - ref.getTime());
  })() : null;
  const wH = workedMs != null ? Math.floor(workedMs / 3600000) : 0;
  const wM = workedMs != null ? Math.floor((workedMs % 3600000) / 60000) : 0;
  const wS = workedMs != null ? Math.floor((workedMs % 60000) / 1000) : 0;

  const statusColor: Record<string, string> = { Early: "text-sky-400", "On Time": "text-emerald-400", Late: "text-amber-400" };
  const chartData = myRecords.filter(r => r.totalHours).slice(0, 7).reverse().map(r => ({ v: r.totalHours ?? 0 }));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* PHT Clock Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Today&apos;s Attendance</p>
            <div className="flex items-center gap-1.5"><Activity size={11} className="text-emerald-400" /><span className="text-[10px] font-mono text-emerald-400">Asia/Manila · PHT</span></div>
          </div>
          <p className="text-3xl sm:text-4xl font-mono font-bold text-foreground">{fmtTimePHT(phtNow)}</p>
          <p className="text-xs text-muted-foreground mt-1">{fmtDatePHT(phtNow)}</p>
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-border">
            <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Check In</p><p className="text-sm font-bold text-foreground mt-1">{todayRecord?.timeIn ?? "—"}</p></div>
            <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Check Out</p><p className="text-sm font-bold text-foreground mt-1">{todayRecord?.timeOut ?? "Not yet"}</p></div>
            <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Working Hrs</p>
              {workedMs != null
                ? <p className="text-sm font-bold text-primary font-mono mt-1">{String(wH).padStart(2,"0")}:{String(wM).padStart(2,"0")}:{String(wS).padStart(2,"0")}</p>
                : <p className="text-sm font-bold text-foreground mt-1">{todayRecord?.totalHours != null ? todayRecord.totalHours + "h" : "—"}</p>}
            </div>
            <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Status</p>
              <p className={`text-sm font-bold mt-1 ${todayRecord ? statusColor[todayRecord.status] ?? "text-foreground" : "text-muted-foreground"}`}>
                {todayRecord?.status ?? "—"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Good morning</p>
            <p className="text-lg font-bold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.position} · {user.department}</p>
          </div>
          <div className="mt-4 pt-4 border-t border-border space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Shift</span><span className="font-mono text-foreground">7:00 AM – 4:00 PM</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Auth</span><span className="font-mono text-foreground">{todayRecord?.authMethod ?? "—"}</span></div>
          </div>
          {todayRecord && !todayRecord.timeOut && (
            <button onClick={() => onNavigateTo("checkout")} className="mt-3 w-full flex items-center justify-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg py-2 text-xs font-semibold hover:bg-red-500/25 transition-all">
              <LogOut size={13} /> Check Out Now
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Month Hours" value={totalHours.toFixed(1) + "h"} sub="June cutoff 1" icon={Clock} color="bg-sky-500/15 text-sky-400" />
        <StatCard label="Overtime" value={totalOT.toFixed(1) + "h"} sub="This period" icon={TrendingUp} color="bg-indigo-500/15 text-indigo-400" />
        <StatCard label="Days Present" value={String(myRecords.filter(r => r.status !== "Absent").length)} sub="This month" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Late Count" value={String(myRecords.filter(r => r.status === "Late").length)} sub="This month" icon={AlertCircle} color="bg-amber-500/15 text-amber-400" />
      </div>

      {chartData.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Hours Worked — Recent Days</h3>
          <SparkLine data={chartData} dataKey="v" color="#00d4aa" height={64} />
        </div>
      )}

      {/* Recent attendance */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Recent Attendance</h3>
          <button onClick={() => onNavigateTo("history")} className="text-[10px] font-mono text-primary hover:underline">View All</button>
        </div>
        <div className="divide-y divide-border/50">
          {myRecords.slice(0, 5).map(r => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center gap-3"><StatusBadge status={r.status} /><span className="text-xs font-mono text-muted-foreground">{r.date}</span></div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-foreground">{r.timeIn}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-foreground">{r.timeOut ?? <span className="text-primary animate-pulse">Active</span>}</span>
                <span className={r.overtimeHours > 0 ? "text-indigo-400" : "text-muted-foreground"}>{r.totalHours != null ? r.totalHours + "h" : "—"}</span>
              </div>
            </div>
          ))}
          {myRecords.length === 0 && <div className="px-5 py-8 text-center text-xs text-muted-foreground">No attendance records yet</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Check-Out Page ───────────────────────────────────────────────────────────

function CheckOutPage({ user, attendance, onUpdate }: { user: User; attendance: AttendanceRecord[]; onUpdate: (r: AttendanceRecord[]) => void; }) {
  const todayStr = todayStrPHT();
  const todayRecord = attendance.find(r => r.employeeId === user.employeeId && r.date === todayStr);
  const [showModal, setShowModal] = useState(false);

  if (!todayRecord) return (
    <div className="p-6"><div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">No check-in found for today. Please check in first.</div></div>
  );

  if (todayRecord.timeOut) return (
    <div className="p-4 sm:p-6 max-w-lg">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center"><CheckCheck size={18} className="text-emerald-400" /></div>
          <div><p className="text-sm font-semibold text-foreground">Already Checked Out</p><p className="text-xs text-muted-foreground">{todayStr}</p></div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Time In</p><p className="text-sm font-bold text-foreground mt-1">{todayRecord.timeIn}</p></div>
          <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Time Out</p><p className="text-sm font-bold text-foreground mt-1">{todayRecord.timeOut}</p></div>
          <div><p className="text-[10px] font-mono text-muted-foreground uppercase">Total Hrs</p><p className="text-sm font-bold text-primary mt-1">{todayRecord.totalHours}h</p></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-md">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Check Out</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Verify your identity to record check-out time</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center py-3 border-y border-border">
          <div><p className="text-[10px] font-mono text-muted-foreground">CHECKED IN</p><p className="text-sm font-bold text-foreground mt-1">{todayRecord.timeIn}</p></div>
          <div><p className="text-[10px] font-mono text-muted-foreground">STATUS</p><div className="mt-1"><StatusBadge status={todayRecord.status} /></div></div>
          <div><p className="text-[10px] font-mono text-muted-foreground">AUTH</p><p className="text-[10px] text-muted-foreground mt-1 truncate">{todayRecord.authMethod}</p></div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 rounded-xl py-3 text-sm font-semibold hover:bg-red-500/25 active:scale-[0.99] transition-all">
          <LogOut size={15} /> Check Out Now
        </button>
      </div>
      {showModal && (
        <CheckOutModal user={user} todayRecord={todayRecord}
          onComplete={(updated) => { onUpdate(attendance.map(r => r.id === todayRecord.id ? updated : r)); setShowModal(false); }}
          onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

// ─── Attendance History Page ──────────────────────────────────────────────────

function AttendanceHistoryPage({ attendance, employeeId, isAdmin, onUpdateOT }: {
  attendance: AttendanceRecord[]; employeeId?: string; isAdmin?: boolean;
  onUpdateOT?: (id: string, status: OTStatus) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const base = useMemo(() => attendance.filter(r => !employeeId || r.employeeId === employeeId), [attendance, employeeId]);
  const filtered = useMemo(() => base.filter(r => {
    if (filter !== "all" && r.status.toLowerCase() !== filter.toLowerCase()) return false;
    if (monthFilter && !r.date.startsWith(monthFilter)) return false;
    if (search && !r.date.includes(search) && !r.employeeId.toLowerCase().includes(search.toLowerCase()) && !r.authMethod.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [base, filter, search, monthFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleExport() {
    exportCSV("attendance_history.csv",
      ["Date", "Emp ID", "Status", "Time In", "Time Out", "Total Hrs", "Late (min)", "OT Hrs", "Auth Method", "GPS Score", "Risk", "Geofence"],
      filtered.map(r => [r.date, r.employeeId, r.status, r.timeIn, r.timeOut ?? "", r.totalHours ?? "", r.late, r.overtimeHours, r.authMethod, r.gps?.accuracyScore ?? "", r.gps?.riskLevel ?? "", r.gps?.geofenceName ?? ""])
    );
    toast.success("Exported to CSV");
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">{isAdmin ? "Attendance Logs" : "My Attendance History"}</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} records</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-1.5">
            <Search size={12} className="text-muted-foreground" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none w-28" />
            {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
          </div>
          <input type="month" value={monthFilter} onChange={e => { setMonthFilter(e.target.value); setPage(1); }} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none" />
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25"><Download size={12} /> CSV</button>
          <button onClick={() => { window.print(); toast.info("Print dialog opened"); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground"><Download size={12} /> PDF</button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {["all", "Early", "On Time", "Late", "Absent", "Holiday"].map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${filter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {isAdmin && <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Emp ID</th>}
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Date</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Status</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Time In</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Time Out</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Total</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Late</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">OT</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">Auth</th>
                <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">GPS / Risk</th>
                {isAdmin && <th className="px-3 py-2 text-left text-[10px] font-mono text-muted-foreground uppercase">OT Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paged.map((r, i) => (
                <tr key={r.id} className={`hover:bg-secondary/20 transition-colors ${i % 2 ? "bg-secondary/5" : ""}`}>
                  {isAdmin && <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.employeeId}</td>}
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.date}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="px-3 py-2.5 font-mono text-foreground">{r.timeIn}</td>
                  <td className="px-3 py-2.5 font-mono text-foreground">{r.timeOut ?? "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-foreground">{r.totalHours != null ? r.totalHours + "h" : <span className="text-primary text-[10px] animate-pulse">Active</span>}</td>
                  <td className={`px-3 py-2.5 font-mono ${r.late > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{r.late > 0 ? r.late + "m" : "—"}</td>
                  <td className={`px-3 py-2.5 font-mono ${r.overtimeHours > 0 ? "text-indigo-400" : "text-muted-foreground"}`}>{r.overtimeHours > 0 ? r.overtimeHours + "h" : "—"}</td>
                  <td className="px-3 py-2.5 text-[10px] text-muted-foreground max-w-24 truncate">{r.authMethod.split(" · ")[0]}</td>
                  <td className="px-3 py-2.5">
                    {r.gps ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono font-bold ${r.gps.accuracyScore >= 80 ? "text-emerald-400" : r.gps.accuracyScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {r.gps.accuracyScore}
                        </span>
                        <RiskBadge level={r.gps.riskLevel} />
                      </div>
                    ) : <span className="text-muted-foreground text-[10px]">—</span>}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      {r.otStatus === "Pending" && onUpdateOT ? (
                        <div className="flex gap-1">
                          <button onClick={() => { onUpdateOT(r.id, "Approved"); toast.success("OT approved"); }} className="p-1 bg-emerald-500/15 rounded hover:bg-emerald-500/25" title="Approve"><ThumbsUp size={10} className="text-emerald-400" /></button>
                          <button onClick={() => { onUpdateOT(r.id, "Rejected"); toast.error("OT rejected"); }} className="p-1 bg-red-500/15 rounded hover:bg-red-500/25" title="Reject"><ThumbsDown size={10} className="text-red-400" /></button>
                        </div>
                      ) : r.otStatus ? <StatusBadge status={r.otStatus} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                </tr>
              ))}
              {paged.length === 0 && <tr><td colSpan={12} className="px-5 py-10 text-center text-muted-foreground text-xs font-mono">No records match your filters</td></tr>}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-[10px] font-mono text-muted-foreground">Page {page} of {totalPages} · {filtered.length} records</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-secondary rounded text-xs disabled:opacity-40 hover:bg-muted">Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-secondary rounded text-xs disabled:opacity-40 hover:bg-muted">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Schedule Page ────────────────────────────────────────────────────────────

function SchedulePage({ user }: { user: User; }) {
  const today = getPHTDate().toLocaleDateString("en-US", { weekday: "long" });
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const rules = [
    { label: "Before 7:00 AM", status: "Early", color: "text-sky-400" },
    { label: "Exactly 7:00 AM", status: "On Time", color: "text-emerald-400" },
    { label: "After 7:00 AM", status: "Late", color: "text-amber-400" },
    { label: "After 4:00 PM (checkout)", status: "Overtime", color: "text-indigo-400" },
  ];
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-xl">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Weekly Schedule</h3>
        <div className="space-y-2">
          {days.map(day => {
            const isWork = !["Saturday", "Sunday"].includes(day);
            const isToday = day === today;
            return (
              <div key={day} className={`flex items-center justify-between p-3 rounded-lg ${isToday ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isToday ? "bg-primary" : isWork ? "bg-emerald-500/60" : "bg-muted-foreground/30"}`} />
                  <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{day}</span>
                  {isToday && <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">TODAY</span>}
                </div>
                {isWork ? <span className="text-xs font-mono text-foreground">7:00 AM – 4:00 PM · 9h</span> : <span className="text-xs font-mono text-muted-foreground/50">Rest Day</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Attendance Status Rules</h3>
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.status} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className={`text-xs font-bold font-mono ${r.color}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

// Custom SVG grouped bar chart — avoids recharts multi-Bar duplicate key bug
function WeeklyAttendanceChart({ data }: { data: { day: string; present: number; late: number; early: number }[] }) {
  const W = 500; const H = 140;
  const PAD = { top: 8, right: 8, bottom: 24, left: 28 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.flatMap(d => [d.present, d.late, d.early]), 1);
  const groupW = iW / data.length;
  const barW = Math.min(10, (groupW - 6) / 3);
  const gap = 2;
  const series = [
    { key: "present" as const, color: "#00d4aa" },
    { key: "late" as const, color: "#f59e0b" },
    { key: "early" as const, color: "#38bdf8" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        {/* Y gridlines */}
        {[0, Math.round(maxVal / 2), maxVal].map(v => {
          const y = PAD.top + iH - (v / maxVal) * iH;
          return (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#6b7fa8" fontFamily="JetBrains Mono">{v}</text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, gi) => {
          const groupX = PAD.left + gi * groupW + groupW / 2 - (series.length * (barW + gap) - gap) / 2;
          return (
            <g key={d.day}>
              {series.map((s, si) => {
                const val = d[s.key];
                const bh = (val / maxVal) * iH;
                const bx = groupX + si * (barW + gap);
                const by = PAD.top + iH - bh;
                return <rect key={s.key} x={bx} y={by} width={barW} height={bh} fill={s.color} rx={2} />;
              })}
              <text x={PAD.left + gi * groupW + groupW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7fa8" fontFamily="JetBrains Mono">{d.day}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 mt-1">
        {[["Present", "#00d4aa"], ["Late", "#f59e0b"], ["Early", "#38bdf8"]].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: c }} /> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard({ employees, attendance, onNavigate, onUpdateOT }: {
  employees: Employee[]; attendance: AttendanceRecord[];
  onNavigate: (p: AnyPage) => void;
  onUpdateOT: (id: string, status: OTStatus) => void;
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const todayStr = todayStrPHT();
  const todayAtt = attendance.filter(r => r.date === todayStr);
  const present = todayAtt.filter(r => r.status === "On Time" || r.status === "Early").length;
  const late = todayAtt.filter(r => r.status === "Late").length;
  const absent = employees.filter(e => e.status === "Active" && !todayAtt.find(r => r.employeeId === e.employeeId)).length;
  const totalOT = attendance.reduce((s, r) => s + r.overtimeHours, 0);
  const pendingOT = attendance.filter(r => r.otStatus === "Pending");

  const displayRecords = useMemo(() => {
    const merged = employees.filter(e => e.status === "Active").map(e => {
      const rec = todayAtt.find(r => r.employeeId === e.employeeId);
      return { ...e, timeIn: rec?.timeIn ?? "—", attStatus: rec?.status ?? "Absent", authMethod: rec?.authMethod };
    });
    return statusFilter === "all" ? merged : merged.filter(e => e.attStatus === statusFilter);
  }, [employees, todayAtt, statusFilter]);

  function exportReport() {
    exportCSV(`attendance_${todayStr}.csv`,
      ["Emp ID", "Name", "Dept", "Status", "Time In", "Auth Method"],
      displayRecords.map(e => [e.employeeId, `${e.firstName} ${e.lastName}`, e.department, e.attStatus, e.timeIn, e.authMethod ?? ""])
    );
    toast.success("Report exported");
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">Admin Dashboard</h2>
          <p className="text-xs text-muted-foreground">{fmtDatePHT(new Date())} · June 1–15 cutoff</p></div>
        <button onClick={exportReport} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25"><Download size={12} /> Export Today</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Employees" value={String(employees.filter(e => e.status === "Active").length)} sub="Total headcount" icon={Users} color="bg-sky-500/15 text-sky-400" />
        <StatCard label="Present Today" value={String(present + late)} sub={`${late} late · ${present} on time/early`} icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Absent Today" value={String(absent)} sub="Not checked in" icon={AlertCircle} color="bg-amber-500/15 text-amber-400" />
        <StatCard label="Pending OT" value={String(pendingOT.length)} sub={`${totalOT.toFixed(1)}h total OT`} icon={TrendingUp} color="bg-indigo-500/15 text-indigo-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Daily Attendance — This Week</h3>
          <WeeklyAttendanceChart data={DAILY_CHART} />
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Pending OT Approvals</h3>
          {pendingOT.length === 0
            ? <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">No pending OT requests</div>
            : (
              <div className="space-y-2">
                {pendingOT.slice(0, 5).map(r => {
                  const emp = employees.find(e => e.employeeId === r.employeeId);
                  return (
                    <div key={r.id} className="flex items-center justify-between p-2.5 bg-secondary/50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-foreground">{emp?.firstName} {emp?.lastName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{r.date} · {r.overtimeHours}h OT</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => { onUpdateOT(r.id, "Approved"); toast.success("OT approved"); }} className="flex items-center gap-1 px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded text-[10px] font-mono hover:bg-emerald-500/25"><ThumbsUp size={9} /> Approve</button>
                        <button onClick={() => { onUpdateOT(r.id, "Rejected"); toast.error("OT rejected"); }} className="flex items-center gap-1 px-2 py-1 bg-red-500/15 text-red-400 rounded text-[10px] font-mono hover:bg-red-500/25"><ThumbsDown size={9} /> Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* Today's log */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Today&apos;s Attendance Log</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setFilterOpen(p => !p)} className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 bg-secondary rounded-lg">
                <Filter size={10} /> {statusFilter === "all" ? "All" : statusFilter} {filterOpen ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-20 overflow-hidden min-w-24">
                  {["all", "On Time", "Early", "Late", "Absent"].map(s => (
                    <button key={s} onClick={() => { setStatusFilter(s); setFilterOpen(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-mono hover:bg-secondary ${statusFilter === s ? "text-primary" : "text-muted-foreground"}`}>{s}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => onNavigate("attendance")} className="text-[10px] font-mono text-primary hover:underline">View All</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-6 px-5 py-2 border-b border-border bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase min-w-[500px]">
            <span className="col-span-2">Employee</span><span>Dept</span><span>Status</span><span>Time In</span><span>Auth</span>
          </div>
          <div className="divide-y divide-border/40">
            {displayRecords.map(emp => (
              <div key={emp.id} className="grid grid-cols-6 px-5 py-3 items-center hover:bg-secondary/20 transition-colors text-xs min-w-[500px]">
                <div className="col-span-2 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{emp.avatar}</div>
                  <div><p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p><p className="text-[10px] font-mono text-muted-foreground">{emp.employeeId}</p></div>
                </div>
                <span className="text-muted-foreground text-[10px]">{emp.department}</span>
                <StatusBadge status={emp.attStatus} />
                <span className="font-mono text-foreground">{emp.timeIn}</span>
                <span className="text-[10px] text-muted-foreground truncate">{emp.authMethod ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee Form + Employee Management ──────────────────────────────────────

interface EmpFormData {
  employeeId: string; firstName: string; lastName: string; email: string;
  department: string; position: string; role: Role; schedule: string;
  fingerprintId: string; contactNumber: string; status: EmpStatus;
}

function EmployeeFormModal({ employee, onSave, onClose }: { employee?: Employee; onSave: (d: EmpFormData) => void; onClose: () => void; }) {
  const [form, setForm] = useState<EmpFormData>({
    employeeId: employee?.employeeId ?? `EMP-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    firstName: employee?.firstName ?? "", lastName: employee?.lastName ?? "",
    email: employee?.email ?? "", department: employee?.department ?? DEPARTMENTS[0],
    position: employee?.position ?? "", role: employee?.role ?? "employee",
    schedule: employee?.schedule ?? SCHEDULES[0], fingerprintId: employee?.fingerprintId ?? "",
    contactNumber: employee?.contactNumber ?? "", status: employee?.status ?? "Active",
  });
  const set = (k: keyof EmpFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={employee ? `Edit — ${employee.firstName} ${employee.lastName}` : "Add New Employee"} onClose={onClose} wide>
      <form onSubmit={e => { e.preventDefault(); if (!form.firstName.trim() || !form.email.trim()) { toast.error("Name and email required"); return; } onSave(form); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee ID"><input value={form.employeeId} onChange={set("employeeId")} className={inputCls} /></Field>
          <Field label="Status"><select value={form.status} onChange={set("status")} className={selectCls}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></Field>
          <Field label="First Name"><input value={form.firstName} onChange={set("firstName")} placeholder="Maria" className={inputCls} required /></Field>
          <Field label="Last Name"><input value={form.lastName} onChange={set("lastName")} placeholder="Santos" className={inputCls} required /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={set("email")} placeholder="name@techcorp.ph" className={inputCls} required /></Field>
          <Field label="Contact"><input value={form.contactNumber} onChange={set("contactNumber")} placeholder="09171234567" className={inputCls} /></Field>
          <Field label="Department"><select value={form.department} onChange={set("department")} className={selectCls}>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
          <Field label="Position"><input value={form.position} onChange={set("position")} placeholder="Software Developer" className={inputCls} /></Field>
          <Field label="Role"><select value={form.role} onChange={set("role")} className={selectCls}><option value="employee">Employee</option><option value="admin">Admin</option></select></Field>
          <Field label="Schedule"><select value={form.schedule} onChange={set("schedule")} className={selectCls}>{SCHEDULES.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
          <Field label="Fingerprint ID"><input value={form.fingerprintId} onChange={set("fingerprintId")} placeholder="FP-1000" className={inputCls} /></Field>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">{employee ? "Save Changes" : "Add Employee"}</button>
        </div>
      </form>
    </Modal>
  );
}

function AdminEmployeesPage({ employees, onUpdate, onAddAuditLog, adminUser }: {
  employees: Employee[]; onUpdate: (e: Employee[]) => void;
  onAddAuditLog: (log: Omit<AuditLog, "id">) => void;
  adminUser: User;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Archived">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | "view" | "archive" | "restore" | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);

  const filtered = useMemo(() => employees.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (search && !`${e.firstName} ${e.lastName} ${e.employeeId} ${e.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [employees, statusFilter, deptFilter, search]);

  function handleSave(data: EmpFormData) {
    const name = `${data.firstName} ${data.lastName}`;
    if (selected) {
      onUpdate(employees.map(e => e.id === selected.id ? { ...e, ...data, avatar: initials(name) } : e));
      onAddAuditLog({ action: "Employee Updated", adminName: adminUser.name, adminId: adminUser.employeeId, target: `${name} (${data.employeeId})`, details: "Employee information updated", timestamp: fmtTimePHTShort(new Date()) + " · " + todayStrPHT() });
      toast.success(`${data.firstName} updated`);
    } else {
      const newEmp = { id: String(Date.now()), ...data, avatar: initials(name) };
      onUpdate([...employees, newEmp]);
      onAddAuditLog({ action: "Employee Created", adminName: adminUser.name, adminId: adminUser.employeeId, target: `${name} (${data.employeeId})`, details: "New employee account created", timestamp: fmtTimePHTShort(new Date()) + " · " + todayStrPHT() });
      toast.success(`${data.firstName} added`);
    }
    setModal(null); setSelected(null);
  }

  function doArchive() {
    if (!selected) return;
    onUpdate(employees.map(e => e.id === selected.id ? { ...e, status: "Archived" as EmpStatus } : e));
    onAddAuditLog({ action: "Employee Archived", adminName: adminUser.name, adminId: adminUser.employeeId, target: `${selected.firstName} ${selected.lastName} (${selected.employeeId})`, details: "Employee archived — account access revoked, records retained", timestamp: fmtTimePHTShort(new Date()) + " · " + todayStrPHT() });
    toast.success(`${selected.firstName} ${selected.lastName} archived`);
    setModal(null); setSelected(null);
  }

  function doRestore(emp: Employee) {
    onUpdate(employees.map(e => e.id === emp.id ? { ...e, status: "Active" as EmpStatus } : e));
    onAddAuditLog({ action: "Employee Restored", adminName: adminUser.name, adminId: adminUser.employeeId, target: `${emp.firstName} ${emp.lastName} (${emp.employeeId})`, details: "Employee restored — account access reinstated", timestamp: fmtTimePHTShort(new Date()) + " · " + todayStrPHT() });
    toast.success(`${emp.firstName} ${emp.lastName} restored`);
  }

  const activeCount = employees.filter(e => e.status === "Active").length;
  const archivedCount = employees.filter(e => e.status === "Archived").length;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Employee Management</h2>
          <p className="text-xs text-muted-foreground">{activeCount} active · {archivedCount} archived</p>
        </div>
        <button onClick={() => { setSelected(null); setModal("add"); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25"><Plus size={12} /> Add Employee</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-1.5">
          <Search size={12} className="text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, email..." className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none w-44" />
          {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
        </div>
        <div className="flex gap-1">
          {(["all", "Active", "Archived"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${statusFilter === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {s}
            </button>
          ))}
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none">
          <option value="all">All Departments</option>{DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground self-center">{filtered.length} shown</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 px-5 py-2 border-b border-border bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase min-w-[600px]">
            <span className="col-span-2">Name / ID</span><span>Dept</span><span>Position</span><span>Status</span><span>Bio</span><span>Role</span><span>Actions</span>
          </div>
          <div className="divide-y divide-border/40">
            {filtered.map(emp => (
              <div key={emp.id} className={`grid grid-cols-8 px-5 py-3.5 items-center hover:bg-secondary/20 text-xs min-w-[600px] ${emp.status === "Archived" ? "opacity-60" : ""}`}>
                <div className="col-span-2 flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${emp.status === "Archived" ? "bg-secondary text-muted-foreground" : "bg-primary/15 text-primary"}`}>{emp.avatar}</div>
                  <div><p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p><p className="text-[10px] font-mono text-muted-foreground">{emp.employeeId}</p></div>
                </div>
                <span className="text-muted-foreground text-[10px]">{emp.department}</span>
                <span className="text-muted-foreground text-[10px]">{emp.position}</span>
                <StatusBadge status={emp.status} />
                <span className={`text-[10px] font-mono ${emp.fingerprintId ? "text-emerald-400" : "text-muted-foreground"}`}>{emp.fingerprintId ? "Yes" : "No"}</span>
                <span className="text-muted-foreground capitalize text-[10px]">{emp.role}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setSelected(emp); setModal("view"); }} className="p-1.5 hover:bg-sky-500/15 rounded-lg" title="View"><Eye size={11} className="text-sky-400" /></button>
                  {emp.status === "Active" && (
                    <button onClick={() => { setSelected(emp); setModal("edit"); }} className="p-1.5 hover:bg-primary/15 rounded-lg" title="Edit"><Pencil size={11} className="text-primary" /></button>
                  )}
                  {emp.status === "Active" ? (
                    <button onClick={() => { setSelected(emp); setModal("archive"); }} className="p-1.5 hover:bg-amber-500/15 rounded-lg" title="Archive Employee">
                      <Archive size={11} className="text-amber-400" />
                    </button>
                  ) : (
                    <button onClick={() => doRestore(emp)} className="p-1.5 hover:bg-emerald-500/15 rounded-lg" title="Restore Employee">
                      <RotateCcw size={11} className="text-emerald-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs font-mono">No employees match your search</div>}
          </div>
        </div>
      </div>

      {(modal === "add" || modal === "edit") && <EmployeeFormModal employee={modal === "edit" ? selected ?? undefined : undefined} onSave={handleSave} onClose={() => { setModal(null); setSelected(null); }} />}

      {modal === "view" && selected && (
        <Modal title={`Profile — ${selected.firstName} ${selected.lastName}`} onClose={() => { setModal(null); setSelected(null); }}>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">{selected.avatar}</div>
              <div><p className="font-semibold text-foreground">{selected.firstName} {selected.lastName}</p><p className="text-xs font-mono text-muted-foreground">{selected.employeeId}</p><StatusBadge status={selected.status} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[["Email", selected.email], ["Contact", selected.contactNumber], ["Dept", selected.department], ["Position", selected.position], ["Schedule", selected.schedule], ["Fingerprint", selected.fingerprintId || "Not enrolled"]].map(([k, v]) => (
                <div key={k} className="bg-secondary/50 rounded-lg p-3"><p className="text-[10px] font-mono text-muted-foreground uppercase">{k}</p><p className="text-xs text-foreground mt-1">{v}</p></div>
              ))}
            </div>
            <button onClick={() => { setModal(null); setSelected(null); }} className="w-full py-2 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Close</button>
          </div>
        </Modal>
      )}

      {modal === "archive" && selected && (
        <Modal title="Archive Employee" onClose={() => { setModal(null); setSelected(null); }}>
          <div className="space-y-4">
            <div className="flex gap-3 items-start p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <Archive size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">Archive Employee</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to archive <strong className="text-foreground">{selected.firstName} {selected.lastName}</strong>?
                  The employee will no longer be able to access the system, but all attendance records, payroll history, and account information will be retained.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setSelected(null); }} className="flex-1 py-2 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={doArchive} className="flex-1 py-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/25 flex items-center justify-center gap-2">
                <Archive size={13} /> Archive Employee
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Employee Profile Page ────────────────────────────────────────────────────

function ProfilePage({ user, employees, accounts, onUpdatePassword }: {
  user: User; employees: Employee[];
  accounts: RegisteredAccount[];
  onUpdatePassword: (userId: string, newHash: string) => void;
}) {
  const emp = employees.find(e => e.employeeId === user.employeeId);
  const [editing, setEditing] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const account = accounts.find(a => a.employeeId === user.employeeId);

  function handlePwChange(e: React.FormEvent) {
    e.preventDefault(); setPwError("");
    if (!account) return;
    if (!verifyPassword(pwForm.current, account.passwordHash)) { setPwError("Current password is incorrect."); return; }
    if (pwForm.newPw.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    onUpdatePassword(account.userId, simpleHash(pwForm.newPw));
    toast.success("Password changed successfully");
    setShowPwForm(false); setPwForm({ current: "", newPw: "", confirm: "" });
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <h2 className="text-sm font-semibold text-foreground">My Profile</h2>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">{user.avatar}</div>
          <div>
            <p className="text-lg font-bold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.position} · {user.department}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{user.employeeId}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Employee ID", user.employeeId],
            ["Email", account?.email ?? "—"],
            ["Department", user.department],
            ["Position", user.position],
            ["Schedule", emp?.schedule ?? "7:00 AM – 4:00 PM"],
            ["Role", user.role],
            ["Contact", emp?.contactNumber || "Not set"],
            ["Status", emp?.status ?? "Active"],
          ].map(([k, v]) => (
            <div key={k} className="bg-secondary/50 rounded-lg p-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{k}</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Lock size={14} className="text-primary" /><h3 className="text-xs font-semibold text-foreground">Change Password</h3></div>
          <button onClick={() => setShowPwForm(f => !f)} className="text-[10px] text-primary hover:underline">{showPwForm ? "Cancel" : "Change"}</button>
        </div>
        {showPwForm ? (
          <form onSubmit={handlePwChange} className="space-y-3">
            <Field label="Current Password"><input type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} className={inputCls} placeholder="Current password" required /></Field>
            <Field label="New Password"><input type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} className={inputCls} placeholder="Min. 8 characters" required /></Field>
            <Field label="Confirm New Password"><input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} className={inputCls} placeholder="Repeat new password" required /></Field>
            {pwError && <p className="text-xs text-red-400">{pwError}</p>}
            <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90">Update Password</button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">Your password was last changed when your account was created.</p>
        )}
      </div>
    </div>
  );
}

// ─── Audit Logs Page ──────────────────────────────────────────────────────────

function AuditLogsPage({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => logs.filter(l =>
    !search || l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.target?.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase())
  ), [logs, search]);

  const actionColor: Record<string, string> = {
    "Employee Created": "text-emerald-400 bg-emerald-500/10",
    "Employee Archived": "text-amber-400 bg-amber-500/10",
    "Employee Restored": "text-sky-400 bg-sky-500/10",
    "Employee Updated": "text-indigo-400 bg-indigo-500/10",
    "OT Approved": "text-emerald-400 bg-emerald-500/10",
    "OT Rejected": "text-red-400 bg-red-500/10",
    "Holiday Added": "text-amber-400 bg-amber-500/10",
  };

  function exportLogs() {
    exportCSV("audit_logs.csv",
      ["Timestamp", "Action", "Admin", "Admin ID", "Target", "Details"],
      filtered.map(l => [l.timestamp, l.action, l.adminName, l.adminId, l.target ?? "", l.details])
    );
    toast.success("Audit logs exported");
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Audit Logs</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} records</p>
        </div>
        <button onClick={exportLogs} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25"><Download size={12} /> Export CSV</button>
      </div>
      <div className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-1.5 w-full max-w-xs">
        <Search size={12} className="text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action, admin, employee..." className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none flex-1" />
        {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground" /></button>}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-6 px-5 py-2 border-b border-border bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase">
          <span className="col-span-2">Action</span><span>Admin</span><span className="col-span-2">Target / Details</span><span>Timestamp</span>
        </div>
        <div className="divide-y divide-border/40">
          {filtered.map(l => (
            <div key={l.id} className="grid grid-cols-6 px-5 py-3 items-start hover:bg-secondary/20 text-xs">
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono ${actionColor[l.action] ?? "text-muted-foreground bg-secondary"}`}>{l.action}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">{l.adminName}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{l.adminId}</p>
              </div>
              <div className="col-span-2">
                {l.target && <p className="font-medium text-foreground">{l.target}</p>}
                <p className="text-[10px] text-muted-foreground">{l.details}</p>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{l.timestamp}</p>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs font-mono">No audit logs found</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Leaflet Map Helper Components ──────────────────────────────────────────

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void; }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number; }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 17, { animate: true, duration: 1.5 });
  }, [lat, lng, map]);
  return null;
}

function CurrentLocationButton({ onLocation }: { onLocation: (lat: number, lng: number) => void; }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    const toastId = toast.loading("Acquiring high-precision GPS...");

    let bestAccuracy = Infinity;
    let bestPosition: GeolocationPosition | null = null;
    let watchId: number;

    // Cleanup function when we find a good location or hit the timeout
    const finish = (msg: string, success: boolean) => {
      navigator.geolocation.clearWatch(watchId);
      setLocating(false);
      
      if (success && bestPosition) {
        const lat = bestPosition.coords.latitude;
        const lng = bestPosition.coords.longitude;
        map.flyTo([lat, lng], 18);
        onLocation(lat, lng);
        toast.success(`Location pinned (Accuracy: ±${Math.round(bestPosition.coords.accuracy)}m)`, { id: toastId });
      } else {
        toast.error(msg, { id: toastId });
      }
    };

    // Fallback: If we don't get a perfect lock in 8 seconds, use the best reading we found.
    const timeout = setTimeout(() => {
      if (bestPosition) {
         finish("Timeout reached. Used best available accuracy.", true);
      } else {
         finish("Could not acquire location. Please try outdoors.", false);
      }
    }, 8000);

    // Use watchPosition instead of getCurrentPosition to capture the hardware warmup
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Skip terrible initial network pings (>100m) unless it's literally our only data
        if (position.coords.accuracy > 100 && bestPosition === null) return;

        // Keep track of the most accurate ping we receive
        if (position.coords.accuracy < bestAccuracy) {
          bestAccuracy = position.coords.accuracy;
          bestPosition = position;
        }

        // Early Exit: If we get a highly accurate lock (< 15m), stop immediately
        if (position.coords.accuracy <= 15) {
          clearTimeout(timeout);
          finish("Perfect lock acquired", true);
        }
      },
      (error) => {
        // Only error out if we haven't found at least one usable location
        if (!bestPosition) {
          clearTimeout(timeout);
          finish(error.code === 1 ? "Permission denied." : "Signal lost.", false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }

  return (
    <button
      type="button"
      onClick={locate}
      disabled={locating}
      className="absolute top-3 right-3 z-[400] bg-card border border-border rounded-lg px-3 py-2 text-xs font-semibold shadow-lg hover:bg-primary/10 transition-colors disabled:opacity-70 flex items-center gap-1.5"
    >
      {locating ? <RefreshCw size={12} className="animate-spin text-primary" /> : "📍"}
      {locating ? "Acquiring..." : "Use My Location"}
    </button>
  );
}

function SearchLocation({ onSelect }: { onSelect: (lat: number, lng: number, displayName: string) => void; }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      // Using OpenStreetMap's free Nominatim API
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (!data.length) {
        toast.error("Location not found.");
        setSearching(false);
        return;
      }
      
      const result = data[0];
      const lat = Number(result.lat);
      const lng = Number(result.lon);
      
      map.flyTo([lat, lng], 17);
      onSelect(lat, lng, result.display_name);
      toast.success("Location found.");
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="absolute top-3 left-3 z-[400] flex gap-2 w-[calc(100%-140px)] max-w-sm shadow-lg">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
        placeholder="Search address (e.g., University of Santo Tomas)..."
        className="bg-card border border-border rounded-lg px-3 py-2 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="button"
        onClick={search}
        disabled={searching}
        className="bg-primary text-primary-foreground rounded-lg px-4 text-xs font-semibold disabled:opacity-70"
      >
        {searching ? "..." : "Search"}
      </button>
    </div>
  );
}



// ─── Geofence Manager Page ────────────────────────────────────────────────────
function GeofencePage({ zones, onUpdate }: { zones: GeofenceZone[]; onUpdate: (z: GeofenceZone[]) => void }) {
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<GeofenceZone | null>(null);
  const [form, setForm] = useState({ name: "", address: "", lat: "", lng: "", radius: "100", active: true });
  const [formError, setFormError] = useState("");
  
  // Default map center (e.g., Manila)
  const [mapCenter, setMapCenter] = useState<[number, number]>([14.5995, 120.9842]);

  function openAdd() {
    setForm({ name: "", address: "", lat: "", lng: "", radius: "100", active: true });
    setMapCenter([14.5995, 120.9842]);
    setSelected(null);
    setFormError("");
    setModal("add");
  }

  function openEdit(z: GeofenceZone) {
    setForm({
      name: z.name,
      address: z.address,
      lat: String(z.lat),
      lng: String(z.lng),
      radius: String(z.radius),
      active: z.active,
    });
    setMapCenter([z.lat, z.lng]);
    setSelected(z);
    setFormError("");
    setModal("edit");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault(); 
    setFormError("");
    
    const lat = parseFloat(form.lat); 
    const lng = parseFloat(form.lng); 
    const radius = parseInt(form.radius);

    if (!form.name.trim()) { setFormError("Zone name is required."); return; }
    if (isNaN(lat) || lat < -90 || lat > 90) { setFormError("Invalid latitude (must be -90 to 90). Click on the map to set."); return; }
    if (isNaN(lng) || lng < -180 || lng > 180) { setFormError("Invalid longitude (must be -180 to 180). Click on the map to set."); return; }
    if (isNaN(radius) || radius < 10 || radius > 5000) { setFormError("Radius must be 10–5000 meters."); return; }

    const data: Omit<GeofenceZone, "id" | "createdAt"> = { 
      name: form.name.trim(), 
      address: form.address.trim(), 
      lat, lng, radius, active: form.active 
    };

    if (selected) {
      onUpdate(zones.map(z => z.id === selected.id ? { ...z, ...data } : z));
      toast.success(`"${data.name}" updated`);
    } else {
      onUpdate([...zones, { id: `gf-${Date.now()}`, createdAt: todayStrPHT(), ...data }]);
      toast.success(`"${data.name}" geofence created`);
    }
    setModal(null); setSelected(null);
  }

  function toggleActive(z: GeofenceZone) {
    onUpdate(zones.map(g => g.id === z.id ? { ...g, active: !g.active } : g));
    toast.success(`"${z.name}" ${z.active ? "deactivated" : "activated"}`);
  }

  const activeCount = zones.filter(z => z.active).length;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Geofence Zones</h2>
          <p className="text-xs text-muted-foreground">{activeCount} active · {zones.length - activeCount} inactive</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25">
          <Plus size={12} /> Add Zone
        </button>
      </div>

      {/* Info card */}
      <div className="flex gap-2.5 p-3 bg-primary/5 border border-primary/20 rounded-xl">
        <Target size={16} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">Admin-Controlled Geofencing</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Employees can only check in when inside an active geofence zone. The system uses the Haversine formula to compute precise distances.
          </p>
        </div>
      </div>

      {/* Zones list */}
      <div className="space-y-3">
        {zones.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
            <Target size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-mono">No geofence zones configured. Add your first zone.</p>
          </div>
        )}
        
        {zones.map(z => (
          <div key={z.id} className={`bg-card border rounded-xl p-4 space-y-3 transition-all ${z.active ? "border-primary/25" : "border-border opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${z.active ? "bg-primary/15" : "bg-muted"}`}>
                  <MapPin size={16} className={z.active ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{z.name}</p>
                    <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${z.active ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-muted-foreground bg-secondary border-border"}`}>
                      {z.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{z.address || "No address"}</p>
                  <div className="flex flex-wrap gap-3 mt-1.5 text-[10px] font-mono">
                    <span className="text-muted-foreground">Lat: <span className="text-foreground">{z.lat.toFixed(5)}</span></span>
                    <span className="text-muted-foreground">Lng: <span className="text-foreground">{z.lng.toFixed(5)}</span></span>
                    <span className="text-muted-foreground">Radius: <span className="text-primary">{z.radius}m</span></span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <a href={`https://www.openstreetmap.org/?mlat=${z.lat}&mlon=${z.lng}#map=18/${z.lat}/${z.lng}`} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-primary/15 rounded-lg" title="Open in Maps">
                  <ExternalLink size={12} className="text-primary" />
                </a>
                <button onClick={() => openEdit(z)} className="p-1.5 hover:bg-primary/15 rounded-lg" title="Edit">
                  <Pencil size={12} className="text-primary" />
                </button>
                <button onClick={() => toggleActive(z)} className="p-1.5 hover:bg-amber-500/15 rounded-lg" title={z.active ? "Deactivate" : "Activate"}>
                  {z.active ? <XCircleIcon size={12} className="text-amber-400" /> : <CheckCircle size={12} className="text-emerald-400" />}
                </button>
                <button onClick={() => { setSelected(z); setModal("delete"); }} className="p-1.5 hover:bg-red-500/15 rounded-lg" title="Delete">
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            </div>
            
            {/* Visual radius indicator */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>Zone radius</span><span>{z.radius}m of 5000m max</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${z.active ? "bg-primary" : "bg-muted-foreground/30"}`} style={{ width: `${Math.min((z.radius / 5000) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Add Geofence Zone" : `Edit — ${selected?.name}`} onClose={() => { setModal(null); setSelected(null); }} wide>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zone Name *">
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="TechCorp HQ" className={inputCls} required />
              </Field>
              <Field label="Address (optional)">
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Ayala Ave, Makati City" className={inputCls} />
              </Field>
            </div>

            {/* Interactive Leaflet Map Field */}
            <Field label="Pin Location on Map">
              <div className="relative">
                {/* Notice z-index adjustment: Leaflet creates stacking contexts, z-[0] keeps it behind standard React modals */}
                <div className="w-full h-[320px] rounded-xl overflow-hidden border border-border z-[0] relative">
                  <MapContainer
                    center={mapCenter}
                    zoom={16}
                    style={{ width: "100%", height: "100%" }}
                    zoomControl={false} // Disable default zoom to keep UI clean, or position it elsewhere
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <SearchLocation
                      onSelect={(lat, lng, address) => {
                        setForm((f) => ({ ...f, lat: String(lat), lng: String(lng), address }));
                        setMapCenter([lat, lng]);
                      }}
                    />
                    
                    <CurrentLocationButton
                      onLocation={(lat, lng) => {
                        setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }));
                        setMapCenter([lat, lng]);
                      }}
                    />
                    
                    <MapClickHandler
                      onSelect={(lat, lng) => {
                        setForm((f) => ({ ...f, lat: String(lat), lng: String(lng) }));
                        setMapCenter([lat, lng]);
                      }}
                    />
                    
                    {form.lat && form.lng && (
                      <>
                        <FlyToLocation lat={parseFloat(form.lat)} lng={parseFloat(form.lng)} />
                        <Marker position={[parseFloat(form.lat), parseFloat(form.lng)]}>
                          <Popup>
                            <div className="text-xs text-foreground font-semibold">
                              {form.name || "Geofence Zone"}
                              <div className="text-[10px] font-normal text-muted-foreground mt-0.5">
                                Radius: {form.radius}m
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                        <Circle
                          center={[parseFloat(form.lat), parseFloat(form.lng)]}
                          radius={Number(form.radius)}
                          pathOptions={{ color: "hsl(var(--primary))", fillColor: "hsl(var(--primary))", fillOpacity: 0.15, weight: 2 }}
                        />
                      </>
                    )}
                  </MapContainer>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground font-mono flex items-center justify-between">
                  <span>Click anywhere on the map to set the center point.</span>
                  {form.lat && form.lng && <span className="text-primary font-bold">Coordinates Locked ✓</span>}
                </div>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude *">
                <input type="text" value={form.lat ? Number(form.lat).toFixed(6) : ""} readOnly className={`${inputCls} opacity-60 bg-muted cursor-not-allowed`} required />
              </Field>
              <Field label="Longitude *">
                <input type="text" value={form.lng ? Number(form.lng).toFixed(6) : ""} readOnly className={`${inputCls} opacity-60 bg-muted cursor-not-allowed`} required />
              </Field>
            </div>

            <Field label={`Geofence Radius: ${form.radius} meters`}>
              <input type="range" min="10" max="5000" step="10" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: e.target.value }))} className="w-full accent-primary cursor-ew-resize" />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1"><span>10m</span><span>500m</span><span>1km</span><span>5km</span></div>
            </Field>

            <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
              <label className="text-xs text-foreground font-semibold">Active (Allow check-ins in this zone)</label>
              <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`w-10 h-5 rounded-full transition-all ${form.active ? "bg-primary" : "bg-muted"} relative`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.active ? "left-5" : "left-0.5"}`} />
              </button>
            </div>

            {formError && (
              <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModal(null); setSelected(null); }} className="flex-1 py-2.5 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-all">{modal === "add" ? "Create Zone" : "Save Changes"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {modal === "delete" && selected && (
        <Modal title="Delete Geofence Zone" onClose={() => { setModal(null); setSelected(null); }}>
          <div className="space-y-4">
            <div className="flex gap-3 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">Delete Geofence Zone</p>
                <p className="text-xs text-muted-foreground mt-1">Delete <strong className="text-foreground">{selected.name}</strong>? Employees will no longer be validated against this zone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setSelected(null); }} className="flex-1 py-2.5 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => { onUpdate(zones.filter(z => z.id !== selected.id)); toast.success(`"${selected.name}" deleted`); setModal(null); setSelected(null); }} className="flex-1 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/25 flex items-center justify-center gap-2">
                <Trash2 size={13} /> Delete Zone
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}



// Holidays Page ------------------------------------------
function HolidaysPage({ holidays, onUpdate }: { holidays: Holiday[]; onUpdate: (h: Holiday[]) => void; }) {
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [selected, setSelected] = useState<Holiday | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Holiday["type"]>("all");
  const [form, setForm] = useState({ name: "", date: "", type: "Regular Holiday" as Holiday["type"] });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const PAY_MAP: Record<Holiday["type"], string> = {
    "Regular Holiday": "200%",
    "Special Holiday": "130%",
    "Company Holiday": "150%",
  };

  const TYPE_COLOR: Record<Holiday["type"], string> = {
    "Regular Holiday": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "Special Holiday": "bg-sky-500/10 text-sky-400 border-sky-500/20",
    "Company Holiday": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  const filtered = useMemo(() => {
    let list = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    if (typeFilter !== "all") list = list.filter(h => h.type === typeFilter);
    if (search.trim()) list = list.filter(h =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.date.includes(search) ||
      h.type.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [holidays, typeFilter, search]);

  // Check for duplicate date on add/edit
  function isDuplicateDate(date: string, excludeId?: number): boolean {
    return holidays.some(h => h.date === date && h.id !== excludeId);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim()) { setFormError("Holiday name is required."); return; }
    if (form.name.trim().length < 3) { setFormError("Holiday name must be at least 3 characters."); return; }
    if (!form.date) { setFormError("Date is required."); return; }
    if (isDuplicateDate(form.date, selected?.id)) {
      setFormError(`A holiday is already configured for ${form.date}. Please choose a different date.`);
      return;
    }

    setSaving(true);
    await new Promise(r => setTimeout(r, 300)); // UX: brief saving state

    const data = { name: form.name.trim(), date: form.date, type: form.type, pay: PAY_MAP[form.type] };
    if (selected) {
      onUpdate(holidays.map(h => h.id === selected.id ? { ...h, ...data } : h));
      toast.success(`"${data.name}" updated successfully`);
    } else {
      onUpdate([...holidays, { id: Date.now(), ...data }]);
      toast.success(`"${data.name}" added to holiday list`);
    }
    setSaving(false);
    setModal(null); setSelected(null); setFormError("");
  }

  function openAdd() {
    setForm({ name: "", date: "", type: "Regular Holiday" });
    setSelected(null); setFormError(""); setModal("add");
  }

  function openEdit(h: Holiday) {
    setForm({ name: h.name, date: h.date, type: h.type });
    setSelected(h); setFormError(""); setModal("edit");
  }

  function doDelete() {
    if (!selected) return;
    onUpdate(holidays.filter(h => h.id !== selected.id));
    toast.success(`"${selected.name}" removed from holiday list`);
    setModal(null); setSelected(null);
  }

  function exportHolidays() {
    exportCSV("holidays.csv",
      ["Name", "Date", "Type", "Pay Rate"],
      filtered.map(h => [h.name, h.date, h.type, h.pay])
    );
    toast.success("Holidays exported to CSV");
  }

  const upcoming = holidays.filter(h => h.date >= todayStrPHT()).length;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Holiday Configuration</h2>
          <p className="text-xs text-muted-foreground">
            {holidays.length} holidays configured · {upcoming} upcoming
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportHolidays}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download size={12} /> Export
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25 transition-colors">
            <Plus size={12} /> Add Holiday
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(["Regular Holiday", "Special Holiday", "Company Holiday"] as Holiday["type"][]).map(t => {
          const count = holidays.filter(h => h.type === t).length;
          return (
            <div key={t} className={`rounded-xl p-3 border ${TYPE_COLOR[t].replace("text-", "border-").split(" ")[0]} bg-card border-border`}>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{t.replace(" Holiday", "")}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{count}</p>
              <p className="text-[10px] text-muted-foreground">{PAY_MAP[t]} pay rate</p>
            </div>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-1.5 flex-1 min-w-48">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, date, or type..."
            className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none w-full" />
          {search && <button onClick={() => setSearch("")}><X size={11} className="text-muted-foreground hover:text-foreground" /></button>}
        </div>
        <div className="flex gap-1">
          {(["all", "Regular Holiday", "Special Holiday", "Company Holiday"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all whitespace-nowrap ${typeFilter === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {t === "all" ? "All" : t.replace(" Holiday", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Sun size={24} className="opacity-30" />
            <p className="text-xs font-mono">
              {search || typeFilter !== "all" ? "No holidays match your filters" : "No holidays configured yet"}
            </p>
            {!search && typeFilter === "all" && (
              <button onClick={openAdd} className="text-xs text-primary hover:underline mt-1">+ Add your first holiday</button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 px-5 py-2.5 border-b border-border bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase tracking-wider min-w-[500px]">
                <span className="col-span-2">Holiday Name</span>
                <span>Date</span>
                <span className="col-span-2">Type</span>
                <span>Pay Rate</span>
                <span>Actions</span>
              </div>
              <div className="divide-y divide-border/40">
                {filtered.map(h => {
                  const isUpcoming = h.date >= todayStrPHT();
                  const isPast = h.date < todayStrPHT();
                  return (
                    <div key={h.id}
                      className={`grid grid-cols-7 px-5 py-3.5 items-center hover:bg-secondary/20 transition-colors text-xs min-w-[500px] ${isPast ? "opacity-60" : ""}`}>
                      <div className="col-span-2 flex items-center gap-2">
                        <Sun size={13} className={isUpcoming ? "text-amber-400" : "text-muted-foreground"} />
                        <div>
                          <span className="text-foreground font-medium">{h.name}</span>
                          {isUpcoming && <span className="ml-2 text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Upcoming</span>}
                          {isPast && <span className="ml-2 text-[9px] font-mono text-muted-foreground">Past</span>}
                        </div>
                      </div>
                      <span className="font-mono text-muted-foreground">{h.date}</span>
                      <span className={`col-span-2 inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono w-fit ${TYPE_COLOR[h.type]}`}>
                        {h.type}
                      </span>
                      <span className="font-mono font-semibold text-emerald-400">{h.pay}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(h)}
                          className="p-1.5 hover:bg-primary/15 rounded-lg transition-colors" title="Edit holiday">
                          <Pencil size={12} className="text-primary" />
                        </button>
                        <button onClick={() => { setSelected(h); setModal("delete"); }}
                          className="p-1.5 hover:bg-red-500/15 rounded-lg transition-colors" title="Delete holiday">
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-2 border-t border-border text-[10px] font-mono text-muted-foreground bg-secondary/20">
              Showing {filtered.length} of {holidays.length} holidays · Sorted by date ascending
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(modal === "add" || modal === "edit") && (
        <Modal title={modal === "add" ? "Add New Holiday" : `Edit — ${selected?.name}`} onClose={() => { setModal(null); setSelected(null); setFormError(""); }}>
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Holiday Name *">
              <input
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setFormError(""); }}
                placeholder="e.g. Christmas Day"
                className={inputCls}
                maxLength={100}
                required
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground mt-1">{form.name.length}/100 characters</p>
            </Field>

            <Field label="Date *">
              <input
                type="date"
                value={form.date}
                onChange={e => { setForm(f => ({ ...f, date: e.target.value })); setFormError(""); }}
                className={inputCls}
                required
              />
              {form.date && isDuplicateDate(form.date, selected?.id) && (
                <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> A holiday already exists on this date
                </p>
              )}
            </Field>

            <Field label="Holiday Type *">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as Holiday["type"] }))} className={selectCls}>
                <option value="Regular Holiday">Regular Holiday — 200% pay rate</option>
                <option value="Special Holiday">Special Holiday — 130% pay rate</option>
                <option value="Company Holiday">Company Holiday — 150% pay rate</option>
              </select>
            </Field>

            <div className="p-3 bg-secondary/50 rounded-lg">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Pay Rate Preview</p>
              <p className="text-sm font-bold text-emerald-400">{PAY_MAP[form.type]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {form.type === "Regular Holiday" && "Employees who work on this day receive 200% of their daily rate"}
                {form.type === "Special Holiday" && "Employees who work on this day receive 130% of their daily rate"}
                {form.type === "Company Holiday" && "Employees who work on this day receive 150% of their daily rate"}
              </p>
            </div>

            {formError && (
              <div className="flex gap-2 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setModal(null); setSelected(null); setFormError(""); }}
                className="flex-1 py-2.5 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving || !!isDuplicateDate(form.date, selected?.id)}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving...</> : modal === "add" ? "Add Holiday" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {modal === "delete" && selected && (
        <Modal title="Delete Holiday" onClose={() => { setModal(null); setSelected(null); }}>
          <div className="space-y-4">
            <div className="flex gap-3 items-start p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">Confirm Deletion</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Are you sure you want to delete <strong className="text-foreground">{selected.name}</strong> ({selected.date})?
                  This will remove it from the holiday list. Existing attendance records that reference this holiday will not be affected.
                </p>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-[10px] text-muted-foreground font-mono uppercase">Holiday</p><p className="font-semibold text-foreground mt-0.5">{selected.name}</p></div>
              <div><p className="text-[10px] text-muted-foreground font-mono uppercase">Date</p><p className="font-mono text-foreground mt-0.5">{selected.date}</p></div>
              <div><p className="text-[10px] text-muted-foreground font-mono uppercase">Type</p><p className="text-foreground mt-0.5">{selected.type.replace(" Holiday", "")}</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setSelected(null); }}
                className="flex-1 py-2.5 bg-secondary rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button onClick={doDelete}
                className="flex-1 py-2.5 bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/25 transition-colors flex items-center justify-center gap-2">
                <Trash2 size={13} /> Delete Holiday
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Payroll Page ─────────────────────────────────────────────────────────────

function PayrollPage({ employees, attendance }: { employees: Employee[]; attendance: AttendanceRecord[]; }) {
  const [cutoff, setCutoff] = useState("june-1");
  const cutoffs = [
    { id: "june-1", label: "June 1–15, 2026", start: "2026-06-01", end: "2026-06-15" },
    { id: "may-2", label: "May 16–31, 2026", start: "2026-05-16", end: "2026-05-31" },
    { id: "may-1", label: "May 1–15, 2026", start: "2026-05-01", end: "2026-05-15" },
  ];
  const sel = cutoffs.find(c => c.id === cutoff)!;

  const data = useMemo(() => employees.filter(e => e.status === "Active").map(e => {
    const recs = attendance.filter(r => r.employeeId === e.employeeId && r.date >= sel.start && r.date <= sel.end);
    return {
      emp: e,
      present: recs.filter(r => r.status !== "Absent").length,
      absent: recs.filter(r => r.status === "Absent").length,
      totalHrs: recs.reduce((s, r) => s + (r.totalHours ?? 0), 0),
      ot: recs.reduce((s, r) => s + r.overtimeHours, 0),
      holiday: recs.reduce((s, r) => s + r.holidayHours, 0),
      late: recs.reduce((s, r) => s + r.late, 0),
      undertime: recs.reduce((s, r) => s + r.undertime, 0),
    };
  }), [employees, attendance, sel]);

  function doExport(type: string) {
    if (type === "pdf") { window.print(); toast.info("Print dialog opened"); return; }
    exportCSV(`payroll_${cutoff}.${type === "excel" ? "xlsx" : "csv"}`,
      ["Emp ID", "Name", "Dept", "Days Present", "Days Absent", "Total Hrs", "OT Hrs", "Holiday Hrs", "Late (min)", "Undertime (min)"],
      data.map(d => [d.emp.employeeId, `${d.emp.firstName} ${d.emp.lastName}`, d.emp.department, d.present, d.absent, d.totalHrs.toFixed(2), d.ot.toFixed(2), d.holiday, d.late, d.undertime])
    );
    toast.success(`${type.toUpperCase()} exported`);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h2 className="text-sm font-semibold text-foreground">Payroll Cutoff Reports</h2><p className="text-xs text-muted-foreground">{sel.label}</p></div>
        <div className="flex gap-2">
          <button onClick={() => doExport("pdf")} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground"><Download size={12} /> PDF</button>
          <button onClick={() => doExport("excel")} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary rounded-lg text-xs text-muted-foreground hover:text-foreground"><Download size={12} /> Excel</button>
          <button onClick={() => doExport("csv")} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25"><Download size={12} /> CSV</button>
        </div>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {cutoffs.map(c => <button key={c.id} onClick={() => setCutoff(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${cutoff === c.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>{c.label}</button>)}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="grid grid-cols-10 px-4 py-2 border-b border-border bg-secondary/30 text-[10px] font-mono text-muted-foreground uppercase min-w-[700px]">
            <span className="col-span-2">Employee</span><span>Dept</span><span>Present</span><span>Absent</span><span>Total Hrs</span><span>OT Hrs</span><span>Holiday</span><span>Late</span><span>Undertime</span>
          </div>
          <div className="divide-y divide-border/40">
            {data.map(({ emp, present, absent, totalHrs, ot, holiday, late, undertime }) => (
              <div key={emp.id} className="grid grid-cols-10 px-4 py-3 items-center hover:bg-secondary/20 text-xs min-w-[700px]">
                <div className="col-span-2 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{emp.avatar}</div>
                  <span className="text-foreground font-medium truncate">{emp.firstName} {emp.lastName}</span>
                </div>
                <span className="font-mono text-muted-foreground text-[10px]">{emp.department.slice(0, 4)}</span>
                <span className="font-mono text-emerald-400">{present}d</span>
                <span className={`font-mono ${absent > 0 ? "text-red-400" : "text-muted-foreground"}`}>{absent}d</span>
                <span className="font-mono text-foreground">{totalHrs.toFixed(1)}h</span>
                <span className={`font-mono ${ot > 0 ? "text-indigo-400" : "text-muted-foreground"}`}>{ot.toFixed(1)}h</span>
                <span className={`font-mono ${holiday > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{holiday}h</span>
                <span className={`font-mono ${late > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{late}m</span>
                <span className={`font-mono ${undertime > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{undertime}m</span>
              </div>
            ))}
            {data.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs font-mono">No records for this period</div>}
          </div>
          {data.length > 0 && (
            <div className="grid grid-cols-10 px-4 py-2.5 border-t border-border bg-secondary/30 text-xs font-mono font-bold min-w-[700px]">
              <span className="col-span-3 text-muted-foreground">TOTALS</span>
              <span className="text-emerald-400">{data.reduce((s, d) => s + d.present, 0)}d</span>
              <span className="text-red-400">{data.reduce((s, d) => s + d.absent, 0)}d</span>
              <span className="text-foreground">{data.reduce((s, d) => s + d.totalHrs, 0).toFixed(1)}h</span>
              <span className="text-indigo-400">{data.reduce((s, d) => s + d.ot, 0).toFixed(1)}h</span>
              <span className="text-amber-400">{data.reduce((s, d) => s + d.holiday, 0)}h</span>
              <span className="text-amber-400">{data.reduce((s, d) => s + d.late, 0)}m</span>
              <span className="text-amber-400">{data.reduce((s, d) => s + d.undertime, 0)}m</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage() {
  const [ot, setOt] = useState({ after: "9", weekday: "1.25", weekend: "1.30" });
  const [bio, setBio] = useState({ model: "ZKTeco K40", ip: "192.168.1.200", interval: "5" });
  const sectionCls = "bg-card border border-border rounded-xl p-5";

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-xl">
      <h2 className="text-sm font-semibold text-foreground">System Configuration</h2>

      <form onSubmit={e => { e.preventDefault(); toast.success(`OT rules saved — after ${ot.after}h`); }} className={sectionCls}>
        <div className="flex items-center gap-2 mb-4"><Timer size={14} className="text-primary" /><h3 className="text-xs font-semibold text-foreground">Overtime Rules</h3></div>
        <div className="space-y-3">
          {[["OT Starts After (hours)", ot.after, (v: string) => setOt(o => ({ ...o, after: v }))], ["Weekday OT Multiplier", ot.weekday, (v: string) => setOt(o => ({ ...o, weekday: v }))], ["Weekend OT Multiplier", ot.weekend, (v: string) => setOt(o => ({ ...o, weekend: v }))]].map(([l, v, fn]) => (
            <div key={l as string} className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{l as string}</label>
              <input value={v as string} onChange={e => (fn as (v: string) => void)(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground w-36 text-right focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          ))}
        </div>
        <button type="submit" className="mt-4 px-4 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25">Save OT Rules</button>
      </form>

      <form onSubmit={e => { e.preventDefault(); toast.success(`Biometric device configured`); }} className={sectionCls}>
        <div className="flex items-center gap-2 mb-4"><Fingerprint size={14} className="text-primary" /><h3 className="text-xs font-semibold text-foreground">Biometric Device (ZKTeco / DigitalPersona)</h3></div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Device Model</label>
            <select value={bio.model} onChange={e => setBio(b => ({ ...b, model: e.target.value }))} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground w-44 focus:outline-none">
              <option>ZKTeco K40</option><option>ZKTeco F22</option><option>DigitalPersona U.are.U 4500</option>
            </select>
          </div>
          {[["Device IP Address", bio.ip, (v: string) => setBio(b => ({ ...b, ip: v }))], ["Sync Interval (min)", bio.interval, (v: string) => setBio(b => ({ ...b, interval: v }))]].map(([l, v, fn]) => (
            <div key={l as string} className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{l as string}</label>
              <input value={v as string} onChange={e => (fn as (v: string) => void)(e.target.value)} className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground w-36 text-right focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          ))}
        </div>
        <button type="submit" className="mt-4 px-4 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25">Save Device Config</button>
      </form>

      <div className={sectionCls}>
        <div className="flex items-center gap-2 mb-3"><ShieldCheck size={14} className="text-primary" /><h3 className="text-xs font-semibold text-foreground">Authentication</h3></div>
        <p className="text-xs text-muted-foreground mb-3">The system uses <strong>WebAuthn</strong> for unified biometric authentication. On Windows, employees will use Windows Hello (fingerprint, face, or device PIN). On mobile, they will use their device fingerprint or biometric sensor.</p>
        <button onClick={() => { try { localStorage.removeItem("webauthn_creds"); } catch { /* ignore */ } toast.success("All biometric credentials cleared"); }} className="px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-semibold hover:bg-red-500/20">Clear All Stored Credentials</button>
      </div>

      <UserManualSection />
    </div>
  );
}

// ─── User Manual & Technical Docs ─────────────────────────────────────────────

function UserManualSection() {
  const [show, setShow] = useState<"user" | "tech" | null>(null);

  function downloadDoc(type: "user" | "tech") {
    const content = type === "user" ? generateUserManual() : generateTechDocs();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "user" ? "TimeTrack_Pro_User_Manual.txt" : "TimeTrack_Pro_Technical_Documentation.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${type === "user" ? "User Manual" : "Technical Documentation"} downloaded`);
  }

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3"><FileText size={14} className="text-primary" /><h3 className="text-xs font-semibold text-foreground">Documentation</h3></div>
        <p className="text-xs text-muted-foreground mb-4">Download the complete User Manual and Technical Documentation for TimeTrack Pro.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2"><ClipboardList size={16} className="text-primary" /><p className="text-xs font-semibold text-foreground">User Manual</p></div>
            <p className="text-[10px] text-muted-foreground">Step-by-step guide for employees and admins. Covers all features, troubleshooting, and FAQs.</p>
            <div className="flex gap-2">
              <button onClick={() => setShow("user")} className="flex-1 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-[10px] text-primary font-semibold hover:bg-primary/25">View</button>
              <button onClick={() => downloadDoc("user")} className="flex-1 py-1.5 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"><Download size={10} /> Download</button>
            </div>
          </div>
          <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2"><Settings size={16} className="text-primary" /><p className="text-xs font-semibold text-foreground">Technical Docs</p></div>
            <p className="text-[10px] text-muted-foreground">Architecture, API reference, database schema, deployment guide, and security documentation.</p>
            <div className="flex gap-2">
              <button onClick={() => setShow("tech")} className="flex-1 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-[10px] text-primary font-semibold hover:bg-primary/25">View</button>
              <button onClick={() => downloadDoc("tech")} className="flex-1 py-1.5 bg-secondary border border-border rounded-lg text-[10px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"><Download size={10} /> Download</button>
            </div>
          </div>
        </div>
      </div>

      {show && (
        <Modal title={show === "user" ? "User Manual — TimeTrack Pro" : "Technical Documentation — TimeTrack Pro"} onClose={() => setShow(null)} wide>
          <div className="flex justify-end mb-3">
            <button onClick={() => downloadDoc(show)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/25 rounded-lg text-xs text-primary font-semibold hover:bg-primary/25">
              <Download size={12} /> Download .txt
            </button>
          </div>
          <pre className="text-[10px] text-foreground font-mono whitespace-pre-wrap leading-relaxed bg-secondary/50 rounded-xl p-4 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {show === "user" ? generateUserManual() : generateTechDocs()}
          </pre>
        </Modal>
      )}
    </>
  );
}

function generateUserManual(): string {
  return `════════════════════════════════════════════════════════════════
                    TIMETRACK PRO
              EMPLOYEE ATTENDANCE MANAGEMENT SYSTEM
                       USER MANUAL

  Version:    2.4.0
  Developer:  TimeTrack Pro Development Team
  Date:       June 2026
  Platform:   React SPA · Vercel Deployment
════════════════════════════════════════════════════════════════

TABLE OF CONTENTS
─────────────────
 1. Introduction
 2. System Requirements
 3. Getting Started
 4. Account Management
 5. Employee Dashboard
 6. Check In & Check Out
 7. Attendance History
 8. Holiday Configuration
 9. Employee Management (Admin)
10. Payroll Management
11. Audit Logs
12. Settings
13. Sign Out
14. Troubleshooting & FAQ

════════════════════════════════════════════════════════════════
1. INTRODUCTION
════════════════════════════════════════════════════════════════

PURPOSE
TimeTrack Pro is a web-based Employee Attendance and Payroll
Preparation System designed for companies in the Philippines.
It records employee attendance using biometric authentication,
computes late minutes, overtime, and holiday pay, and generates
payroll cutoff reports.

KEY FEATURES
• Biometric check-in/check-out (WebAuthn / Windows Hello)
• Philippine Time (PHT, UTC+8) attendance recording
• Automatic computation: late, undertime, overtime
• Holiday management with pay multipliers
• Payroll cutoff report generation (CSV/PDF/Excel)
• Role-based access: Employee and Admin
• Audit trail for all administrative actions
• Mobile-responsive design

════════════════════════════════════════════════════════════════
2. SYSTEM REQUIREMENTS
════════════════════════════════════════════════════════════════

HARDWARE
• Any modern PC, laptop, tablet, or smartphone
• Fingerprint sensor or Windows Hello camera (recommended)
• Minimum 4 GB RAM, stable internet connection

SUPPORTED BROWSERS
• Google Chrome 90+       ✓ Recommended
• Microsoft Edge 90+      ✓ Supported
• Apple Safari 14+        ✓ Supported (Touch ID / Face ID)
• Mozilla Firefox 88+     ✓ Supported (PIN fallback)
• Samsung Internet 14+    ✓ Supported

SUPPORTED DEVICES
• Windows PC/Laptop       — Windows Hello (fingerprint, face, PIN)
• macOS                   — Touch ID
• iPhone / iPad           — Face ID / Touch ID
• Android Phone/Tablet    — Fingerprint / Device unlock

════════════════════════════════════════════════════════════════
3. GETTING STARTED
════════════════════════════════════════════════════════════════

ACCESSING THE SYSTEM
Open your browser and navigate to the TimeTrack Pro URL
provided by your system administrator.

DEMO ACCOUNTS
  Employee:  maria.santos@techcorp.ph
  Admin:     james.reyes@techcorp.ph
  Password:  password123  (for both accounts)

════════════════════════════════════════════════════════════════
4. ACCOUNT MANAGEMENT
════════════════════════════════════════════════════════════════

SIGN UP (CREATE ACCOUNT)
1. On the Login page, click "Create Account"
2. Fill in: First Name, Last Name, Email, Department, Password
3. Password must be at least 8 characters
4. Click "Create Account"
5. You will be redirected to Sign In with your new credentials

NOTE: Admin accounts are created by the system administrator.
      Self-registration creates employee accounts only.

SIGN IN (LOG IN)
1. Enter your registered email address
2. Enter your password
3. Click "Sign In"
4. On success: employees see Check In prompt; admins see dashboard

SIGN IN ERRORS
• "No account found"     → Check your email address
• "Incorrect password"   → Check your password / use Forgot Password
• "Account archived"     → Contact your administrator

FORGOT PASSWORD
1. Click "Forgot Password?" on the Login page
2. Enter your registered email address
3. Click "Continue" — the system verifies your email
4. Enter your new password (min. 8 characters)
5. Confirm the new password
6. Click "Set New Password"
7. You will be redirected to Sign In

CHANGE PASSWORD (WHILE LOGGED IN)
1. Navigate to My Profile (sidebar or mobile nav)
2. Click "Change" next to the Change Password section
3. Enter your current password
4. Enter and confirm your new password
5. Click "Update Password"

════════════════════════════════════════════════════════════════
5. EMPLOYEE DASHBOARD
════════════════════════════════════════════════════════════════

After logging in and completing Check In, the dashboard shows:

ATTENDANCE CARD
• Live Philippine Time clock (updates every second)
• Today's Check In time
• Check Out time (or "Not yet" if still active)
• Running worked hours counter
• Arrival status: Early / On Time / Late

SCHEDULE INFO
• Shift: 7:00 AM – 4:00 PM (Monday to Friday)
• Timezone: Asia/Manila (PHT, UTC+8)
• Core hours: 9 hours

STATS CARDS
• Month Hours   — total hours worked this cutoff
• Overtime      — OT hours accumulated
• Days Present  — attendance count this month
• Late Count    — number of late arrivals

RECENT ATTENDANCE TABLE
• Shows last 5 attendance records
• Click "View All" to see full history

════════════════════════════════════════════════════════════════
6. CHECK IN & CHECK OUT
════════════════════════════════════════════════════════════════

CHECK IN PROCESS
1. After login, the Check In screen appears automatically
2. The screen shows your name, employee ID, and live PHT time
3. Your arrival status (Early/On Time/Late) is displayed
4. Click "Verify with [Windows Hello / Touch ID / Fingerprint]"
5. Complete the biometric prompt on your device
6. Success screen shows: Time In, Status, Auth Method

AUTHENTICATION OPTIONS
• "Verify with [Biometric]" — uses your device's biometric
  - First use: registers your credential (one-time setup)
  - Subsequent uses: authenticates with stored credential
• "Simulate Authentication" — for demo/testing environments
  where biometrics are not available

IF BIOMETRIC FAILS
• "Biometric prompt dismissed" → Try again and follow the prompt
• "No authenticator found"     → Use Simulate option
• "Running in preview iframe"  → Open in a direct browser tab

ATTENDANCE STATUS RULES (Philippine Time)
  Before 7:00 AM  →  Early
  Exactly 7:00 AM →  On Time
  After 7:00 AM   →  Late
  After 4:00 PM   →  Overtime computed

CHECK OUT PROCESS
1. Navigate to "Check Out" in the sidebar/bottom nav
2. Click "Check Out Now"
3. Complete biometric verification (same as Check In)
4. The system records: Time Out, Total Hours, Overtime

OVERTIME COMPUTATION
  OT Hours = Checkout Time - 4:00 PM (if after 4:00 PM)
  OT requests are set to Pending and require admin approval

════════════════════════════════════════════════════════════════
7. ATTENDANCE HISTORY
════════════════════════════════════════════════════════════════

ACCESSING HISTORY
Navigate to "Attendance History" in the sidebar or mobile nav.

COLUMNS DISPLAYED
Date · Status · Time In · Time Out · Total Hours
Late (min) · OT Hours · Undertime · Auth Method

FILTERING
• Search by date, employee ID, or auth method
• Filter by month using the date picker
• Filter by status: All / Early / On Time / Late / Absent / Holiday

PAGINATION
Records are paginated (10 per page) with Prev/Next navigation.

EXPORT
• CSV Export — downloads a spreadsheet with all filtered records
• PDF Export — opens browser print dialog for PDF saving

════════════════════════════════════════════════════════════════
8. HOLIDAY CONFIGURATION (ADMIN ONLY)
════════════════════════════════════════════════════════════════

VIEWING HOLIDAYS
Navigate to Settings > Holiday Config (or sidebar).
Holidays are sorted by date ascending.
• Green "Upcoming" badge = future holidays
• Dimmed = past holidays

ADDING A HOLIDAY
1. Click "+ Add Holiday"
2. Enter Holiday Name (required, min. 3 characters)
3. Select Date (required; duplicate dates are rejected)
4. Select Holiday Type:
   - Regular Holiday  → 200% pay rate
   - Special Holiday  → 130% pay rate
   - Company Holiday  → 150% pay rate
5. Pay rate preview is shown automatically
6. Click "Add Holiday"

EDITING A HOLIDAY
1. Click the pencil (✏) icon on any holiday row
2. Modify the name, date, or type
3. Click "Save Changes"

DELETING A HOLIDAY
1. Click the trash (🗑) icon on any holiday row
2. Review the confirmation dialog showing the holiday details
3. Click "Delete Holiday" to confirm
NOTE: Existing attendance records referencing this holiday
      are not affected.

SEARCHING & FILTERING
• Use the search box to find by name, date, or type
• Use type filter tabs: All / Regular / Special / Company

EXPORT
Click "Export" to download all holidays as a CSV file.

════════════════════════════════════════════════════════════════
9. EMPLOYEE MANAGEMENT (ADMIN ONLY)
════════════════════════════════════════════════════════════════

ADDING AN EMPLOYEE
1. Go to "Employees" in the admin sidebar
2. Click "+ Add Employee"
3. Fill in: Employee ID, Name, Email, Department, Position,
   Schedule, Role, Fingerprint ID, Contact Number
4. Click "Add Employee"

EDITING AN EMPLOYEE
1. Find the employee in the list
2. Click the pencil (✏) icon
3. Modify the desired fields
4. Click "Save Changes"

ARCHIVING AN EMPLOYEE (replaces Delete)
IMPORTANT: Employees are NEVER permanently deleted.
1. Click the archive (📦) icon on an Active employee
2. Read the confirmation: "Employee will no longer be able
   to access the system, but all records will be retained"
3. Click "Archive Employee"

Effect of archiving:
• Employee cannot log in
• All attendance history is preserved
• Payroll history is preserved
• Audit log records the action

RESTORING AN EMPLOYEE
1. Filter by "Archived" using the status tabs
2. Click the restore (↺) icon on the archived employee
3. Employee status becomes Active and they can log in again

SEARCHING & FILTERING
• Search: by name, employee ID, or email
• Status filter: All / Active / Archived
• Department filter

════════════════════════════════════════════════════════════════
10. PAYROLL MANAGEMENT (ADMIN ONLY)
════════════════════════════════════════════════════════════════

ACCESSING PAYROLL
Navigate to "Payroll Cutoff" in the admin sidebar.

SELECTING A CUTOFF PERIOD
Click the cutoff tabs: June 1-15 / May 16-31 / May 1-15

PAYROLL COLUMNS
Employee · Department · Days Present · Days Absent
Total Hours · OT Hours · Holiday Hours · Late (min) · Undertime (min)

TOTALS ROW
The bottom row shows aggregate totals for all columns.

EXPORT FORMATS
• CSV   — Comma-separated file, opens in Excel/Google Sheets
• Excel — Downloads as .xlsx file (CSV format compatible)
• PDF   — Opens browser print dialog, save as PDF

════════════════════════════════════════════════════════════════
11. AUDIT LOGS (ADMIN ONLY)
════════════════════════════════════════════════════════════════

Audit logs record all administrative actions for accountability.

RECORDED ACTIONS
• Employee Created      • Employee Updated
• Employee Archived     • Employee Restored
• OT Approved           • OT Rejected
• Holiday Added         (and more)

EACH LOG ENTRY SHOWS
• Action performed
• Admin who performed it (name + ID)
• Target employee (if applicable)
• Details / description
• Date and time

SEARCHING LOGS
Use the search box to filter by action, admin name, or employee.

EXPORT
Click "Export CSV" to download all visible log entries.

════════════════════════════════════════════════════════════════
12. SETTINGS (ADMIN ONLY)
════════════════════════════════════════════════════════════════

OVERTIME RULES
• Set the number of hours after which OT begins (default: 9)
• Set weekday and weekend OT multipliers

BIOMETRIC DEVICE
• Configure ZKTeco or DigitalPersona device settings
• Set device IP address and sync interval

AUTHENTICATION
• Clear all stored WebAuthn credentials (resets biometric setup)

DOCUMENTATION
• View and download User Manual and Technical Documentation

════════════════════════════════════════════════════════════════
13. SIGN OUT
════════════════════════════════════════════════════════════════

SIGNING OUT
• Desktop: Click "Sign Out" at the bottom of the sidebar
• Mobile:  Access via "Profile" tab in the bottom navigation

On sign out:
• Session data is cleared
• Browser storage is cleaned
• You are redirected to the Login page
• A confirmation message is shown: "You have successfully signed out"
• The browser Back button cannot access protected pages after logout

════════════════════════════════════════════════════════════════
14. TROUBLESHOOTING & FAQ
════════════════════════════════════════════════════════════════

Q: The biometric prompt does not appear.
A: Ensure you are accessing the app over HTTPS (not HTTP).
   WebAuthn requires a secure context. If using a preview
   iframe (e.g., Figma Make), open the app in a direct
   browser tab. Use "Simulate Authentication" for demos.

Q: I get "no passkeys available" on Check Out.
A: This means the biometric credential registered at Check In
   is not found. Click "Reset stored credential" in the auth
   screen, then re-register. This can happen if you cleared
   browser data or switched devices.

Q: My attendance shows the wrong time.
A: TimeTrack Pro uses Philippine Time (UTC+8 / Asia/Manila)
   automatically regardless of your device's time zone.
   Ensure your device's clock is synchronized correctly.

Q: I cannot log in — my account is archived.
A: Contact your system administrator. Archived accounts
   cannot access the system until restored by an admin.

Q: Can I delete my attendance records?
A: Only administrators can modify attendance records.
   Records cannot be permanently deleted to ensure audit
   integrity.

Q: How is overtime computed?
A: OT = Checkout time minus 4:00 PM (if after 4:00 PM).
   OT requests require admin approval before taking effect.

Q: What is the difference between Regular and Special Holiday?
A: Regular Holiday (200%) — employees receive double pay.
   Special Holiday (130%) — employees receive 30% additional.
   Company Holiday (150%) — set by the company at 50% extra.

────────────────────────────────────────────────────────────────
TimeTrack Pro User Manual v2.4.0 · June 2026
For support, contact your system administrator.
────────────────────────────────────────────────────────────────`;
}

function generateTechDocs(): string {
  return `════════════════════════════════════════════════════════════════
                    TIMETRACK PRO
          EMPLOYEE ATTENDANCE MANAGEMENT SYSTEM
                TECHNICAL DOCUMENTATION

  Version:      2.4.0
  Stack:        React 18 · TypeScript · Tailwind CSS
  Deployment:   Vercel (Edge Network)
  Date:         June 2026
════════════════════════════════════════════════════════════════

TABLE OF CONTENTS
─────────────────
 1. Project Overview
 2. Technology Stack
 3. System Architecture
 4. Data Models & Interfaces
 5. Authentication & Security
 6. Biometric Authentication (WebAuthn)
 7. Component Reference
 8. State Management
 9. Business Logic
10. Source Code Structure
11. Environment & Deployment
12. Known Limitations & Future Roadmap

════════════════════════════════════════════════════════════════
1. PROJECT OVERVIEW
════════════════════════════════════════════════════════════════

TimeTrack Pro is a single-page React application (SPA) that
implements a complete Employee Attendance and Payroll
Preparation System. It is designed as a frontend-first demo
that can be extended with a real backend.

OBJECTIVES
• Demonstrate a production-quality attendance workflow
• Implement real WebAuthn biometric authentication
• Use Philippine Time (UTC+8) for all timestamps
• Provide role-based access (Employee / Admin)
• Generate payroll cutoff reports with CSV/PDF export

SCOPE
• Frontend: Complete UI with all pages and interactions
• Authentication: WebAuthn + password hashing (demo)
• Data: In-memory React state (extendable to PostgreSQL/Prisma)
• Deployment: Vercel-compatible, single build artifact

════════════════════════════════════════════════════════════════
2. TECHNOLOGY STACK
════════════════════════════════════════════════════════════════

FRONTEND
  Framework:      React 18 (hooks-based, no class components)
  Language:       TypeScript 5.x (strict mode)
  Styling:        Tailwind CSS v4 with custom design tokens
  State:          React useState + useMemo (no Redux)
  Charts:         Recharts 2.x (BarChart only — no multi-series)
  Icons:          Lucide React
  Notifications:  Sonner (toast notifications)
  Build tool:     Vite (via Figma Make scaffold)

AUTHENTICATION
  Biometric:      Web Authentication API (WebAuthn / FIDO2)
  Password:       btoa-based hash (demo; use bcrypt in production)
  Sessions:       React state (use NextAuth/JWT in production)

MAPS & LOCATION
  Geocoding:      Nominatim (OpenStreetMap) — free, no API key
  IP Fallback:    ipapi.co — free tier
  Maps link:      Google Maps URL (opens in browser)

DEPLOYMENT
  Platform:       Vercel (Edge deployment)
  CDN:            Vercel Edge Network
  CI/CD:          Git push → Vercel auto-deploy

WHY THESE TECHNOLOGIES
• React + TypeScript: type safety, component reusability
• Tailwind CSS: rapid styling, consistent design tokens
• WebAuthn: browser-native biometrics, no library needed
• Sonner: lightweight toast notifications
• Recharts: declarative chart API, good TypeScript support

════════════════════════════════════════════════════════════════
3. SYSTEM ARCHITECTURE
════════════════════════════════════════════════════════════════

APPLICATION PHASES
  login        → Login / Sign Up / Forgot Password screens
  signup       → Account registration screen
  forgot       → Password reset screen
  force-checkin → Mandatory biometric check-in gate
  app          → Main application (dashboard + all pages)

ROLE-BASED ROUTING
  Employee pages: dashboard, checkout, history, schedule, profile
  Admin pages:    dashboard, employees, attendance, holidays,
                  payroll, audit-logs, settings

AUTHENTICATION FLOW
  1. User submits email + password
  2. System looks up RegisteredAccount by email
  3. Verifies password hash
  4. Checks employee status (Archived → denied)
  5. Maps account to User object
  6. Sets AppPhase:
     - attendance exists today → "app"
     - no attendance today     → "force-checkin"

BIOMETRIC CHECK-IN FLOW
  1. ForceCheckInGate renders
  2. BiometricAuthPanel checks platform + WebAuthn availability
  3. User triggers authentication:
     a. If no stored credential → webAuthnRegister() → store credentialId
     b. If credential exists   → webAuthnAuthenticate(userId) with
        allowCredentials = [{ type: "public-key", id: base64urlToBuffer(credentialId) }]
  4. On success → AttendanceRecord created with PHT timestamp
  5. Phase transitions to "app"

════════════════════════════════════════════════════════════════
4. DATA MODELS & INTERFACES
════════════════════════════════════════════════════════════════

USER
  id: string           — unique identifier
  name: string         — full name
  role: "admin" | "employee"
  department: string
  position: string
  employeeId: string   — e.g. EMP-0042
  avatar: string       — two-letter initials
  schedule: {
    timeIn: string     — e.g. "7:00 AM"
    timeOut: string    — e.g. "4:00 PM"
    breakHours: number
    coreHours: number
  }

EMPLOYEE
  All User fields plus:
  email: string
  fingerprintId: string
  contactNumber: string
  status: "Active" | "Archived"

ATTENDANCE RECORD
  id: string
  employeeId: string
  date: string         — ISO date "YYYY-MM-DD"
  timeIn: string       — "HH:MM AM/PM" in PHT
  timeOut: string | null
  totalHours: number | null
  overtimeHours: number
  holidayHours: number
  status: "Early" | "On Time" | "Late" | "Absent" | "Holiday" | "On Leave"
  late: number         — minutes late
  earlyMinutes: number — minutes early
  undertime: number    — minutes undertime
  authMethod: string   — e.g. "Windows Hello · Fingerprint"
  device: string       — e.g. "Windows · Chrome"
  otStatus: "Pending" | "Approved" | "Rejected" | null

HOLIDAY
  id: number
  name: string
  date: string
  type: "Regular Holiday" | "Special Holiday" | "Company Holiday"
  pay: string          — e.g. "200%"

REGISTERED ACCOUNT
  userId: string
  email: string
  passwordHash: string — btoa-based (use bcrypt in production)
  role: Role
  employeeId: string

AUDIT LOG
  id: string
  action: string       — e.g. "Employee Archived"
  adminName: string
  adminId: string
  target?: string      — affected employee
  details: string
  timestamp: string

════════════════════════════════════════════════════════════════
5. AUTHENTICATION & SECURITY
════════════════════════════════════════════════════════════════

PASSWORD HASHING (DEMO)
  function simpleHash(s: string): string {
    return btoa(unescape(encodeURIComponent(s + "_tt")));
  }
  ⚠ PRODUCTION: Replace with bcrypt (server-side Node.js):
    const hash = await bcrypt.hash(password, 12);
    const valid = await bcrypt.compare(plain, hash);

SESSION MANAGEMENT
  Current: React useState (in-memory, cleared on page refresh)
  Production: NextAuth.js with JWT tokens + HTTP-only cookies

PROTECTION AGAINST ARCHIVED ACCOUNTS
  Login checks employee.status === "Archived" and denies access
  with a clear error message.

ROLE-BASED ACCESS CONTROL (RBAC)
  • Employee pages: only accessible when role === "employee"
  • Admin pages: only accessible when role === "admin"
  • Sidebar and bottom nav render role-appropriate items
  • renderPage() function gates all page renders by role

SECURITY BEST PRACTICES (PRODUCTION)
  • Never store plaintext passwords ✓ (hashing implemented)
  • HTTPS required for WebAuthn ✓ (enforced in code)
  • CSP headers: set via Vercel headers configuration
  • Input sanitization: trim() on all text inputs ✓
  • No eval() or dangerouslySetInnerHTML ✓
  • SQL injection: N/A (no SQL in frontend; use Prisma ORM)

════════════════════════════════════════════════════════════════
6. BIOMETRIC AUTHENTICATION (WEBAUTHN)
════════════════════════════════════════════════════════════════

REGISTRATION (first check-in)
  await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "TimeTrack Pro" },
      user: { id: Uint8Array, name: userName, displayName: userName },
      pubKeyCredParams: [{ alg: -7, type: "public-key" },   // ES256
                         { alg: -257, type: "public-key" }], // RS256
      authenticatorSelection: {
        authenticatorAttachment: "platform",  // built-in sensor only
        userVerification: "required",
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: "none",
    }
  });
  → credential.id (base64url string) stored in localStorage

AUTHENTICATION (subsequent check-ins/check-outs)
  KEY FIX: allowCredentials must include the stored credential ID
  so mobile browsers don't fail with "no passkeys available":

  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      userVerification: "required",
      timeout: 60000,
      allowCredentials: [{
        type: "public-key",
        id: base64urlToBuffer(storedCredentialId),  // ← critical
        transports: ["internal", "hybrid"],
      }]
    }
  });

BASE64URL DECODING
  function base64urlToBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

PLATFORM SUPPORT
  Windows:  Windows Hello (fingerprint, face, or PIN)
  macOS:    Touch ID
  iOS:      Face ID or Touch ID
  Android:  Device fingerprint sensor
  Fallback: "Simulate Authentication" button (demo mode)

ERROR CODES
  "unsupported"      — browser lacks PublicKeyCredential API
  "iframe"           — cross-origin iframe blocks WebAuthn
  "http"             — HTTPS required
  "no_authenticator" — no platform authenticator found
  "dismissed"        — user cancelled the prompt
  "security"         — SecurityError (usually iframe/HTTPS)
  "no_credential"    — credential ID not found on device
  "already_registered" — credential already exists

════════════════════════════════════════════════════════════════
7. COMPONENT REFERENCE
════════════════════════════════════════════════════════════════

AUTH COMPONENTS
  LoginPage             — email/password + demo account quick-fill
  SignUpPage            — employee self-registration
  ForgotPasswordPage    — 3-step password reset (email verify → set)
  ForceCheckInGate      — mandatory biometric check-in after login
  BiometricAuthPanel    — unified WebAuthn auth (shared component)

EMPLOYEE COMPONENTS
  EmployeeDashboard     — PHT clock, stats, recent attendance
  CheckOutPage          — check-out trigger + CheckOutModal
  CheckOutModal         — biometric check-out flow
  AttendanceHistoryPage — paginated, filterable table
  SchedulePage          — weekly schedule + status rules
  ProfilePage           — personal info + change password

ADMIN COMPONENTS
  AdminDashboard        — stats, bar chart, OT approvals, today's log
  AdminEmployeesPage    — CRUD + archive/restore + audit log emit
  HolidaysPage          — full CRUD + search/filter + export
  PayrollPage           — cutoff reports + CSV/Excel/PDF export
  AuditLogsPage         — searchable activity log + export
  SettingsPage          — OT rules, device config, docs download

SHARED COMPONENTS
  Modal                 — overlay dialog (closeable)
  StatusBadge           — colored status indicator
  StatCard              — metric card with icon
  SparkLine             — custom SVG line chart (no recharts multi-series)
  Field                 — labeled form field wrapper
  NotificationsPanel    — slide-in notification drawer
  Sidebar               — desktop navigation (lg+ only)
  MobileBottomNav       — mobile navigation (hidden on lg+)
  Topbar                — header with live PHT clock + bell
  UserManualSection     — documentation viewer + download

════════════════════════════════════════════════════════════════
8. STATE MANAGEMENT
════════════════════════════════════════════════════════════════

All state lives in the root App component and is passed
down as props. No external state management library is used.

ROOT STATE
  phase          AppPhase          — controls which screen shows
  user           User | null       — authenticated user
  page           AnyPage           — current route
  employees      Employee[]        — employee roster
  attendance     AttendanceRecord[] — all attendance records
  holidays       Holiday[]         — holiday configuration
  notifications  Notification[]    — in-app notifications
  accounts       RegisteredAccount[] — authentication accounts
  auditLogs      AuditLog[]        — admin audit trail

KEY DERIVED STATE (useMemo)
  filtered records in list pages
  payroll computation per cutoff period
  today's attendance for dashboard

════════════════════════════════════════════════════════════════
9. BUSINESS LOGIC
════════════════════════════════════════════════════════════════

PHILIPPINE TIME (PHT)
  All time operations use:
  new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }))

ARRIVAL STATUS
  getArrivalStatus(h, m):
    mins < 7*60  → "Early"
    mins === 7*60 → "On Time"
    mins > 7*60  → "Late"

LATE MINUTES
  computeLateMinutes(timeIn) = max(0, parseTime12(timeIn) - 7*60)

UNDERTIME MINUTES
  computeUndertimeMinutes(timeOut) = max(0, 16*60 - parseTime12(timeOut))

OVERTIME HOURS
  computeOTHours(timeOut) = max(0, (parseTime12(timeOut) - 16*60) / 60)

TOTAL HOURS WORKED
  totalHours = (checkoutTime - checkinTime) / 3600000

HOLIDAY PAY MULTIPLIERS
  Regular Holiday  → 200%
  Special Holiday  → 130%
  Company Holiday  → 150%

════════════════════════════════════════════════════════════════
10. SOURCE CODE STRUCTURE
════════════════════════════════════════════════════════════════

/
├── src/
│   ├── app/
│   │   └── App.tsx          — entire application (single file SPA)
│   ├── styles/
│   │   ├── index.css        — Tailwind entry point
│   │   ├── tailwind.css     — Tailwind imports + utilities
│   │   ├── theme.css        — design tokens (colors, radius, fonts)
│   │   └── fonts.css        — Google Fonts imports
│   └── imports/             — Figma-imported assets (if any)
├── public/                  — static assets
├── package.json             — dependencies
├── vite.config.ts           — Vite build config
└── tsconfig.json            — TypeScript config

IMPORTANT NOTE: The entire application is in src/app/App.tsx.
For a production system, this should be split into:
  components/  — reusable UI components
  pages/       — page-level components
  hooks/       — custom React hooks
  lib/         — utilities and helpers
  types/       — TypeScript interfaces
  api/         — API route handlers (Next.js)

════════════════════════════════════════════════════════════════
11. ENVIRONMENT & DEPLOYMENT
════════════════════════════════════════════════════════════════

DEVELOPMENT
  npm install
  npm run dev          — starts Vite dev server
  Open: http://localhost:5173

BUILD FOR PRODUCTION
  npm run build        — creates /dist folder
  npm run preview      — preview production build locally

DEPLOY TO VERCEL
  1. Push code to GitHub repository
  2. Import repository in Vercel dashboard
  3. Build command: npm run build
  4. Output directory: dist
  5. Click Deploy

ENVIRONMENT VARIABLES (for production backend)
  DATABASE_URL         — PostgreSQL connection string
  NEXTAUTH_SECRET      — NextAuth session secret
  NEXTAUTH_URL         — deployment URL
  WEBAUTHN_RP_ID       — your domain (e.g. myapp.vercel.app)
  GOOGLE_MAPS_API_KEY  — for reverse geocoding (optional)

PRODUCTION DATABASE SETUP (Prisma)
  npx prisma init
  npx prisma migrate dev --name init
  npx prisma generate
  npx prisma db seed   — seed initial data

════════════════════════════════════════════════════════════════
12. KNOWN LIMITATIONS & FUTURE ROADMAP
════════════════════════════════════════════════════════════════

CURRENT LIMITATIONS
• Data persists only in React state (lost on page refresh)
  → Production: replace with PostgreSQL + Prisma ORM
• Password hashing uses btoa() (not cryptographically strong)
  → Production: use bcrypt via Next.js API route
• No real email sending for Forgot Password
  → Production: use Nodemailer / Resend / SendGrid
• WebAuthn RP ID is auto-detected (may fail on some proxies)
  → Production: set explicit WEBAUTHN_RP_ID env variable
• No real GPS reverse geocoding API key configured
  → Production: add Google Maps API key or use Mapbox

FUTURE FEATURES
• Real PostgreSQL database with Prisma ORM
• NextAuth.js authentication with JWT
• Email notifications for OT approval, late arrivals
• Push notifications (PWA)
• PDF report generation (react-pdf or Puppeteer)
• Multi-company support
• Custom schedule types (flexi, shift)
• Biometric device sync (ZKTeco API integration)
• Google Maps live employee location tracking
• Mobile app (React Native)

────────────────────────────────────────────────────────────────
TimeTrack Pro Technical Documentation v2.4.0 · June 2026
────────────────────────────────────────────────────────────────`;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("login");
  const [user, setUser] = useState<User | null>(null);
  const [page, setPage] = useState<AnyPage>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>(INIT_EMPLOYEES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(INIT_ATTENDANCE);
  const [holidays, setHolidays] = useState<Holiday[]>(INIT_HOLIDAYS);
  const [notifications, setNotifications] = useState<Notification[]>(INIT_NOTIFICATIONS);
  const [accounts, setAccounts] = useState<RegisteredAccount[]>(INIT_ACCOUNTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INIT_AUDIT_LOGS);
  const [geofences, setGeofences] = useState<GeofenceZone[]>(INIT_GEOFENCES);
  const [showNotifications, setShowNotifications] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState("");

  const unreadCount = notifications.filter(n => !n.read).length;

  function addAuditLog(log: Omit<AuditLog, "id">) {
    setAuditLogs(prev => [{ id: String(Date.now()), ...log }, ...prev]);
  }

  function handleLogin(u: User) {
    setUser(u);
    const alreadyIn = attendance.some(r => r.employeeId === u.employeeId && r.date === todayStrPHT());
    setPhase(alreadyIn ? "app" : "force-checkin");
  }

  function handleLogout() {
    // Clear all auth-related storage
    try {
      sessionStorage.clear();
      localStorage.removeItem("att_pins");
    } catch { /* ignore */ }
    setUser(null); setPhase("login"); setPage("dashboard");
    toast.success("You have successfully signed out.");
  }

  function handleCheckInComplete(record: AttendanceRecord) {
    setAttendance(prev => [record, ...prev]);
    setNotifications(prev => [{
      id: String(Date.now()), type: "checkin",
      message: `${user?.name} checked in at ${record.timeIn} — ${record.status}`,
      time: record.timeIn, read: false, employee: user?.name,
    }, ...prev]);
    setPhase("app"); setPage("dashboard");
  }

  function handleUpdateOT(id: string, status: OTStatus) {
    setAttendance(prev => prev.map(r => r.id === id ? { ...r, otStatus: status } : r));
    setNotifications(prev => [{
      id: String(Date.now()), type: status === "Approved" ? "ot-approved" : "ot-rejected",
      message: `OT request ${status.toLowerCase()} for record #${id}`,
      time: fmtTimePHTShort(new Date()), read: false,
    }, ...prev]);
  }

  function handleUpdatePassword(userId: string, newHash: string) {
    setAccounts(prev => prev.map(a => a.userId === userId ? { ...a, passwordHash: newHash } : a));
  }

  // Pre-login screens
  if (phase === "login") return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <LoginPage
        onLogin={handleLogin} onSignUp={() => setPhase("signup")} onForgot={() => setPhase("forgot")}
        accounts={accounts} employees={employees}
      />
    </>
  );
  if (phase === "signup") return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <SignUpPage
        onBack={() => setPhase("login")}
        onSuccess={(email) => { setSignupSuccessEmail(email); setPhase("login"); }}
        accounts={accounts}
        onAddAccount={(acc, emp) => { setAccounts(prev => [...prev, acc]); setEmployees(prev => [...prev, emp]); }}
      />
    </>
  );
  if (phase === "forgot") return (
    <>
      <Toaster theme="dark" position="top-right" richColors />
      <ForgotPasswordPage onBack={() => setPhase("login")} accounts={accounts} onUpdatePassword={handleUpdatePassword} />
    </>
  );
  if (phase === "force-checkin" && user) return (
    <><ForceCheckInGate user={user} geofences={geofences} onComplete={handleCheckInComplete} /><Toaster theme="dark" position="top-right" richColors /></>
  );
  if (!user) return null;

  const pageTitles: Record<AnyPage, string> = {
    dashboard: "Dashboard", checkout: "Check Out", history: "Attendance History",
    schedule: "My Schedule", profile: "My Profile",
    employees: "Employee Management", attendance: "Attendance Logs",
    holidays: "Holiday Configuration", payroll: "Payroll Cutoff",
    "audit-logs": "Audit Logs", geofences: "Geofence Zones", settings: "Settings",
  };

  function renderPage() {
    if (user!.role === "employee") {
      if (page === "dashboard") return <EmployeeDashboard user={user!} attendance={attendance} onNavigateTo={setPage} />;
      if (page === "checkout") return <CheckOutPage user={user!} attendance={attendance} onUpdate={setAttendance} />;
      if (page === "history") return <AttendanceHistoryPage attendance={attendance} employeeId={user!.employeeId} />;
      if (page === "schedule") return <SchedulePage user={user!} />;
      if (page === "profile") return <ProfilePage user={user!} employees={employees} accounts={accounts} onUpdatePassword={handleUpdatePassword} />;
    } else {
      if (page === "dashboard") return <AdminDashboard employees={employees} attendance={attendance} onNavigate={setPage} onUpdateOT={handleUpdateOT} />;
      if (page === "employees") return <AdminEmployeesPage employees={employees} onUpdate={setEmployees} onAddAuditLog={addAuditLog} adminUser={user!} />;
      if (page === "attendance") return <AttendanceHistoryPage attendance={attendance} isAdmin onUpdateOT={handleUpdateOT} />;
      if (page === "holidays") return <HolidaysPage holidays={holidays} onUpdate={setHolidays} />;
      if (page === "payroll") return <PayrollPage employees={employees} attendance={attendance} />;
      if (page === "audit-logs") return <AuditLogsPage logs={auditLogs} />;
      if (page === "geofences") return <GeofencePage zones={geofences} onUpdate={setGeofences} />;
      if (page === "settings") return <SettingsPage />;
    }
    return null;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="hidden lg:flex"><Sidebar user={user} page={page} setPage={setPage} onLogout={handleLogout} /></div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={pageTitles[page] ?? "Dashboard"} user={user} unreadCount={unreadCount} onBell={() => setShowNotifications(true)} />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0" style={{ scrollbarWidth: "none" }}>{renderPage()}</main>
      </div>
      <MobileBottomNav user={user} page={page} setPage={setPage} />
      {showNotifications && <NotificationsPanel notifications={notifications} onUpdate={setNotifications} onClose={() => setShowNotifications(false)} />}
    </div>
  );
}
