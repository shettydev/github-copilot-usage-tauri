import { invoke } from '@tauri-apps/api/core';

export const SECRET_SERVICE = 'github-copilot-usage-app';
export const ANTHROPIC_API_KEY_SECRET = 'anthropic_api_key';

export async function storeSecret(key: string, value: string): Promise<void> {
  await invoke('store_secret', {
    service: SECRET_SERVICE,
    key,
    value,
  });
}

export async function getSecret(key: string): Promise<string | null> {
  const result = await invoke<string | null>('get_secret', {
    service: SECRET_SERVICE,
    key,
  });
  return result;
}

export async function deleteSecret(key: string): Promise<void> {
  await invoke('delete_secret', {
    service: SECRET_SERVICE,
    key,
  });
}

export async function storeAnthropicApiKey(apiKey: string): Promise<void> {
  await storeSecret(ANTHROPIC_API_KEY_SECRET, apiKey);
}

export async function getAnthropicApiKey(): Promise<string | null> {
  return getSecret(ANTHROPIC_API_KEY_SECRET);
}

export async function deleteAnthropicApiKey(): Promise<void> {
  await deleteSecret(ANTHROPIC_API_KEY_SECRET);
}
