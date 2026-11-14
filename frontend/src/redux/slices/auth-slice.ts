import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type UserInfo = {
  id: string
  name: string
  email: string
  account_type: 'candidate' | 'employer' | 'admin' | string
}

type AuthState = {
  token: string | null
  accountType: string | null
  user: UserInfo | null
}

const getStoredToken = () => {
  try {
    return localStorage.getItem('jobx_token')
  } catch {
    return null
  }
}

const getStoredUser = (): UserInfo | null => {
  try {
    const raw = localStorage.getItem('jobx_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const storedToken = getStoredToken()
const storedUser = getStoredUser()

const initialState: AuthState = {
  token: storedToken,
  accountType: storedUser?.account_type ?? null,
  user: storedUser,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession: (
      state,
      action: PayloadAction<{ token: string; accountType: string; user?: UserInfo }>,
    ) => {
      state.token = action.payload.token
      state.accountType = action.payload.accountType
      state.user = action.payload.user ?? null
      try {
        localStorage.setItem('jobx_token', action.payload.token)
        if (action.payload.user) {
          localStorage.setItem('jobx_user', JSON.stringify(action.payload.user))
        }
      } catch {
        // Ignore storage error
      }
    },
    clearSession: (state) => {
      state.token = null
      state.accountType = null
      state.user = null
      try {
        localStorage.removeItem('jobx_token')
        localStorage.removeItem('jobx_user')
      } catch {
        // Ignore storage error
      }
    },
  },
})

export const { setSession, clearSession } = authSlice.actions
export default authSlice.reducer
