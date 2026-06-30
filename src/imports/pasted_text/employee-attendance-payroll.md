# Act as a Senior Full-Stack Software Engineer and System Architect

Build a **fully functional Employee Attendance, Timekeeping, and Payroll Preparation System**.

The application must be **production-ready**, have **working backend and frontend**, and all buttons, forms, modals, API calls, and database actions must be fully implemented.

The project must be **100% compatible with Vercel v0** and deployable on Vercel without major modifications.

---

# Technology Stack

## Frontend

Use:

* Next.js 15 App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Hook Form
* Zod validation
* TanStack Table
* Recharts

---

## Backend

Use:

* Next.js Server Actions
* Next.js API Routes
* Prisma ORM
* PostgreSQL

---

## Authentication

Use:

* Auth.js / NextAuth
* Credentials Login

Support:

* Employee Login
* Admin Login

Implement:

* Protected routes
* Session management
* Role-based access control

---

# System Modules

The system must have:

1. Authentication
2. Employee Management
3. Attendance Check In
4. Attendance Check Out
5. GPS Attendance
6. Google Maps Integration
7. Holiday Management
8. Overtime Management
9. Schedule Management
10. Payroll Cutoff
11. Attendance Reports
12. Biometric Integration Architecture
13. Dashboard Analytics
14. Notifications

Everything must be fully functional.

---

# User Roles

## Admin

Admin can:

### Employee Management

* Add employee
* Edit employee
* Delete employee
* Activate employee
* Deactivate employee

Fields:

* Employee ID
* First Name
* Last Name
* Email
* Department
* Position
* Role
* Schedule
* Fingerprint ID
* Contact Number

---

### Attendance Monitoring

Admin can:

* View all attendance

* Search attendance

* Filter by:

  * Employee
  * Department
  * Date
  * Month
  * Payroll cutoff

* Approve overtime

* Approve manual attendance

---

### Schedule Management

Admin can:

Create:

* Fixed schedules

Example:

7:00 AM

to

4:00 PM

Break:

1 hour

Core Hours:

8 hours

---

### Holiday Management

Admin can:

Add holidays.

Fields:

* Holiday Name
* Holiday Date
* Holiday Type

Holiday types:

* Regular Holiday
* Special Holiday
* Company Holiday

---

### Reports

Admin can generate:

* Daily Attendance
* Weekly Attendance
* Monthly Attendance
* Payroll Cutoff Attendance
* Overtime Reports
* Holiday Work Reports

Export:

* PDF
* Excel
* CSV

---

# Employee Dashboard

Employee can:

* Login
* Check In
* Check Out
* View attendance history
* View overtime
* View schedules
* View holiday work
* Download reports

---

# Attendance Check In

Create a large Check In button.

When clicked:

1.

Get:

* Current date
* Current time

2.

Get:

GPS Coordinates

Example:

Latitude:

14.45678

Longitude:

121.12345

3.

Automatically detect:

* City
* Municipality
* Province
* Barangay
* Establishment Name

Example:

"Jollibee UST España"

or

"University of Santo Tomas"

or

"Barangay Talipapa"

---

# Google Maps Integration

Integrate Google Maps.

Requirements:

After employee checks in:

Save:

* Latitude
* Longitude
* Full Address
* Place Name

Display:

Interactive Google Map.

Map must:

* Show pin location
* Show employee position
* Show complete address
* Show place name

Example:

Employee:

Juan Dela Cruz

Location:

University of Santo Tomas

Address:

España Boulevard, Sampaloc,
Manila,
Metro Manila,
Philippines

Map:

Display Google Maps marker.

---

# Reverse Geocoding

After GPS coordinates are acquired:

Automatically call:

Google Maps Geocoding API

Convert:

Latitude:

14.6091

Longitude:

120.9895

to

Place Name:

University of Santo Tomas

Address:

España Blvd,
Sampaloc,
Manila,
Metro Manila,
Philippines

Store in database:

* latitude
* longitude
* placeName
* fullAddress

---

# Live Attendance Tracking

Admin Dashboard must contain:

"Live Employee Locations"

Display:

Google Map.

Show:

All checked-in employees.

Each marker should display:

