// Persistent store for guest lists (no database required)
// This allows guests to create and manage lists without authentication

import { ShoppingList, ListItem } from '@/types';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

const GUEST_DATA_FILE = path.join(process.cwd(), 'guest_data.json');

// Helper to load data from file
function loadStore(): Map<string, ShoppingList[]> {
  try {
    if (fs.existsSync(GUEST_DATA_FILE)) {
      const data = fs.readFileSync(GUEST_DATA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error('Failed to load guest store:', error);
  }
  return new Map<string, ShoppingList[]>();
}

// Helper to save data to file
function saveStore(store: Map<string, ShoppingList[]>) {
  try {
    const obj = Object.fromEntries(store);
    fs.writeFileSync(GUEST_DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save guest store:', error);
  }
}

// Persist the store on globalThis so it survives Next.js hot reloads in dev mode
const globalForGuestStore = globalThis as unknown as {
  guestListsStore: Map<string, ShoppingList[]>;
};

if (!globalForGuestStore.guestListsStore) {
  globalForGuestStore.guestListsStore = loadStore();
}

// Storage: Map<guestSessionId, ShoppingList[]>
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

  const newList: ShoppingList = {
    id: `guest_list_${randomBytes(8).toString('hex')}`,
    name,
    userId: guestSessionId,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  lists.push(newList);
  guestListsStore.set(guestSessionId, lists);
  saveStore(guestListsStore);

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
  saveStore(guestListsStore);
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
  saveStore(guestListsStore);
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

  if (newItem.price === undefined) {
    newItem.price = 0;
  }
  list.items.push(newItem);
  list.updatedAt = new Date();

  const lists = getGuestLists(guestSessionId);
  const listIndex = lists.findIndex(l => l.id === listId);
  if (listIndex !== -1) {
    lists[listIndex] = list;
    guestListsStore.set(guestSessionId, lists);
    saveStore(guestListsStore);
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
    saveStore(guestListsStore);
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
    saveStore(guestListsStore);
  }

  return true;
}
