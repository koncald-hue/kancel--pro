import { redirect } from 'next/navigation';

// Sdílení souborů se sloučilo do šifrovaného chatu kanceláře
export default function Page() {
    redirect('/kancelar/chat');
}
