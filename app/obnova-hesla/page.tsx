import type { Metadata } from 'next';
import PasswordReset from '@/app/components/site/PasswordReset';

export const metadata: Metadata = { title: 'Nové heslo | Kancelář Pro', robots: { index: false, follow: false } };

export default function Page() {
    return <PasswordReset />;
}
