#!/bin/bash

# Watch Party Pro - Deployment Script
# This script helps you deploy the application to production

echo "🚀 Watch Party Pro - Deployment Script"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "server/server.js" ] || [ ! -f "client/package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the watch-party-app directory${NC}"
    exit 1
fi

# Step 1: Install dependencies
echo -e "${YELLOW}📦 Step 1: Installing dependencies...${NC}"
echo ""

echo "Installing server dependencies..."
cd server
npm install --production
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install server dependencies${NC}"
    exit 1
fi

echo ""
echo "Installing client dependencies..."
cd ../client
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install client dependencies${NC}"
    exit 1
fi

# Step 2: Build React app
echo ""
echo -e "${YELLOW}🏗️  Step 2: Building React app for production...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build React app${NC}"
    exit 1
fi

# Step 3: Check environment variables
echo ""
echo -e "${YELLOW}🔐 Step 3: Checking environment variables...${NC}"
cd ../server

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Creating .env.example file..."
    cat > .env.example << EOF
# Server Configuration
PORT=5000
NODE_ENV=production

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/watchparty

# JWT Secret (generate a random string)
JWT_SECRET=your-secret-key-change-this-in-production

# Base URL for video file serving
BASE_URL=http://localhost:5000
EOF
    echo -e "${YELLOW}⚠️  Please create a .env file with your production settings${NC}"
    echo "You can copy .env.example to .env and update the values"
else
    echo -e "${GREEN}✅ .env file found${NC}"
fi

# Step 4: Create uploads directory
echo ""
echo -e "${YELLOW}📁 Step 4: Creating uploads directory...${NC}"
mkdir -p uploads/videos
chmod 755 uploads
chmod 755 uploads/videos
echo -e "${GREEN}✅ Uploads directory created${NC}"

# Step 5: Check client .env
echo ""
echo -e "${YELLOW}🔐 Step 5: Checking client environment variables...${NC}"
cd ../client

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: client/.env file not found${NC}"
    echo "Creating .env.example file..."
    cat > .env.example << EOF
# React App Environment Variables
REACT_APP_SERVER_URL=http://localhost:5000
EOF
    echo -e "${YELLOW}⚠️  Please create a client/.env file with REACT_APP_SERVER_URL${NC}"
    echo "Example: REACT_APP_SERVER_URL=https://yourdomain.com"
else
    echo -e "${GREEN}✅ client/.env file found${NC}"
fi

# Step 6: Summary
echo ""
echo -e "${GREEN}✅ Deployment preparation complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Update server/.env with your production settings"
echo "2. Update client/.env with REACT_APP_SERVER_URL"
echo "3. Rebuild the client if you changed .env: cd client && npm run build"
echo "4. Start the server: cd server && npm start"
echo ""
echo "📖 For detailed deployment instructions, see DEPLOYMENT.md"
echo ""

