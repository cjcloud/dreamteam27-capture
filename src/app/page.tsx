import Link from 'next/link'
import BackgroundAnimation from '@/components/ui/background-animation';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <BackgroundAnimation />
      <div className="max-w-4xl mx-auto relative z-10">
        <p className="text-4xl text-slate-200 font- mb-8">DT<span className="text-green-400 font-bold">Capture</span>26</p>
        <div className="grid gap-4">
          <Link 
            href="/upload" 
            className="p-4 bg-green-500/80 text-white rounded-lg hover:bg-green-600 transition-colors text-center"
          >
            Upload JSON Data
          </Link>
          <Link 
            href="/data" 
            className="p-4 bg-[#FF00C9]/70 text-slate-100 rounded-lg hover:bg-pink-600 transition-color text-center"
          >
            View Data
          </Link>
          <Link 
            href="/managers" 
            className="p-4 bg-gray-600/80 text-white rounded-lg hover:bg-green-600 transition-colors text-center"
          >
            Managers
          </Link>
        </div>
      </div>
    </main>
  )
}
