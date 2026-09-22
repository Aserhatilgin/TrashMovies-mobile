import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
}

// Başlangıç değerlerimiz (Uygulama ilk açıldığında kimse giriş yapmamış sayılır)
const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Kullanıcı giriş yaptığında (veya session bulunduğunda) bu çalışacak
    setAuth: (state, action: PayloadAction<{ session: Session; user: User }>) => {
      state.session = action.payload.session;
      state.user = action.payload.user;
      state.isAuthenticated = !!action.payload.session; // Session varsa true, yoksa false
    },
    // Çıkış yapıldığında bu çalışacak
    clearAuth: (state) => {
      state.session = null;
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
