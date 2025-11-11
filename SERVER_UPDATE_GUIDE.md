# 🔄 Server Update Guide

## ✅ Pull Successful!

You've successfully pulled from GitHub. Now you have:

1. ✅ **Merged changes from GitHub** - All new files are now on server
2. ⚠️ **Modified files** - Server has local changes that differ from GitHub

---

## 🎯 What to Do Next

### Option 1: Use GitHub Version (Recommended)

If you want the server to match GitHub exactly:

```bash
cd /var/www/WatchParty

# Discard all local changes and use GitHub version
git reset --hard origin/main

# This will:
# - Remove all local modifications
# - Make server match GitHub exactly
```

**⚠️ Warning:** This will discard all local changes on the server!

---

### Option 2: Keep Local Changes

If you have important local changes on the server:

```bash
cd /var/www/WatchParty

# See what's different
git diff

# Commit local changes
git add .
git commit -m "Server-specific changes"

# Now server has both GitHub changes and local changes
```

---

### Option 3: Check What's Different First

Before deciding, see what's different:

```bash
cd /var/www/WatchParty

# See summary of changes
git status

# See detailed differences
git diff --stat

# See specific file differences
git diff client/src/App.js
```

---

## 📋 Recommended: Reset to GitHub Version

For production server, it's usually best to match GitHub exactly:

```bash
cd /var/www/WatchParty

# 1. Backup current changes (optional)
cp -r . ../WatchParty-backup

# 2. Reset to match GitHub exactly
git reset --hard origin/main

# 3. Verify
git status
# Should show: "working tree clean"
```

---

## 🔄 After Updating

After resetting or committing, you should:

1. **Reinstall dependencies (if package.json changed):**
   ```bash
   cd /var/www/WatchParty/server
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Rebuild React app (if client files changed):**
   ```bash
   cd /var/www/WatchParty/client
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. **Restart server:**
   ```bash
   pm2 restart watch-party-server
   # OR
   sudo systemctl restart watch-party-backend
   ```

---

## 🎯 Quick Commands

**Reset to GitHub version:**
```bash
cd /var/www/WatchParty
git reset --hard origin/main
```

**Check what's different:**
```bash
cd /var/www/WatchParty
git diff --stat
```

**Keep local changes:**
```bash
cd /var/www/WatchParty
git add .
git commit -m "Server-specific changes"
```

---

## 📝 Summary

**Current status:**
- ✅ Pulled and merged from GitHub
- ⚠️ Server has local modifications

**Recommended action:**
```bash
cd /var/www/WatchParty
git reset --hard origin/main
```

This will make the server match GitHub exactly.

