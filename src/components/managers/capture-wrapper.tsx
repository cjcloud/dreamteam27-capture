'use client'

import React, { useState, useCallback } from 'react';
import { CartProvider, useCart } from 'react-use-cart';
import CaptureForm from './capture-form';
import type { ExtendedCartItem } from './types';

// Feature flag to control whether to use the layout's CartProvider or a local one
const USE_LAYOUT_CART_PROVIDER = true;

interface CaptureWrapperProps {
  sessionId: string;
  cartKey: number;
  onResetCart: () => Promise<void>;
  pendingItems: ExtendedCartItem[];
  onSaveItems: (items: ExtendedCartItem[]) => void;
}

const CaptureContent: React.FC<CaptureWrapperProps> = ({
  sessionId,
  cartKey,
  onResetCart,
  pendingItems,
  onSaveItems
}) => {
  console.log(' CaptureContent render:', {
    sessionId,
    cartKey,
    pendingItemsCount: pendingItems?.length || 0,
    timestamp: new Date().toISOString()
  });
  return (
    <CaptureForm
      onResetCart={onResetCart}
      pendingItems={pendingItems}
      onSaveItems={onSaveItems}
    />
  );
};

const CaptureWrapper = () => {
  // Generate a unique session ID on component mount
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [cartKey, setCartKey] = useState(0);
  const [pendingItems, setPendingItems] = useState<ExtendedCartItem[]>([]);

  const handleResetCart = useCallback(() => {
    return new Promise<void>((resolve) => {
      // Commented out to prevent cart resets during normal operation
      // setCartKey(prev => prev + 1);
      resolve();
    });
  }, []);

  // If using the layout's CartProvider, render content directly
  if (USE_LAYOUT_CART_PROVIDER) {
    return (
      <CaptureContent
        sessionId={sessionId}
        cartKey={cartKey}
        onResetCart={handleResetCart}
        pendingItems={pendingItems}
        onSaveItems={(items) => setPendingItems(items)}
      />
    );
  }

  // Otherwise, use the local CartProvider (original behavior)
  return (
    <CartProvider
      id={`capture-cart-${sessionId}-${cartKey}`}
      key={`${sessionId}-${cartKey}`}
      defaultItems={[]}
    >
      <CaptureContent
        sessionId={sessionId}
        cartKey={cartKey}
        onResetCart={handleResetCart}
        pendingItems={pendingItems}
        onSaveItems={(items) => setPendingItems(items)}
      />
    </CartProvider>
  );
};

export default CaptureWrapper;
