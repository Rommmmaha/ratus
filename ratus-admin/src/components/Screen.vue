<script lang="ts" setup>
import { computed, onMounted, onUnmounted, type CSSProperties } from "vue";
import { wsClient } from "@/api/websocket";
import { useActiveUserStore } from "@/stores/activeUserStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { storeToRefs } from "pinia";

// Store references
const activeUserStore = useActiveUserStore();
const settingsStore = useSettingsStore();
const { id, screen, mouse } = storeToRefs(activeUserStore);
const { fullscreenEnabled, isFastPressEnabled, isMouseControlEnabled, isAlwaysMoveEnabled } = storeToRefs(settingsStore);
const { setFullscreenEnabled } = settingsStore;

// --- Keyboard event handling ---
function sendKeyPacket(keycode: string, action: "down" | "up" | "press") {
  wsClient.send({ type: "key", keycode, action });
}

/**
 * Handles keydown and keyup events for remote control.
 */
function handleKeyEvent(e: KeyboardEvent) {
  if (!id.value) return; // No user selected
  if (e.repeat) return;
  const keycode = e.keyCode?.toString();
  if (!keycode) return;

  // Toggle fullscreen on keyCode 192 (backtick/tilde key)
  if (keycode === "192") {
    if (e.type === "keydown") {
      setFullscreenEnabled(!fullscreenEnabled.value);
      e.preventDefault();
    }
    return;
  }
  if (e.metaKey) return;

  // Fast press logic for non-modifier keys
  if (isFastPressEnabled.value) {
    const isModifier = e.key === "Shift" || e.key === "Control" || e.key === "Alt";
    if (!isModifier && e.type === "keydown") {
      sendKeyPacket(keycode, "press");
    } else if (isModifier) {
      if (e.type === "keydown") sendKeyPacket(keycode, "down");
      else if (e.type === "keyup") sendKeyPacket(keycode, "up");
    }
  } else {
    if (e.type === "keydown") sendKeyPacket(keycode, "down");
    else if (e.type === "keyup") sendKeyPacket(keycode, "up");
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyEvent);
  window.addEventListener("keyup", handleKeyEvent);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyEvent);
  window.removeEventListener("keyup", handleKeyEvent);
});

// --- Mouse event handling ---
let lastMouseMoveTime = 0;

/**
 * Handles mouse events (move, down, up) for remote control.
 */
function handleMouseEvent(event: MouseEvent) {
  if (!id.value || !isMouseControlEnabled.value) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 65535);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 65535);

  let action: string | null = null;
  let key = -1;

  if (event.type === "mousemove") {
    if (!isAlwaysMoveEnabled.value && !event.buttons) return;
    const now = Date.now();
    if (now - lastMouseMoveTime < 50) return;
    lastMouseMoveTime = now;
    action = "move";
    key = -1;
  } else if (event.type === "mousedown") {
    if (event.button >= 0 && event.button <= 2) {
      action = "down";
      key = event.button;
    }
  } else if (event.type === "mouseup") {
    if (event.button >= 0 && event.button <= 2) {
      action = "up";
      key = event.button;
    }
  }

  if (action) {
    wsClient.sendMouse({ action, key, x: Math.max(0, Math.min(65535, x)), y: Math.max(0, Math.min(65535, y)) });
  }
}

/**
 * Handles mouse wheel events for remote control.
 */
function handleWheelEvent(event: WheelEvent) {
  if (!id.value || !isMouseControlEnabled.value) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 65535);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 65535);
  const key = event.deltaY < 0 ? -1 : 1;
  wsClient.sendMouse({ action: "wheel", key, x: Math.max(0, Math.min(65535, x)), y: Math.max(0, Math.min(65535, y)) });
}

// --- Computed styles for screen and mouse cursor ---
const screenStyle = computed<CSSProperties>(() => ({
  backgroundImage: screen.value ? `url(${screen.value})` : "none",
  backgroundSize: `100% 100%`,
  zIndex: fullscreenEnabled.value ? 9999 : "auto",
  top: fullscreenEnabled.value ? 0 : "auto",
  left: fullscreenEnabled.value ? 0 : "auto",
  width: fullscreenEnabled.value ? "100vw" : "100%",
  height: fullscreenEnabled.value ? "100vh" : "100%",
  position: fullscreenEnabled.value ? "fixed" : "relative",
  margin: fullscreenEnabled.value ? 0 : undefined,
  padding: fullscreenEnabled.value ? 0 : undefined,
  userSelect: "none",
  WebkitUserSelect: "none",
  MozUserSelect: "none",
  msUserSelect: "none",
}));

const mouseCursorStyle = computed<CSSProperties>(() => {
  if (!mouse.value || !screen.value) return {} as CSSProperties;
  return {
    position: "absolute",
    left: `calc(${(mouse.value.x / 65535) * 100}% - 5px)`,
    top: `calc(${(mouse.value.y / 65535) * 100}% - 5px)`,
    pointerEvents: "none",
    zIndex: 10,
  } as CSSProperties;
});
</script>

<template>
  <div @mousedown="handleMouseEvent" @mouseup="handleMouseEvent" @mousemove="handleMouseEvent" @contextmenu.prevent @wheel="handleWheelEvent" :style="screenStyle">
    <!-- Mouse cursor overlay -->
    <template v-if="mouse && screen">
      <div :style="mouseCursorStyle">
        <div style="position: absolute; left: 4px; top: 0; width: 2px; height: 10px; background: red"></div>
        <div style="position: absolute; left: 0; top: 4px; width: 10px; height: 2px; background: red"></div>
      </div>
    </template>
  </div>
</template>
