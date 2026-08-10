import { Redirect } from 'expo-router';

export default function Index() {
  // Şimdilik test için direkt login sayfasına yönlendiriyoruz
  return <Redirect href="/(auth)/login" />;
}
