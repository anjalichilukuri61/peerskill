# Deployment Guide: PeerSkill Hub

This guide provides instructions for hosting your full-stack application for free using **Vercel** (Frontend) and **Render** (Backend).

## Prerequisites
1.  A [GitHub](https://github.com/) account.
2.  Your project pushed to a GitHub repository.

---

## 1. Backend Deployment (Render.com)
Render is an excellent choice for hosting Node.js Express servers.

### Steps:
1.  **Sign up**: Go to [Render.com](https://render.com/) and sign in with GitHub.
2.  **New Web Service**: Click **New +** > **Web Service**.
3.  **Connect Repo**: Connect your PeerSkill Hub repository.
4.  **Configuration**:
    - **Name**: `peerskill-hub-backend`
    - **Root Directory**: `server`
    - **Language**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node index.js`
5.  **Environment Variables**: Click **Advanced** and add:
    - `PORT`: `10000` (or leave empty, Render handles this).
    - `FIREBASE_PROJECT_ID`: (Your Project ID)
    - `FIREBASE_CLIENT_EMAIL`: (From your Firebase Service Account JSON)
    - `FIREBASE_PRIVATE_KEY`: (From your Firebase Service Account JSON - replace `\n` with actual newlines if needed).
    - `RAZORPAY_KEY_ID`: (Your Razorpay Key)
    - `RAZORPAY_KEY_SECRET`: (Your Razorpay Secret)
6.  **Deploy**: Click **Create Web Service**. Once deployed, copy the URL (e.g., `https://peerskill-hub-backend.onrender.com`).

---

## 2. Frontend Deployment (Vercel)
Vercel is the best platform for React/Vite applications.

### Steps:
1.  **Sign up**: Go to [Vercel.com](https://vercel.com/) and sign in with GitHub.
2.  **Add New**: Click **Add New** > **Project**.
3.  **Import**: Import your PeerSkill Hub repository.
4.  **Configuration**:
    - **Root Directory**: `client`
    - **Framework Preset**: `Vite` (automatically detected).
5.  **Environment Variables**: Add:
    - `VITE_API_URL`: (The URL of your Render backend from step 1).
6.  **Deploy**: Click **Deploy**. Vercel will give you a production URL (e.g., `https://peerskill-hub.vercel.app`).

---

## 3. Post-Deployment Updates

### Firebase Console
1.  Go to **Firebase Console** > **Authentication** > **Settings** > **Authorized Domains**.
2.  Add your Vercel URL (e.g., `peerskill-hub.vercel.app`) so login works correctly.

### Razorpay Dashboard
1.  Update your Webhook URLs (if any) to point to your new Render backend URL.

---

## Troubleshooting
- **CORS Errors**: If the frontend cannot talk to the backend, ensure your backend's `cors()` middleware allows the Vercel domain.
- **Environment Variables**: Double-check that all Firebase secrets are correctly copied without extra spaces or quotes.
