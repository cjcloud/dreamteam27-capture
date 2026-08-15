'use client'
import { AuthProvider } from '@/lib/auth-context';
import AuthGuard from '@/components/auth/auth-guard';
import Navbar from '@/components/nav/navbar';
import { ToastContainer } from 'react-toastify';
import { CartProvider } from 'react-use-cart';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { usePathname } from 'next/navigation';
import 'react-toastify/dist/ReactToastify.css';

// Routes that must stay reachable without being logged in.
const PUBLIC_ROUTES = ['/login', '/register'];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.includes(pathname ?? '');

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
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
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