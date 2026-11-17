import type { DishBankItem } from '../../types/nutrition';

let cachedBank: DishBankItem[] | null = null;

/**
 * Lazy-loads and merges all split JSON dish batches.
 * To expand the database later, simply add a new 40-50 dish JSON file
 * in src/data/dishes/ and append its dynamic import below.
 */
export async function loadDishBank(): Promise<DishBankItem[]> {
  if (cachedBank) return cachedBank;

  const [eatoutViet, homecookViet, healthyIntl, drinksSnacks] = await Promise.all([
    import('./eatout-viet.json'),
    import('./homecook-viet.json'),
    import('./healthy-intl.json'),
    import('./drinks-snacks.json'),
  ]);

  cachedBank = [
    ...(eatoutViet.default as DishBankItem[]),
    ...(homecookViet.default as DishBankItem[]),
    ...(healthyIntl.default as DishBankItem[]),
    ...(drinksSnacks.default as DishBankItem[]),
  ];

  return cachedBank;
}

export function clearDishBankCacheForTest(): void {
  cachedBank = null;
}
