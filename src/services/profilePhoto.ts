// Foto de perfil: escolhida na galeria e copiada para a pasta do app. Fica só no aparelho, nunca é enviada.
import { Platform } from 'react-native';

const PHOTO_PREFIX = 'profile-photo-';

/** Abre a galeria (recorte quadrado). Devolve o endereço da cópia guardada no app ou `null` se a pessoa cancelar. */
export async function pickProfilePhoto(): Promise<string | null> {
  const ImagePicker = await import('expo-image-picker');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // Na web não há pasta do app: usa o endereço que a galeria devolveu.
  if (Platform.OS === 'web') return asset.uri;
  const { File, Paths } = await import('expo-file-system');
  const destination = new File(Paths.document, `${PHOTO_PREFIX}${Date.now()}.jpg`);
  await new File(asset.uri).copy(destination);
  return destination.uri;
}

/** Apaga a cópia guardada pelo app (só arquivos criados por `pickProfilePhoto`). */
export async function removeProfilePhoto(uri: string | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web' || !uri.includes(PHOTO_PREFIX)) return;
  const { File } = await import('expo-file-system');
  const file = new File(uri);
  if (file.exists) file.delete();
}
