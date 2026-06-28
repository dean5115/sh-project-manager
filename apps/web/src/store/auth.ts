import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Organization } from '@sitepilot/types'

interface AuthState {
  token: string | null
  user: User | null
  organization: Organization | null
  setAuth: (token: string, user: User, organization: Organization) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      organization: null,
      setAuth: (token, user, organization) => {
        localStorage.setItem('sitepilot_token', token)
        set({ token, user, organization })
      },
      logout: () => {
        localStorage.removeItem('sitepilot_token')
        set({ token: null, user: null, organization: null })
      },
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'sitepilot-auth',
      partialize: (state) => ({ token: state.token, user: state.user, organization: state.organization }),
    }
  )
)
