# 🚀 Deployment Guide

This guide will help you deploy the Watch Party Pro application to a production server.

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud like MongoDB Atlas)
- A server with:
  - Ubuntu/Debian Linux (recommended)
  - At least 2GB RAM
  - 10GB+ storage (for video uploads)
  - Domain name (optional but recommended)

## 🔧 Step 1: Prepare Your Server

### 1.1 Install Node.js and MongoDB

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB (or use MongoDB Atlas)
sudo apt-get install -y mongodb
```

### 1.2 Clone Your Repository

```bash
cd /var/www
git clone <your-repo-url> watch-party-app
cd watch-party-app/watch-party-app
```

## 🔐 Step 2: Configure Environment Variables

### 2.1 Server Environment Variables

Create a `.env` file in the `server/` directory:

```bash
cd server
nano .env
```

Add the following (replace with your actual values):

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Client URL (your frontend domain)
CLIENT_URL=https://yourdomain.com

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/watchparty
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/watchparty

# JWT Secret (generate a random string)
JWT_SECRET=b7a01e6d9931ddea9bd4fbc876a34953fb9e7a66131bf9ab078a3c7c34df59cd

# Base URL for video file serving
BASE_URL=https://watch.cloudpillers.com
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 Client Environment Variables

Create a `.env` file in the `client/` directory:

```bash
cd ../client
nano .env
```

Add:

```env
REACT_APP_SERVER_URL=https://yourdomain.com
```

**Important:** Replace `https://yourdomain.com` with your actual domain name.

## 📦 Step 3: Install Dependencies

```bash
# Install server dependencies
cd ../server
npm install --production

# Install client dependencies
cd ../client
npm install
```

## 🏗️ Step 4: Build the React App

```bash
cd client
npm run build
```

This creates a `build/` directory with optimized production files.

## 🚀 Step 5: Run the Application

### Option A: Using PM2 (Recommended)

PM2 is a process manager that keeps your app running and restarts it if it crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the server
cd ../server
pm2 start server.js --name watch-party-server

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Option B: Using systemd

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/watch-party.service
```

Add:

```ini
[Unit]
Description=Watch Party Pro Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/watch-party-app/watch-party-app/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable watch-party
sudo systemctl start watch-party
sudo systemctl status watch-party
```

## 🌐 Step 6: Setup Reverse Proxy (Nginx)

Install Nginx:

```bash
sudo apt-get install nginx
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/watch-party
```

Add:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (optional but recommended)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Increase upload size for video files (1GB)
    client_max_body_size 1024M;

    # Proxy to Node.js server
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout for long-running requests (video uploads)
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Serve uploaded videos directly
    location /uploads {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/watch-party /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 Step 7: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
```

## 📁 Step 8: Create Uploads Directory

```bash
cd /var/www/watch-party-app/watch-party-app/server
mkdir -p uploads/videos
chmod 755 uploads
chmod 755 uploads/videos
```

## 🔍 Step 9: Verify Deployment

1. Check server logs:
   ```bash
   pm2 logs watch-party-server
   # OR
   sudo journalctl -u watch-party -f
   ```

2. Test the application:
   - Visit `https://yourdomain.com`
   - Create a room
   - Upload a video
   - Test YouTube video playback

## 🔄 Step 10: Update Deployment

When you need to update the app:

```bash
cd /var/www/watch-party-app/watch-party-app

# Pull latest changes
git pull

# Update dependencies
cd server
npm install --production

cd ../client
npm install
npm run build

# Restart the server
pm2 restart watch-party-server
# OR
sudo systemctl restart watch-party
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 5000
sudo lsof -i :5000
# Kill it
sudo kill -9 <PID>
```

### MongoDB Connection Issues
- Check MongoDB is running: `sudo systemctl status mongodb`
- Verify connection string in `.env`
- Check firewall rules

### Video Upload Fails
- Check `uploads/videos/` directory permissions
- Verify `client_max_body_size` in Nginx config
- Check disk space: `df -h`

### CORS Errors
- Verify `CLIENT_URL` in server `.env` matches your domain
- Check `REACT_APP_SERVER_URL` in client `.env`

## 📊 Monitoring

### PM2 Monitoring
```bash
pm2 status
pm2 monit
pm2 logs watch-party-server
```

### System Resources
```bash
# CPU and Memory
htop

# Disk Usage
df -h
du -sh /var/www/watch-party-app/watch-party-app/server/uploads
```

## 🔐 Security Checklist

- [ ] Changed JWT_SECRET to a random string
- [ ] Using HTTPS (SSL certificate installed)
- [ ] MongoDB has authentication enabled
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] Regular backups of MongoDB database
- [ ] Regular backups of uploaded videos
- [ ] Server OS is up to date
- [ ] Node.js and npm are up to date

## 📝 Notes

- The server serves the React app in production mode
- All API routes are prefixed with `/api`
- Video uploads are stored in `server/uploads/videos/`
- Consider using a CDN for video serving in production
- For large-scale deployments, consider:
  - Using MongoDB Atlas (cloud database)
  - Using AWS S3 or similar for video storage
  - Using Redis for session management
  - Load balancing for multiple server instances

## 🆘 Support

If you encounter issues:
1. Check server logs
2. Check browser console for errors
3. Verify all environment variables are set correctly
4. Ensure all dependencies are installed
5. Verify MongoDB connection

---

**Happy Deploying! 🎉**

