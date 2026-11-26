const STORAGE_KEY = 'swb-welcome-seen';

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markWelcomeSeen(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}
