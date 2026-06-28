'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { ArrowRight, Image as ImageIcon, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRef } from 'react'

export default function GalleryPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data } = useQuery({
    queryKey: ['photos', projectId],
    queryFn: () => api.get<{ data: any[] }>(`/projects/${projectId}/photos`),
    enabled: !!projectId,
  })
  const photos = data?.data ?? []

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('projectId', projectId)
        await api.upload('/photos/upload', fd)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos', projectId] }),
  })

  return (
    <AppLayout title="גלריית תמונות">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
            <ArrowRight size={13} />
            חזרה לפרויקט
          </Link>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadMutation.mutate(e.target.files)}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} loading={uploadMutation.isPending}>
              <Upload size={14} />
              העלאת תמונות
            </Button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="card text-center py-14">
            <ImageIcon size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">אין תמונות עדיין</p>
            <Button size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
              <Upload size={14} />
              העלה תמונה ראשונה
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {photos.map((photo) => (
              <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer">
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity">
                  <img
                    src={photo.url}
                    alt={photo.caption || 'תמונת אתר'}
                    className="w-full h-full object-cover"
                  />
                </div>
                {photo.caption && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{photo.caption}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
