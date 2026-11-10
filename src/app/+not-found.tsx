import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <EmptyState
        icon="compass-outline"
        title="Página não encontrada"
        description="Este caminho não existe ou o conteúdo foi movido."
      />
      <Button label="Voltar ao início" onPress={() => router.replace('/')} style={{ marginHorizontal: 40 }} />
    </Screen>
  );
}
