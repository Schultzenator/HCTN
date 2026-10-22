// Deterministic multi-cloud GPU catalog fixtures for mock mode.
// Prices and stock are illustrative, stable values chosen to make the demo
// deterministic; they are not quotes from any provider. Real mode replaces
// this whole module with the live emma API.

import type { GpuOffer } from "../types.js";

export const MOCK_CATALOG: GpuOffer[] = [
  // H100 80GB
  { id: "coreweave-uscentral1-h100x8", provider: "coreweave", region: "us-central1", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 23.92, availableGpus: 64 },
  { id: "lambda-use1-h100x8", provider: "lambda", region: "us-east-1", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 25.99, availableGpus: 32 },
  { id: "nebius-eunorth1-h100x8", provider: "nebius", region: "eu-north1", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 28.56, availableGpus: 48 },
  { id: "gcp-uscentral1-a3-8g", provider: "gcp", region: "us-central1", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 51.6, availableGpus: 32 },
  { id: "aws-use1-p5-48xlarge", provider: "aws", region: "us-east-1", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 54.24, availableGpus: 16 },
  { id: "azure-eastus-nc-h100-v5", provider: "azure", region: "eastus", gpuType: "H100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 47.04, availableGpus: 24 },
  // A100 80GB
  { id: "lambda-use1-a100x8", provider: "lambda", region: "us-east-1", gpuType: "A100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 15.36, availableGpus: 64 },
  { id: "coreweave-uscentral1-a100x8", provider: "coreweave", region: "us-central1", gpuType: "A100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 16.0, availableGpus: 48 },
  { id: "nebius-eunorth1-a100x8", provider: "nebius", region: "eu-north1", gpuType: "A100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 17.04, availableGpus: 32 },
  { id: "azure-eastus-nd-a100-v4", provider: "azure", region: "eastus", gpuType: "A100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 27.2, availableGpus: 16 },
  { id: "gcp-uscentral1-a2-8g", provider: "gcp", region: "us-central1", gpuType: "A100", vramGbPerGpu: 80, gpusPerNode: 8, pricePerNodeHour: 29.39, availableGpus: 24 },
  { id: "aws-use1-p4d-24xlarge", provider: "aws", region: "us-east-1", gpuType: "A100", vramGbPerGpu: 40, gpusPerNode: 8, pricePerNodeHour: 32.77, availableGpus: 8 },
  // L40S 48GB
  { id: "lambda-use1-l40s", provider: "lambda", region: "us-east-1", gpuType: "L40S", vramGbPerGpu: 48, gpusPerNode: 1, pricePerNodeHour: 1.62, availableGpus: 40 },
  { id: "coreweave-uscentral1-l40s", provider: "coreweave", region: "us-central1", gpuType: "L40S", vramGbPerGpu: 48, gpusPerNode: 1, pricePerNodeHour: 1.69, availableGpus: 96 },
  { id: "nebius-eunorth1-l40s", provider: "nebius", region: "eu-north1", gpuType: "L40S", vramGbPerGpu: 48, gpusPerNode: 1, pricePerNodeHour: 1.85, availableGpus: 64 },
  { id: "gcp-uscentral1-g2-48g", provider: "gcp", region: "us-central1", gpuType: "L40S", vramGbPerGpu: 48, gpusPerNode: 1, pricePerNodeHour: 3.67, availableGpus: 12 },
  // Out of stock everywhere else: forces planner to fall through providers.
  { id: "azure-eastus-l40s", provider: "azure", region: "eastus", gpuType: "L40S", vramGbPerGpu: 48, gpusPerNode: 1, pricePerNodeHour: 2.1, availableGpus: 0 },
];

/** Price of one GPU for one hour under an offer. */
export function gpuHourPrice(offer: GpuOffer): number {
  return offer.pricePerNodeHour / offer.gpusPerNode;
}
