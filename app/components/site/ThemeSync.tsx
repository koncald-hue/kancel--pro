'use client';

import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

// Po načtení sjednotí třídu „dark“ s uloženou volbou (úvodní skript v <head> ji nastaví ještě před vykreslením)
export default function ThemeSync() {
    useEffect(() => { applyTheme(); }, []);
    return null;
}
