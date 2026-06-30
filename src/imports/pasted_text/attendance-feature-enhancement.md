Also, I want you to improve and fix the Check In / Check Out feature completely.

# 1. GPS Location Accuracy (Very Important)

Currently, the GPS location is not accurate. Sometimes it shows a nearby location or an incorrect place even though I am physically somewhere else.

Please explain:

* Why GPS location becomes inaccurate.
* Difference between:

  * Browser GPS
  * IP-based location
  * WiFi triangulation
  * Mobile GPS sensor
* Why desktop/laptop location is sometimes less accurate than smartphones.

I want you to make the GPS location as accurate as possible.

Requirements:

### A. High Accuracy GPS

Use:

```javascript
enableHighAccuracy: true
```

and explain:

* timeout
* maximumAge
* watchPosition vs getCurrentPosition

### B. Location Validation

Before recording attendance:

1. Request location permission.
2. Get the GPS coordinates.
3. Show:

```text
Current Location

Latitude:
14.xxxxx

Longitude:
120.xxxxx

Accuracy:
8 meters

Address:
UST Main Building,
España Boulevard,
Sampaloc, Manila

Google Maps:
https://maps.google.com/?q=...
```

4. Ask the employee:

```text
Is this your current location?

[ Confirm ]
[ Retry GPS ]
```

Only save attendance if the user confirms.

### C. Multiple GPS Attempts

If GPS accuracy is:

* more than 50 meters

Automatically:

1. Retry GPS.
2. Wait for stronger GPS signal.
3. Compare results.
4. Save the most accurate coordinates.

Show loading:

```text
Acquiring precise GPS location...

Attempt 1/3

Accuracy:
23 meters
```

### D. Prevent Fake Location

Please implement:

* Detect mock/fake GPS apps if possible.
* Prevent attendance using IP address alone.
* Detect suspicious location jumps.

Example:

```text
Employee checked in:

9:00 AM
Manila

9:05 AM
Cebu

Impossible travel detected.
```

### E. Explain GPS Accuracy by Device

Explain:

* Android phone GPS accuracy
* iPhone GPS accuracy
* Windows laptop GPS accuracy
* Desktop PC without GPS sensor
* WiFi-only devices

and tell me what is realistically achievable.

---

# 2. Biometrics Feature

Currently, the app shows:

```text
Windows Hello

Touch ID

Face ID

Android Fingerprint
```

I want the biometric feature to be easier for employees.

Please separate the authentication methods.

I want independent buttons.

Example:

```text
Choose Authentication Method

[ Fingerprint ]

[ Face Recognition ]

[ PIN Code ]
```

---

## Fingerprint Button

If user clicks:

```text
[ Fingerprint ]
```

Requirements:

### Windows

Use:

* Windows Hello Fingerprint

### Android

Use:

* Device fingerprint scanner

### Mac

Use:

* Touch ID

### iPhone

Use:

* Touch ID if supported

Show:

```text
Touch your fingerprint sensor.
```

and authenticate.

---

## Face Recognition Button

If user clicks:

```text
[ Face Recognition ]
```

Requirements:

### Windows

Use:

* Windows Hello Face

### Android

Use:

* Device Face Unlock if supported

### iPhone

Use:

* Face ID

### Mac

If unsupported:

```text
Face Recognition is not available on this device.
```

---

## PIN Code Button

If user clicks:

```text
[ PIN ]
```

Requirements:

### Windows

Use:

* Windows Hello PIN

### Mobile

If device PIN cannot be accessed:

Fallback to:

* Employee Attendance PIN

Example:

```text
Enter your Attendance PIN

[ ____ ]

[ Verify ]
```

The PIN must:

* be hashed in database
* allow reset
* support forgot PIN flow

---

# 3. Device Compatibility

Please make ALL authentication methods work depending on device capability.

Examples:

### Windows Laptop

Show:

```text
Available Methods

✓ Fingerprint

✓ Face Recognition

✓ PIN
```

---

### Android Phone

Show:

```text
Available Methods

✓ Fingerprint

✓ Face Unlock

✓ Attendance PIN
```

---

### iPhone

Show:

```text
Available Methods

✓ Face ID

✓ Touch ID (if available)

✓ Attendance PIN
```

---

### Desktop PC without biometrics

Show:

```text
Available Methods

✗ Fingerprint unavailable

✗ Face Recognition unavailable

✓ Attendance PIN
```

---

# 4. Explain Technical Limitations

Very important:

Explain honestly whether it is technically possible to:

* Force fingerprint only.
* Force Face ID only.
* Force Windows Hello Face only.
* Separate Face ID and Touch ID into different APIs.
* Detect whether Windows Hello used fingerprint or face.
* Detect whether Android used fingerprint or face.

If impossible because of WebAuthn/browser limitations:

* Explain why.
* Show the closest alternative.
* Suggest the best UX design.

---

# 5. Responsive Design

Please make the ENTIRE app fully responsive.

Support:

* Android phones
* iPhones
* Tablets
* iPads
* Windows laptops
* MacBooks
* Desktop monitors

Requirements:

### Mobile

* Bottom navigation bar
* Touch-friendly buttons
* Swipe gestures if applicable
* Full screen dialogs
* Responsive tables
* Responsive Google Maps

### Tablet

* Adaptive layouts
* Side navigation if space allows

### Desktop

* Sidebar navigation
* Keyboard shortcuts
* Resizable tables
* Multi-column dashboards

---

# 6. Attendance Check In Flow

The Check In process should be:

1. Employee logs in.

2. Automatically prompt:

```text
Check In Required
```

3. Acquire GPS.

Show:

```text
Searching for precise location...

Accuracy:
5 meters
```

4. Display:

* Google Maps
* Address
* Coordinates
* Accuracy

5. User confirms location.

6. Ask for authentication:

```text
Choose Authentication

[ Fingerprint ]

[ Face Recognition ]

[ PIN ]
```

7. Authenticate.

8. Save:

* Check In Time
* Date
* GPS Coordinates
* Full Address
* Google Maps URL
* Device Name
* Browser
* Authentication Method Used
* GPS Accuracy

9. Show:

```text
✓ Check In Successful

Time:
7:02 AM

Location:
UST Main Building

Authentication:
Fingerprint

Accuracy:
5 meters
```

Please make this fully functional, production-ready, and explain the exact files and code to modify so I can debug and test it on my own computer step by step.
