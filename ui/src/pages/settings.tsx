import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MaskedInput } from '@/components/ui/masked-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Edit, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'

interface Settings {
  env?: Record<string, string>
}

interface SettingsResponse {
  profile: string
  settings: Settings
  mtime: number
  path: string
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = searchParams.get('profile')
  const [editMode, setEditMode] = useState(false)
  const [editedSettings, setEditedSettings] = useState<Settings | null>(null)
  const [conflictDialog, setConflictDialog] = useState(false)
  const queryClient = useQueryClient()

  // Fetch profiles for selector
  const { data: profilesData } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => api.profiles.list(),
  })

  // Fetch settings for selected profile
  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ['settings', profile],
    queryFn: () => fetch(`/api/settings/${profile}/raw`).then(r => r.json()),
    enabled: !!profile,
  })

  // Initialize edited settings when data loads
  useEffect(() => {
    if (data?.settings) {
      setEditedSettings(data.settings)
    }
  }, [data])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/settings/${profile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: editedSettings,
          expectedMtime: data?.mtime,
        }),
      })

      if (res.status === 409) {
        throw new Error('CONFLICT')
      }

      if (!res.ok) {
        throw new Error('Failed to save')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', profile] })
      setEditMode(false)
      toast.success('Settings saved')
    },
    onError: (error: Error) => {
      if (error.message === 'CONFLICT') {
        setConflictDialog(true)
      } else {
        toast.error(error.message)
      }
    },
  })

  const handleSave = () => {
    saveMutation.mutate()
  }

  const handleConflictResolve = async (overwrite: boolean) => {
    setConflictDialog(false)
    if (overwrite) {
      // Refetch to get new mtime, then save
      await refetch()
      saveMutation.mutate()
    } else {
      // Discard local changes
      if (data?.settings) {
        setEditedSettings(data.settings)
      }
      setEditMode(false)
    }
  }

  const updateEnvValue = (key: string, value: string) => {
    setEditedSettings((prev) => ({
      ...prev,
      env: {
        ...prev?.env,
        [key]: value,
      },
    }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Settings Editor</h1>
        <select
          className="border rounded px-3 py-2"
          value={profile || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchParams({ profile: e.target.value })}
        >
          <option value="">Select profile...</option>
          {profilesData?.profiles.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      {!profile && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select a profile to view/edit settings.</p>
          </CardContent>
        </Card>
      )}

      {profile && isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {profile && data && editedSettings && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Environment Variables</CardTitle>
            <div className="flex gap-2">
              {!editMode ? (
                <Button variant="outline" onClick={() => setEditMode(true)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => {
                    setEditedSettings(data.settings)
                    setEditMode(false)
                  }}>
                    <X className="w-4 h-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saveMutation.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(editedSettings.env || {}).map(([key, value]) => (
              <div key={key}>
                <Label>{key}</Label>
                {key.includes('TOKEN') || key.includes('KEY') ? (
                  <MaskedInput
                    value={value}
                    onChange={(e) => updateEnvValue(key, e.target.value)}
                    disabled={!editMode}
                  />
                ) : (
                  <Input
                    value={value}
                    onChange={(e) => updateEnvValue(key, e.target.value)}
                    disabled={!editMode}
                    className="font-mono"
                  />
                )}
              </div>
            ))}

            <div className="pt-4 text-xs text-muted-foreground">
              <p>Path: {data.path}</p>
              <p>Last modified: {new Date(data.mtime).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={conflictDialog}
        title="File Modified Externally"
        description="This settings file was modified by another process. Overwrite with your changes or discard?"
        confirmText="Overwrite"
        variant="destructive"
        onConfirm={() => handleConflictResolve(true)}
        onCancel={() => handleConflictResolve(false)}
      />
    </div>
  )
}
