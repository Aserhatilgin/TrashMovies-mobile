// mobile/constants/Translations.ts
export const tr = {
  home: {
    loadingMovie: 'Film yükleniyor',
    loadMovieError: 'Film yüklenemedi.',
    noMovieAvailable: 'Gösterilecek film bulunamadı.',
    backToToday: 'Bugüne dön'
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
  },
  interactions: {
    save: 'Kaydet',
    saved: 'Kaydedildi',
    markWatched: 'İzledim',
    watched: 'İzlendi',
    rate: 'Puan Ver',
    watchBeforeRating: 'Puan vermek için önce izlendi olarak işaretle',
    yourRating: 'TrashMovies Puanın',
    saveRating: 'Puanı Kaydet',
    cancel: 'Vazgeç',
    loadError: 'Film işlemleri yüklenemedi.'
  },
  streak: {
    title: 'Serin',
    days: 'günlük seri',
    loadError: 'Seri bilgisi yüklenemedi.',
    countPending: '—',
    weekdays: ['P', 'S', 'Ç', 'P', 'C', 'C', 'P']
  },
  profile: {
    fallbackName: 'Sinema Delisi',
    activeDays: 'aktif gün',
    pendingValue: '—',
    gameScore: 'Oyun Puanı',
    noScore: 'Henüz puan yok',
    savedMovies: 'Kaydettiklerim',
    closeSavedMovies: 'Kaydedilen filmleri kapat',
    viewAll: 'Tümünü Gör',
    openSavedMovies: 'Kaydedilen filmleri aç',
    savedEmpty: 'Henüz film kaydetmedin.',
    savedError: 'Kaydedilen filmler yüklenemedi.',
    loadingSaved: 'Kaydedilen filmler yükleniyor',
    logout: 'Çıkış Yap'
  },
  game: {
    score: 'Oyun Puanın',
    previewScore: '300',
    previewLabel: 'Örnek puan',
    dailyTitle: 'Günlük Oyunlar',
    dailySubtitle: 'Bugünün önerilen oyunlarını oyna',
    dailyPlaceholder: 'Günlük oyunlar yakında burada olacak.',
    openDailyGames: 'Günlük Oyunları aç',
    allGames: 'Tüm Oyunlar',
    comingSoon: 'Yakında',
    guessMovie: 'Film Tahmin',
    posterQuiz: 'Poster Quiz',
    trueFalse: 'Doğru / Yanlış',
    findActor: 'Oyuncuyu Bul'
  }
};
// İleride buraya 'en' (İngilizce) ekleyip Redux ile yönetebiliriz.
export const currentLang = tr;
