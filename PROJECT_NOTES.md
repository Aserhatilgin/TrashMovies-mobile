# 🗑️ TrashMovies - Proje Rehberi ve Mimarisi

## 🎯 Proje Vizyonu
TrashMovies, "kötü filmleri" (çöp filmler) listeleyen, kullanıcıların bu filmleri oyladığı, günlük mini sinema trivia oyunları oynadığı ve streak (seri) yaptığı oyunlaştırılmış (gamified) bir platformdur.

## 🛠️ Teknoloji Yığını (Tech Stack)
- **Backend & Veritabanı:** Supabase (PostgreSQL, Supabase Auth)
- **Web:** Next.js (App Router, Tailwind CSS)
- **Mobile:** React Native (Expo, Expo Router)
- **State Management:** Redux Toolkit
- **Tasarım Dili:** Koyu tema (Dark Mode) ağırlıklı, kırmızı/siyah tonlar.

## 📁 Mobil Klasör Mimarisi
Tüm geliştirme `src/` klasörü içinde yapılacaktır:
- `src/app/`: Expo Router sayfaları ve navigasyon (Drawer ve Tabs).
  - `(auth)`: Login, Register gibi giriş sayfaları.
  - `(tabs)`: Ana Sayfa, Kategoriler, Oyunlar, Profil.
- `src/components/`: Yeniden kullanılabilir UI bileşenleri.
- `src/constants/`: Renkler (`Colors.ts`) ve Dil sözlükleri (`Translations.ts`).
- `src/lib/`: Supabase client (`supabase.ts`) ve API istekleri.
- `src/store/`: Redux slice'ları.

## ⚠️ Kesin Kodlama Kuralları (AI Asistanı İçin)
1. **ASLA** sayfa içinde doğrudan renk kodu (hex, rgb) kullanma. Her zaman `src/constants/Colors.ts` dosyasındaki `theme` objesinden çek.
2. **ASLA** sayfa içine doğrudan statik metin (Türkçe/İngilizce) yazma. Her zaman `src/constants/Translations.ts` dosyasından `lang` objesini kullan.
3. **Yönlendirmeler:** React Navigation yerine her zaman `expo-router` (`useRouter`, `Link`) kullan.

## 📱 Temel Ekranlar ve Özellikler
- **Ana Sayfa:** Günün çöp filmi önerisi ve sağ üstte 🔥 Streak (Seri) sayacı.
- **Kategoriler:** Oyunculuk, senaryo, görsel efekt faciaları gibi alt başlıklar.
- **Oyun Alanı:** 2-3 dakikalık film tahmin/trivia oyunları (Günlük haklı).
- **Profil:** Kullanıcı seviyesi, oyun puanları, ayarlar.