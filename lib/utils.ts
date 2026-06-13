// General utility functions

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency = 'EGP'): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate tax (assuming 8.5% tax rate)
 */
export function calculateTax(subtotal: number, taxRate: number = 0.085): number {
  return subtotal * taxRate;
}

/**
 * Generate a unique cart ID
 */
export function generateCartId(): string {
  return `CART-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Calculate shopping progress
 */
export function calculateProgress(total: number, collected: number) {
  const remaining = total - collected;
  const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
  
  return {
    total,
    collected,
    remaining,
    percentage,
  };
}

