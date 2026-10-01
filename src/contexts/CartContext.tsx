import { createContext, useContext, useState, useCallback } from "react";
import type { Product } from "@/data/products";

export type CartItem = {
  lineId: string;
  product: Product;
  quantity: number;
  selectedSize?: string;
};

type CartContextValue = {
  items: CartItem[];
  add: (product: Product, initialSize?: string) => void;
  decrement: (lineId: string) => void;
  remove: (lineId: string) => void;
  setSize: (lineId: string, size: string) => void;
  clearSize: (lineId: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

let _lineCounter = 0;
const newLineId = () => `line-${++_lineCounter}`;

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((product: Product, initialSize?: string) => {
    const hasSizes = (product.sizes?.length ?? 0) > 0;
    setItems((prev) => {
      if (!hasSizes) {
        // Sem tamanho: agrupa por produto
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.lineId === existing.lineId ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
      }
      // Com tamanho: sempre nova linha
      return [...prev, { lineId: newLineId(), product, quantity: 1, selectedSize: initialSize }];
    });
  }, []);

  const decrement = useCallback((lineId: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.lineId === lineId);
      if (!item) return prev;
      if (item.quantity <= 1) return prev.filter((i) => i.lineId !== lineId);
      return prev.map((i) => i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  }, []);

  const remove = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const setSize = useCallback((lineId: string, size: string) => {
    setItems((prev) =>
      prev.map((i) => i.lineId === lineId ? { ...i, selectedSize: size } : i)
    );
  }, []);

  const clearSize = useCallback((lineId: string) => {
    setItems((prev) =>
      prev.map((i) => i.lineId === lineId ? { ...i, selectedSize: undefined } : i)
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => {
    const price = parseFloat((i.product.price ?? "0").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    return sum + price * i.quantity;
  }, 0);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, decrement, remove, setSize, clearSize, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
};
