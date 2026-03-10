export type ProductSeed = {
  name: string;
  category: string;
  emoji?: string;
  price?: number;
  popularity?: number;
};

// Local fallback dataset used when DATABASE_URL is not configured (guest mode).
// Keep this reasonably sized to avoid huge bundles; the DB-backed search is the long-term path.
export const LOCAL_PRODUCTS: ProductSeed[] = [
  { name: 'milk', category: 'Dairy & Eggs', emoji: '🥛', popularity: 98 },
  { name: 'eggs', category: 'Dairy & Eggs', emoji: '🥚', popularity: 98 },
  { name: 'butter', category: 'Dairy & Eggs', emoji: '🧈', popularity: 95 },
  { name: 'cheddar cheese', category: 'Dairy & Eggs', emoji: '🧀', popularity: 92 },
  { name: 'yogurt', category: 'Dairy & Eggs', popularity: 92 },
  { name: 'bread', category: 'Bakery & Bread', emoji: '🍞', popularity: 95 },
  { name: 'baguette', category: 'Bakery & Bread', emoji: '🥖', popularity: 82 },
  { name: 'rice', category: 'Pantry Staples', emoji: '🍚', popularity: 98 },
  { name: 'pasta', category: 'Pantry Staples', emoji: '🍝', popularity: 95 },
  { name: 'salt', category: 'Pantry Staples', emoji: '🧂', popularity: 98 },
  { name: 'black pepper', category: 'Pantry Staples', popularity: 95 },
  { name: 'olive oil', category: 'Pantry Staples', popularity: 92 },
  { name: 'sugar', category: 'Pantry Staples', popularity: 95 },
  { name: 'flour', category: 'Pantry Staples', popularity: 92 },
  { name: 'coffee', category: 'Beverages', emoji: '☕', popularity: 95 },
  { name: 'tea', category: 'Beverages', emoji: '🍵', popularity: 85 },
  { name: 'water', category: 'Beverages', emoji: '💧', popularity: 98 },
  { name: 'orange juice', category: 'Beverages', emoji: '🧃', popularity: 92 },
  { name: 'cola', category: 'Beverages', popularity: 95 },
  { name: 'apple', category: 'Fresh Fruits', emoji: '🍎', popularity: 95 },
  { name: 'banana', category: 'Fresh Fruits', emoji: '🍌', popularity: 98 },
  { name: 'orange', category: 'Fresh Fruits', emoji: '🍊', popularity: 92 },
  { name: 'strawberry', category: 'Fresh Fruits', emoji: '🍓', popularity: 88 },
  { name: 'grape', category: 'Fresh Fruits', emoji: '🍇', popularity: 85 },
  { name: 'lemon', category: 'Fresh Fruits', emoji: '🍋', popularity: 82 },
  { name: 'avocado', category: 'Fresh Fruits', emoji: '🥑', popularity: 90 },
  { name: 'tomato', category: 'Fresh Vegetables', emoji: '🍅', popularity: 95 },
  { name: 'onion', category: 'Fresh Vegetables', emoji: '🧅', popularity: 98 },
  { name: 'garlic', category: 'Fresh Vegetables', emoji: '🧄', popularity: 95 },
  { name: 'potato', category: 'Fresh Vegetables', emoji: '🥔', popularity: 98 },
  { name: 'carrot', category: 'Fresh Vegetables', emoji: '🥕', popularity: 92 },
  { name: 'cucumber', category: 'Fresh Vegetables', emoji: '🥒', popularity: 87 },
  { name: 'lettuce', category: 'Fresh Vegetables', emoji: '🥬', popularity: 90 },
  { name: 'broccoli', category: 'Fresh Vegetables', emoji: '🥦', popularity: 88 },
  { name: 'corn', category: 'Fresh Vegetables', emoji: '🌽', popularity: 88 },
  { name: 'chicken breast', category: 'Meat & Poultry', emoji: '🍗', popularity: 95 },
  { name: 'ground beef', category: 'Meat & Poultry', popularity: 92 },
  { name: 'bacon', category: 'Meat & Poultry', emoji: '🥓', popularity: 95 },
  { name: 'salmon', category: 'Seafood', popularity: 88 },
  { name: 'shrimp', category: 'Seafood', emoji: '🦐', popularity: 90 },
  { name: 'tuna', category: 'Seafood', popularity: 82 },
  { name: 'cereal', category: 'Pantry Staples', emoji: '🥣', popularity: 92 },
  { name: 'oatmeal', category: 'Pantry Staples', popularity: 90 },
  { name: 'peanut butter', category: 'Pantry Staples', emoji: '🥜', popularity: 95 },
  { name: 'jam', category: 'Pantry Staples', popularity: 88 },
  { name: 'chips', category: 'Snacks & Sweets', popularity: 95 },
  { name: 'popcorn', category: 'Snacks & Sweets', emoji: '🍿', popularity: 90 },
  { name: 'cookies', category: 'Snacks & Sweets', emoji: '🍪', popularity: 95 },
  { name: 'chocolate', category: 'Snacks & Sweets', emoji: '🍫', popularity: 98 },
];

