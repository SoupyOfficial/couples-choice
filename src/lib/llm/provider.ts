import { createDeepSeek } from '@ai-sdk/deepseek';

export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
});

export const LLM_MODEL = deepseek('deepseek-v4-flash');
