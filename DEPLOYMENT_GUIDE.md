# FocusForge Production Deployment Guide

**Target Architecture:**
* **Frontend:** Vercel (React 18 + Vite SPA + Tailwind CSS)
* **Backend:** Render (Node.js + Express REST API)
* **Database:** MongoDB Atlas (Cloud Database with Mongoose ODM)
* **Local Production Orchestration:** Docker Compose (Nginx + Express + MongoDB 7.0)

---

## 1. Prerequisites & Account Setup

Before deploying, ensure you have:
1. A [MongoDB Atlas Account](https://cloud.mongodb.com)
2. A [Render Account](https://render.com)
3. A [Vercel Account](https://vercel.com)
4. Your FocusForge repository pushed to GitHub or GitLab

---

## 2. Step 1: MongoDB Atlas Configuration (Database)

### 1.1 Create Cluster
1. Log in to **MongoDB Atlas**.
2. Click **Create** to deploy a new database cluster.
3. Choose **M0 Free** (for evaluation/staging) or **M10+** (for dedicated production with point-in-time recovery).
4. Choose a cloud provider and region matching your Render region (e.g., AWS `us-west-2 / Oregon` or `us-east-1 / N. Virginia`).
5. Cluster Name: `FocusForge`.

### 1.2 Create Database User
1. Navigate to **Security → Database Access → Add New Database User**.
2. Authentication Method: **Password**.
3. Username: `focusforge_app_user`.
4. Password: Generate a cryptographically strong 32-character password (store securely).
5. Database User Privileges: Select **Built-in Role** → `readWrite` on `focusforge` database (or `readWriteAnyDatabase`).
6. Click **Add User**.

### 1.3 Configure Network Access (IP Access List)
1. Navigate to **Security → Network Access → Add IP Address**.
2. Since Render and serverless platforms use dynamic outbound IP addresses, add:
   - Access List Entry: `0.0.0.0/0`
   - Comment: `Allow Render dynamic API access`
3. Click **Confirm**.

### 1.4 Obtain Connection URI
1. Click **Database → Clusters → Connect → Drivers (Node.js)**.
2. Copy the connection string format:
   ```
   mongodb+srv://focusforge_app_user:<YOUR_PASSWORD>@<cluster-host>.mongodb.net/focusforge?retryWrites=true&w=majority&appName=FocusForge
   ```

---

## 3. Step 2: Render API Deployment (Backend)

You can deploy to Render using either **Infrastructure as Code (Render Blueprint)** or **Manual Web Service**.

### Option A: 1-Click Render Blueprint (Recommended)
FocusForge includes `render.yaml` at the repository root and `apps/api/render.yaml`:
1. In the Render Dashboard, click **New +** → **Blueprint**.
2. Connect your FocusForge repository.
3. Render automatically reads `render.yaml` and parses the service configuration.
4. Fill in the two unsynced variables when prompted:
   - `MONGODB_URI`: Paste your MongoDB Atlas connection string.
   - `CLIENT_ORIGIN`: Enter your Vercel frontend domain (e.g. `https://focusforge.vercel.app` or `https://app.yourdomain.com`).
5. Click **Apply**.

### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect your FocusForge repository.
3. Set the following service parameters:
   - **Name:** `focusforge-api`
   - **Region:** `Oregon` (or matching your MongoDB Atlas region)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank for repository root)*
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build:api
     ```
     *(Or: `npm install && npm run build --workspace=@focusforge/shared && npm run build --workspace=api`)*
   - **Start Command:**
     ```bash
     node apps/api/dist/server.js
     ```
   - **Health Check Path:** `/health`
   - **Plan:** Free or Starter

### 3.1 Backend Environment Variables Reference

Configure these variables under the **Environment** tab on Render:

| Variable | Recommended Production Value | Required? | Description |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `production` | **Yes** | Enables secure HTTP-only cookies and production error handling. |
| `PORT` | `5000` | No | Render automatically sets `PORT`, API defaults to 5000. |
| `MONGODB_URI` | `mongodb+srv://...` | **Yes** | MongoDB Atlas connection string with database `focusforge`. |
| `JWT_ACCESS_SECRET` | *Min 32 random characters* | **Yes** | Cryptographic secret for signing 15-minute access tokens. |
| `JWT_REFRESH_SECRET` | *Min 32 random characters* | **Yes** | Cryptographic secret for signing 7-day refresh tokens. |
| `ACCESS_TOKEN_TTL` | `15m` | No | Access token lifespan (default `15m`). |
| `REFRESH_TOKEN_TTL` | `7d` | No | Refresh token cookie lifespan (default `7d`). |
| `CLIENT_ORIGIN` | `https://your-app.vercel.app` | **Yes** | Allowed CORS origin (must match your frontend domain exactly). |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | No | General IP rate limit window in minutes (default `15`). |
| `RATE_LIMIT_MAX_REQUESTS` | `300` | No | Max requests per IP in window (default `300`). |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `20` | No | Max auth attempts per IP per 15 minutes (default `20`). |

> [!NOTE]
> `app.set('trust proxy', 1)` is enabled in `apps/api/src/app.ts`. This ensures SSL termination on Render correctly flags incoming requests as HTTPS and transmits `secure: true` cookies.

---

## 4. Step 3: Vercel Deployment (Frontend)

FocusForge's frontend is a React 18 + Vite SPA located in `apps/web`.

### 4.1 Import Repository to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Select and import your `FocusForge` repository.

### 4.2 Configure Project Settings
FocusForge supports both root-level and monorepo subdirectory imports via included `vercel.json` configurations:

* **Configuration Option 1: Root Directory set to `apps/web` (Recommended for Vercel):**
  - **Framework Preset:** `Vite`
  - **Root Directory:** Click **Edit** → select `apps/web`.
  - **Build Command:** *(Leave default or uses `apps/web/vercel.json`)*:
    ```bash
    cd ../.. && npm run build --workspace=@focusforge/shared && npm run build --workspace=web
    ```
  - **Output Directory:** `dist`

* **Configuration Option 2: Root Directory left as `.` (Repository Root):**
  - Vercel automatically detects the root `vercel.json`:
    - **Build Command:** `npm run build:web`
    - **Output Directory:** `apps/web/dist`

### 4.3 Environment Variables
Configure under **Environment Variables** in Vercel:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://<your-render-service>.onrender.com/api/v1` | URL of your deployed Render backend API |

Click **Deploy**.

### 4.4 SPA Routing Fallback & Security Headers
Both `vercel.json` files in FocusForge automatically configure:
1. **SPA Rewrites:** All requests to `/(.*)` redirect to `/index.html`, ensuring deep links (`/tasks`, `/planner`, `/timer`, `/analytics`) don't return 404 on browser reload.
2. **Immutable Caching:** Static hashed assets in `/assets/*` are cached with `public, max-age=31536000, immutable`.
3. **Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 5. Step 4: Connecting Frontend and Backend (CORS & Cookies)

Modern browsers apply strict cross-site cookie restrictions. FocusForge is designed to handle this seamlessly.

### Subdomain Strategy (Best Practice for Custom Domains)
If using a custom domain:
* **Frontend:** `https://app.yourdomain.com`
* **API:** `https://api.yourdomain.com`
* **CORS `CLIENT_ORIGIN`:** `https://app.yourdomain.com`

**Advantages:**
- Same-site cookie context: Cookies are considered first-party (`SameSite=Lax` or `SameSite=None` on same registrable domain).
- Prevents cross-site tracking blockers in Safari (ITP) and Brave.

### Default Cross-Origin Strategy (e.g., `*.vercel.app` and `*.onrender.com`)
If using default provider domains:
* Backend `apps/api/src/utils/tokens.ts` automatically configures:
  - `sameSite: 'none'`
  - `secure: true`
  - `httpOnly: true`
* Backend `apps/api/src/app.ts` enables `credentials: true` on CORS with origin set to `CLIENT_ORIGIN`.
* Frontend `apps/web/src/services/api/apiClient.ts` sends `credentials: 'include'` on all API requests.

---

## 6. Local Production Testing via Docker Compose

To verify the complete production stack locally before cloud deployment:

```bash
# 1. Start MongoDB, Express API, and Nginx Web Server
docker compose up --build

# 2. Verify running containers
docker compose ps

# 3. Access applications:
# Frontend SPA: http://localhost:80
# Backend API:  http://localhost:5000/health
```

### Docker Compose Architecture
* `mongodb`: Official `mongo:7.0` container with volume persistence and healthcheck.
* `api`: Multi-stage Node 22 Alpine build running production bundle with non-root security user.
* `web`: Multi-stage build compiled by Vite and served by Nginx Alpine with SPA routing and asset caching.

---

## 7. Post-Deployment Smoke Test Checklist

Execute these 7 verification steps after deploying to production:

- [ ] **1. API Health Check:**
  - Visit `https://<api-url>/health`
  - Verify response is HTTP 200:
    ```json
    {
      "success": true,
      "data": {
        "status": "healthy",
        "uptimeSeconds": 45,
        "database": { "connected": true, "status": "connected" }
      }
    }
    ```
- [ ] **2. Frontend Navigation:**
  - Visit `https://<web-url>`
  - Verify application loads in Guest Mode with demo data.
  - Refresh the page on `/tasks` and `/analytics` to verify SPA fallback routing does not 404.
- [ ] **3. User Registration:**
  - Click **Sign in** → **Create account**.
  - Register with a test email and password.
  - Verify immediate redirection to Dashboard with fresh user state.
- [ ] **4. Cookie Verification:**
  - Open Browser DevTools → **Application** → **Cookies** → API domain.
  - Verify `focusforge_refresh_token` exists and has:
    - `HttpOnly: true`
    - `Secure: true`
    - `SameSite: None` (or `Lax` on custom domain)
- [ ] **5. Resource CRUD & Persistence:**
  - Create a new task (e.g., "Review Chemistry Notes").
  - Mark it complete.
  - Hard refresh the page (`Ctrl+F5` / `Cmd+Shift+R`).
  - Verify the task persists in the database.
- [ ] **6. Silent Token Refresh:**
  - Trigger token refresh in DevTools Console or let access token expire (15 min).
  - Verify a `POST /api/v1/auth/refresh` succeeds and issues a new access token without user logout.
- [ ] **7. Sign Out:**
  - Click user profile → **Sign out**.
  - Verify refresh cookie is cleared and app returns to login/guest state.

---

## 8. Rollback Procedures

### Rollback Frontend (Vercel)
1. Go to **Vercel Dashboard → FocusForge → Deployments**.
2. Locate the previous working deployment.
3. Click the three dots (`...`) → **Instant Rollback**.
4. Traffic is immediately redirected to the previous build without rebuilding.

### Rollback Backend (Render)
1. Go to **Render Dashboard → focusforge-api → Events**.
2. Locate the previous successful deploy.
3. Click **Rollback to this deploy**.
4. Render switches traffic back to the prior container image.

---
*Guide maintained for FocusForge monorepo.*
