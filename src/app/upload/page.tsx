'use client'

import { useAuth } from '@/lib/auth-context'
import UploadForm from '@/components/upload/upload-form'

export default function UploadPage() {
  const { user } = useAuth()

  if (!user) {
    return null // Let middleware handle the redirect
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl text-slate-200 font-bold my-6">Upload JSON Data</h1>
        <UploadForm />
      </div>
    </main>
  )
}
