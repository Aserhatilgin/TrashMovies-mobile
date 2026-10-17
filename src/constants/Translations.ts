// mobile/constants/Translations.ts
export const tr = {
  home: {
    loadingMovie: 'Film yükleniyor',
    loadMovieError: 'Film yüklenemedi.',
    noMovieAvailable: 'Gösterilecek film bulunamadı.',
    backToToday: 'Bugüne dön'
  },
  auth: {
    initializing: 'Oturum yükleniyor',
    brandName: 'Çöplük',
    loginTitle: 'Çöplüğe Hoş Geldin',
    loginSubtitle: 'En kötü filmleri keşfetmek ve oyunlarla puan toplamak için giriş yap.',
    emailPlaceholder: 'E-posta adresin',
    passwordPlaceholder: 'Şifren',
    loginButton: 'Giriş Yap',
    noAccountText: 'Henüz çöplüğe katılmadın mı? ',
    signUpLink: 'Kayıt Ol',
    registrationConfirmationTitle: 'E-postanı doğrula',
    registrationConfirmationMessage: 'Hesabını etkinleştirmek için e-postandaki doğrulama bağlantısını aç.'
  },
  onboarding: {
    title: 'Film Zevkini Tanıyalım',
    initializing: 'Hesap bilgilerin yükleniyor',
    placeholder: 'Film zevkini keşfetme adımları yakında burada olacak.',
    bootstrapError: 'Hesap bilgilerin yüklenemedi. Tekrar deneyebilirsin.',
    retry: 'Tekrar Dene',
    back: 'Geri',
    continue: 'Devam et',
    skip: 'Geç',
    finish: 'Profilimi Gör',
    enter: 'Çöplüğe Gir',
    previewExit: 'Önizlemeden Çık',
    optional: 'İsteğe bağlı',
    coreProgress: 'Ana bölüm',
    optionalProgress: 'Ek seçimler',
    preview: 'Onboarding Preview',
    previewNote: 'Geliştirme önizlemesi: cevaplar kaydedilmez.',
    optionalIntroTitle: 'Seni biraz daha tanımamızı ister misin?',
    optionalIntroBody: 'Birkaç isteğe bağlı seçim, film önerilerini ileride daha iyi ayarlamamıza yardım edebilir.',
    optionalIntroSkip: 'Şimdilik geç',
    displayNamePlaceholder: 'Adın veya takma adın',
    avatarLabel: 'Avatar',
    countSelected: 'Seçilen',
    genreHint: 'En az bir tür seç. İstersen beşe kadar işaretleyebilirsin.',
    dislikedHint: 'Beğendiğin türler burada seçilemez. En fazla üç tür.',
    movieHint: 'Bildiklerine tepki ver; diğerlerini boş bırakabilirsin.',
    reactionPage: 'Film grubu',
    nextMovies: 'Sonraki Filmler',
    posterUnavailable: 'Afiş bulunamadı',
    previousMovies: 'Önceki filmler',
    like: 'Sevdim',
    notForMe: 'Bana göre değil',
    clearHint: 'İsteğe bağlı ölçekte seçimi kaldırmak için tekrar dokun.',
    selfRatingHint: 'Bu yalnızca kendi görüşün; oyun puanı değil.',
    demographicHint: 'Bu bilgiler şu anda önerileri etkilemez.',
    age: 'Yaş aralığı',
    gender: 'Cinsiyet',
    classic: 'Klasiklere açıklık',
    classicHint: 'Düşük: yeni filmler; yüksek: eski ve klasik filmler.',
    international: 'Dünya sinemasına açıklık',
    internationalHint: 'Düşük: tanıdık filmler; yüksek: dünyanın her yerinden filmler.',
    runtime: 'Tercih ettiğin süre',
    popularity: 'Popülerlik tercihi',
    loadError: 'Seçenekler yüklenemedi. Tekrar dene.',
    saveError: 'Yanıtların kaydedilemedi. Seçimlerin burada duruyor; tekrar dene.',
    conflictError: 'Bu taslak başka bir yerde değişmiş. Sunucudaki taslağı yükleyebilir veya burada kalabilirsin.',
    completeError: 'Tamamlama doğrulanamadı. Tekrar dene; cevapların korunuyor.',
    loadServerDraft: 'Sunucudaki taslağı yükle',
    requiredHint: 'Devam etmek için bu seçimi tamamla.',
    resultTitle: 'Zevk Profilin Hazır',
    resultSubtitle: 'Seçimlerine göre film zevkinden küçük bir kesit.',
    resultDisclaimer: 'Bu bir film zevki özeti; bilimsel ya da nesnel bir değerlendirme değil.',
    resultFavoriteGenres: 'Sevdiğin türler',
    resultPriorities: 'Filmde aradıkların',
    resultRuntime: 'Süre tercihi',
    resultDiscovery: 'Keşif İsteği',
    resultTrash: 'Çöp Toleransı',
    resultClassic: 'Klasiklere Açıklık',
    resultInternational: 'Dünya Sinemasına Açıklık',
    resultNotAnswered: 'Yanıtlanmadı',
    modes: {
      chaos: 'Kaos Avcısı', explorer: 'Keşifçi', classic: 'Klasik Meraklısı',
      safe: 'Güvenli Liman', balanced: 'Dengeli İzleyici'
    },
    titles: {
      display_name: 'Sana ne diyelim?',
      avatar_choice: 'Çöplükteki yüzünü seç.',
      liked_genres: 'Hangi türlere koşarak gidersin?',
      movie_priorities: 'Bir filmde seni ne yakalar?',
      watch_intent: 'Film açtığında çoğu zaman ne arıyorsun?',
      trash_tolerance: 'Çöp toleransın ne kadar?',
      discovery_preferences: 'Seni ne kadar şaşırtalım?',
      disliked_genres: 'Hangilerini görünce kaçarsın?',
      movie_reactions: 'Filmler üzerinden anlaşalım.',
      exploration_preferences: 'Biraz daha açalım mı?',
      movie_knowledge_self_rating: 'Film kültürünü kendin kaç / 10 görüyorsun?',
      demographics: 'Seni biraz tanıyalım.'
    },
    priorities: {
      story: 'Hikâye', characters: 'Karakterler', atmosphere: 'Atmosfer', visuals: 'Görsellik',
      humor: 'Mizah', ideas: 'Fikir / düşündürmesi', pace: 'Tempo', music: 'Müzik',
      originality: 'Özgünlük', absurdity: 'Absürtlük'
    },
    intents: {
      have_fun: 'Eğlenmek', feel_tension: 'Gerilmek', be_surprised: 'Şaşırmak', think: 'Düşünmek',
      feel_emotion: 'Bir şeyler hissetmek', high_energy: 'Tempo / enerji', relax: 'Kafa dinlemek',
      embrace_absurdity: 'Saçmalığın tadını çıkarmak'
    },
    trashLabels: [
      'Kötü filme tahammülüm yok', 'Biraz saçmalık olabilir', 'Eğlenceliyse sorun değil',
      'Kötülüğü ayrı bir sanat', 'Çöpün dibini getir'
    ],
    discoveryLabels: ['Zevkime yakın kal', 'Biraz yakın', 'Dengeli', 'Biraz şaşırt', 'Beni şaşırt'],
    popularityLabels: ['Popüler / bilinen', 'Daha bilinen', 'Dengeli', 'Daha keşfedilmemiş', 'Gizli cevher'],
    scaleLabels: ['Çok az', 'Az', 'Orta', 'Yüksek', 'Çok yüksek'],
    knowledgeLabels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    runtimeLabels: {
      '60_90': '60–90 dk', '90_120': '90–120 dk', '120_150': '120–150 dk',
      '150_plus': '150 dk+', no_preference: 'Süre önemli değil'
    },
    ageLabels: {
      '13_17': '13–17', '18_24': '18–24', '25_34': '25–34', '35_44': '35–44',
      '45_54': '45–54', '55_plus': '55+', prefer_not_to_say: 'Söylemek istemiyorum'
    },
    genderLabels: {
      woman: 'Kadın', man: 'Erkek', non_binary: 'İkili cinsiyet dışında',
      another_identity: 'Başka bir kimlik', prefer_not_to_say: 'Söylemek istemiyorum'
    }
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
