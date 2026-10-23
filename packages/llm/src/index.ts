import Anthropic from '@anthropic-ai/sdk';
import { requireConfig } from '@plicit/config';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

let cached: Anthropic | undefined;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = requireConfig('ANTHROPIC_API_KEY');
  cached = new Anthropic({ apiKey });
  return cached;
}

export type { Anthropic };
