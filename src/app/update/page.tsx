'use client'

import UpdateManager from '../../components/update/update-manager'
import AuthGuard from '@/components/auth/auth-guard'
import { useSearchParams } from 'next/navigation'

export default function UpdatePage() {
  const searchParams = useSearchParams()
  const managerName = searchParams?.get('name') ?? undefined

  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <UpdateManager managerName={managerName} />
      </div>
    </AuthGuard>
  )
}
