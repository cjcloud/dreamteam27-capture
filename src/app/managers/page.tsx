'use client'

import CaptureWrapper from '@/components/managers/capture-wrapper';
import AuthGuard from '@/components/auth/auth-guard';

export default function CapturePage() {
  return (
    <AuthGuard>
      <main className="container mx-auto px-4 py-8">
        <CaptureWrapper />
      </main>
    </AuthGuard>
  );
}
