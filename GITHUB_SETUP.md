# 🚀 GitHub Setup Guide

Your code is ready to push to GitHub! Follow these steps:

## Step 1: Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name:** `watch-party-pro` (or your preferred name)
   - **Description:** "Real-time synchronized video watching app with YouTube support"
   - **Visibility:** Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

## Step 2: Add GitHub Remote

After creating the repository, GitHub will show you commands. Use these:

```bash
cd /home/satish/Videos/WatchParty/watch-party-app

# Add your GitHub repository as remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
```

## Step 3: Push to GitHub

```bash
# Rename branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## ✅ What's Already Done

- ✅ Git repository initialized
- ✅ `.gitignore` created (excludes `.env` files, `node_modules`, etc.)
- ✅ Initial commit created
- ✅ All code files are staged and committed

## 🔒 Security Notes

**IMPORTANT:** Your `.env` files are **NOT** committed (they're in `.gitignore`). 

Before deploying, make sure to:
1. Create `.env` files on your server
2. Never commit secrets to GitHub
3. Use environment variables in your deployment

## 📝 Quick Commands Reference

```bash
# Check status
git status

# Add changes
git add .

# Commit changes
git commit -m "Your commit message"

# Push to GitHub
git push origin main

# Pull latest changes
git pull origin main
```

## 🆘 Troubleshooting

### If you get "remote origin already exists":
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
```

### If you get authentication errors:
- Use GitHub Personal Access Token instead of password
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### If you need to update .gitignore:
```bash
# Edit .gitignore, then:
git add .gitignore
git commit -m "Update .gitignore"
git push
```

---

**Your code is ready! Just create the GitHub repo and push! 🎉**

