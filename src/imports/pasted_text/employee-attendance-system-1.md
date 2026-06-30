Act as a Senior Full-Stack Software Engineer, System Architect, and UI/UX Designer.

Build a production-ready Employee Attendance and Time Tracking System that is fully compatible with Vercel v0 and can be deployed smoothly on Vercel.

### General Requirements

* Generate complete and functional code.
* All buttons, forms, dialogs, tables, and features must be fully working.
* Use modern and responsive UI.
* Use TypeScript.
* Follow best coding practices.
* Implement proper error handling and validations.
* Make the system mobile-friendly and desktop-friendly.

---

# Employee Working Hours

The company follows a fixed work schedule:

* Working Days: Monday to Friday
* Time Zone: Philippine Time (PHT / UTC+8)
* Work Start: 7:00 AM
* Work End: 4:00 PM
* Total Working Hours: 9 hours including breaks

The system must automatically:

1. Display current Philippine Time.
2. Determine if the employee is:

   * Early
   * On Time
   * Late
   * Absent
3. Calculate:

   * Total Hours Worked
   * Overtime Hours
   * Late Minutes
   * Undertime Minutes
4. Prevent employees from checking in twice without checking out first.
5. Prevent employees from checking out without checking in.

---

# Authentication System

Implement a secure authentication system with:

### Employee Login

Fields:

* Employee ID
* Email
* Password

After successful login:

* Redirect employee to Dashboard.
* Display:

  * Employee Name
  * Employee ID
  * Department
  * Current Status
  * Current Philippine Time
  * Today's Attendance Status

---

# Attendance Check-In

When the employee clicks "Check In":

The system must:

### 1. Capture Current Time

Store:

* Exact Check-In Time
* Date
* Day of Week
* Timezone (Asia/Manila)

Example:

* Check In:
  June 21, 2026
  07:02:15 AM
  Asia/Manila

---

### 2. Capture GPS Location

Request browser geolocation permission.

Get:

* Latitude
* Longitude

Convert coordinates to a human-readable address using Google Maps Reverse Geocoding API.

Display:

* Place Name
* Complete Address
* City
* Province
* Country

Example:

Location:

* Latitude: 14.5995
* Longitude: 120.9842
* Place Name: University of Santo Tomas
* Address: España Blvd, Sampaloc, Manila
* City: Manila
* Province: Metro Manila
* Country: Philippines

Show the location on:

* Embedded Google Maps
* Marker Pin
* Google Maps link

Admin should also be able to see this information.

---

### 3. Fingerprint Authentication

Before the attendance is saved:

Require fingerprint verification using:

* WebAuthn API
* Windows Hello Fingerprint
* Touch ID (Mac)
* Android Fingerprint
* Compatible biometric devices

Flow:

1. Employee clicks Check In.
2. System requests fingerprint authentication.
3. Fingerprint is verified.
4. Attendance is saved only if fingerprint verification succeeds.
5. If fingerprint verification fails:

   * Attendance is not recorded.
   * Display an error message.

Store:

* Authentication Status
* Verification Timestamp
* Device Used

Example:

Authentication:

* Status: Verified
* Method: Fingerprint
* Device: Windows Hello
* Verified At:
  June 21, 2026
  07:01:23 AM

---

# Employee Dashboard

After login, the dashboard must display:

### Attendance Card

Show:

* Current Philippine Time
* Check-In Time
* Check-Out Time
* Working Hours
* Overtime
* Status

Example:

Today's Attendance

Current Time:
07:35:12 AM

Check In:
07:01:10 AM

Check Out:
Not Yet

Status:
Present

Working Hours:
00:34:02

---

### Location Card

Display:

* Current Location
* Place Name
* Address
* Latitude
* Longitude

Include:

* Embedded Google Map
* Refresh Location Button
* Open in Google Maps Button

---

### Fingerprint Status Card

Display:

* Verification Status
* Device
* Last Verification Time

Example:

Fingerprint Status

Verified

Device:
Windows Hello

Last Verified:
07:01:23 AM

---

# Check-Out

When employee clicks "Check Out":

Require:

1. Fingerprint verification again.
2. Capture current GPS location.
3. Capture:

   * Check-Out Time
   * Total Working Hours
   * Overtime
   * Late Minutes
   * Undertime Minutes

Save everything to the database.

---

# Admin Dashboard

Admin can:

### Manage Employees

* Add Employee
* Edit Employee
* Delete Employee
* Reset Password
* Activate/Deactivate Employee

Fields:

* Employee ID
* Name
* Email
* Department
* Position
* Profile Photo
* Status

---

### Attendance Records

Admin can:

* View all attendance logs
* Search employees
* Filter by:

  * Date
  * Department
  * Status
  * Late
  * Absent
  * Overtime

Display:

* Employee Name
* Employee ID
* Check-In Time
* Check-Out Time
* GPS Location
* Place Name
* Address
* Fingerprint Status
* Working Hours
* Late Minutes
* Overtime

---

### Attendance Map View

Create a map dashboard showing:

* All employee check-in locations
* Marker pins
* Place names
* Timestamp
* Employee details

Admin can:

* Zoom
* Filter by date
* Filter by employee
* Open Google Maps

---

# Notifications

Provide notifications for:

Employee:

* Successful Check In
* Successful Check Out
* Fingerprint Failed
* Location Permission Denied
* Late Arrival Warning

Admin:

* Employee Late
* Employee Absent
* Failed Fingerprint Attempts
* Suspicious Login Attempts

---

# Database Design

Create complete database schemas for:

* Users
* Employees
* Attendance
* Departments
* Fingerprint Credentials
* Notifications
* Login Sessions
* Audit Logs

Include:

* Foreign Keys
* Indexes
* Relationships
* Timestamps

---

# Technology Stack

Use:

Frontend:

* Next.js App Router
* TypeScript
* Tailwind CSS
* shadcn/ui

Authentication:

* NextAuth
* JWT
* WebAuthn

Location:

* Browser Geolocation API
* Google Maps JavaScript API
* Google Maps Reverse Geocoding API

Database:

* PostgreSQL
* Prisma ORM

Hosting:

* Vercel

---

# Additional Requirements

* All buttons must be fully functional.
* No placeholder buttons.
* No dummy pages.
* Use real API integrations.
* Use secure authentication.
* Follow clean architecture.
* Include loading states.
* Include empty states.
* Include error handling.
* Include reusable components.
* Include complete database migrations.
* Generate production-ready code that can be deployed directly to Vercel with minimal configuration.
