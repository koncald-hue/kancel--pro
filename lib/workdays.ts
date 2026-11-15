// České státní svátky a posun lhůt na nejbližší pracovní den
export const CZECH_FIXED_HOLIDAYS = [
    '01-01', '05-01', '05-08', '07-05', '07-06', '09-28', '10-28', '11-17', '12-24', '12-25', '12-26'
];

export function getEasterSunday(year: number) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

export function isWeekendOrHoliday(date: Date) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { isHoliday: true, reason: dayOfWeek === 0 ? 'Neděle' : 'Sobota' };
    }

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const monthDay = `${mm}-${dd}`;

    if (CZECH_FIXED_HOLIDAYS.includes(monthDay)) {
        return { isHoliday: true, reason: 'Státní svátek ČR' };
    }

    const easterSunday = getEasterSunday(yyyy);
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
    const easterMonday = new Date(easterSunday);
    easterMonday.setDate(easterSunday.getDate() + 1);

    if (date.toDateString() === goodFriday.toDateString()) return { isHoliday: true, reason: 'Velký pátek' };
    if (date.toDateString() === easterMonday.toDateString()) return { isHoliday: true, reason: 'Velikonoční pondělí' };

    return { isHoliday: false, reason: '' };
}

export function shiftToWorkingDay(date: Date) {
    const adjusted = new Date(date);
    let shifted = false;
    const initialCheck = isWeekendOrHoliday(adjusted);

    while (isWeekendOrHoliday(adjusted).isHoliday) {
        adjusted.setDate(adjusted.getDate() + 1);
        shifted = true;
    }

    return { 
        finalDate: adjusted, 
        wasShifted: shifted, 
        originalDayName: initialCheck.reason 
    };
}
