'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

interface ImageUploaderProps {
  currentUrl?: string | null
  onUpload: (url: string) => void
  onRemove: () => void
  bucket?: string
  label?: string
  aspectRatio?: string
}

export function ImageUploader({ currentUrl, onUpload, onRemove, bucket = 'product-images', label = 'Gambar Produk', aspectRatio = 'aspect-square' }: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Format tidak disokong. Guna JPG, PNG atau WebP.')
      return
    }

    if (file.size > MAX_SIZE) {
      toast.error(`Saiz gambar terlalu besar. Maksimum 5MB. (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      return
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { upsert: false, contentType: file.type })

    if (error) {
      toast.error('Gagal upload gambar. Cuba lagi.')
      setPreview(currentUrl ?? null)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
    onUpload(data.publicUrl)
    toast.success('Gambar berjaya diupload')
    setUploading(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleRemove() {
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
    onRemove()
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {preview ? (
        /* Preview */
        <div className={`relative w-full ${aspectRatio} max-w-[200px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50`}>
          <Image
            src={preview}
            alt="Preview"
            fill
            className="object-cover"
            sizes="200px"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`w-full ${aspectRatio} max-w-[200px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
            dragOver
              ? 'border-brand-red-400 bg-brand-red-50'
              : 'border-gray-300 bg-gray-50 hover:border-brand-red-300 hover:bg-gray-100'
          }`}
        >
          <div className="p-3 rounded-full bg-white shadow-sm">
            <ImageIcon className="h-6 w-6 text-gray-400" />
          </div>
          <div className="text-center px-2">
            <p className="text-xs font-medium text-gray-600">Klik atau drag & drop</p>
            <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WebP · Max 5MB</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-red-600 font-medium">
            <Upload className="h-3.5 w-3.5" />
            Pilih Gambar
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  )
}
