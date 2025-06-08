import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@/types";

/**
 * Store for the currently active user.
 * Provides state and actions for managing the selected user's info and screen.
 */
export const useActiveUserStore = defineStore("activeUser", () => {
  // State
  const id = ref("");
  const name = ref("");
  const ip = ref("");
  const screen = ref("");
  const mouse = ref<{ x: number; y: number }>({ x: 0, y: 0 });

  // FPS calculation
  const screenTimestamps = ref<number[]>([]);
  const fps = computed(() => {
    const now = Date.now();
    screenTimestamps.value = screenTimestamps.value.filter((ts) => now - ts <= 1000);
    return screenTimestamps.value.length;
  });

  /**
   * Set the active user info. If no user is provided, resets to empty.
   */
  function setActiveUser(user: User = { id: "", name: "", ip: "", screen: "", mouse: { x: 0, y: 0 } }) {
    id.value = user.id;
    name.value = user.name;
    ip.value = user.ip;
    screen.value = user.screen;
    mouse.value = { x: user.mouse.x, y: user.mouse.y };
  }

  /**
   * Set the screen and mouse position for the active user.
   */

  function setScreen(data: string, mousePos: { x: number; y: number } = { x: 0, y: 0 }) {
    screen.value = data;
    mouse.value = { x: mousePos.x, y: mousePos.y };
    screenTimestamps.value.push(Date.now());
  }

  return {
    id,
    name,
    ip,
    screen,
    mouse,
    fps,
    setActiveUser,
    setScreen,
  };
});
