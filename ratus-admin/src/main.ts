import { createApp } from "vue";
import { createPinia } from "pinia";
import { wsClient } from "@/api/websocket";
import App from "./App.vue";
import "./index.css";

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
app.mount("#app");

function getPasskeyFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("passkey") || "";
}

wsClient.connect(getPasskeyFromUrl());
