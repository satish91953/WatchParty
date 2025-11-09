# 🔧 Fix Divergent Branches on Server

## 🚨 Problem

When you run `git pull origin main` on the server, you get:
```
fatal: Need to specify how to reconcile divergent branches.
```

This means:
- Server has commits that GitHub doesn't have
- GitHub has commits that server doesn't have
- Git doesn't know how to combine them

---

## ✅ Solution: Merge (Recommended)

### Step 1: Configure Git to Use Merge

```bash
cd /var/www/WatchParty
git config pull.rebase false
```

### Step 2: Pull with Merge

```bash
git pull origin main --no-edit
```

This will:
- Fetch changes from GitHub
- Merge them with your local changes
- Create a merge commit

---

## 🔄 Alternative: Rebase (Cleaner History)

If you want a cleaner history without merge commits:

```bash
cd /var/www/WatchParty

# Configure to use rebase
git config pull.rebase true

# Pull with rebase
git pull origin main
```

This will:
- Fetch changes from GitHub
- Replay your local commits on top of GitHub commits
- No merge commit

---

## 🎯 Quick Fix Commands

Run these on your server:

```bash
# Option 1: Merge (Recommended)
cd /var/www/WatchParty
git config pull.rebase false
git pull origin main --no-edit

# Option 2: Rebase (Cleaner)
cd /var/www/WatchParty
git config pull.rebase true
git pull origin main
```

---

## 🔍 Check What's Different

Before pulling, you can check what's different:

```bash
cd /var/www/WatchParty

# See what commits are on GitHub but not on server
git log HEAD..origin/main --oneline

# See what commits are on server but not on GitHub
git log origin/main..HEAD --oneline

# See all differences
git log --oneline --graph --all --decorate
```

---

## ⚠️ If There Are Conflicts

If you get merge conflicts:

1. **See conflicts:**
   ```bash
   git status
   ```

2. **Resolve conflicts:**
   - Edit the conflicted files
   - Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Keep the code you want

3. **Mark as resolved:**
   ```bash
   git add .
   git commit -m "Merge: Resolve conflicts"
   ```

---

## 📋 Recommended Approach

**For server deployment, use merge:**

```bash
cd /var/www/WatchParty
git config pull.rebase false
git pull origin main --no-edit
```

This is safer and preserves all history.

---

## 🆘 If You Want to Start Fresh

If you want to discard local changes and use GitHub version:

```bash
cd /var/www/WatchParty

# Backup current changes (optional)
cp -r . ../WatchParty-backup

# Reset to match GitHub exactly
git fetch origin
git reset --hard origin/main
```

**⚠️ Warning:** This will discard all local changes!

---

## 📝 Summary

**Quick fix:**
```bash
cd /var/www/WatchParty
git config pull.rebase false
git pull origin main --no-edit
```

This will merge GitHub changes with your server changes.

