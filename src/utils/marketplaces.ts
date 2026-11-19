export interface MarketplaceLink {
  id: 'ikea' | 'jysk' | 'otto' | 'google' | 'kleinanzeigen';
  label: string;
  url: string;
  kind: 'retail' | 'secondhand';
}

function toKleinanzeigenSlug(query: string): string {
  const normalized = query
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return normalized || 'moebel';
}

export function buildMarketplaceLinks(
  searchQuery: string,
  secondhandQuery?: string,
  includeSecondhand = false
): MarketplaceLink[] {
  const cleanQuery = searchQuery.trim();
  const encodedQuery = encodeURIComponent(cleanQuery);
  const usedSlug = toKleinanzeigenSlug(secondhandQuery?.trim() || cleanQuery);

  const retailLinks: MarketplaceLink[] = [
    {
      id: 'ikea',
      label: 'IKEA',
      url: `https://www.ikea.com/de/de/search/?q=${encodedQuery}`,
      kind: 'retail',
    },
    {
      id: 'jysk',
      label: 'JYSK',
      url: `https://jysk.de/search?query=${encodedQuery}`,
      kind: 'retail',
    },
    {
      id: 'otto',
      label: 'Otto',
      url: `https://www.otto.de/suche/${encodeURIComponent(cleanQuery.replace(/\s+/g, '-'))}/`,
      kind: 'retail',
    },
    {
      id: 'google',
      label: 'Google Shopping',
      url: `https://www.google.com/search?tbm=shop&hl=de&gl=de&q=${encodedQuery}`,
      kind: 'retail',
    },
  ];

  if (!includeSecondhand) {
    return retailLinks;
  }

  return [
    ...retailLinks,
    {
      id: 'kleinanzeigen',
      label: 'Kleinanzeigen',
      url: `https://www.kleinanzeigen.de/s-${usedSlug}/k0`,
      kind: 'secondhand',
    },
  ];
}
