# 🚀 LUDO ROYALE — DEPLOYMENT & TESTING GUIDE
## Go from code → playing with friends on phone in 10 minutes

---

## STEP 1: Test Locally First (2 minutes)

Open your terminal (VS Code terminal works) in the `ludo-royale` folder:

```bash
cd ludo-royale
npm install
npm start
```

You should see:
```
╔═══════════════════════════════════════════════╗
║         🎲  LUDO ROYALE SERVER  🎲            ║
║   Running on: http://localhost:3000           ║
╚═══════════════════════════════════════════════╝
```

**Quick test:** Open TWO browser tabs at `http://localhost:3000`
- Tab 1: Enter "Raj" → Create Room → You'll see the room code
- Tab 2: Enter "Test" → Join Room → Enter the code
- Tab 1: Click "Start Game"
- Both tabs: Play! Roll dice, move pawns, test everything works.

---

## STEP 2: Push to GitHub (3 minutes)

### 2a. Create GitHub Repository

1. Go to https://github.com
2. Click the green **"New"** button (or go to https://github.com/new)
3. Repository name: `ludo-royale`
4. Keep it **Public**
5. Do NOT check "Add a README file" (we already have one)
6. Click **"Create repository"**

### 2b. Push Your Code

In VS Code terminal, inside the `ludo-royale` folder:

```bash
git init
git add .
git commit -m "Ludo Royale - multiplayer with voice chat"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/ludo-royale.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username (e.g. `rajakrp18`).

If git asks for password, use a **Personal Access Token** instead:
- Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate New Token
- Give it `repo` permission → Copy the token → Use it as password

---

## STEP 3: Deploy to Render.com (5 minutes)

### 3a. Create Render Account

1. Go to **https://render.com**
2. Click **"Get Started for Free"**
3. **Sign up with GitHub** (easiest — links your repos automatically)

### 3b. Create Web Service

1. After login, click **"New +"** at the top → **"Web Service"**
2. Choose **"Build and deploy from a Git repository"** → Next
3. You'll see your GitHub repos — find `ludo-royale` and click **"Connect"**

### 3c. Configure Settings

Fill in these settings:

| Setting | Value |
|---------|-------|
| **Name** | `ludo-royale` (or anything you want) |
| **Region** | Singapore (closest to India) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** |

4. Click **"Create Web Service"**

### 3d. Wait for Deployment

- Render will build and deploy your app (2-3 minutes)
- Watch the logs — when you see `LUDO ROYALE SERVER` and `Running on`, it's ready!
- At the top you'll see your URL:

```
https://ludo-royale-XXXX.onrender.com
```

**That's your game URL! Copy it.**

---

## STEP 4: Play with Friends! (30 seconds)

### How it works now:

```
YOU                              YOUR FRIEND
 │                                    │
 ├─ Open your Render URL              │
 ├─ Enter name                        │
 ├─ Click "Create Room"               │
 ├─ Click "📤 Share Invite Link"      │
 ├─ Send via WhatsApp ──────────────► │
 │                                    ├─ Taps the link
 │                                    ├─ Opens in phone browser
 │                                    ├─ Enters their name
 │                                    ├─ Clicks "Join Game"
 ├─ See them join in lobby            │
 ├─ Click "Start Game"               │
 │                                    │
 └── PLAYING + VOICE CHAT! ◄────────►┘
```

### The shared link looks like:
```
https://ludo-royale-XXXX.onrender.com?room=ABC123
```

When your friend taps it:
- Room code is **auto-filled** — they don't need to type it
- They just enter their name and tap "Join Game"
- Voice chat starts automatically when the game begins

---

## STEP 5: Test on Mobile

### On YOUR phone:
1. Open the Render URL in Chrome/Safari
2. Create a room
3. Share the link via WhatsApp

### On FRIEND'S phone:
1. They tap the WhatsApp link
2. It opens in their browser
3. They enter name → Join → Done

### Mobile Voice Chat:
- When game starts, browser will ask **"Allow microphone?"** → Tap **Allow**
- Voice connects automatically between all players
- Tap 🔊 to mute/unmute
- Long-press 🔊 to leave voice

### If mic permission was denied:
- **iPhone Safari**: Settings → Safari → Microphone → Allow
- **Android Chrome**: Tap lock icon in address bar → Site Settings → Microphone → Allow
- **Any browser**: Tap 🎤 button in game to retry

---

## ⚠️ IMPORTANT NOTES

### Free Tier Limitations (Render.com)
- Server **sleeps after 15 minutes** of no activity
- First visit after sleep takes **~30 seconds** to wake up
- Once awake, runs perfectly for as long as people are playing
- To fix: Upgrade to paid plan ($7/month) for 24/7 uptime

### Voice Chat Requirements
- **HTTPS is required** — Render provides this automatically ✅
- Won't work on `http://localhost` for voice (but game works fine for testing)
- Works on all modern mobile browsers (Chrome 74+, Safari 14.5+)

### Best Experience
- Use **WiFi** for stable connection
- Keep the browser tab **in foreground** on phone (background tabs may pause)
- If connection drops, just **refresh the page**

---

## 🔧 TROUBLESHOOTING

### "Application Error" on Render
Check the Render dashboard → Logs tab for specific errors.
Most common fix: Make sure `package.json` has the correct dependencies.

### Can't hear other players
1. Check browser allowed microphone (lock icon in address bar)
2. Check phone isn't on silent/do-not-disturb mode
3. Try tapping 🎤 to manually reconnect voice
4. Both players need to have microphone permission

### Game is slow to load first time
Normal — free Render tier sleeps after 15 min. First load wakes it up (~30 sec).
After that it's instant.

### Room code not auto-filling
Make sure the shared URL has `?room=XXXXXX` at the end.
The "📤 Share Invite Link" button creates this automatically.

### Voice doesn't connect on mobile data
Some mobile carriers block WebRTC. The TURN servers should handle this,
but if it still fails, switch to WiFi for voice. Game itself works on any connection.

---

## 📱 ADD TO HOME SCREEN (Bonus)

On phones, you can add the game as a "web app" icon:

**iPhone:**
1. Open the URL in Safari
2. Tap the share button (box with arrow)
3. Tap "Add to Home Screen"
4. Now it has its own app icon!

**Android:**
1. Open the URL in Chrome
2. Tap ⋮ (three dots menu)
3. Tap "Add to Home Screen"
4. Now it looks and feels like an app!

---

## 🔄 UPDATING YOUR GAME

Whenever you change code locally:

```bash
git add .
git commit -m "your changes"
git push
```

Render auto-deploys on every push. New version live in ~2 minutes.

---

## 📊 QUICK REFERENCE

| What | Where |
|------|-------|
| Your game URL | `https://ludo-royale-XXXX.onrender.com` |
| Share with friends | Click "📤 Share Invite Link" in lobby |
| Server logs | Render Dashboard → your service → Logs |
| Server health | `https://your-url.onrender.com/health` |
| Source code | `https://github.com/YOUR_USERNAME/ludo-royale` |
| Voice chat | Auto-starts on game begin; tap 🎤 if needed |

---

**That's it! You're live on the internet. Share the link and play! 🎲🎮**
