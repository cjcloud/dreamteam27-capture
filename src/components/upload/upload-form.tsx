import { toast } from 'react-toastify'
import FileUpload from './file-upload'

interface UploadFormProps {
  onUploadComplete?: () => void;
}

export default function UploadForm({ onUploadComplete }: UploadFormProps) {
  const handleUploadComplete = () => {
    toast.success('Upload completed')
    if (onUploadComplete) {
      onUploadComplete()
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <FileUpload onUploadComplete={handleUploadComplete} />
    </div>
  )
}
