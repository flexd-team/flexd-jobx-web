import { configureStore } from '@reduxjs/toolkit'
import appReducer from '@/redux/slices/app-slice'
import authReducer from '@/redux/slices/auth-slice'

export const store = configureStore({ reducer: { app: appReducer, auth: authReducer } })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
