'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

interface AuthGuardProps {
  children: React.ReactNode
}

// Development mode flag - set to true to bypass authentication in development
const BYPASS_AUTH_IN_DEV = process.env.NODE_ENV === 'development'

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // If not loading and no user is authenticated, redirect to login
    // Unless we're in development mode and bypassing auth
    if (!loading && !user && !BYPASS_AUTH_IN_DEV) {
      // Redirect to login with the current path as the 'from' parameter
      router.push(`/login?from=${encodeURIComponent(pathname ?? '')}`)
    }
  }, [user, loading, router, pathname, BYPASS_AUTH_IN_DEV])

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // If authenticated or bypassing auth in development, show the protected content
  if (user || BYPASS_AUTH_IN_DEV) {
    return <>{children}</>
  }

  // Otherwise show nothing while redirecting
  return null
}
