/**
 * Resolve a country flag emoji from free-text location
 * (e.g. "Mumbai, India", "New York, USA", "London").
 */

const COUNTRY_FLAGS = [
  { flag: '🇮🇳', label: 'India', names: ['india', 'bharat', 'ind', 'in'], cities: ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'pune', 'jaipur', 'ahmedabad', 'lucknow', 'goa', 'virar'] },
  { flag: '🇺🇸', label: 'USA', names: ['usa', 'united states', 'united states of america', 'us', 'america', 'u.s.', 'u.s.a.'], cities: ['new york', 'los angeles', 'chicago', 'houston', 'miami', 'seattle', 'boston', 'austin', 'san francisco', 'las vegas'] },
  { flag: '🇬🇧', label: 'UK', names: ['uk', 'united kingdom', 'britain', 'great britain', 'england', 'scotland', 'wales', 'gb'], cities: ['london', 'manchester', 'birmingham', 'liverpool', 'glasgow', 'edinburgh'] },
  { flag: '🇦🇺', label: 'Australia', names: ['australia', 'au', 'aus'], cities: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide'] },
  { flag: '🇨🇦', label: 'Canada', names: ['canada', 'ca', 'can'], cities: ['toronto', 'vancouver', 'montreal', 'calgary', 'ottawa'] },
  { flag: '🇯🇵', label: 'Japan', names: ['japan', 'jp', 'nippon'], cities: ['tokyo', 'osaka', 'kyoto', 'yokohama', 'nagoya'] },
  { flag: '🇩🇪', label: 'Germany', names: ['germany', 'deutschland', 'de', 'ger'], cities: ['berlin', 'munich', 'hamburg', 'frankfurt', 'cologne'] },
  { flag: '🇫🇷', label: 'France', names: ['france', 'fr'], cities: ['paris', 'lyon', 'marseille', 'nice', 'toulouse'] },
  { flag: '🇮🇹', label: 'Italy', names: ['italy', 'italia', 'it'], cities: ['rome', 'milan', 'naples', 'turin', 'florence'] },
  { flag: '🇪🇸', label: 'Spain', names: ['spain', 'españa', 'espana', 'es'], cities: ['madrid', 'barcelona', 'valencia', 'seville'] },
  { flag: '🇧🇷', label: 'Brazil', names: ['brazil', 'brasil', 'br'], cities: ['sao paulo', 'rio de janeiro', 'brasilia', 'salvador'] },
  { flag: '🇲🇽', label: 'Mexico', names: ['mexico', 'méxico', 'mx'], cities: ['mexico city', 'guadalajara', 'monterrey', 'cancun'] },
  { flag: '🇦🇪', label: 'UAE', names: ['uae', 'united arab emirates', 'emirates'], cities: ['dubai', 'abu dhabi', 'sharjah'] },
  { flag: '🇸🇦', label: 'Saudi Arabia', names: ['saudi arabia', 'saudi', 'ksa'], cities: ['riyadh', 'jeddah', 'dammam'] },
  { flag: '🇸🇬', label: 'Singapore', names: ['singapore', 'sg'], cities: ['singapore'] },
  { flag: '🇳🇿', label: 'New Zealand', names: ['new zealand', 'nz', 'aotearoa'], cities: ['auckland', 'wellington', 'christchurch'] },
  { flag: '🇹🇭', label: 'Thailand', names: ['thailand', 'th'], cities: ['bangkok', 'phuket', 'chiang mai'] },
  { flag: '🇵🇭', label: 'Philippines', names: ['philippines', 'ph', 'pilipinas'], cities: ['manila', 'cebu', 'davao'] },
  { flag: '🇰🇷', label: 'South Korea', names: ['south korea', 'korea', 'kr'], cities: ['seoul', 'busan', 'incheon'] },
  { flag: '🇨🇳', label: 'China', names: ['china', 'cn', 'prc'], cities: ['beijing', 'shanghai', 'shenzhen', 'guangzhou'] },
  { flag: '🇵🇰', label: 'Pakistan', names: ['pakistan', 'pk'], cities: ['karachi', 'lahore', 'islamabad'] },
  { flag: '🇧🇩', label: 'Bangladesh', names: ['bangladesh', 'bd'], cities: ['dhaka', 'chittagong'] },
  { flag: '🇱🇰', label: 'Sri Lanka', names: ['sri lanka', 'lk'], cities: ['colombo', 'kandy'] },
  { flag: '🇿🇦', label: 'South Africa', names: ['south africa', 'za'], cities: ['johannesburg', 'cape town', 'durban', 'pretoria'] },
  { flag: '🇳🇬', label: 'Nigeria', names: ['nigeria', 'ng'], cities: ['lagos', 'abuja'] },
  { flag: '🇦🇷', label: 'Argentina', names: ['argentina', 'ar'], cities: ['buenos aires', 'cordoba'] },
  { flag: '🇳🇱', label: 'Netherlands', names: ['netherlands', 'holland', 'nl'], cities: ['amsterdam', 'rotterdam'] },
  { flag: '🇵🇹', label: 'Portugal', names: ['portugal', 'pt'], cities: ['lisbon', 'porto'] },
  { flag: '🇮🇪', label: 'Ireland', names: ['ireland', 'ie', 'eire'], cities: ['dublin', 'cork'] },
  { flag: '🇸🇪', label: 'Sweden', names: ['sweden', 'se'], cities: ['stockholm', 'gothenburg'] },
  { flag: '🇳🇴', label: 'Norway', names: ['norway', 'no'], cities: ['oslo', 'bergen'] },
  { flag: '🇨🇭', label: 'Switzerland', names: ['switzerland', 'ch'], cities: ['zurich', 'geneva'] },
  { flag: '🇦🇹', label: 'Austria', names: ['austria', 'at'], cities: ['vienna', 'salzburg'] },
  { flag: '🇧🇪', label: 'Belgium', names: ['belgium', 'be'], cities: ['brussels', 'antwerp'] },
  { flag: '🇵🇱', label: 'Poland', names: ['poland', 'pl'], cities: ['warsaw', 'krakow'] },
  { flag: '🇹🇷', label: 'Turkey', names: ['turkey', 'türkiye', 'turkiye', 'tr'], cities: ['istanbul', 'ankara'] },
  { flag: '🇪🇬', label: 'Egypt', names: ['egypt', 'eg'], cities: ['cairo', 'alexandria'] },
  { flag: '🇮🇩', label: 'Indonesia', names: ['indonesia', 'id'], cities: ['jakarta', 'bali', 'surabaya'] },
  { flag: '🇲🇾', label: 'Malaysia', names: ['malaysia', 'my'], cities: ['kuala lumpur', 'penang'] },
  { flag: '🇻🇳', label: 'Vietnam', names: ['vietnam', 'vn'], cities: ['hanoi', 'ho chi minh', 'saigon'] },
  { flag: '🇷🇺', label: 'Russia', names: ['russia', 'ru'], cities: ['moscow', 'saint petersburg'] },
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} locationText
 * @returns {{ flag: string, country: string|null }}
 */
export function resolveLocationFlag(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return { flag: '', country: null };

  const normalized = normalize(raw);
  const parts = normalized
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // Prefer last segment as country ("Mumbai, India")
  const candidates = [...parts].reverse();

  for (const candidate of candidates) {
    for (const entry of COUNTRY_FLAGS) {
      if (entry.names.includes(candidate)) {
        return { flag: entry.flag, country: entry.label };
      }
    }
  }

  // Full-string contains country name
  for (const entry of COUNTRY_FLAGS) {
    for (const name of entry.names) {
      if (name.length < 3) continue;
      if (
        normalized === name ||
        normalized.endsWith(` ${name}`) ||
        normalized.includes(`, ${name}`)
      ) {
        return { flag: entry.flag, country: entry.label };
      }
    }
  }

  // City fallback
  for (const entry of COUNTRY_FLAGS) {
    for (const city of entry.cities) {
      if (
        normalized === city ||
        normalized.startsWith(`${city},`) ||
        normalized.startsWith(`${city} `) ||
        normalized.includes(` ${city}`)
      ) {
        return { flag: entry.flag, country: entry.label };
      }
    }
  }

  return { flag: '🌐', country: null };
}

export default resolveLocationFlag;
