import { createSlice } from '@reduxjs/toolkit';

// Başlangıç değerlerimiz (Uygulama ilk açıldığında kimse giriş yapmamış sayılır)
const initialState = {
  user: null,
  session: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Kullanıcı giriş yaptığında (veya session bulunduğunda) bu çalışacak
    setAuth: (state, action) => {
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