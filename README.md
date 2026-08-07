# Workout Tracker

A small installable web app for logging weights and reps against a fixed 5-day
workout plan (Back/Biceps, Legs, Shoulders/Abs, Chest/Triceps, Legs Optional)
and viewing trends over time.

No build step, no bundler — plain HTML/CSS/JS. Sign-in and data sync are
handled by Firebase (Auth + Firestore) on its free tier; everything else is
static files you can host anywhere.

## Features

- **Log**: pick a day, enter weight + reps per set. Previous session's
  numbers show as placeholders so you can see what you did last time.
- **History**: browse and edit/delete past sessions.
- **Trends**: per-exercise chart of top-set weight or total volume over time
  (bodyweight exercises chart total reps instead).
- **Account & sync**: sign in with email + password and your workouts sync
  across every device you sign into. Data also caches locally (Firestore
  offline persistence), so logging a workout with no gym wifi still works
  instantly and syncs once you're back online.
- **Backup**: export/import a JSON file of your full history (gear icon,
  top right).
- Installable to your phone's home screen (PWA).

## Cloud setup (Firebase)

This app expects a Firebase project with **Authentication → Email/Password**
enabled and a **Firestore database**. The project config lives in `cloud.js`
(the Firebase web API key is not secret — access is enforced by the
Firestore security rules below, not by hiding it).

Firestore security rules (Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/sessions/{sessionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This scopes every user to only their own `users/{uid}/sessions/*` documents.

## Running locally

No build step needed — just serve the folder statically, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. (Sign-in requires network access to
Firebase; everything after that first sign-in also works offline.)

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
