You can expand your prompt into something much more detailed and implementation-focused like this:

---

**Expanded Prompt**

Act as a Senior Full Stack Engineer, System Architect, and Security Expert.

I am building an **Employee Attendance Management System** with a **Figma-designed UI**, and I need you to make **all features fully functional**, production-ready, and compatible with **Vercel v0 deployment**.

### 1. GPS Location Tracking (High Priority)

Please completely fix and implement the GPS Location feature.

Requirements:

* The application must use the **device's native GPS sensor** and NOT rely on IP-based geolocation as the primary source.
* When an employee checks in or checks out, the app must:

  * Request GPS permission from the browser/device.
  * Continuously wait until permission is granted.
  * Retrieve the precise latitude and longitude using the browser Geolocation API.
  * Convert the coordinates into:

    * Complete address
    * Building or establishment name
    * City
    * Province
    * Country
  * Display the location on:

    * Attendance page
    * Employee dashboard
    * Admin dashboard
  * Show the location in an embedded Google Maps component.
  * Include a clickable Google Maps link.

Example:

```text
Location:
UST Main Building
España Boulevard, Sampaloc
Manila, Metro Manila, Philippines

Coordinates:
14.6091, 120.9896

Google Maps:
https://maps.google.com/?q=14.6091,120.9896
```

### 2. Fix Browser GPS Unavailable Issue

Currently, I am getting:

```text
Browser GPS was unavailable — location determined from your IP address.
Coordinates are included in your attendance record.
```

Please completely fix this.

Requirements:

* Explain why browser GPS is unavailable.
* Detect:

  * HTTP vs HTTPS
  * Browser permissions denied
  * Device GPS disabled
  * Unsupported browsers
* Implement proper permission flow.

If browser GPS is unavailable:

1. Prompt the user to enable GPS.
2. Show a modal:

```text
GPS is disabled.

Please:

1. Turn on Location Services.
2. Allow this website to access your location.
3. Refresh the page.
```

3. Retry automatically.

Only use IP geolocation as:

* Emergency fallback
* Clearly marked as:

```text
Approximate Location (IP-Based)
```

Never use IP location as the main attendance location.

### 3. How to Integrate GPS Properly

Please explain and implement:

* Browser Geolocation API
* Google Maps API integration
* Reverse Geocoding API
* Permission handling
* HTTPS requirements
* Mobile compatibility
* Desktop compatibility

Show:

* Complete frontend code
* Backend API
* Database schema
* Environment variables
* Vercel deployment configuration

### 4. Biometric Authentication (Very Important)

Currently, I get:

```text
Step 2 — Identity Verification

Windows Hello · Touch ID · Face ID · Android fingerprint

Biometric prompt dismissed. Try again.

Make sure your device has a fingerprint sensor or Windows Hello enabled, then try again.
```

Please completely fix this.

Requirements:

* Implement proper WebAuthn authentication.
* Support:

#### Windows

* Windows Hello
* Fingerprint
* Face Recognition
* PIN

#### Mac

* Touch ID

#### Android

* Fingerprint
* Face Unlock

#### iPhone

* Face ID
* Touch ID

### 5. Biometric Registration Flow

When the employee logs in for the first time:

1. Prompt:

```text
Register your biometric credential.
```

2. Open:

* Windows Hello
* Touch ID
* Face ID
* Fingerprint scanner

3. Store:

* Public Key Credential ID
* Credential Type
* Device Name
* Device OS
* Registration Date

Do NOT store:

* Fingerprint images
* Face images
* Biometric raw data

Use WebAuthn standards only.

### 6. Biometric Login Flow

When employee checks in:

1. Verify login session.
2. Prompt biometric authentication.
3. Verify via WebAuthn.
4. Record:

* Check In Time
* Date
* Device Used
* GPS Location
* Address
* Coordinates
* Google Maps URL

When employee checks out:

1. Prompt biometric again.
2. Record:

* Check Out Time
* Total Hours
* GPS Location
* Coordinates
* Device Used

### 7. Figma Integration

Since my UI is designed in Figma:

* Convert all Figma screens into responsive code.
* Preserve:

  * Fonts
  * Colors
  * Components
  * Spacing
  * Icons
  * Layout hierarchy
* Make every button and interaction fully functional.
* Ensure mobile responsiveness.
* Ensure desktop responsiveness.

### 8. Technology Stack

Use:

Frontend:

* Next.js 15 App Router
* TypeScript
* TailwindCSS
* ShadCN UI
* React Hooks

Authentication:

* NextAuth
* WebAuthn
* SimpleWebAuthn

Location:

* Browser Geolocation API
* Google Maps API
* Reverse Geocoding API

Backend:

* Next.js API Routes
* Prisma ORM

Database:

* PostgreSQL

Deployment:

* Vercel

### 9. Production Requirements

The final system must:

* Be fully functional.
* Have no placeholder buttons.
* Have complete frontend and backend logic.
* Properly handle errors.
* Work on Windows, Mac, Android, and iPhone.
* Work on Chrome, Edge, Safari, and Firefox.
* Support HTTPS.
* Be deployable directly to Vercel without modifications.

Provide the complete working implementation, including:

* Folder structure
* Database schema
* Frontend code
* Backend code
* API routes
* WebAuthn setup
* Google Maps setup
* Environment variables
* Vercel deployment configuration
* Step-by-step setup instructions.
