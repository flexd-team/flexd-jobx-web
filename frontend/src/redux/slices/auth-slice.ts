import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type AuthState = { token: string | null; accountType: string | null }
const initialState: AuthState = { token: null, accountType: null }
const authSlice = createSlice({
  name: 'auth', initialState,
  reducers: {
    setSession: (state, action: PayloadAction<{ token: string; accountType: string }>) => {
      state.token = action.payload.token
      state.accountType = action.payload.accountType
    },
    clearSession: () => initialState,
  },
})
export const { setSession, clearSession } = authSlice.actions
export default authSlice.reducer
