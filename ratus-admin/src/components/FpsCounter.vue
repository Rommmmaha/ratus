<script lang="ts" setup>
import { storeToRefs } from "pinia";
import { useActiveUserStore } from "@/stores/activeUserStore";
const activeUserStore = useActiveUserStore();
const { screen } = storeToRefs(activeUserStore);
const { fps } = storeToRefs(activeUserStore);
</script>

<template>
  <p v-show="screen" class="text-center">FPS: {{ fps }}</p>
</template>
