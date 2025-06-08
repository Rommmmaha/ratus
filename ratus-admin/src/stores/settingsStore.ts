import { defineStore } from "pinia";
import { ref, computed } from "vue";

/**
 * Store for UI settings and toggles.
 * Provides state and actions for mouse control, always-move, fullscreen, and fast-press options.
 */
export const useSettingsStore = defineStore("settings", () => {
  // State
  const mouseControlEnabled = ref(true);
  const alwaysMoveEnabled = ref(false);
  const fullscreenEnabled = ref(false);
  const fastPressEnabled = ref(true);

  // Getters
  const isMouseControlEnabled = computed(() => mouseControlEnabled.value);
  const isAlwaysMoveEnabled = computed(() => mouseControlEnabled.value && alwaysMoveEnabled.value);
  const isFullscreenEnabled = computed(() => fullscreenEnabled.value);
  const isFastPressEnabled = computed(() => fastPressEnabled.value);

  // Actions
  function setMouseControlEnabled(on: boolean) {
    mouseControlEnabled.value = on;
  }
  function setAlwaysMoveEnabled(on: boolean) {
    alwaysMoveEnabled.value = on;
  }
  function setFullscreenEnabled(on: boolean) {
    fullscreenEnabled.value = on;
  }
  function setFastPressEnabled(on: boolean) {
    fastPressEnabled.value = on;
  }

  return {
    // State
    mouseControlEnabled,
    alwaysMoveEnabled,
    fullscreenEnabled,
    fastPressEnabled,
    // Getters
    isMouseControlEnabled,
    isAlwaysMoveEnabled,
    isFullscreenEnabled,
    isFastPressEnabled,
    // Actions
    setMouseControlEnabled,
    setAlwaysMoveEnabled,
    setFullscreenEnabled,
    setFastPressEnabled,
  };
});
