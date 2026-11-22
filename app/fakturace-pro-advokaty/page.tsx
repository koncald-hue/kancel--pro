import LandingTemplate from '@/app/components/seo/LandingTemplate';
import { landingMetadata, mustLanding } from '@/lib/seo/landingPage';

const page = mustLanding('fakturace-pro-advokaty');
export const metadata = landingMetadata(page);
export default function Page() { return <LandingTemplate page={page} />; }
