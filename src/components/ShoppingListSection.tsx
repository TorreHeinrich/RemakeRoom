import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import { ShoppingListResult } from '../types';
import { buildMarketplaceLinks } from '../utils/marketplaces';

interface ShoppingListSectionProps {
  shoppingList: ShoppingListResult | null;
  isLoading: boolean;
  checkedItemIds: string[];
  includeSecondhand: boolean;
  onToggleItemChecked: (id: string) => void;
  onToggleSecondhand: (include: boolean) => void;
}

export const ShoppingListSection: React.FC<ShoppingListSectionProps> = ({
  shoppingList,
  isLoading,
  checkedItemIds,
  includeSecondhand,
  onToggleItemChecked,
  onToggleSecondhand,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [copied, setCopied] = useState(false);

  const categories = useMemo(() => {
    if (!shoppingList) return ['Alle'];
    const unique = Array.from(new Set(shoppingList.items.map((item) => item.category)));
    return ['Alle', ...unique];
  }, [shoppingList]);

  const filteredItems = useMemo(() => {
    if (!shoppingList) return [];
    if (selectedCategory === 'Alle') return shoppingList.items;
    return shoppingList.items.filter((item) => item.category === selectedCategory);
  }, [shoppingList, selectedCategory]);

  const remainingTotals = useMemo(() => {
    if (!shoppingList) return { min: 0, max: 0 };
    return shoppingList.items
      .filter((item) => !checkedItemIds.includes(item.id))
      .reduce(
        (acc, item) => ({
          min: acc.min + item.estimatedMinEur,
          max: acc.max + item.estimatedMaxEur,
        }),
        { min: 0, max: 0 }
      );
  }, [shoppingList, checkedItemIds]);

  if (!isLoading && !shoppingList) {
    return null;
  }

  const handleCopyText = async () => {
    if (!shoppingList) return;
    const lines = [
      `Raumstudio Einkaufsliste (Entwurf v${shoppingList.approvedVersion})`,
      `Geschätztes Budget: ${shoppingList.totalMinEur} € – ${shoppingList.totalMaxEur} €`,
      `Beibehalten: ${shoppingList.keptItemsNote}`,
      '',
      ...shoppingList.items.map((item, idx) => {
        const links = buildMarketplaceLinks(
          item.searchQuery,
          item.secondhandQuery,
          includeSecondhand
        )
          .map((l) => `${l.label}: ${l.url}`)
          .join(' | ');
        return `${idx + 1}. ${item.name} (${item.category}) — ca. ${item.estimatedMinEur} € – ${item.estimatedMaxEur} €\n   ${item.description}\n   Suche: ${links}`;
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback via unsichtbares Textarea falls Clipboard-API eingeschränkt ist
      const textarea = document.createElement('textarea');
      textarea.value = lines.join('\n');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadCsv = () => {
    if (!shoppingList) return;
    const escapeCsv = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const headers = [
      'Artikel',
      'Kategorie',
      'Beschreibung',
      'Min EUR',
      'Max EUR',
      'Suchbegriff',
      'IKEA',
      'JYSK',
      'Otto',
      'Google Shopping',
      ...(includeSecondhand ? ['Kleinanzeigen'] : []),
    ];

    const rows = shoppingList.items.map((item) => {
      const links = buildMarketplaceLinks(
        item.searchQuery,
        item.secondhandQuery,
        includeSecondhand
      );
      return [
        escapeCsv(item.name),
        escapeCsv(item.category),
        escapeCsv(item.description),
        item.estimatedMinEur,
        item.estimatedMaxEur,
        escapeCsv(item.searchQuery),
        ...links.map((l) => escapeCsv(l.url)),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raumstudio-einkaufsliste-v${shoppingList.approvedVersion}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="einkaufsliste"
      className="bg-white border border-[#E7E5E4] rounded-xl p-6 lg:p-8 flex flex-col gap-6"
    >
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="w-6 h-6 text-[#18181B] animate-spin" aria-hidden="true" />
          <p className="font-display text-lg text-[#18181B]">
            Einkaufsliste wird aus dem Entwurf abgeleitet …
          </p>
          <p className="text-xs text-[#52525B] max-w-md">
            Originalraum und freigegebener Entwurf werden verglichen, damit nur tatsächlich neue
            oder geänderte Gegenstände auf der Liste erscheinen.
          </p>
        </div>
      ) : shoppingList ? (
        <>
          {/* Kopfzeile & Budgetübersicht */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E7E5E4]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-[#71717A]">
                <span className="font-mono tabular-nums">
                  Freigegeben: Entwurf v{shoppingList.approvedVersion}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{shoppingList.items.length} Positionen</span>
              </div>
              <h2 className="font-display text-2xl font-medium text-[#18181B]">
                Einkaufsliste · Günstigste Optionen
              </h2>
              <p className="text-sm text-[#52525B] max-w-2xl leading-relaxed">
                {shoppingList.summary}
              </p>
            </div>

            <div className="flex flex-col lg:items-end gap-1 shrink-0">
              <span className="text-xs text-[#71717A]">Geschätztes Gesamtbudget</span>
              <span className="font-mono text-2xl font-medium text-[#18181B] tabular-nums">
                {remainingTotals.min} € – {remainingTotals.max} €
              </span>
              {checkedItemIds.length > 0 && (
                <span className="text-xs text-[#71717A] font-mono tabular-nums">
                  Gesamt ohne Abzug: {shoppingList.totalMinEur} € – {shoppingList.totalMaxEur} €
                </span>
              )}
            </div>
          </div>

          {/* Transparenzhinweis & Bestandsbestätigung */}
          <div className="bg-[#FAF9F6] border border-[#E7E5E4] rounded-lg p-4 flex flex-col gap-2 text-xs text-[#52525B] leading-relaxed">
            <p>
              <strong className="font-medium text-[#18181B]">Beibehaltener Bestand:</strong>{' '}
              {shoppingList.keptItemsNote}
            </p>
            <p>
              <strong className="font-medium text-[#18181B]">Preistransparenz:</strong> Alle
              Euro-Angaben sind unverbindliche Schätzwerte für preiswerte Neuware. Die Suchlinks
              führen direkt zu vorbefüllten Suchergebnissen deutscher Händler zum sofortigen
              Preisvergleich.
            </p>
          </div>

          {/* Filter & Exportleiste */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                role="group"
                aria-label="Kategorien filtern"
                className="flex flex-wrap items-center gap-1 p-1 bg-[#F4F4F2] rounded-lg"
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-white text-[#18181B] border border-[#E7E5E4]'
                        : 'text-[#52525B] hover:text-[#18181B]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#3F3F46] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSecondhand}
                  onChange={(e) => onToggleSecondhand(e.target.checked)}
                  className="w-4 h-4 accent-[#18181B] rounded cursor-pointer"
                />
                <span>Kleinanzeigen (Gebraucht) einblenden</span>
              </label>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#18181B] bg-white border border-[#D4D4D8] rounded-lg hover:bg-[#F4F4F2] transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Kopiert</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Liste kopieren</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#FAF9F6] bg-[#18181B] rounded-lg hover:bg-[#27272A] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Als CSV exportieren</span>
              </button>
            </div>
          </div>

          {/* Artikelliste */}
          <div className="divide-y divide-[#E7E5E4] border-t border-[#E7E5E4]">
            {filteredItems.map((item) => {
              const isChecked = checkedItemIds.includes(item.id);
              const links = buildMarketplaceLinks(
                item.searchQuery,
                item.secondhandQuery,
                includeSecondhand
              );

              return (
                <div
                  key={item.id}
                  className={`py-5 flex flex-col gap-3 transition-opacity ${
                    isChecked ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleItemChecked(item.id)}
                        aria-label={`${item.name} als erledigt markieren`}
                        className="mt-1 w-4 h-4 accent-[#18181B] rounded cursor-pointer shrink-0"
                      />
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <h3
                            className={`text-base font-medium text-[#18181B] ${
                              isChecked ? 'line-through' : ''
                            }`}
                          >
                            {item.name}
                          </h3>
                          <span className="text-xs text-[#71717A]">· {item.category}</span>
                        </div>
                        <p className="text-sm text-[#52525B] leading-relaxed">{item.description}</p>
                      </div>
                    </div>

                    <div className="sm:text-right shrink-0 pl-7 sm:pl-4">
                      <span className="font-mono text-sm font-medium text-[#18181B] tabular-nums whitespace-nowrap">
                        ca. {item.estimatedMinEur} € – {item.estimatedMaxEur} €
                      </span>
                    </div>
                  </div>

                  {/* Suchlinks zu Händlern */}
                  <div className="pl-7 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#71717A] mr-1">Günstig suchen:</span>
                    {links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                          link.kind === 'secondhand'
                            ? 'bg-[#FAF9F6] text-[#3F3F46] border-dashed border-[#A1A1AA] hover:border-[#18181B] hover:text-[#18181B]'
                            : 'bg-[#FAF9F6] text-[#18181B] border-[#E7E5E4] hover:bg-[#F4F4F2] hover:border-[#D4D4D8]'
                        }`}
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="w-3 h-3 text-[#71717A]" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
};
