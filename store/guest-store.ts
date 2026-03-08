// In-memory store for guest lists (no database required)
// This allows guests to create and manage lists without authentication

import { ShoppingList, ListItem } from '@/types';
import { randomBytes } from 'crypto';

// Persist the store on globalThis so it survives Next.js hot reloads in dev mode
const globalForGuestStore = globalThis as unknown as {
  guestListsStore: Map<string, ShoppingList[]>;
};

if (!globalForGuestStore.guestListsStore) {
  globalForGuestStore.guestListsStore = new Map<string, ShoppingList[]>();
}

// In-memory storage: Map<guestSessionId, ShoppingList[]>
const guestListsStore = globalForGuestStore.guestListsStore;

// Generate a unique guest session ID
export function generateGuestSessionId(): string {
  return `guest_${randomBytes(16).toString('hex')}`;
}

// Get lists for a guest session
export function getGuestLists(guestSessionId: string): ShoppingList[] {
  return guestListsStore.get(guestSessionId) || [];
}

// Create a new list for a guest
export function createGuestList(
  guestSessionId: string,
  name: string
): ShoppingList {
  const lists = getGuestLists(guestSessionId);

  // Set all other lists to inactive
  lists.forEach(list => {
    list.isActive = false;
  });

  const newList: ShoppingList = {
    id: `guest_list_${randomBytes(8).toString('hex')}`,
    name,
    userId: guestSessionId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    items: [],
  };

  lists.push(newList);
  guestListsStore.set(guestSessionId, lists);

  return newList;
}

// Get a specific list for a guest
export function getGuestList(
  guestSessionId: string,
  listId: string
): ShoppingList | null {
  const lists = getGuestLists(guestSessionId);
  return lists.find(list => list.id === listId) || null;
}

// Update a guest list
export function updateGuestList(
  guestSessionId: string,
  listId: string,
  updates: Partial<ShoppingList>
): ShoppingList | null {
  const lists = getGuestLists(guestSessionId);
  const listIndex = lists.findIndex(list => list.id === listId);

  if (listIndex === -1) {
    return null;
  }

  lists[listIndex] = {
    ...lists[listIndex],
    ...updates,
    updatedAt: new Date(),
  };

  guestListsStore.set(guestSessionId, lists);
  return lists[listIndex];
}

// Delete a guest list
export function deleteGuestList(
  guestSessionId: string,
  listId: string
): boolean {
  const lists = getGuestLists(guestSessionId);
  const filteredLists = lists.filter(list => list.id !== listId);

  if (filteredLists.length === lists.length) {
    return false; // List not found
  }

  guestListsStore.set(guestSessionId, filteredLists);
  return true;
}

// Add item to guest list
export function addGuestListItem(
  guestSessionId: string,
  listId: string,
  item: Omit<ListItem, 'id' | 'listId' | 'collectedAt'>
): ListItem | null {
  const list = getGuestList(guestSessionId, listId);
  if (!list) {
    return null;
  }

  const newItem: ListItem = {
    id: `guest_item_${randomBytes(8).toString('hex')}`,
    listId,
    collectedAt: null,
    ...item,
  };

  if (!list.items) {
    list.items = [];
  }

  list.items.push(newItem);
  list.updatedAt = new Date();

  const lists = getGuestLists(guestSessionId);
  const listIndex = lists.findIndex(l => l.id === listId);
  if (listIndex !== -1) {
    lists[listIndex] = list;
    guestListsStore.set(guestSessionId, lists);
  }

  return newItem;
}

// Update guest list item
export function updateGuestListItem(
  guestSessionId: string,
  listId: string,
  itemId: string,
  updates: Partial<ListItem>
): ListItem | null {
  const list = getGuestList(guestSessionId, listId);
  if (!list || !list.items) {
    return null;
  }

  const itemIndex = list.items.findIndex(item => item.id === itemId);
  if (itemIndex === -1) {
    return null;
  }

  list.items[itemIndex] = {
    ...list.items[itemIndex],
    ...updates,
  };

  if (updates.isCollected && !list.items[itemIndex].collectedAt) {
    list.items[itemIndex].collectedAt = new Date();
  } else if (!updates.isCollected && list.items[itemIndex].collectedAt) {
    list.items[itemIndex].collectedAt = null;
  }

  list.updatedAt = new Date();

  const lists = getGuestLists(guestSessionId);
  const listIndex = lists.findIndex(l => l.id === listId);
  if (listIndex !== -1) {
    lists[listIndex] = list;
    guestListsStore.set(guestSessionId, lists);
  }

  return list.items[itemIndex];
}

// Delete guest list item
export function deleteGuestListItem(
  guestSessionId: string,
  listId: string,
  itemId: string
): boolean {
  const list = getGuestList(guestSessionId, listId);
  if (!list || !list.items) {
    return false;
  }

  const initialLength = list.items.length;
  list.items = list.items.filter(item => item.id !== itemId);

  if (list.items.length === initialLength) {
    return false; // Item not found
  }

  list.updatedAt = new Date();

  const lists = getGuestLists(guestSessionId);
  const listIndex = lists.findIndex(l => l.id === listId);
  if (listIndex !== -1) {
    lists[listIndex] = list;
    guestListsStore.set(guestSessionId, lists);
  }

  return true;
}

