import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(cents: number | string): string {
  const amount = Number(cents) / 100;
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
