
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";





const firebaseConfig = {
  apiKey: "AIzaSyBw2zh2ivnttuCg9oMo8MCUGECGRcAmiIY",
  authDomain: "kleio-4d5d4.firebaseapp.com",
  projectId: "kleio-4d5d4",
  storageBucket: "kleio-4d5d4.firebasestorage.app",
  messagingSenderId: "219531459308",
  appId: "1:219531459308:web:54c9ec4915c1122e7183c9",
  measurementId: "G-VLFVLGBD63"
};


export const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
