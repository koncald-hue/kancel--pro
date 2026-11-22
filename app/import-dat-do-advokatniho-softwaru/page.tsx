import LandingTemplate from '@/app/components/seo/LandingTemplate';
import { landingMetadata, mustLanding } from '@/lib/seo/landingPage';

const page = mustLanding('import-dat-do-advokatniho-softwaru');
export const metadata = landingMetadata(page);
export default function Page() { return <LandingTemplate page={page} />; }
