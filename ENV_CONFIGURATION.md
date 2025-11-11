# 🔧 Environment Variables Configuration Guide

## Same Domain vs Different Domains

You have **two options** for deployment:

## Option 1: Same Domain (Recommended for Simple Deployment) ✅

**Best for:** Single server setup, easier configuration

### Setup:
- **Server serves both:** React app + API
- **Single domain:** `https://yourdomain.com`
- **React app:** Served from root `/`
- **API:** Available at `/api/*`

### Environment Variables:

**Server `.env`:**
```env
PORT=5000
NODE_ENV=production
CLIENT_URL=https://yourdomain.com
BASE_URL=https://yourdomain.com
MONGODB_URI=your-mongodb-connection
JWT_SECRET=your-secret-key
```

**Client `.env`:**
```env
REACT_APP_SERVER_URL=https://yourdomain.com
```

**Why this works:**
- Server serves React build from `client/build/`
- API routes are at `/api/*`
- Socket.IO connects to same domain
- No CORS issues (same origin)

---

## Option 2: Different Domains (Advanced)

**Best for:** Separate frontend/backend servers, CDN setup

### Setup:
- **Frontend:** `https://app.yourdomain.com` or `https://yourdomain.com`
- **Backend:** `https://api.yourdomain.com` or `https://yourdomain.com:5000`

### Environment Variables:

**Server `.env`:**
```env
PORT=5000
NODE_ENV=production
CLIENT_URL=https://app.yourdomain.com
BASE_URL=https://api.yourdomain.com
MONGODB_URI=your-mongodb-connection
JWT_SECRET=your-secret-key
```

**Client `.env`:**
```env
REACT_APP_SERVER_URL=https://api.yourdomain.com
```

**Important:** 
- Must configure CORS properly
- Need to handle CORS for Socket.IO
- More complex setup

---

## 🎯 Recommended: Same Domain Setup

For most deployments, **use the same domain**. Here's why:

### Advantages:
✅ Simpler configuration  
✅ No CORS issues  
✅ Single SSL certificate  
✅ Easier to manage  
✅ Server already configured to serve React app  

### How It Works:

1. **Server Configuration:**
   - In production mode, server serves React app from `client/build/`
   - API routes work at `/api/*`
   - Socket.IO works on same domain

2. **Nginx Configuration:**
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       # All requests go to Node.js server
       location / {
           proxy_pass http://localhost:5000;
           # ... proxy settings
       }
   }
   ```

3. **Client Configuration:**
   - `REACT_APP_SERVER_URL=https://yourdomain.com`
   - API calls: `https://yourdomain.com/api/...`
   - Socket.IO: `https://yourdomain.com`

---

## 📝 Example Configuration (Same Domain)

### Server `.env`:
```env
PORT=5000
NODE_ENV=production
CLIENT_URL=https://watchparty.example.com
BASE_URL=https://watchparty.example.com
MONGODB_URI=mongodb://localhost:27017/watchparty
JWT_SECRET=your-super-secret-key-here
```

### Client `.env`:
```env
REACT_APP_SERVER_URL=https://watchparty.example.com
```

### After Setting Up:
1. Build React app: `cd client && npm run build`
2. Start server: `cd server && NODE_ENV=production npm start`
3. Access app at: `https://watchparty.example.com`

---

## ⚠️ Important Notes

1. **After changing `.env` files:**
   - **Server:** Just restart the server
   - **Client:** Must rebuild: `cd client && npm run build`

2. **Development vs Production:**
   - **Development:** Use `http://localhost:3000` and `http://localhost:5000`
   - **Production:** Use your actual domain

3. **URL Format:**
   - Always include protocol: `https://` or `http://`
   - No trailing slash: `https://domain.com` ✅ (not `https://domain.com/`)

4. **CORS:**
   - `CLIENT_URL` in server `.env` must match your frontend domain exactly
   - For same domain: Both use the same URL

---

## 🔍 Quick Reference

| Scenario | CLIENT_URL | REACT_APP_SERVER_URL | BASE_URL |
|----------|-----------|---------------------|----------|
| **Same Domain** | `https://domain.com` | `https://domain.com` | `https://domain.com` |
| **Different Domains** | `https://app.domain.com` | `https://api.domain.com` | `https://api.domain.com` |
| **Development** | `http://localhost:3000` | `http://localhost:5000` | `http://localhost:5000` |

---

**For your deployment, I recommend using the same domain!** 🎯

