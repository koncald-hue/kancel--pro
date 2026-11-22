import LandingTemplate from '@/app/components/seo/LandingTemplate';
import { landingMetadata, mustLanding } from '@/lib/seo/landingPage';

const page = mustLanding('kontrola-stretu-zajmu');
export const metadata = landingMetadata(page);
export default function Page() { return <LandingTemplate page={page} />; }
