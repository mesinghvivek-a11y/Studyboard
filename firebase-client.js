// firebase-client.js
// Exposes two globals the app's notifications UI expects:
//   - window.pushPermissionState()      -> 'default' | 'granted' | 'denied'
//   - window.enablePushNotifications()  -> { ok: true } or { ok:false, reason, detail }

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiX0OPqh8dvHaDaMcjJznTNp7XE1iuPE4",
  authDomain: "study-board-6c9d0.firebaseapp.com",
  projectId: "study-board-6c9d0",
  storageBucket: "study-board-6c9d0.firebasestorage.app",
  messagingSenderId: "706066762938",
  appId: "1:706066762938:web:6e0cde4838353927b74683",
  measurementId: "G-EZX2Q1Y5XS"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

const myVapidKey = "BHaRFc-faH5vI-yIhWjd0n1BF3CQ0zmkHHJcJOVT9mYLaloj_BB0qaSjfAJ4Utm1BVyNLr1-vq-cNiFToCDgCFs";

// TODO: once your backend/sender exists, point this at the real endpoint.
const SAVE_TOKEN_ENDPOINT = "/api/save-token";

// Reports current permission state without prompting.
window.pushPermissionState = function () {
  if (typeof Notification === "undefined") return "denied"; // unsupported browser
  return Notification.permission; // 'default' | 'granted' | 'denied'
};

// Called on button tap. Must not have any await before Notification.requestPermission()
// on iOS, or the browser won't treat it as a genuine user gesture.
window.enablePushNotifications = async function () {
  try {
    const permission = await Notification.requestPermission();

    if (permission === "denied") {
      return { ok: false, reason: "denied" };
    }
    if (permission !== "granted") {
      return { ok: false, reason: "dismissed", detail: "Permission prompt was dismissed." };
    }

    const registration = await navigator.serviceWorker.register("./sw.js");
    const readyRegistration = await navigator.serviceWorker.ready;

    const currentToken = await getToken(messaging, {
      vapidKey: myVapidKey,
      serviceWorkerRegistration: readyRegistration
    });

    if (!currentToken) {
      return { ok: false, reason: "no_token", detail: "Firebase returned no token." };
    }

    console.log("Firebase token:", currentToken);
    alert("TOKEN:\n\n" + currentToken);

    // Best-effort save to backend — safe even if the endpoint doesn't exist yet.
    try {
      await fetch(SAVE_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, platform: "web" })
      });
    } catch (saveErr) {
      console.warn("Token generated but backend save failed (expected until backend exists):", saveErr);
    }

    return { ok: true };
  } catch (err) {
    console.error("enablePushNotifications error:", err);
    return { ok: false, reason: "error", detail: err.message };
  }
};