# LiveFrame

LiveFrame is a desktop app for streamers: music, Twitch chat, and game stats overlays with live controls for OBS.

## What You Get

- Music, chat, and game stats controls in one app
- First-run wizard and pre-stream checklist
- One-click copy of OBS Browser Source URLs
- Dark and light theme support
- Live updates without restarting overlays

## Download and Run (Windows)

1. Open the latest GitHub Release.
2. Download the archive with `LiveFrame-win32-x64`.
3. Extract the archive.
4. Run `LiveFrame.exe`.

No installer is required.

## Important

- You do **not** need Node.js to use the app.
- Node.js is only needed for development/building by the author.

## OBS Setup

1. Open `Music` tab in LiveFrame and click copy OBS URL.
2. Open `Chat` tab and copy OBS URL.
3. Open `Games` tab and copy game stats OBS URL.
4. In OBS, add all copied links as Browser Sources.

## First Launch Checklist

- Set your YouTube playlist
- Set your Twitch channel (without `#`)
- Set Faceit nickname in `Games` tab
- Copy all OBS URLs and paste them into OBS

## FAQ

**Q: Windows shows "Unknown publisher". Is it normal?**  
A: Yes. Click "More info" and run anyway.

**Q: Do I need to install anything else?**  
A: No, just extract and run `LiveFrame.exe`.

**Q: How do I show CS2 Faceit stats?**  
A: Open `Games`, set your Faceit nickname, add your Faceit API key, click refresh, then copy the OBS URL.

**Q: Where are my app settings stored?**  
A: In `liveframe-settings.json` near the app runtime folder.