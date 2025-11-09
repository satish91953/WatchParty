#!/bin/bash

# Quick Deployment Script for Two Domains
# Frontend: watch.cloudpillers.com
# Backend: backend.cloudpillers.com

echo "🚀 Watch Party Pro - Two Domains Deployment"
echo "============================================="
echo ""
echo "Frontend: watch.cloudpillers.com"
echo "Backend: backend.cloudpillers.com"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Server .env
echo -e "${YELLOW}📝 Step 1: Configure server/.env${NC}"
cat > server/.env << 'ENVEOF'
PORT=5000
NODE_ENV=production
CLIENT_URL=https://watch.cloudpillers.com
BASE_URL=https://backend.cloudpillers.com
MONGODB_URI=mongodb://localhost:27017/watchparty
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING
ENVEOF

echo -e "${GREEN}✅ Server .env created${NC}"
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "   1. Update MONGODB_URI"
echo "   2. Generate JWT_SECRET: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo ""

# Step 2: Client .env
echo -e "${YELLOW}📝 Step 2: Configure client/.env${NC}"
cat > client/.env << 'ENVEOF'
REACT_APP_SERVER_URL=https://backend.cloudpillers.com
ENVEOF

echo -e "${GREEN}✅ Client .env created${NC}"
echo ""

# Step 3: Build React app
echo -e "${YELLOW}🏗️  Step 3: Building React app...${NC}"
cd client
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
cd ..
echo -e "${GREEN}✅ React app built${NC}"
echo ""

# Step 4: Create uploads directory
echo -e "${YELLOW}📁 Step 4: Creating uploads directory...${NC}"
mkdir -p server/uploads/videos
chmod 755 server/uploads
chmod 755 server/uploads/videos
echo -e "${GREEN}✅ Uploads directory created${NC}"
echo ""

echo -e "${GREEN}✅ Configuration complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Update server/.env with your MongoDB URI and JWT_SECRET"
echo "2. Setup Nginx (see DEPLOYMENT_TWO_DOMAINS.md)"
echo "3. Get SSL certificates: sudo certbot --nginx -d watch.cloudpillers.com -d backend.cloudpillers.com"
echo "4. Start backend: cd server && pm2 start server.js --name watch-party-backend"
echo ""
echo "📖 See DEPLOYMENT_TWO_DOMAINS.md for complete guide"
