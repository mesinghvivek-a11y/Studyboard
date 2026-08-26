// Import Firebase directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// 1. Firebase configuration (unchanged from your existing setup)
const firebaseConfig = {
  apiKey: "AIzaSyAiX0OPqh8dvHaDaMcjJznTNp7XE1iuPE4",
  authDomain: "study-board-6c9d0.firebaseapp.com",
  projectId: "study-board-6c9d0",
  storageBucket: "study-board-6c9d0.firebasestorage.app",
  messagingSenderId: "706066762938",
  appId: "1:706066762938:web:6e0cde4838353927b74683",
  measurementId: "G-EZX2Q1Y5XS"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 3. VAPID key (unchanged)
const myVapidKey = "BHaRFc-faH5vI-yIhWjd0n1BF3CQ0zmkHHJcJOVT9mYLaloj_BB0qaSjfAJ4Utm1BVyNLr1-vq-cNiFToCDgCFs";

// 4. TODO: once your backend/sender script exists, point this at the real endpoint.
//    Until then, this call will safely fail (caught below) and won't break anything —
//    you'll still see the "Success" alert with your token either way.
const SAVE_TOKEN_ENDPOINT = "/api/save-token";

// 5. Wrapped inside a function so it only runs on a user click (required for iOS)
window.requestFirebaseToken = async function () {
  try {
    // Ask for permission (must happen directly on the click, no awaits before it)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permission was not granted: " + permission);
      return;
    }

    // Register your existing sw.js (already handles push + caching)
    const registration = await navigator.serviceWorker.register("./sw.js");
    const readyRegistration = await navigator.serviceWorker.ready;

    // Request the token from Firebase
    const currentToken = await getToken(messaging, {
      vapidKey: myVapidKey,
      serviceWorkerRegistration: readyRegistration
    });

    if (!currentToken) {
      alert("No token available.");
      return;
    }

    console.log("Token:", currentToken);
    alert("Success! Firebase token generated.");

    // Try to save the token to your backend so you can actually send to it later.
    // Safe to leave in even before the backend exists — it just won't persist yet.
    try {
      await fetch(SAVE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, platform: "web" })
      });
    } catch (saveErr) {
      console.warn("Token generated, but saving to backend failed (backend may not exist yet):", saveErr);
    }
  } catch (err) {
    console.error("Token error:", err);
    alert("Firebase Error: " + err.message);
  }
};
