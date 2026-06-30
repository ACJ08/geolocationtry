Act as a Senior Full Stack Engineer, Web Security Engineer, and Debugging Expert.

I am currently building an Employee Attendance Management System using:

* Next.js 15 App Router
* TypeScript
* TailwindCSS
* ShadCN UI
* Prisma
* PostgreSQL
* Vercel deployment
* Google Maps API
* Browser Geolocation API
* WebAuthn / SimpleWebAuthn
* Figma for UI Design

I am having problems with two major features:

# 1. GPS Location Feature

The GPS location feature is not working correctly.

Current issue:

```text
Browser GPS was unavailable — location determined from your IP address.
Coordinates are included in your attendance record.
```

Sometimes the browser never asks for location permission.

I want you to:

### A. Explain the root causes

Explain all possible reasons why GPS is unavailable, such as:

* Browser permission denied
* Device location service disabled
* HTTP instead of HTTPS
* Browser incompatibility
* Vercel deployment issues
* localhost limitations
* Missing permission handling
* Incorrect Geolocation API usage

### B. Tell me EXACTLY what files to edit

Show:

* Which file to edit
* File path
* Existing code to look for
* Code to remove
* Code to replace
* Why this fixes the issue

Example:

```text
app/(employee)/attendance/page.tsx

Find:

navigator.geolocation.getCurrentPosition(...)

Replace with:

new code here
```

### C. Show complete working GPS code

I want:

1. Permission request

```javascript
navigator.permissions.query({ name: "geolocation" })
```

2. GPS enable prompt

3. Browser Geolocation API

4. High accuracy mode

```javascript
enableHighAccuracy: true
```

5. Timeout handling

6. Error handling

7. Retry button

8. Loading indicator

9. Google Maps integration

10. Reverse geocoding

Convert:

```text
14.6091,120.9896
```

into:

```text
UST Main Building
España Boulevard
Sampaloc
Manila
Metro Manila
Philippines
```

### D. Debugging Checklist

Show:

* Chrome DevTools steps
* Browser console commands
* Network tab checks
* GPS permission checks
* How to test on localhost
* How to test on Vercel
* How to test on Android Chrome
* How to test on iPhone Safari

Explain step by step like I am debugging this on my own computer.

---

# 2. Biometrics / Fingerprint Authentication

My fingerprint feature is not working.

I get:

```text
Step 2 — Identity Verification

Windows Hello · Touch ID · Face ID · Android fingerprint

Biometric prompt dismissed. Try again.

Make sure your device has a fingerprint sensor or Windows Hello enabled, then try again.
```

I want you to help me debug this.

### A. Explain why this happens

Explain:

* User cancelled prompt
* WebAuthn not configured
* Browser unsupported
* Windows Hello disabled
* Fingerprint sensor unavailable
* RP ID mismatch
* HTTPS requirement
* Invalid challenge
* Credential creation failure
* Credential verification failure

---

### B. Tell me EXACTLY which files to edit

Show:

```text
app/api/webauthn/register/options/route.ts

app/api/webauthn/register/verify/route.ts

app/api/webauthn/authenticate/options/route.ts

app/api/webauthn/authenticate/verify/route.ts

components/BiometricButton.tsx

lib/webauthn.ts
```

For every file:

1. Explain its purpose
2. Show existing code to find
3. Show code to remove
4. Show complete replacement code
5. Explain why the fix works

---

### C. Explain WebAuthn configuration

Explain:

* RP Name
* RP ID
* Origin
* Credential ID
* Public Key
* Challenge
* User Verification

Example:

```javascript
rpID: "localhost"

origin:
http://localhost:3000
```

and

```javascript
rpID:
myattendance.vercel.app

origin:
https://myattendance.vercel.app
```

Explain when each should be used.

---

### D. Show debugging steps

Teach me:

1. How to open Chrome DevTools
2. How to inspect WebAuthn requests
3. How to use:

```text
chrome://webauthn
```

4. How to test:

* Windows Hello
* Fingerprint
* Face Recognition
* Touch ID
* Android Fingerprint
* Face ID

5. How to clear existing credentials

6. How to register a new credential

7. How to verify if the credential was saved in database

---

### E. Show database tables

Show:

```text
User

Authenticator

Attendance

Device

LocationHistory
```

For each:

* Columns
* Types
* Relationships

Explain how biometric credentials are stored securely.

Never store:

* Fingerprint images
* Face images
* Raw biometric data

Store only:

* Credential ID
* Public Key
* Counter
* Device Type
* User ID

---

# 3. Overall Requirement

I want a COMPLETE debugging guide.

For BOTH GPS and Biometrics:

* Show the specific files to edit.
* Show the exact code to replace.
* Explain every line.
* Show browser debugging steps.
* Show database checks.
* Show console logs to inspect.
* Show common errors and solutions.
* Explain how to test on localhost.
* Explain how to test on Vercel.
* Explain how to test on Windows, Android, Mac, and iPhone.

Please assume I am debugging this on my own computer and guide me step by step until both features are fully working.
