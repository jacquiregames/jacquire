// src/utils/stockPricing.ts
//
// FIX: this used to hardcode its own copy of the three price tables that
// also live in src/server/utils.py, purely for client-side display
// (merger resolution previews, majority/minority estimates in
// StockAvailability). Nothing enforced the two stayed in sync — any future
// tuning of prices would have to be made in two places, in two languages,
// with no compiler or test catching a mismatch.
//
// The server now exposes GET /price_table as the single source of truth.
// `loadServerPriceTables` should be called once (e.g. from App.tsx on
// mount) to populate the cache below. `getStockPricing` prefers that cache
// and falls back to the original hardcoded tables only if the fetch hasn't
// completed yet (e.g. first paint) or failed (e.g. offline), so display
// math never breaks — it just briefly risks the old drift-risk until the
// real tables arrive.

type PriceTier = [number | [number, number], number, number, number];

interface ServerPriceEntry {
  min_size: number;
  max_size: number;
  price: number;
  majority: number;
  minority: number;
}

let serverTables: Record<string, ServerPriceEntry[]> | null = null;

export async function loadServerPriceTables(apiUrl: string): Promise<void> {
  try {
    const res = await fetch(`${apiUrl}/price_table`);
    if (!res.ok) return;
    const data = await res.json();
    serverTables = data;
  } catch {
    // Offline or server not up yet — keep using the fallback tables below.
  }
}

const FALLBACK_PRICE_TABLE_LUXOR_TOWER: PriceTier[] = [
  [2, 200, 2000, 1000],
  [3, 300, 3000, 1500],
  [4, 400, 4000, 2000],
  [5, 500, 5000, 2500],
  [[6, 10], 600, 6000, 3000],
  [[11, 20], 700, 7000, 3500],
  [[21, 30], 800, 8000, 4000],
  [[31, 40], 900, 9000, 4500],
  [[41, 108], 1000, 10000, 5000],
];

const FALLBACK_PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA: PriceTier[] = [
  [2, 300, 3000, 1500],
  [3, 400, 4000, 2000],
  [4, 500, 5000, 2500],
  [5, 600, 6000, 3000],
  [[6, 10], 700, 7000, 3500],
  [[11, 20], 800, 8000, 4000],
  [[21, 30], 900, 9000, 4500],
  [[31, 40], 1000, 10000, 5000],
  [[41, 108], 1100, 11000, 5500],
];

const FALLBACK_PRICE_TABLE_CONTINENTAL_IMPERIAL: PriceTier[] = [
  [2, 400, 4000, 2000],
  [3, 500, 5000, 2500],
  [4, 600, 6000, 3000],
  [5, 700, 7000, 3500],
  [[6, 10], 800, 8000, 4000],
  [[11, 20], 900, 9000, 4500],
  [[21, 30], 1000, 10000, 5000],
  [[31, 40], 1100, 11000, 5500],
  [[41, 108], 1200, 12000, 6000],
];

const FALLBACK_TABLES: Record<string, PriceTier[]> = {
  Luxor: FALLBACK_PRICE_TABLE_LUXOR_TOWER,
  Tower: FALLBACK_PRICE_TABLE_LUXOR_TOWER,
  Festival: FALLBACK_PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA,
  Worldwide: FALLBACK_PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA,
  American: FALLBACK_PRICE_TABLE_FESTIVAL_WORLDWIDE_AMERICA,
  Continental: FALLBACK_PRICE_TABLE_CONTINENTAL_IMPERIAL,
  Imperial: FALLBACK_PRICE_TABLE_CONTINENTAL_IMPERIAL,
};

export function getStockPricing(chain: string, size: number): { price: number; majority: number; minority: number } {
  const serverTable = serverTables?.[chain];
  if (serverTable) {
    for (const tier of serverTable) {
      if (size >= tier.min_size && size <= tier.max_size) {
        return { price: tier.price, majority: tier.majority, minority: tier.minority };
      }
    }
    return { price: 0, majority: 0, minority: 0 };
  }

  const table = FALLBACK_TABLES[chain] || FALLBACK_PRICE_TABLE_LUXOR_TOWER;
  for (const [range, price, majority, minority] of table) {
    if (typeof range === "number" && size === range) {
      return { price, majority, minority };
    }
    if (Array.isArray(range) && size >= range[0] && size <= range[1]) {
      return { price, majority, minority };
    }
  }

  return { price: 0, majority: 0, minority: 0 };
}
