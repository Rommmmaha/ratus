<script lang="ts" setup>
const allUsersStore = useAllUsersStore();
const activeUserStore = useActiveUserStore();
const { allUsers, currentActiveUserId } = storeToRefs(allUsersStore);

import { useAllUsersStore } from "@/stores/allUsersStore";
import { useActiveUserStore } from "@/stores/activeUserStore";
import { wsClient } from "@/api/websocket";
import { storeToRefs } from "pinia";

/**
 * Handles user selection and toggling active user.
 */
function handleUserSelect(event: Event) {
  const target = event.target as HTMLElement;
  const userId = target.innerText;
  const prevActiveUserId = currentActiveUserId.value;

  if (prevActiveUserId === userId) {
    allUsersStore.setActiveUserId(null);
    activeUserStore.setActiveUser();
    wsClient.send({ type: "unselect_user" });
    activeUserStore.setScreen("");
    return;
  }
  allUsersStore.setActiveUserId(userId);
  const selectedUser = allUsers.value.find((u: any) => u.id === userId);
  if (selectedUser) {
    activeUserStore.setActiveUser(selectedUser);
  } else {
    activeUserStore.setActiveUser({ id: userId, name: "", ip: "", screen: "", mouse: { x: 0, y: 0 } });
  }
  if (prevActiveUserId && prevActiveUserId !== userId) {
    wsClient.send({ type: "unselect_user" });
  }
  wsClient.send({ type: "select_user", user: userId });
}
</script>

<template>
  <div class="h-full scrollbar-thin overflow-y-scroll scrollbar-thumb-neutral-600 scrollbar-track-neutral-900 cursor-pointer">
    <div v-for="user in allUsers" :key="user.id" :class="['user-item border-b-1 border-r-1 border-neutral-700 p-2', user.id === currentActiveUserId ? 'bg-neutral-600' : 'bg-neutral-900']" @mousedown="handleUserSelect">
      {{ user.name || user.id }}
    </div>
  </div>
</template>
