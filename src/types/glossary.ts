export interface GlossaryEntry {
  id: string;
  term: string;
  abbr?: string;
  category: string;
  wikidata?: string;
  translations: {
    en?: string;
    zhHans?: string;
    zhHant?: string;
    es?: string;
    ko?: string;
    th?: string;
  };
  wikipedia?: {
    ja?: string;
    en?: string;
    zhHans?: string;
    zhHant?: string;
    ko?: string;
    th?: string;
    es?: string;
  };
  aliases: string[];
  /** Cross-cutting labels from a controlled vocabulary (topic / population /
   *  register), in addition to the single primary `category`. */
  tags: string[];
  avoid: string[];
  /** Alternative names for the same referent whose use is argued over. */
  disputedNames: string[];
  notes?: string;
  /** Where the meaning of the term itself is argued over: who it covers, who
   *  decides, and what turns on the answer. Rendered as its own block, so the
   *  disagreement sits beside the definition instead of inside it. */
  contested?: string;
  source?: string;
  /** Hand-curated related glossary ids (antonyms, complements, umbrella terms),
   *  rendered as 「関連することば」 ahead of the automatic category siblings. */
  seeAlso?: string[];
  /** Optional gentle message shown to readers (e.g. a self-compassion note). */
  message?: string;
}
