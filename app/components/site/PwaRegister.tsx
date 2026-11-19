'use client';

import { useEffect } from 'react';

// Registruje service worker (jen v ostrém provozu, ve vývoji by zdržoval změny)
export default function PwaRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => { /* aplikace funguje i bez toho */ });
    }, []);
    return null;
}
