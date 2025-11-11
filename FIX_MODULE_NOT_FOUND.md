# 🔧 Fix MODULE_NOT_FOUND Error

## 🚨 Error Found

Your PM2 logs show:
```
MODULE_NOT_FOUND
at Socket.<anonymous> (/root/WatchParty/server/server.js:115:20)
```

This means a required module is missing from `node_modules`.

---

## ✅ Solution: Reinstall Dependencies

### Step 1: Stop the Server

```bash
# Stop PM2 process
pm2 stop watch-party-server
# OR
pm2 stop 0
```

### Step 2: Remove node_modules and Reinstall

```bash
cd /root/WatchParty/server

# Remove node_modules
rm -rf node_modules

# Remove package-lock.json (optional, but helps)
rm -f package-lock.json

# Reinstall dependencies
npm install
```

### Step 3: Restart Server

```bash
# Restart with PM2
pm2 restart watch-party-server
# OR
pm2 restart 0

# Check logs
pm2 logs watch-party-server
```

---

## 🔍 Alternative: Check Specific Module

If the error persists, check which module is missing:

```bash
cd /root/WatchParty/server

# Check if mongoose is installed
npm list mongoose

# If not found, install it
npm install mongoose

# Check all dependencies
npm list --depth=0
```

---

## 📋 Quick Fix Commands

Run these commands on your server:

```bash
# 1. Stop server
pm2 stop watch-party-server

# 2. Go to server directory
cd /root/WatchParty/server

# 3. Clean and reinstall
rm -rf node_modules package-lock.json
npm install

# 4. Restart server
pm2 restart watch-party-server

# 5. Check logs
pm2 logs watch-party-server --lines 20
```

---

## 🎯 Most Likely Cause

**Missing or corrupted `node_modules`** - This happens when:
- Dependencies weren't installed properly
- `node_modules` got corrupted
- Package versions are mismatched

**Solution:** Clean reinstall of dependencies.

---

## 🔍 Verify Installation

After reinstalling, verify:

```bash
# Check if all dependencies are installed
cd /root/WatchParty/server
npm list --depth=0

# Should show all packages without errors
```

---

## ⚠️ If Error Persists

If the error still occurs after reinstalling:

1. **Check Node.js version:**
   ```bash
   node --version
   # Should be v18 or higher
   ```

2. **Check npm version:**
   ```bash
   npm --version
   ```

3. **Check package.json:**
   ```bash
   cat /root/WatchParty/server/package.json
   ```

4. **Install specific missing module:**
   ```bash
   cd /root/WatchParty/server
   npm install mongoose express socket.io cors dotenv multer jsonwebtoken bcryptjs uuid
   ```

---

## 📝 Expected Dependencies

Your `server/package.json` should have:
- `express`
- `socket.io`
- `mongoose`
- `cors`
- `dotenv`
- `multer`
- `jsonwebtoken`
- `bcryptjs`
- `uuid`

All should be installed in `node_modules`.

---

**After reinstalling dependencies, the error should be fixed!** ✅

