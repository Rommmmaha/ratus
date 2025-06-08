<script lang="ts" setup>
import { useSettingsStore } from "@/stores/settingsStore";
import { storeToRefs } from "pinia";

const baseBox = "flex-1 flex flex-col items-center justify-center font-semibold text-[1.1rem] cursor-pointer select-none transition-all duration-200 border-1 m-0 w-full h-full text-white";
const settingsStore = useSettingsStore();
const { isMouseControlEnabled, isAlwaysMoveEnabled, isFastPressEnabled } = storeToRefs(settingsStore);

function toggleFastPress() {
  settingsStore.setFastPressEnabled(!isFastPressEnabled.value);
}

function toggleMouseControl() {
  settingsStore.setMouseControlEnabled(!isMouseControlEnabled.value);
}

function toggleAlwaysMove() {
  settingsStore.setAlwaysMoveEnabled(!isAlwaysMoveEnabled.value);
}
</script>

<template>
  <div class="flex flex-row w-full h-full items-stretch justify-stretch gap-0 m-0 p-0">
    <label :class="[baseBox, isMouseControlEnabled ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-700 opacity-50']">
      <input type="checkbox" :checked="isMouseControlEnabled" @change="toggleMouseControl" class="hidden" />
      <span>Mouse Control</span>
    </label>
    <label :class="[baseBox, isAlwaysMoveEnabled ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-700 opacity-50', !isMouseControlEnabled ? 'opacity-50 pointer-events-none' : '']">
      <input type="checkbox" :checked="isAlwaysMoveEnabled" @change="toggleAlwaysMove" :disabled="!isMouseControlEnabled" class="hidden" />
      <span>Always Move</span>
    </label>
    <label :class="[baseBox, isFastPressEnabled ? 'bg-green-900 border-green-500' : 'bg-red-900 border-red-700 opacity-50']">
      <input type="checkbox" :checked="isFastPressEnabled" @change="toggleFastPress" class="hidden" />
      <span>Fast Press</span>
    </label>
  </div>
</template>
