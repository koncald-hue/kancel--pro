'use client';

import CaseFolder from '../situation/CaseFolder';

// Věci kanceláře: stejný spis jako u občanů, v přehledné tabulce s klientem, značkou a lhůtou
export default function LawyerCases() {
    return <CaseFolder variant="office" />;
}
