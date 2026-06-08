export const PRODUCT_FINDER_TAB_VALUES = ['popular', 'recent', 'favorites'] as const;
export type ProductFinderTab = (typeof PRODUCT_FINDER_TAB_VALUES)[number];

export const PRODUCT_CATEGORY_FALLBACKS = [
  'Fresh Fruits',
  'Fresh Vegetables',
  'Dairy & Eggs',
  'Meat & Poultry',
  'Seafood',
  'Bakery & Bread',
  'Pantry Staples',
  'Snacks & Sweets',
  'Beverages',
  'Frozen Foods',
  'Sauces & Condiments',
  'Herbs & Spices',
  'Nuts & Seeds',
  'Middle Eastern Foods',
  'Asian Foods',
  'European Specialties',
] as const;

const preferredCategoryOrder = new Map(
  PRODUCT_CATEGORY_FALLBACKS.map((category, index) => [category.toLowerCase(), index])
);

export function isProductFinderTab(value: string | null | undefined): value is ProductFinderTab {
  return PRODUCT_FINDER_TAB_VALUES.includes((value ?? '').toLowerCase() as ProductFinderTab);
}

export function sortProductCategoryNames(categories: string[]) {
  return [...categories].sort((left, right) => {
    const normalizedLeft = left.trim().toLowerCase();
    const normalizedRight = right.trim().toLowerCase();
    const preferredLeft = preferredCategoryOrder.get(normalizedLeft);
    const preferredRight = preferredCategoryOrder.get(normalizedRight);

    if (preferredLeft !== undefined && preferredRight !== undefined) {
      return preferredLeft - preferredRight;
    }

    if (preferredLeft !== undefined) {
      return -1;
    }

    if (preferredRight !== undefined) {
      return 1;
    }

    return left.localeCompare(right);
  });
}
