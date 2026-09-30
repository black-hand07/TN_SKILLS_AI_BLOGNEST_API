# AI BlogNest API

> **This project is a backend-only REST API and does not contain a frontend.**

A modular, AI-powered blogging REST API built with Node.js, Express.js, MongoDB, and Google Gemini AI. Test all endpoints using Postman or Thunder Client.

---

## Table of Contents

1. [Project Description](#project-description)
2. [Problem Statement](#problem-statement)
3. [Solution](#solution)
4. [Features](#features)
5. [Technology Stack](#technology-stack)
6. [Software Requirements](#software-requirements)
7. [Project Architecture](#project-architecture)
8. [Folder Structure](#folder-structure)
9. [Database Design](#database-design)
10. [User Roles & Authorization](#user-roles--authorization)
11. [Authentication](#authentication)
12. [API Endpoints](#api-endpoints)
13. [Environment Variables](#environment-variables)
14. [Installation](#installation)
15. [How to Start](#how-to-start)
16. [How to Test with Postman](#how-to-test-with-postman)
17. [AI Generation Examples](#ai-generation-examples)
18. [AI Ambiguity Handling](#ai-ambiguity-handling)
19. [Security Features](#security-features)
20. [Error Handling](#error-handling)

---

## Project Description

AI BlogNest API is a production-ready, headless REST API for an AI-powered blogging platform. It enables users to register, create and manage blogs, interact through comments and likes, and leverage Google Gemini AI to automatically generate full blog articles or summarize existing content.

---

## Problem Statement

Content creators spend significant time writing and structuring articles. Existing blog platforms lack intelligent assistance and are often monolithic. There is a need for a secure, role-aware, modular backend that supports both traditional blog management and AI-assisted content generation across any topic domain.

---

## Solution

AI BlogNest API provides:
- A secure authentication system with JWT and bcrypt
- Role-based access control for granular permissions
- Full Blog CRUD with search, filtering, and pagination
- Embedded comment management with moderation
- Like/unlike functionality
- AI blog generation via Gemini — adaptable to any topic (technology, history, travel, food, science, etc.)
- AI summarization that preserves the original subject
- Intelligent ambiguity detection to ask for clarification when needed

---

## Features

- ✅ User registration & JWT login
- ✅ bcrypt password hashing
- ✅ Role-based authorization (admin, editor, author, reader)
- ✅ Blog CRUD (create, read, update, delete)
- ✅ Blog status lifecycle: draft → pending → scheduled → published
- ✅ Category and tag support with filtering
- ✅ Full-text search across title, content, category, tags
- ✅ Pagination for blog listings
- ✅ Embedded comments with moderation (approve / spam)
- ✅ Blog likes (toggle, per-user, prevents duplicates)
- ✅ AI blog generation using Google Gemini (context-aware, universal topics)
- ✅ AI blog summarization
- ✅ Ambiguity detection — asks for clarification when topic is unclear
- ✅ Rate limiting (global + stricter for AI endpoints)
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Input validation with express-validator
- ✅ Centralized error handling
- ✅ Structured JSON responses
- ✅ Morgan request logging
- ✅ Graceful shutdown
- ✅ MongoDB indexes for performance

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | ODM for MongoDB |
| bcrypt | Password hashing |
| jsonwebtoken | JWT authentication |
| @google/genai | Google Gemini AI SDK |
| dotenv | Environment variable management |
| cors | Cross-origin resource sharing |
| helmet | HTTP security headers |
| express-rate-limit | Rate limiting |
| express-validator | Input validation |
| morgan | HTTP request logging |

---

## Software Requirements

- **Node.js** v18+ (LTS recommended)
- **npm** v9+
- **MongoDB** v6+ (Atlas or local)
- **Google Gemini API key** (from Google AI Studio)
- **Postman** or **Thunder Client** (for testing)

---

## Project Architecture

```
Postman / Thunder Client
        │
        ▼
   Express Route
        │
        ▼
  Auth Middleware
        │
        ▼
    Controller
        │
     ┌──┴──┐
     ▼     ▼
  Service  Model
  (Gemini) (Mongoose)
     │     │
     ▼     ▼
  Gemini  MongoDB
   API
        │
        ▼
  JSON Response
```

---

## Folder Structure

```
AI_Blognest_2nd/
│
├── src/
│   ├── config/
│   │   └── db.js                  # MongoDB connection
│   │
│   ├── controllers/
│   │   ├── aiController.js        # AI generation & summarization handlers
│   │   ├── authController.js      # Register & login handlers
│   │   └── blogController.js      # Blog CRUD, comments, likes
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js      # JWT authentication + role authorization
│   │   └── errorMiddleware.js     # Centralized error handling
│   │
│   ├── models/
│   │   ├── Blog.js                # Blog schema (with embedded comments)
│   │   └── User.js                # User schema
│   │
│   ├── routes/
│   │   ├── aiRoutes.js            # /api/ai routes
│   │   ├── authRoutes.js          # /api/auth routes
│   │   └── blogRoutes.js          # /api/blogs routes
│   │
│   ├── services/
│   │   └── geminiService.js       # All Gemini AI logic
│   │
│   ├── app.js                     # Express app setup
│   └── server.js                  # Server entry point
│
├── .env                           # Environment variables (not committed)
├── .gitignore
├── package.json
└── README.md
```

---

## Database Design

### User Collection

| Field | Type | Notes |
|---|---|---|
| name | String | Required, trimmed |
| email | String | Required, unique, lowercase |
| password | String | Hashed with bcrypt, never returned |
| role | String | admin / editor / author / reader |
| createdAt | Date | Auto |
| updatedAt | Date | Auto |

### Blog Collection

| Field | Type | Notes |
|---|---|---|
| title | String | Required, 5-300 chars |
| content | String | Required, min 50 chars |
| summary | String | Optional, max 1000 chars |
| author | ObjectId | Ref to User |
| category | String | Required |
| tags | [String] | Max 20 tags |
| status | String | draft / pending / scheduled / published |
| comments | [Comment] | Embedded array |
| likes | Number | Count, default 0 |
| likedBy | [ObjectId] | User refs, not returned by default |
| createdAt | Date | Auto |
| updatedAt | Date | Auto |

### Embedded Comment

| Field | Type | Notes |
|---|---|---|
| user | ObjectId | Ref to User |
| text | String | Required, 1-2000 chars |
| status | String | pending / approved / spam |
| createdAt | Date | Auto |

---

## User Roles & Authorization

| Role | Permissions |
|---|---|
| **admin** | Full access: manage users, all blogs, all comments, publish anything |
| **editor** | Review blogs, approve/publish, moderate comments |
| **author** | Create/update/delete own blogs, submit for review |
| **reader** | View published blogs, comment, like |

### Status Workflow

```
author creates  →  draft
author submits  →  pending
editor reviews  →  scheduled / published
admin manages   →  any status
```

---

## Authentication

- **Registration**: POST /api/auth/register — creates account, returns JWT
- **Login**: POST /api/auth/login — validates credentials, returns JWT
- **JWT payload**: `{ userId, role }` — no password included
- **Token usage**: `Authorization: Bearer <token>` header
- **Token expiry**: 7 days

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login and get JWT |

### Blogs

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/blogs` | Yes | admin, editor, author | Create blog |
| GET | `/api/blogs` | Optional | All | List blogs (search/filter) |
| GET | `/api/blogs/:id` | Optional | All | Get single blog |
| PUT | `/api/blogs/:id` | Yes | admin, editor, author | Update blog |
| DELETE | `/api/blogs/:id` | Yes | admin, author (own) | Delete blog |
| POST | `/api/blogs/:id/comments` | Yes | All | Add comment |
| PATCH | `/api/blogs/:id/comments/:commentId/moderate` | Yes | admin, editor | Moderate comment |
| POST | `/api/blogs/:id/like` | Yes | All | Like/unlike blog |

### AI

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/ai/generate-blog` | Yes | admin, editor, author | Generate blog with Gemini |
| POST | `/api/ai/summarize` | Yes | All | Summarize content with Gemini |

### Query Parameters for GET /api/blogs

| Param | Example | Description |
|---|---|---|
| `search` | `?search=machine learning` | Full-text search |
| `category` | `?category=Technology` | Filter by category |
| `tag` | `?tag=AI` | Filter by tag |
| `status` | `?status=published` | Filter by status |
| `author` | `?author=<userId>` | Filter by author |
| `page` | `?page=2` | Pagination page |
| `limit` | `?limit=5` | Items per page (max 100) |

---

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ai-blognest
JWT_SECRET=your_very_long_random_secret_here
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=development
```

> ⚠️ Never commit `.env` to version control. It is in `.gitignore`.

---

## Installation

```bash
# 1. Clone or navigate to the project
cd AI_Blognest_2nd

# 2. Install dependencies
npm install

# 3. Configure environment
# Edit .env with your MongoDB URI, JWT secret, and Gemini API key

# 4. Start the server
npm start
```

---

## How to Start

**Development (with auto-restart):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The server starts at `http://localhost:5000` (or configured PORT).

---

## How to Test with Postman

Set base URL: `http://localhost:5000`

For authenticated requests, add header:
```
Authorization: Bearer <your_jwt_token>
```

---

### 1. Register

**POST** `/api/auth/register`

Body (JSON):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123"
}
```

Expected (201):
```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "token": "eyJ...",
    "user": { "id": "...", "name": "John Doe", "email": "john@example.com", "role": "reader" }
  }
}
```

---

### 2. Login

**POST** `/api/auth/login`

Body (JSON):
```json
{
  "email": "john@example.com",
  "password": "Password123"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Login successful.",
  "data": { "token": "eyJ...", "user": { ... } }
}
```

---

### 3. Create Blog

**POST** `/api/blogs`
**Header:** `Authorization: Bearer <token>` (author/editor/admin)

Body (JSON):
```json
{
  "title": "Getting Started with Node.js",
  "content": "Node.js is a JavaScript runtime built on Chrome's V8 engine. It allows developers to run JavaScript on the server side. This article covers the fundamental concepts every Node.js developer should know.",
  "summary": "An introduction to Node.js fundamentals.",
  "category": "Programming",
  "tags": ["Node.js", "JavaScript", "Backend"],
  "status": "draft"
}
```

Expected (201):
```json
{
  "success": true,
  "message": "Blog created successfully.",
  "data": { "blog": { "_id": "...", "title": "...", "status": "draft", ... } }
}
```

---

### 4. Get All Blogs

**GET** `/api/blogs`

Expected (200):
```json
{
  "success": true,
  "message": "Blogs retrieved successfully.",
  "data": {
    "blogs": [...],
    "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### 5. Get Single Blog

**GET** `/api/blogs/:id`

Expected (200):
```json
{
  "success": true,
  "message": "Blog retrieved successfully.",
  "data": { "blog": { ... } }
}
```

---

### 6. Update Blog

**PUT** `/api/blogs/:id`
**Header:** `Authorization: Bearer <token>`

Body (JSON):
```json
{
  "title": "Updated Title",
  "status": "published"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Blog updated successfully.",
  "data": { "blog": { ... } }
}
```

---

### 7. Delete Blog

**DELETE** `/api/blogs/:id`
**Header:** `Authorization: Bearer <token>` (author/admin)

Expected (200):
```json
{
  "success": true,
  "message": "Blog deleted successfully.",
  "data": null
}
```

---

### 8. Generate AI Blog

**POST** `/api/ai/generate-blog`
**Header:** `Authorization: Bearer <token>` (author/editor/admin)

Body (JSON):
```json
{
  "topic": "Artificial Intelligence in Healthcare",
  "category": "Technology",
  "keywords": ["AI", "healthcare", "machine learning"],
  "length": "medium"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Blog generated successfully.",
  "data": {
    "title": "How AI is Revolutionizing Healthcare Diagnostics",
    "summary": "...",
    "content": "...",
    "category": "Technology",
    "tags": ["AI", "Healthcare", "Machine Learning", "Diagnostics", "Innovation"]
  }
}
```

---

### 9. Summarize Blog

**POST** `/api/ai/summarize`
**Header:** `Authorization: Bearer <token>`

Body (JSON):
```json
{
  "content": "Node.js is a JavaScript runtime built on Chrome V8 engine... [long content]"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Blog summarized successfully.",
  "data": { "summary": "A concise 2-4 sentence summary..." }
}
```

---

### 10. Add Comment

**POST** `/api/blogs/:id/comments`
**Header:** `Authorization: Bearer <token>`

Body (JSON):
```json
{
  "text": "This is a great article! Very informative."
}
```

Expected (201):
```json
{
  "success": true,
  "message": "Comment submitted successfully. It is pending moderation.",
  "data": { "comment": { "_id": "...", "text": "...", "status": "pending" } }
}
```

---

### 11. Like Blog

**POST** `/api/blogs/:id/like`
**Header:** `Authorization: Bearer <token>`

Expected (200):
```json
{
  "success": true,
  "message": "Blog liked.",
  "data": { "likes": 1 }
}
```

Call again to unlike:
```json
{
  "success": true,
  "message": "Blog unliked.",
  "data": { "likes": 0 }
}
```

---

### 12. Protected Routes

Any protected route without a token returns:
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

With expired token:
```json
{
  "success": false,
  "message": "Token has expired. Please log in again."
}
```

---

### 13. Role Authorization

A reader trying to create a blog returns:
```json
{
  "success": false,
  "message": "Access denied. Required role(s): admin, editor, author. Your role: reader."
}
```

---

### 14. Search

**GET** `/api/blogs?search=machine+learning`

**GET** `/api/blogs?search=artificial+intelligence&category=Technology`

---

### 15. Category Filtering

**GET** `/api/blogs?category=Technology`

**GET** `/api/blogs?category=History`

---

### 16. Tag Filtering

**GET** `/api/blogs?tag=AI`

**GET** `/api/blogs?tag=Node.js`

---

### 17. Moderate Comment

**PATCH** `/api/blogs/:blogId/comments/:commentId/moderate`
**Header:** `Authorization: Bearer <token>` (admin or editor only)

Body (JSON):
```json
{
  "status": "approved"
}
```

Expected (200):
```json
{
  "success": true,
  "message": "Comment approved successfully.",
  "data": { "comment": { "_id": "...", "status": "approved", ... } }
}
```

---

## AI Generation Examples

### Technology Topic
```json
{
  "topic": "Java Architecture",
  "category": "Programming",
  "keywords": ["JVM", "JDK", "JRE"]
}
```
→ Generates article about **Java programming language** architecture.

### Travel Topic
```json
{
  "topic": "Java Culture and Geography",
  "category": "Travel",
  "keywords": ["Indonesia", "island", "culture"]
}
```
→ Generates article about the **Java island** in Indonesia.

### History Topic
```json
{
  "topic": "World War II",
  "category": "History",
  "keywords": ["Europe", "1939", "1945"]
}
```
→ Generates appropriate **historical article**.

### Health Topic
```json
{
  "topic": "Apple Nutrition",
  "category": "Health",
  "keywords": ["fruit", "vitamins", "diet"]
}
```
→ Generates article about the **apple fruit** and nutrition.

---

## AI Ambiguity Handling

If the topic cannot be clearly identified from context, the API returns:

```json
{
  "success": false,
  "message": "The topic is ambiguous. Please provide a category, description, or keywords to clarify the intended subject.",
  "data": {
    "reason": "The topic 'Mercury' could refer to the planet, the chemical element, or other subjects without additional context.",
    "hint": "Add more specific keywords or a description field to help identify the correct subject."
  }
}
```

**Fix**: Add category and keywords to disambiguate:
```json
{
  "topic": "Mercury",
  "category": "Astronomy",
  "keywords": ["planet", "Sun", "orbit"]
}
```
→ Generates article about **Mercury the planet**.

---

## Security Features

| Feature | Implementation |
|---|---|
| Password hashing | bcrypt with 12 salt rounds |
| Authentication | JWT Bearer tokens (7-day expiry) |
| Security headers | helmet middleware |
| CORS | Configurable origins |
| Rate limiting | 200/15min global; 20/15min AI endpoints |
| Input validation | express-validator on all inputs |
| Password exposure | Never returned in any response |
| Stack traces | Hidden in production |
| MongoDB injection | Mongoose typed schemas prevent injection |
| Secret management | Environment variables only, never hardcoded |

---

## Error Handling

All errors return consistent JSON:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

| HTTP Code | Meaning |
|---|---|
| 400 | Bad request / validation failure |
| 401 | Unauthenticated (no/invalid/expired token) |
| 403 | Unauthorized (insufficient role) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Server error |
| 502 | AI/external service failure |

---

## Important Notes

- This is a **backend-only** REST API with no frontend.
- Test with **Postman** or **Thunder Client**.
- AI-generated content quality depends on Google Gemini API.
- AI content is coherent and context-aware but not guaranteed to be 100% factually accurate.
- The system supports any valid topic — not limited to technology or programming.
