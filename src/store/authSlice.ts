import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

// Başlangıç değerlerimiz (Uygulama ilk açıldığında kimse giriş yapmamış sayılır)
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Kullanıcı giriş yaptığında (veya session bulunduğunda) bu çalışacak
    setAuth: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isInitialized = true;
    },
    // Çıkış yapıldığında bu çalışacak
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
