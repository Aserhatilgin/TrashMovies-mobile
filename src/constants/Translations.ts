// mobile/constants/Translations.ts
export const tr = {
  home: {
    loadingMovie: 'Film yükleniyor',
    loadMovieError: 'Film yüklenemedi.',
    noMovieAvailable: 'Gösterilecek film bulunamadı.'
  },
  auth: {
    loginTitle: 'Çöplüğe Hoş Geldin! 🗑️',
    loginSubtitle: 'En kötü filmleri keşfetmek ve oynamak için giriş yap.',
    emailPlaceholder: 'E-posta adresin',
    passwordPlaceholder: 'Şifren',
    loginButton: 'Giriş Yap',
    noAccountText: 'Henüz çöplüğe katılmadın mı? ',
    signUpLink: 'Kayıt Ol'
  },
  movieCard: {
    tmdbRating: 'TMDB puanı',
    showDetails: 'Film ayrıntılarını göster',
    showPoster: 'Film afişini göster',
    flipHint: 'Kartın diğer yüzünü görmek için iki kez dokun'
  }
};
// İleride buraya 'en' (İngilizce) ekleyip Redux ile yönetebiliriz.
export const currentLang = tr;
