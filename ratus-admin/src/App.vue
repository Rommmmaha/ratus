<script setup lang="ts">
import { ref } from "vue";
import UsersList from "./components/List.vue";
import Screen from "./components/Screen.vue";
import Settings from "./components/Settings.vue";
import FpsCounter from "./components/FpsCounter.vue";
import { wsClient } from "@/api/websocket";

const showPasskeyInput = ref(false);
const passkey = ref("");

// Handler for wrong passkey error
wsClient.setWrongPasskeyHandler(() => {
  showPasskeyInput.value = true;
});

function submitPasskey() {
  showPasskeyInput.value = false;
  wsClient.connect(passkey.value);
}
</script>

<template>
  <div>
    <div v-if="showPasskeyInput" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
      <div class="bg-neutral-900 p-8 rounded shadow-lg flex flex-col items-center">
        <p class="mb-4 text-red-400">Wrong passkey. Please enter the correct admin passkey:</p>
        <input v-model="passkey" type="password" class="mb-4 p-2 rounded bg-neutral-800 text-white" placeholder="Admin passkey" @keyup.enter="submitPasskey" />
        <button @click="submitPasskey" class="px-4 py-2 bg-green-700 rounded text-white">Submit</button>
      </div>
    </div>
    <div :class="['h-screen w-screen grid grid-rows-[1fr_auto] grid-cols-[150px_1fr] text-white bg-neutral-900', showPasskeyInput ? 'blur-sm pointer-events-none' : '']">
      <UsersList class="col-start-1 row-span-1" />
      <FpsCounter class="col-start-1 row-start-2 border-t border-neutral-700" />
      <Screen class="col-start-2 row-start-1 border-l border-neutral-700" />
      <Settings class="col-start-2 col-span-1 row-start-2 h-20" />
    </div>
  </div>
</template>
