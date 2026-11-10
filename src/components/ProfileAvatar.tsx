import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';

interface ProfileAvatarProps {
  initial: string;
  photoUri?: string;
  size?: number;
}

/** Foto de perfil (guardada só no aparelho) ou a inicial do nome. */
export function ProfileAvatar({ initial, photoUri, size = 62 }: ProfileAvatarProps) {
  const { colors, fonts } = useAppTheme();
  const [failedUri, setFailedUri] = useState<string>();
  const round = { width: size, height: size, borderRadius: size / 2 };
  const showPhoto = Boolean(photoUri) && failedUri !== photoUri;

  return (
    <View style={[styles.base, round, { backgroundColor: colors.primary }]}>
      {showPhoto ? (
        <Image source={{ uri: photoUri }} onError={() => setFailedUri(photoUri)} style={round} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ color: colors.primaryText, fontFamily: fonts.bold, fontSize: Math.round(size * 0.44) }}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
