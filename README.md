# ✨ Whisk AI — Image to Reverse Prompt Studio

A fast, lightweight, and modern web application that reverse-engineers any image into a hyper-detailed, structured prompt modeled after **Google Labs' Whisk**.

Powered by Google's multimodal **Gemini Vision API** (free tier: 1,500 requests/day).

---

## 🚀 Features

- **Whisk 6-Layer Deconstruction**:
  - 👤 **Subject & Micro-Details** (anatomy, clothing weave, expression, gaze)
  - 🏞️ **Scene & Environment** (foreground, midground, background staging)
  - 🎨 **Art Medium & Style** (film stock, 3D render, claymation, paint texture)
  - 💡 **Lighting & Atmosphere** (angles, color temperature, shadows, bounce)
  - 🌈 **Color Palette** (with clickable, copyable hex color swatches)
  - 📷 **Camera & Optics** (focal length, depth of field, framing)
- **Master Synthesized Prompt**: Ready to paste into **Google Imagen 3**, **Midjourney v6**, or **Flux**.
- **Interactive Editing**: Modify words directly inside the prompt before copying.
- **Clipboard Paste Support**: Simply press `Ctrl+V` anywhere to paste screenshots directly.
- **Deploy Anywhere**: Works locally on `localhost:8000` or hosted 24/7 on **Vercel** for free.

---

## 💻 Running Locally

1. Make sure Python 3.11+ is installed.
2. Open a terminal in this directory (`E:\New folder\TGA\whisk-ai`) and run:
   ```bash
   python run.py
   ```
3. The server will start and automatically open [http://localhost:8000](http://localhost:8000) in your browser!

### Setting your API Key locally (Optional)
You can either:
- Paste your key directly in the UI via the **API Key** button (saved safely in your browser's `localStorage`).
- Or create a `.env` file in this directory:
  ```env
  GEMINI_API_KEY=AIzaSy...
  ```

---

## ☁️ Deploying to Vercel (100% Free 24/7 Hosting)

Because this app is structured with a serverless FastAPI handler and static frontend, it deploys directly to Vercel:

### Option 1: Via GitHub (Recommended)
1. Initialize git and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Whisk AI"
   git remote add origin https://github.com/your-username/whisk-ai.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. (Optional) Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google AI Studio key.
5. Click **Deploy**! In ~60 seconds, you'll have a permanent live URL (e.g. `https://whisk-ai.vercel.app`).

### Option 2: Via Vercel CLI
```bash
npm i -g vercel  # or via winget/brew
vercel
```

---

## 🔑 Where to get a Free Gemini API Key
1. Go to [aistudio.google.com](https://aistudio.google.com).
2. Click **Get API key**.
3. Generate a key (100% free, no credit card required, 1,500 free requests per day).
