import type { Metadata } from 'next';
import LawyerShell from '@/app/components/lawyer/LawyerShell';
import AuditLogView from '@/app/components/lawyer/AuditLogView';

export const metadata: Metadata = { title: 'Auditní záznam | Kancelář Pro', robots: { index: false } };

export default function Page() {
    return <LawyerShell active="nastaveni"><AuditLogView /></LawyerShell>;
}
