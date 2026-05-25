import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function pick(n: number): string {
  const bytes = randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateJoinCode(): string {
  return `${pick(3)}-${pick(3)}`;
}
