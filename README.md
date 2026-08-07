# Workout Tracker

A small installable web app for logging weights and reps against a fixed 5-day
workout plan (Back/Biceps, Legs, Shoulders/Abs, Chest/Triceps, Legs Optional)
and viewing trends over time.

No build step, no backend, no external dependencies — plain HTML/CSS/JS.
All workout history is stored on-device in `localStorage`.

## Features

- **Log**: pick a day, enter weight + reps per set. Previous session's
  numbers show as placeholders so you can see what you did last time.
- **History**: browse and edit/delete past sessions.
- **Trends**: per-exercise chart of top-set weight or total volume over time
  (bodyweight exercises chart total reps instead).
- **Backup**: export/import a JSON file of your full history (gear icon,
  top right) — worth doing occasionally since data lives only on this
  device/browser.
- Installable to your phone's home screen (PWA) and works offline once
  loaded.

## Running locally

No build step needed — just serve the folder statically, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`.

## Deploying (GitHub Pages)

1. In this repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Pick the branch you want live (e.g. `main`) and folder `/ (root)`, then
   save.
4. GitHub will publish it at `https://<owner>.github.io/<repo>/` within a
   minute or two.
5. On your phone, open that URL in Safari/Chrome and use **Add to Home
   Screen** to install it like a native app.

## Editing the workout plan

Exercises, sets, reps, and per-side flags live in `data.js`. Edit that file
and refresh to change the plan.
