import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@/types";

/**
 * Store for managing all users and the currently active user.
 */
export const useAllUsersStore = defineStore("allUsers", () => {
  // State
  const users = ref<User[]>([]);
  const activeUserId = ref<string | null>(null);

  // Getters
  const allUsers = computed(() => users.value);
  const currentActiveUserId = computed(() => activeUserId.value);

  // Actions
  function addUser(user: User) {
    users.value.push(user);
  }

  function removeUserById(userId: string) {
    users.value = users.value.filter((user) => user.id !== userId);
  }

  function setUsers(newUsers: User[]) {
    users.value = newUsers;
  }

  function setActiveUserId(userId: string | null) {
    activeUserId.value = userId;
  }

  return {
    // State
    users,
    activeUserId,
    // Getters
    allUsers,
    currentActiveUserId,
    // Actions
    addUser,
    removeUserById,
    setUsers,
    setActiveUserId,
  };
});
