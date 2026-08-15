import { Metadata } from 'next'
import LoginForm from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Login - DreamTeam27 Capture',
  description: 'Login to access the application',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-center mb-8">Dream<span >Team</span>27</h1>
          <h2 className="text-2xl font-semibold text-center mb-8">Login</h2>
        </div>
        <div className="bg-white shadow-lg rounded-lg p-8">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
