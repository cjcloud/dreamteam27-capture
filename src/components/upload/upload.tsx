'use client'

import FileUpload from './file-upload'
import { toast } from 'react-toastify'

export default function Upload() {
  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl text-slate-200 font-bold mb-4">Upload Data</h1>
      <FileUpload onUploadComplete={() => toast.success('Upload completed')} />
    </div>
  )
}
