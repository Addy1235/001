# Deployment Guide - Flashcard App

Deploy your flashcard app for **FREE** using:
- **Frontend:** Cloudflare Pages (static hosting)
- **Backend:** Render (Node.js hosting)
- **Database:** MongoDB Atlas (cloud database)

Total cost: **$0/month**

---

## Step 1: Set Up MongoDB Atlas (5 minutes)

### 1.1 Create Account
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click "Try Free" and create an account

### 1.2 Create Free Cluster
1. Click "Build a Database"
2. Select **M0 FREE** tier
3. Choose cloud provider: **AWS**
4. Choose region: **Singapore** (or closest to you)
5. Cluster name: `flashcard-cluster`
6. Click "Create"

### 1.3 Set Up Database Access
1. Go to "Database Access" in sidebar
2. Click "Add New Database User"
3. Username: `flashcard-user`
4. Password: Click "Autogenerate Secure Password" → **COPY THIS!**
5. Database User Privileges: "Read and write to any database"
6. Click "Add User"

### 1.4 Set Up Network Access
1. Go to "Network Access" in sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for Render deployment)
4. Click "Confirm"

### 1.5 Get Connection String
1. Go to "Database" in sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string, it looks like:
   ```
   mongodb+srv://flashcard-user:<password>@flashcard-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password
6. Add database name before `?`:
   ```
   mongodb+srv://flashcard-user:YOUR_PASSWORD@flashcard-cluster.xxxxx.mongodb.net/flashcard?retryWrites=true&w=majority
   ```

**Save this connection string - you'll need it for Render!**

---

## Step 2: Deploy Backend to Render (10 minutes)

### 2.1 Push Code to GitHub
First, push your code to GitHub if you haven't:

```bash
cd d:\1.1_flashcard
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2.2 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### 2.3 Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Select your flashcard repository

### 2.4 Configure Service
| Setting | Value |
|---------|-------|
| Name | `flashcard-api` |
| Region | Singapore (or closest) |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Plan | **Free** |

### 2.5 Add Environment Variables
Click "Advanced" → "Add Environment Variable":

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your MongoDB connection string from Step 1.5 |
| `JWT_SECRET` | Click "Generate" or use a random 64-char string |
| `CORS_ORIGIN` | `https://your-app.pages.dev` (update after frontend deploy) |

### 2.6 Deploy
Click "Create Web Service"

Wait for deployment (2-5 minutes). You'll get a URL like:
```
https://flashcard-api.onrender.com
```

**Test it:** Visit `https://flashcard-api.onrender.com/health`
You should see: `{"status":"ok","timestamp":"..."}`

---

## Step 3: Deploy Frontend to Cloudflare Pages (5 minutes)

### 3.1 Create Cloudflare Account
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Sign up (free)

### 3.2 Create New Project
1. Click "Create a project"
2. Click "Connect to Git"
3. Select your GitHub repository

### 3.3 Configure Build Settings
| Setting | Value |
|---------|-------|
| Project name | `flashcard-app` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | (leave empty) |
| Build output directory | `/` (or leave empty) |
| Root directory | `/` |

### 3.4 Deploy
Click "Save and Deploy"

Wait for deployment (1-2 minutes). You'll get a URL like:
```
https://flashcard-app.pages.dev
```

---

## Step 4: Connect Frontend to Backend

### 4.1 Update API URL
Edit `api.js` and replace the production URL:

```javascript
// Line 268: Replace with your actual Render URL
return 'https://flashcard-api.onrender.com/api/v1';
```

### 4.2 Update CORS on Render
1. Go to Render Dashboard → Your service → Environment
2. Update `CORS_ORIGIN` to your Cloudflare URL:
   ```
   https://flashcard-app.pages.dev
   ```
3. Click "Save Changes" (service will redeploy)

### 4.3 Redeploy Frontend
```bash
git add api.js
git commit -m "Update production API URL"
git push
```

Cloudflare will auto-deploy.

---

## Step 5: Test Your Deployment

1. Visit your frontend URL: `https://flashcard-app.pages.dev`
2. Click "Login" → "Sign up"
3. Create an account
4. Add some flashcards
5. Test on mobile!

---

## Custom Domain (Optional)

### Cloudflare Pages
1. Go to your project → Custom domains
2. Click "Set up a custom domain"
3. Enter your domain (e.g., `flashcards.yourdomain.com`)
4. Follow DNS instructions

### Render
1. Go to your service → Settings → Custom Domains
2. Add your API domain (e.g., `api.flashcards.yourdomain.com`)

---

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify `MONGODB_URI` is correct
- Ensure MongoDB IP whitelist includes `0.0.0.0/0`

### CORS errors
- Check `CORS_ORIGIN` matches your frontend URL exactly
- Include `https://` in the URL
- For multiple origins: `https://app1.com,https://app2.com`

### Slow first load
- Render free tier sleeps after 15 minutes of inactivity
- First request after sleep takes 10-30 seconds
- Upgrade to paid ($7/month) for always-on

### MongoDB connection fails
- Verify password has no special characters that need URL encoding
- Check Network Access allows `0.0.0.0/0`
- Ensure database name is in the URI (`/flashcard?`)

---

## Upgrade Path

When you need more:

| Need | Solution | Cost |
|------|----------|------|
| Always-on backend | Render Starter | $7/month |
| More database storage | Atlas M2 | $9/month |
| Custom domain SSL | Included free | $0 |
| More bandwidth | Cloudflare (unlimited) | $0 |

---

## Quick Reference

| Component | URL |
|-----------|-----|
| Frontend | `https://flashcard-app.pages.dev` |
| Backend | `https://flashcard-api.onrender.com` |
| API Health | `https://flashcard-api.onrender.com/health` |
| MongoDB | Atlas Dashboard |

---

**Done!** Your flashcard app is now live and accessible from anywhere! 🎉
