// Catalog search across providers: filter, price, sort, explain.

import type { GpuOffer } from "../types.js";
import { gpuHourPrice } from "../emma/fixtures.js";

export interface CatalogQuery {
  gpuType?: string;
  minVramGbPerGpu?: number;
  region?: string;
  maxGpuHourPrice?: number;
  limit?: number;
}

export interface CatalogRow {
  offer: GpuOffer;
  gpuHourPrice: number;
}

export function searchCatalog(offers: GpuOffer[], query: CatalogQuery = {}): CatalogRow[] {
  const rows = offers
    .filter((offer) => {
      if (query.gpuType && offer.gpuType.toLowerCase() !== query.gpuType.toLowerCase()) return false;
      if (query.minVramGbPerGpu !== undefined && offer.vramGbPerGpu < query.minVramGbPerGpu) return false;
      if (query.region && offer.region !== query.region) return false;
      if (query.maxGpuHourPrice !== undefined && gpuHourPrice(offer) > query.maxGpuHourPrice) return false;
      return true;
    })
    .map((offer) => ({ offer, gpuHourPrice: gpuHourPrice(offer) }));
  rows.sort((a, b) => {
    if (a.gpuHourPrice !== b.gpuHourPrice) return a.gpuHourPrice - b.gpuHourPrice;
    return a.offer.id < b.offer.id ? -1 : a.offer.id > b.offer.id ? 1 : 0;
  });
  const limit = query.limit ?? rows.length;
  return rows.slice(0, limit);
}

/** Cheapest-to-priciest ratio across matching offers, for demo narration. */
export function priceSpread(rows: CatalogRow[]): number | undefined {
  if (rows.length < 2) return undefined;
  const cheapest = rows[0].gpuHourPrice;
  const priciest = rows[rows.length - 1].gpuHourPrice;
  return priciest / cheapest;
}
