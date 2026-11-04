const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Date parts of an ISO UTC timestamp, shown in Japan Standard Time (UTC+9, no DST). */
export function jst(isoUtc: string) {
  const d = new Date(new Date(isoUtc).getTime() + 9 * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    monthEn: MONTHS[d.getUTCMonth()],
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  }
}

export function utcTime(isoUtc: string) {
  return isoUtc.slice(11, 16)
}

export function latLng(lat: number, lng: number) {
  return `${lat.toFixed(4)}°N  ${lng.toFixed(4)}°E`
}
