# 🚀 Deployment Guide: Two Domains Setup

## 📋 Your Setup

- **Frontend:** `watch.cloudpillers.com`
- **Backend:** `backend.cloudpillers.com`

---

## 🔧 Step 1: Environment Variables Configuration

### 1.1 Server Environment Variables

Create/Edit `server/.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Client URL (frontend domain for CORS)
CLIENT_URL=https://watch.cloudpillers.com

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/watchparty
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/watchparty

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Base URL for video file serving (backend domain)
BASE_URL=https://backend.cloudpillers.com
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 1.2 Client Environment Variables

Create/Edit `client/.env`:

```env
# React App Environment Variables
# Backend server URL for API calls and Socket.IO
REACT_APP_SERVER_URL=https://backend.cloudpillers.com
```

**Important:** After changing `client/.env`, rebuild the React app:
```bash
cd client
npm run build
```

---

## 🌐 Step 2: Nginx Configuration

### 2.1 Frontend Nginx Configuration

**Important:** In production, the React app does NOT run on port 3000. It's built and served as static files by Nginx.

Create frontend Nginx config: `/etc/nginx/sites-available/watch.cloudpillers.com`

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name watch.cloudpillers.com www.watch.cloudpillers.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Frontend Server
server {
    listen 443 ssl http2;
    server_name watch.cloudpillers.com www.watch.cloudpillers.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/watch.cloudpillers.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watch.cloudpillers.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Root directory (React build files - NO port 3000 needed!)
    root /var/www/watch-party-app/watch-party-app/client/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Serve static files (React app is built and served as static files)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "public, max-age=3600";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

### 2.2 Backend Nginx Configuration

Create backend Nginx config: `/etc/nginx/sites-available/backend.cloudpillers.com`

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name backend.cloudpillers.com www.backend.cloudpillers.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS Backend Server
server {
    listen 443 ssl http2;
    server_name backend.cloudpillers.com www.backend.cloudpillers.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/backend.cloudpillers.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/backend.cloudpillers.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Increase upload size for video files (1GB)
    client_max_body_size 1024M;

    # Proxy to Node.js server
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        
        # WebSocket support for Socket.IO
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Cache bypass for WebSocket
        proxy_cache_bypass $http_upgrade;
        
        # Timeout for long-running requests (video uploads)
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # Serve uploaded videos directly
    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # Cache video files
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, max-age=3600";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 2.3 Enable Nginx Sites

```bash
# Enable frontend site
sudo ln -s /etc/nginx/sites-available/watch.cloudpillers.com /etc/nginx/sites-enabled/

