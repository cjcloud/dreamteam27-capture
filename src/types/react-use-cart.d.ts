declare module 'react-use-cart' {
  export interface CartItem {
    id: string | number;
    // Price may arrive as a number (e.g. 4.0) or a formatted string (e.g. "£4.0M").
    price?: number | string;
    rawPrice?: number | null;
    quantity?: number;
    // Domain fields carried on cart items throughout the capture app.
    displayName?: string;
    position?: string;
    playerClub?: string;
    [key: string]: unknown;
  }

  export interface CartProviderProps<ItemType extends CartItem = CartItem> {
    children: React.ReactNode;
    id?: string;
    defaultItems?: ItemType[];
    onItemAdd?: (item: ItemType) => void;
    onItemRemove?: (item: ItemType) => void;
    onItemUpdate?: (item: ItemType) => void;
    shouldPersist?: boolean;
    storage?: (key: string, initialValue: string) => [string, (value: string) => void];
  }

  export interface CartContextValue<ItemType extends CartItem = CartItem> {
    items: ItemType[];
    addItem: (item: ItemType) => void;
    removeItem: (id: string | number) => void;
    updateItem: (id: string | number, payload: Partial<ItemType>) => void;
    setItems: (items: ItemType[]) => void;
    inCart: (id: string | number) => boolean;
    clearCart: () => void;
    emptyCart: () => void;
    getItem: (id: string | number) => ItemType | undefined;
    updateItemQuantity: (id: string | number, quantity: number) => void;
    isEmpty: boolean;
    totalItems: number;
    totalUniqueItems: number;
    cartTotal: number;
  }

  export const CartProvider: React.FC<CartProviderProps>;
  export function useCart<ItemType extends CartItem = CartItem>(): CartContextValue<ItemType>;
}
