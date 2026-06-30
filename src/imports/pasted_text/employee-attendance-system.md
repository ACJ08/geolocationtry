# Act as an Expert Full-Stack Software Engineer

I want to develop a modern Employee Attendance and Timekeeping System.

The system must be production-ready, scalable, and fully compatible with Vercel v0 so that the frontend can be easily generated and deployed on Vercel.

## Technology Requirements

* Frontend:

  * Next.js 15 (App Router)
  * TypeScript
  * Tailwind CSS
  * shadcn/ui components
  * Responsive design for desktop, tablet, and mobile

* Backend:

  * Next.js API Routes or Server Actions
  * TypeScript

* Database:

  * PostgreSQL using Prisma ORM

* Authentication:

  * NextAuth/Auth.js
  * Role-based access

* Deployment:

  * Must be fully compatible with Vercel v0
  * Avoid libraries or architectures incompatible with Vercel serverless deployment

---

# System Overview

The system is an Employee Attendance and Payroll Preparation System.

Employees log in to the system and record their attendance.

The system must support:

1. Attendance Check In
2. Attendance Check Out
3. GPS-based attendance
4. Biometric/Fingerprint attendance integration
5. Core Hours monitoring
6. Overtime computation
7. Holiday computation
8. Payroll cutoff reports
9. Role-based dashboard

---

# User Roles

## Admin

Can:

* Manage employees
* Manage schedules
* Manage holidays
* View attendance
* Generate reports
* Configure overtime rules
* Configure payroll cutoff
* Manage biometric devices

---

## Employee

Can:

* Login
* Check In
* Check Out
* View attendance history
* View overtime hours
* View holiday work hours
* View schedules
* Download attendance reports

---

# Attendance Flow

## Step 1

Employee logs in.

System validates:

* Username/email
* Password
* User role
* Employee status

If valid:

* Redirect to Employee Dashboard

---

## Step 2

Employee clicks:

"Check In"

The system must:

1. Record:

* Date
* Time In
* GPS coordinates
* Device used
* IP Address

2. Validate:

* Employee schedule
* Allowed radius from workplace
* Already checked in today

3. Save attendance record

Example:

Date:
2026-06-21

Time In:
07:03 AM

Latitude:
14.xxxxx

Longitude:
121.xxxxx

Status:
Present

---

## Step 3

Employee clicks:

"Check Out"

The system records:

* Time Out
* Total hours worked
* Overtime hours
* Holiday status

---

# GPS Attendance

Attendance should use GPS.

Requirements:

* Browser geolocation API
* Employee must be inside an allowed radius

Example:

Office Coordinates:

Latitude:
14.12345

Longitude:
121.54321

Allowed Radius:

100 meters

If employee is outside the radius:

Display:

"You are outside the allowed attendance location."

---

# Biometric Fingerprint Integration

The system must support fingerprint biometrics.

Requirements:

1. Fingerprint device integration

Examples:

* ZKTeco
* DigitalPersona

2. Attendance logs from device should sync to database.

3. If biometric device is unavailable:

Fallback to:

* GPS attendance
* Manual admin approval

---

# Employee Schedule

Each employee has a schedule.

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

Working Hours:

8 hours

Type:

Fixed Schedule

---

# Core Hours

Each employee has required core hours.

Example:

Required:

8 hours

If employee works:

7:00 AM

to

6:00 PM

Total:

11 hours

Regular Hours:

8

Overtime:

3

The system automatically computes:

* Total Hours
* Late Minutes
* Undertime
* Overtime

---

# Overtime Rules

Example:

Schedule:

7:00 AM - 4:00 PM

Employee logs out:

7:00 PM

Regular:

8 hours

Overtime:

3 hours

Store:

* Overtime Hours
* Overtime Type
* Approval Status

---

# Holiday Computation

Admin can configure holidays.

Example:

Holiday:

Christmas Day

Date:

2026-12-25

Type:

Regular Holiday

If employee works:

7:00 AM - 4:00 PM

System marks:

Holiday Work = Yes

and computes:

* Holiday Hours
* Holiday Overtime
* Holiday Pay Multiplier

Holiday types:

* Regular Holiday
* Special Holiday
* Company Holiday

---

# Payroll Cutoff

Attendance records must be printable every payroll cutoff.

Example:

Cutoff:

1st - 15th

16th - End of Month

Generate:

* Employee Name
* Department
* Time In
* Time Out
* Late
* Undertime
* Overtime
* Holiday Hours
* Total Worked Hours

Export formats:

* PDF
* Excel
* CSV

---

# Dashboard

Employee Dashboard:

Cards:

* Today's Attendance
* Current Status
* Total Hours This Month
* Overtime Hours
* Holiday Hours

Tables:

* Attendance History
* Recent Logs

---

Admin Dashboard:

Cards:

* Total Employees
* Present Today
* Absent Today
* Total Overtime

Charts:

* Daily Attendance
* Monthly Attendance Trends
* Overtime Trends

Tables:

* Attendance Logs
* Pending Approvals
* Payroll Cutoff Reports

---

# Database Design

Create Prisma schema for:

Employee

* id
* employeeId
* firstName
* lastName
* email
* role
* department
* scheduleId
* biometricId

Attendance

* id
* employeeId
* date
* timeIn
* timeOut
* latitude
* longitude
* totalHours
* overtimeHours
* holidayHours
* status

Schedule

* id
* timeIn
* timeOut
* breakHours
* coreHours

Holiday

* id
* holidayName
* holidayDate
* holidayType

PayrollCutoff

* id
* startDate
* endDate
* cutoffName

---

# Important Requirements

1. Must use Next.js App Router.

2. Must use TypeScript.

3. Must use Prisma ORM.

4. Must be optimized for Vercel deployment.

5. Use Server Actions whenever possible.

6. Follow clean architecture.

7. Create reusable components.

8. Use shadcn/ui.

9. Use Tailwind CSS.

10. Include folder structure and setup instructions.

Generate:

* Database schema
* API routes
* Authentication flow
* UI pages
* Dashboard layouts
* Attendance business logic
* GPS validation logic
* Biometric integration architecture
* Payroll cutoff report generation
* Deployment instructions for Vercel.