# Enable backend site
sudo ln -s /etc/nginx/sites-available/backend.cloudpillers.com /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 🔒 Step 3: SSL Certificates (Let's Encrypt)

### 3.1 Install Certbot

```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
```

### 3.2 Get SSL Certificates

```bash
# Frontend SSL certificate
sudo certbot --nginx -d watch.cloudpillers.com -d www.watch.cloudpillers.com

# Backend SSL certificate
sudo certbot --nginx -d backend.cloudpillers.com -d www.backend.cloudpillers.com
```

Certbot will automatically:
- Obtain SSL certificates
- Configure Nginx
- Set up auto-renewal

### 3.3 Verify Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Auto-renewal is set up automatically via cron
```

---

## 📦 Step 4: Build and Deploy Application

### 4.1 Build React App

```bash
cd /var/www/watch-party-app/watch-party-app/client

# Make sure .env is set correctly
cat .env
# Should show: REACT_APP_SERVER_URL=https://backend.cloudpillers.com

# Build for production
npm run build
```

### 4.2 Copy Build Files to Frontend Server

If frontend and backend are on the same server:
```bash
# Build files are already in client/build/
# Nginx is configured to serve from there
```

If frontend is on a different server:
```bash
# On backend server, create a tarball
cd /var/www/watch-party-app/watch-party-app/client
tar -czf build.tar.gz build/

# Copy to frontend server
scp build.tar.gz user@frontend-server:/var/www/watch-party-app/

# On frontend server, extract
cd /var/www/watch-party-app/
tar -xzf build.tar.gz
```

### 4.3 Set Permissions

```bash
# Frontend build files
sudo chown -R www-data:www-data /var/www/watch-party-app/watch-party-app/client/build
sudo chmod -R 755 /var/www/watch-party-app/watch-party-app/client/build

# Backend uploads directory
sudo mkdir -p /var/www/watch-party-app/watch-party-app/server/uploads/videos
sudo chown -R www-data:www-data /var/www/watch-party-app/watch-party-app/server/uploads
sudo chmod -R 755 /var/www/watch-party-app/watch-party-app/server/uploads
```

---

## 🚀 Step 5: Start the Backend Server

### Option A: Using PM2 (Recommended)

```bash
# Install PM2
sudo npm install -g pm2

# Navigate to server directory
cd /var/www/watch-party-app/watch-party-app/server

# Start server with PM2
pm2 start server.js --name watch-party-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown
```

### Option B: Using systemd

Create service file: `/etc/systemd/system/watch-party-backend.service`

```ini
[Unit]
Description=Watch Party Pro Backend Server
After=network.target mongodb.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/watch-party-app/watch-party-app/server
Environment=NODE_ENV=production
EnvironmentFile=/var/www/watch-party-app/watch-party-app/server/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=watch-party-backend

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable watch-party-backend
sudo systemctl start watch-party-backend
sudo systemctl status watch-party-backend
```

---

## 🔍 Step 6: Verify Deployment

### 6.1 Check Backend Server

```bash
# Check if server is running
curl https://backend.cloudpillers.com/api/health
# Or check logs
pm2 logs watch-party-backend
# OR
sudo journalctl -u watch-party-backend -f
```

### 6.2 Check Frontend

1. Visit `https://watch.cloudpillers.com` in browser
2. Open browser console (F12)
3. Check for errors
4. Verify API calls go to `backend.cloudpillers.com`

### 6.3 Test Features

- ✅ Create a room
- ✅ Upload a video
- ✅ Play YouTube video
- ✅ Test voice chat
- ✅ Test synchronized playback

---

## 🔧 Step 7: DNS Configuration

Make sure your DNS records are set correctly:

### DNS Records (A Records)

```
watch.cloudpillers.com     → Your Server IP
backend.cloudpillers.com   → Your Server IP
```

Or if using CNAME:
```
watch.cloudpillers.com     → CNAME → your-server.com
backend.cloudpillers.com   → CNAME → your-server.com
```

**Verify DNS:**
```bash
# Check DNS resolution
nslookup watch.cloudpillers.com
nslookup backend.cloudpillers.com
```

---

## 🐛 Troubleshooting

### CORS Errors

If you see CORS errors in browser console:

1. **Check server `.env`:**
   ```bash
   cat server/.env | grep CLIENT_URL
   # Should show: CLIENT_URL=https://watch.cloudpillers.com
   ```

2. **Restart backend server:**
   ```bash
   pm2 restart watch-party-backend
   # OR
   sudo systemctl restart watch-party-backend
   ```

### Socket.IO Connection Issues

1. **Check Nginx WebSocket configuration:**
   - Make sure `proxy_set_header Upgrade $http_upgrade;` is present
   - Make sure `proxy_set_header Connection 'upgrade';` is present

2. **Check backend logs:**
   ```bash
   pm2 logs watch-party-backend
   ```

### 404 Errors on Frontend

1. **Check Nginx root directory:**
   ```bash
   # Verify build files exist
   ls -la /var/www/watch-party-app/watch-party-app/client/build/
   ```

2. **Check Nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Video Upload Fails

1. **Check uploads directory permissions:**
   ```bash
   ls -la /var/www/watch-party-app/watch-party-app/server/uploads/
   sudo chown -R www-data:www-data /var/www/watch-party-app/watch-party-app/server/uploads
   ```

2. **Check Nginx `client_max_body_size`:**
   - Should be at least `1024M` in backend Nginx config

### SSL Certificate Issues

1. **Check certificate status:**
   ```bash
   sudo certbot certificates
   ```

2. **Renew certificates manually:**
   ```bash
   sudo certbot renew
   ```

---

## 📊 Monitoring

### PM2 Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs watch-party-backend

# Monitor resources
pm2 monit
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### System Resources

```bash
# CPU and Memory
htop

# Disk usage
df -h
du -sh /var/www/watch-party-app/watch-party-app/server/uploads
```

---

## 🔄 Updating the Application

### Update Frontend

```bash
cd /var/www/watch-party-app/watch-party-app/client

# Pull latest changes
git pull

# Update dependencies (if needed)
npm install

# Rebuild
npm run build

# Restart Nginx (if needed)
sudo systemctl restart nginx
```

### Update Backend

```bash
cd /var/www/watch-party-app/watch-party-app/server

# Pull latest changes
git pull

# Update dependencies (if needed)
npm install --production

# Restart server
pm2 restart watch-party-backend
# OR
sudo systemctl restart watch-party-backend
```

---

## 🔐 Security Checklist

- [ ] SSL certificates installed and auto-renewing
- [ ] JWT_SECRET changed to a random string
- [ ] MongoDB has authentication enabled
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Nginx security headers configured
- [ ] Server OS is up to date
- [ ] Node.js and npm are up to date
- [ ] Regular backups of MongoDB database
- [ ] Regular backups of uploaded videos
- [ ] `.env` files are not committed to git

---

## 📝 Quick Reference

### Environment Variables Summary

**Server `.env`:**
```env
CLIENT_URL=https://watch.cloudpillers.com
BASE_URL=https://backend.cloudpillers.com
```

**Client `.env`:**
```env
REACT_APP_SERVER_URL=https://backend.cloudpillers.com
```

### Important URLs

- Frontend: `https://watch.cloudpillers.com`
- Backend API: `https://backend.cloudpillers.com/api/*`
- Backend Socket.IO: `https://backend.cloudpillers.com`

### Key Commands

```bash
# Restart backend
pm2 restart watch-party-backend

# Restart Nginx
sudo systemctl restart nginx

# View backend logs
pm2 logs watch-party-backend

# Rebuild frontend
cd client && npm run build
```

---

**Your two-domain setup is ready! 🎉**

Frontend: `https://watch.cloudpillers.com`  
Backend: `https://backend.cloudpillers.com`

