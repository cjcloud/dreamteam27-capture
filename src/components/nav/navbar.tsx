'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { signOut } from '@/lib/firebase'
import { LogOut, Upload, RefreshCw, UserPlus, Menu, X, BarChart3, Shield } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const { user } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await signOut()
      // Close mobile menu when signing out
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Function to close mobile menu
  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  // Enhanced Link component that closes the menu on click
  const NavLink = ({
    href,
    children,
    className
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => {
    return (
      <Link
        href={href}
        className={className}
        onClick={closeMenu}
      >
        {children}
      </Link>
    )
  }

  return (
    <nav className="bg-[#353b48] text-white shadow-lg w-full sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-6">
            <NavLink href="/" className="flex items-center font-bold text-md hover:text-blue-100 transition-colors">
              <Image
                src="footballCapture26.png"
                alt="Football Capture Logo"
                width={24}
                height={24}
                className="mr-2"
              />
              Dream<span className="text-green-300">Team</span>27 Capture
            </NavLink>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md hover:bg-[#2c313c] focus:outline-none"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>

            {/* Desktop navigation - only show links for authenticated users */}
            <div className="hidden md:flex items-center gap-4">
              {/* Links only for authenticated users */}
              {user && (
                <>
                  <NavLink
                    href="/managers"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Managers
                  </NavLink>
                  <NavLink
                    href="/upload"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </NavLink>
                  <NavLink
                    href="/update"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update
                  </NavLink>
                  <NavLink
                    href="/builder"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Builder
                  </NavLink>
                  <NavLink
                    href="/mobile-archive"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Mobile Archive
                  </NavLink>
                </>
              )}
            </div>
          </div>

          {/* User info and sign out for authenticated users */}
          {user ? (
            <div className="hidden md:flex items-center gap-4">
              <span className="text-md text-blue-100">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-md bg-[#2c313c] hover:bg-[#23272f] text-white rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-4">
              <NavLink
                href="/login"
                className="flex items-center gap-2 px-3 py-2 text-md hover:text-blue-100 transition-colors"
              >
                Login
              </NavLink>
            </div>
          )}
        </div>

        {/* Mobile menu - updated to show appropriate links */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Only show links for authenticated users */}
              {user ? (
                <>
                  <NavLink
                    href="/managers"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Managers
                  </NavLink>
                  <NavLink
                    href="/upload"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload
                  </NavLink>
                  <NavLink
                    href="/update"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update
                  </NavLink>
                  <NavLink
                    href="/builder"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Builder
                  </NavLink>
                  <NavLink
                    href="/mobile-archive"
                    className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Mobile Archive
                  </NavLink>
                  <div className="border-t border-[#2c313c] my-2"></div>
                  <div className="px-3 py-2">
                    <span className="text-md text-blue-100">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <NavLink
                  href="/login"
                  className="flex items-center gap-2 px-3 py-2 text-md hover:bg-[#2c313c] rounded-md transition-colors"
                >
                  Login
                </NavLink>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
