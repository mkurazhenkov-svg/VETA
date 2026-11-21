// Контент приходит из виртуального модуля, собранного плагином Vite (см. vite.config.ts).
import raw from 'virtual:content';
import type { Content } from './schemas';

export const content: Content = raw as Content;
