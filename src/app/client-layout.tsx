'use client'

import { AuthProvider } from '@/lib/auth-context';
import Navbar from '@/components/nav/navbar';
import { ToastContainer } from 'react-toastify';
import { CartProvider } from 'react-use-cart';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import 'react-toastify/dist/ReactToastify.css';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <CartProvider
        id="capture-cart"
        defaultItems={[]}
        shouldPersist={false}
        onItemAdd={(item) => {
          console.log('Item added:', item.id);
        }}
        onItemRemove={(item) => {
          console.log('Item removed:', item.id);
        }}
      >
        <Navbar />
        {children}
        <ThemeSwitcher defaultTheme="aquamarine" />
        <ToastContainer
          position="bottom-right"
          limit={3}
          autoClose={3000}
          newestOnTop
        />
      </CartProvider>
    </AuthProvider>
  );
}
