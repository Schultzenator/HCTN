// AgentCart — demo merchant catalog (in-memory, no DB by design).
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number; // USD
  rating: number; // 1..5
  stock: number;
  tags: string[];
}

export const CATALOG: Product[] = [
  { id: "desk-01", name: "ErgoDesk 140 Standing Desk", category: "desk", price: 149, rating: 4.6, stock: 5, tags: ["desk", "standing", "office"] },
  { id: "desk-02", name: "CompactDesk 100", category: "desk", price: 89, rating: 4.2, stock: 0, tags: ["desk", "small"] },
  { id: "chair-01", name: "MeshBack Pro Chair", category: "chair", price: 129, rating: 4.5, stock: 7, tags: ["chair", "ergonomic", "office"] },
  { id: "chair-02", name: "BasicStool", category: "chair", price: 39, rating: 3.9, stock: 12, tags: ["chair", "cheap"] },
  { id: "lamp-01", name: "Lumos LED Desk Lamp", category: "lamp", price: 29, rating: 4.4, stock: 20, tags: ["lamp", "light", "office"] },
  { id: "kb-01", name: "TactileOne 75 Mechanical Keyboard", category: "keyboard", price: 59, rating: 4.7, stock: 9, tags: ["keyboard", "mechanical", "office"] },
  { id: "kb-02", name: "MembraneLite Keyboard", category: "keyboard", price: 19, rating: 3.8, stock: 15, tags: ["keyboard", "cheap"] },
  { id: "mouse-01", name: "Glide MX Wireless Mouse", category: "mouse", price: 35, rating: 4.5, stock: 11, tags: ["mouse", "wireless"] },
  { id: "headset-01", name: "ClearVoice HC200 Headset", category: "headset", price: 45, rating: 4.3, stock: 8, tags: ["headset", "calls", "office"] },
  { id: "webcam-01", name: "SharpEye 1080p Webcam", category: "webcam", price: 49, rating: 4.2, stock: 6, tags: ["webcam", "calls"] },
  { id: "hub-01", name: "PortHub 7 USB-C Dock", category: "dock", price: 55, rating: 4.6, stock: 4, tags: ["dock", "usb", "hub"] },
  { id: "monitor-01", name: "View 27 1440p Monitor", category: "monitor", price: 199, rating: 4.8, stock: 3, tags: ["monitor", "screen", "office"] },
  { id: "mic-01", name: "StudioMin USB Microphone", category: "microphone", price: 69, rating: 4.4, stock: 5, tags: ["microphone", "calls", "streaming"] },
];

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return CATALOG.filter(
    (p) =>
      p.tags.some((t) => q.includes(t)) ||
      p.category.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
  );
}

export function byId(id: string): Product | undefined {
  return CATALOG.find((p) => p.id === id);
}

/** Deterministic "merchant bot": grants a 5% discount when asked politely. */
export function negotiatePrice(p: Product): { product: Product; discountPct: number; note: string } {
  const discountPct = 5;
  return {
    product: { ...p, price: Math.round(p.price * (1 - discountPct / 100) * 100) / 100 },
    discountPct,
    note: `Merchant bot: bundle deal granted — ${discountPct}% off on ${p.name}.`,
  };
}