* Employee Name
* Employee ID
* Department
* Time In
* Place Name
* Full Address

Example:

Marker:

Anne Carol Jonson

Checked In:

7:02 AM

Location:

University of Santo Tomas

Address:

España Boulevard,
Sampaloc,
Manila

---

# Geofencing

Implement geofencing.

Admin can configure:

Office Location.

Example:

Latitude:

14.6091

Longitude:

120.9895

Allowed Radius:

100 meters

---

If employee checks in:

Inside radius:

Allow attendance.

Outside radius:

Reject attendance.

Display:

"You are outside the allowed attendance area."

---

# Employee Schedule

Example:

Employee:

Janitor

Schedule:

Time In:

7:00 AM

Time Out:

4:00 PM

Break:

1 hour

Core Hours:

8 hours

Schedule Type:

Fixed

---

# Late Computation

Example:

Schedule:

7:00 AM

Employee Time In:

7:12 AM

System computes:

Late:

12 minutes

Store:

lateMinutes

---

# Undertime Computation

Example:

Schedule End:

4:00 PM

Employee Time Out:

3:20 PM

Undertime:

40 minutes

Store:

undertimeMinutes

---

# Overtime Computation

Example:

Schedule:

7:00 AM

to

4:00 PM

Employee Out:

7:00 PM

Regular:

8 hours

Overtime:

3 hours

Store:

* overtimeHours
* overtimeStatus

Statuses:

* Pending
* Approved
* Rejected

---

# Holiday Computation

If date is holiday:

Automatically detect.

Example:

Holiday:

December 25

Type:

Regular Holiday

If employee works:

7AM - 4PM

Store:

* holidayHours
* holidayType
* holidayOvertime

---

# Attendance History

Employee must see:

Table

Columns:

* Date
* Time In
* Time Out
* Hours Worked
* Late
* Undertime
* Overtime
* Holiday Hours
* Place Name
* Address
* Status

Search:

* By Month
* By Date

---

# Payroll Cutoff

Example:

Cutoff 1

June 1 - June 15

Cutoff 2

June 16 - June 30

Generate:

* Employee Name
* Department
* Days Present
* Days Absent
* Total Hours
* Total Overtime
* Holiday Hours
* Late
* Undertime

Export:

* PDF
* Excel
* CSV

---

# Notifications

Create notification system.

Notify employee:

* Successful Check In
* Successful Check Out
* Outside Geofence
* Overtime Approved
* Overtime Rejected

Notify admin:

* Employee checked in
* Employee checked out
* Manual attendance request
* Overtime request

---

# Biometric Integration

Design architecture for:

Fingerprint Attendance.

Support:

* ZKTeco
* DigitalPersona

Architecture:

Fingerprint Device

↓

Local Middleware Service

↓

REST API

↓

Next.js API

↓

PostgreSQL

↓

Dashboard

If biometric is unavailable:

Fallback:

GPS Attendance.

---

# Database Design

Create complete Prisma Schema.

Tables:

Employee

Attendance

Department

Schedule

Holiday

PayrollCutoff

Overtime

Notification

FingerprintLog

Geofence

Session

AuditTrail

---

# Admin Dashboard

Cards:

* Total Employees
* Present Today
* Absent Today
* Employees on Leave
* Total Overtime
* Holiday Workers

Charts:

* Daily Attendance
* Monthly Attendance
* Department Attendance
* Overtime Trends

Google Map:

Display:

Live Employee Locations

---

# Important Requirements

1.

Everything must be fully functional.

No placeholder buttons.

No dummy actions.

All forms must:

* Create records
* Update records
* Delete records

---

2.

All API routes must be implemented.

---

3.

All Server Actions must work.

---

4.

All Google Maps integrations must work.

Use:

* Google Maps JavaScript API
* Google Geocoding API
* Places API

---

5.

All pages must be responsive.

Support:

* Desktop
* Tablet
* Mobile

---

6.

Create:

* Complete folder structure
* Prisma schema
* Database migrations
* API routes
* Server Actions
* React Components
* Dashboard pages
* Google Maps components
* Authentication flow
* Deployment instructions

---

Generate production-ready code with proper TypeScript types, clean architecture, reusable components, error handling, loading states, and Vercel deployment compatibility.
