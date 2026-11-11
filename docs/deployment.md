# FocusForge Deployment Runbook & Production Guide

This guide details the step-by-step procedure for deploying FocusForge to production using MongoDB Atlas, Render (API), and Vercel (Frontend).

---

## 1. MongoDB Atlas Setup

### Step 1: Create a Cluster
1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create a new Project named `FocusForge`.
3. Create a cluster (the **M0 Free Tier** is sufficient for evaluation; **M10+** for production with automated backups).
4. Select a cloud region close to your API host (e.g., `us-east-1` or `oregon`).

### Step 2: Configure Database User (Least Privilege)
1. Go to **Security → Database Access → Add New Database User**.
2. **Authentication Method:** Password.
3. **Username:** `focusforge_app_user`.
4. **Password:** Generate a strong 32-character random string (store securely in a password manager).
5. **Database User Privileges:** Select `Built-in Role` → `Read and write to any database` (or restrict specifically to the `focusforge` database).
6. Click **Add User**.

### Step 3: Configure Network Access
1. Go to **Security → Network Access → Add IP Address**.
2. For initial deployment or platforms with dynamic IP ranges (such as Render or Railway):
   - Add `0.0.0.0/0` (Allow access from anywhere).
   - *Production best practice:* Configure VPC Peering or Private Service Connect if using dedicated Atlas clusters.
3. Click **Confirm**.

### Step 4: Retrieve Connection String
1. Go to **Database → Clusters → Connect → Drivers (Node.js)**.
2. Copy the connection URI:
   ```
   mongodb+srv://focusforge_app_user:<password>@cluster0.xxxx.mongodb.net/focusforge?retryWrites=true&w=majority&appName=FocusForge
   ```

---

## 2. API Deployment (Render)

### Step 1: Connect GitHub Repository
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository containing FocusForge.

### Step 2: Configure Service Parameters
- **Name:** `focusforge-api`
- **Region:** Choose the region closest to your Atlas cluster (e.g., Oregon).
- **Branch:** `main`
- **Root Directory:** *(leave blank for root or set to monorepo root)*
- **Runtime:** `Node`
- **Build Command:**
  ```bash
  npm install && npm run build --workspace=@focusforge/shared && npm run build --workspace=api
  ```
- **Start Command:**
  ```bash
  node apps/api/dist/server.js
  ```
- **Health Check Path:** `/health`

### Step 3: Environment Variables
Add the following in **Environment**:
| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables secure cookies and disables debug traces |
| `PORT` | `5000` | Port used by Render (or let Render set PORT) |
| `MONGODB_URI` | `mongodb+srv://...` | Connection URI from MongoDB Atlas |
| `JWT_ACCESS_SECRET` | *32+ char random string* | Secret used to sign short-lived access JWTs |
| `JWT_REFRESH_SECRET` | *32+ char random string* | Secret used to sign refresh token cookies |
| `ACCESS_TOKEN_TTL` | `15m` | Lifetime of in-memory access token |
| `REFRESH_TOKEN_TTL` | `7d` | Lifetime of refresh token cookie |
| `CLIENT_ORIGIN` | `https://focusforge.vercel.app` | URL of your deployed frontend |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | Window duration for IP rate limiting |
| `RATE_LIMIT_MAX_REQUESTS` | `300` | Max requests per window |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `20` | Max auth attempts per window |

Click **Create Web Service**.

---

## 3. Frontend Deployment (Vercel)

### Step 1: Import Project to Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** → **Project**.
3. Import the `FocusForge` repository.

### Step 2: Configure Monorepo Settings
- **Framework Preset:** `Vite`
- **Root Directory:** `apps/web`
- **Build Command:** (managed by `apps/web/vercel.json` or override):
  ```bash
  npm run build
  ```
- **Output Directory:** `dist`

### Step 3: Configure Environment Variables
| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://focusforge-api.onrender.com/api/v1` | URL of your deployed Render API service |

Click **Deploy**.

---

## 4. Cross-Site Cookies & Custom Domain Strategy

### The Subdomain Approach (Recommended)
For seamless cookie handling across modern browsers (safeguarding against third-party cookie restrictions in Safari/Brave):
- **Web:** `https://app.focusforge.dev`
- **API:** `https://api.focusforge.dev`

**Benefits:**
- Same-site first-party cookie scope (`SameSite=Lax` or `SameSite=None` with same registrable domain `focusforge.dev`).
- Browsers do not categorize the refresh cookie as a cross-site tracking cookie.

### Cross-Origin Approach (e.g. `vercel.app` + `onrender.com`)
- FocusForge is pre-configured with `sameSite: 'none'` and `secure: true` in production.
- Render trust proxy is enabled (`app.set('trust proxy', 1)`), ensuring `secure` cookies transmit correctly through SSL termination proxies.

---

## 5. Post-Deployment Smoke Test Checklist

After completing deployment:
- [ ] **Health Check:** Visit `https://<api-domain>/health` → HTTP 200 `{ status: "healthy", database: { connected: true } }`.
- [ ] **Registration:** Navigate to `https://<web-domain>/register`, create an account, verify instant redirect to Dashboard.
- [ ] **Cookie Verification:** Inspect browser DevTools → Application → Cookies → confirm `focusforge_refresh_token` has `HttpOnly`, `Secure`, and `SameSite=None`.
- [ ] **Task Creation & Persistence:** Create a task, mark it complete, reload page (`F5`) → confirm task status persists.
- [ ] **Silent Token Refresh:** Keep the session open for 15+ minutes (or trigger `/auth/refresh`) → confirm access token refreshes without user disruption.
- [ ] **Logout:** Click sign out → confirm refresh cookie is cleared and redirected to `/login`.

---

## 6. Rollback Procedures

### Frontend (Vercel)
1. Go to **Deployments** in the Vercel project dashboard.
2. Find the previous stable deployment.
3. Click **...** → **Instant Rollback**.

### API (Render)
1. Go to **Events** or **Deploy History** in the Render service dashboard.
2. Select the previous successful deployment and click **Rollback to this deploy**.
3. If rollback is due to a database schema mismatch, review MongoDB Atlas backups and restore point-in-time snapshot if necessary.
