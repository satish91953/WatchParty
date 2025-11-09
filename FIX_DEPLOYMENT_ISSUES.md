# 🔧 Fix Deployment Issues

Based on the screenshot showing `watch.cloudpillers.com`, here are the issues and fixes:

## 🚨 Issues Found

1. **❌ "Not secure" (HTTP instead of HTTPS)**
2. **❌ "Failed to create room" error**
3. **⚠️ Misleading YouTube warning message**

---

## ✅ Fix 1: Remove Misleading YouTube Warning

**Status:** ✅ Fixed in code

The warning message "YouTube videos cannot be used due to embedding restrictions" is misleading since we actually support YouTube videos. This has been updated to show correct information.

---

## ✅ Fix 2: Enable HTTPS (SSL Certificate)

### Problem:
Your site shows "Not secure" because it's using HTTP instead of HTTPS.

### Solution:

1. **Install Certbot:**
```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

2. **Get SSL Certificate:**
```bash
# For frontend
sudo certbot --nginx -d watch.cloudpillers.com -d www.watch.cloudpillers.com

# For backend
sudo certbot --nginx -d backend.cloudpillers.com -d www.backend.cloudpillers.com
```

3. **Verify Nginx Config:**
Make sure your Nginx configs redirect HTTP to HTTPS:
```nginx
server {
    listen 80;
    server_name watch.cloudpillers.com;
    return 301 https://$server_name$request_uri;
}
```

4. **Restart Nginx:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## ✅ Fix 3: Fix "Failed to Create Room" Error

### Problem:
The error "Failed to create room. Please try again." suggests the frontend can't connect to the backend.

### Possible Causes:

1. **Backend server not running**
2. **Wrong backend URL in client `.env`**
3. **CORS configuration issue**
4. **Socket.IO connection issue**

### Solutions:

#### Step 1: Check Backend is Running

```bash
# Check if backend is running
pm2 status
# OR
sudo systemctl status watch-party-backend

# Check backend logs
pm2 logs watch-party-backend
# OR
sudo journalctl -u watch-party-backend -f
```

#### Step 2: Verify Client Environment Variable

Check `client/.env`:
```bash
cd /var/www/watch-party-app/watch-party-app/client
cat .env
```

Should show:
```env
REACT_APP_SERVER_URL=https://backend.cloudpillers.com
```

**Important:** If you changed `.env`, rebuild the React app:
```bash
cd client
npm run build
```

#### Step 3: Check Server Environment Variables

Check `server/.env`:
```bash
cd /var/www/watch-party-app/watch-party-app/server
cat .env
```

Should show:
```env
CLIENT_URL=https://watch.cloudpillers.com
BASE_URL=https://backend.cloudpillers.com
```

**Important:** After changing server `.env`, restart the backend:
```bash
pm2 restart watch-party-backend
# OR
sudo systemctl restart watch-party-backend
```

#### Step 4: Test Backend Connection

```bash
# Test backend API
curl https://backend.cloudpillers.com/api/health

# Test from browser console
# Open browser console (F12) and run:
fetch('https://backend.cloudpillers.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

#### Step 5: Check Browser Console

1. Open `https://watch.cloudpillers.com` (after HTTPS is set up)
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Look for errors like:
   - CORS errors
   - Connection refused
   - Socket.IO connection errors

#### Step 6: Verify Socket.IO Connection

In browser console, check if Socket.IO connects:
```javascript
// Should show connection status
console.log('Socket connected:', socket?.connected)
```

---

## 🔍 Debugging Steps

### 1. Check Backend Logs

```bash
# PM2 logs
pm2 logs watch-party-backend --lines 50

# Systemd logs
sudo journalctl -u watch-party-backend -n 50
```

Look for:
- Connection errors
- MongoDB connection issues
- CORS errors

### 2. Check Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### 3. Test Socket.IO Connection

```bash
# Test if Socket.IO endpoint is accessible
curl -I https://backend.cloudpillers.com/socket.io/
```

### 4. Check MongoDB Connection

```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# Test MongoDB connection
mongo --eval "db.adminCommand('ping')"
```

---

## 📋 Quick Checklist

- [ ] SSL certificate installed (HTTPS working)
- [ ] Backend server running (`pm2 status` or `systemctl status`)
- [ ] Client `.env` has correct `REACT_APP_SERVER_URL`
- [ ] Server `.env` has correct `CLIENT_URL` and `BASE_URL`
- [ ] React app rebuilt after changing `.env`
- [ ] Backend restarted after changing `.env`
- [ ] MongoDB is running
- [ ] Nginx is running and configured correctly
- [ ] No CORS errors in browser console
- [ ] Socket.IO connects successfully

---

## 🚀 Quick Fix Commands

```bash
# 1. Install SSL certificate
sudo certbot --nginx -d watch.cloudpillers.com -d backend.cloudpillers.com

# 2. Check backend status
pm2 status
# OR
sudo systemctl status watch-party-backend

# 3. Restart backend
pm2 restart watch-party-backend
# OR
sudo systemctl restart watch-party-backend

# 4. Rebuild React app (if .env changed)
cd /var/www/watch-party-app/watch-party-app/client
npm run build

# 5. Restart Nginx
sudo systemctl restart nginx

# 6. Check logs
pm2 logs watch-party-backend
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 Still Not Working?

1. **Check browser console** for specific error messages
2. **Check backend logs** for connection errors
3. **Verify DNS** - make sure domains point to your server:
   ```bash
   nslookup watch.cloudpillers.com
   nslookup backend.cloudpillers.com
   ```
4. **Test backend directly:**
   ```bash
   curl https://backend.cloudpillers.com/api/health
   ```

---

**After fixing these issues, your app should work correctly!** 🎉

