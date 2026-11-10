// Segredos do app (chaves de API, tokens, PIN). No Android/iOS ficam no SecureStore
// (Keystore/Keychain). No Web não existe SecureStore: caem no armazenamento do
// navegador, sem criptografia, e as telas avisam.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const SECRETS_ARE_ENCRYPTED = Platform.OS !== 'web';

/** Chaves aceitas pelo SecureStore: letras, números, ".", "-" e "_". */
function assertValidKey(key: string) {
  if (!/^[\w.-]+$/.test(key)) throw new Error(`Chave de segredo inválida: ${key}`);
}

export async function getSecret(key: string): Promise<string> {
  assertValidKey(key);
  const value = SECRETS_ARE_ENCRYPTED ? await SecureStore.getItemAsync(key) : await AsyncStorage.getItem(key);
  return value ?? '';
}

export async function setSecret(key: string, value: string): Promise<void> {
  assertValidKey(key);
  if (!value) return deleteSecret(key);
  if (SECRETS_ARE_ENCRYPTED) await SecureStore.setItemAsync(key, value);
  else await AsyncStorage.setItem(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  assertValidKey(key);
  if (SECRETS_ARE_ENCRYPTED) await SecureStore.deleteItemAsync(key);
  else await AsyncStorage.removeItem(key);
}
