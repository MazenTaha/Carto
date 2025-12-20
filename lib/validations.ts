// Zod validation schemas

import { z } from 'zod';

// Authentication schemas
export const signUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
});

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Shopping list schemas
export const createListSchema = z.object({
  name: z.string().min(1, 'List name is required').max(100, 'List name is too long'),
});

export const createListItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(200, 'Item name is too long'),
  quantity: z.number().int().positive().default(1),
  category: z.string().max(50).optional(),
});

export const updateListItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().int().positive().optional(),
  category: z.string().max(50).optional(),
  isCollected: z.boolean().optional(),
});

// Cart linking schema
export const linkCartSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  listId: z.string().min(1, 'List ID is required'),
});

