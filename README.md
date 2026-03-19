# Express MVC Backend

A production-ready Node.js + Express.js REST API with MongoDB, Mongoose, and Firebase Cloud Messaging (FCM).

---

## Project Structure

```
backend/
├── config/
│   ├── db.js                    # MongoDB connection
│   └── firebase.js              # Firebase Admin SDK initialization
├── controllers/
│   ├── userBirthDetailController.js  # CRUD for user birth details
│   └── notificationController.js     # FCM push notifications
├── middleware/
│   ├── validators.js            # express-validator rules
│   └── errorHandler.js          # 404 + global error handler
├── models/
│   └── UserBirthDetail.js       # Mongoose schema & model
├── routes/
│   ├── userBirthDetailRoutes.js
│   └── notificationRoutes.js
├── .env                         # Environment variables (do not commit)
├── .env.example                 # Template for environment variables
├── .gitignore
├── app.js                       # Express app setup
├── package.json
└── server.js                    # Entry point
```

---

## Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Firebase project with Admin SDK credentials

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```

Edit `.env` and fill in your values:
```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/birthdetails_db

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
```

> **Getting Firebase credentials:** Firebase Console → Project Settings → Service Accounts → Generate new private key

### 3. Start the server
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

---

## API Reference

### Health Check
| Method | Endpoint  | Description       |
|--------|-----------|-------------------|
| GET    | /health   | Server status     |

---

### User Birth Details — `/api/users`

#### Create a record
```
POST /api/users
Content-Type: application/json

{
  "name": "Arjun Sharma",
  "gender": "male",
  "deviceId": "fcm-token-abc123",
  "dateOfBirth": "1990-05-15",
  "timeOfBirth": "14:30",
  "placeOfBirth": "Mumbai, Maharashtra"
}
```

#### Get all records (paginated)
```
GET /api/users?page=1&limit=10&deviceId=fcm-token-abc123&gender=male
```

#### Get one record
```
GET /api/users/:id
```

#### Update a record
```
PUT /api/users/:id
Content-Type: application/json

{
  "placeOfBirth": "Pune, Maharashtra"
}
```

#### Delete a record
```
DELETE /api/users/:id
```

---

### Notifications — `/api/notifications`

#### Send to a specific device
```
POST /api/notifications/send
Content-Type: application/json

{
  "deviceId": "fcm-device-token",
  "title": "Hello!",
  "body": "Your profile has been updated.",
  "data": { "screen": "profile", "userId": "abc123" }
}
```

#### Send to all devices of a user
```
POST /api/notifications/send-to-user
Content-Type: application/json

{
  "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
  "title": "Reminder",
  "body": "Your appointment is tomorrow."
}
```

#### Broadcast to all devices
```
POST /api/notifications/broadcast
Content-Type: application/json

{
  "title": "App Update Available",
  "body": "Version 2.0 is now available!",
  "data": { "version": "2.0" }
}
```

---

## Response Format

**Success:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

**Validation Error (422):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "name", "message": "Name is required" }
  ]
}
```

**Not Found (404):**
```json
{
  "success": false,
  "message": "Record not found"
}
```

---

## Gender Values
Valid values for the `gender` field:
- `male`
- `female`
- `other`
- `prefer_not_to_say`
