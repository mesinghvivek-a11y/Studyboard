// Import Firebase directly from the CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// 1. Paste your Firebase configuration object here
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

// 3. Paste your VAPID Key
const myVapidKey = "BHaRFc-faH5vI-yIhWjd0n1BF3CQ0zmkHHJcJOVT9mYLaloj_BB0qaSjfAJ4Utm1BVyNLr1-vq-cNiFToCDgCFs"; 

// 4. Register YOUR specific sw.js file and get the token
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((registration) => {
      // FIX: Force the browser to wait until the service worker is 100% active
      return navigator.serviceWorker.ready;
    })
    .then((readyRegistration) => {
      // Pass the fully ready registration and VAPID key to Firebase
      return getToken(messaging, { 
        vapidKey: myVapidKey, 
        serviceWorkerRegistration: readyRegistration 
      });
    })
    .then((currentToken) => {
      if (currentToken) {
        console.log("Success! Here is the device token:", currentToken);
        alert("Success! Firebase token generated."); // Pops up so you know it worked
      } else {
        console.log("No registration token available. User denied permission.");
      }
    })
    .catch((err) => {
      console.error("An error occurred while retrieving token. ", err);
      // CRITICAL FIX: This will pop up the exact hidden error on your iPad screen!
      alert("Firebase Error: " + err.message); 
    });
}
