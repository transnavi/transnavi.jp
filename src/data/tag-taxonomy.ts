// The controlled tag vocabulary as a (multi-parent) taxonomy tree. The same 25
// tag labels used on glossary terms (src/data/glossary.json) and content pages
// (src/data/page-tags.json) live here once, each with a URL slug and a place in
// the tree. Consumed by /tags/ (the drawn taxonomy tree) and /tags/<slug>/ (all
// items carrying a tag). A tag may sit under more than one branch — it is a
// poly-hierarchy ("multi tree"), not a strict tree.

export interface TagNode {
  /** Canonical Japanese label (matches the strings in glossary.json `tags`). */
  label: string;
  /** URL slug for /tags/<slug>/. */
  slug: string;
  /** One-line description shown on the tag page. */
  desc: string;
}

export interface TagBranch {
  label: string;
  tags: string[]; // tag labels under this branch
}

export interface TagFacet {
  key: string;
  label: string;
  desc: string;
  branches: TagBranch[];
}

// Flat registry: label -> { slug, desc }.
export const TAGS: Record<string, { slug: string; desc: string }> = {
  // body & medical
  'ホルモン療法': { slug: 'hormones', desc: '性ホルモンや、その薬・治療に関する言葉。' },
  '手術': { slug: 'surgery', desc: '性別適合手術など、外科的な手術に関する言葉。' },
  '検査・数値': { slug: 'labs', desc: '血液検査の項目や、体の状態をはかる数値。' },
  'からだ・解剖': { slug: 'anatomy', desc: 'からだの部位や、解剖に関する言葉。' },
  '薬': { slug: 'medication', desc: 'ホルモン剤や、その他の医薬品に関する言葉。' },
  '声': { slug: 'voice', desc: '声の高さ・響き・トレーニングや手術に関する言葉。' },
  '脱毛': { slug: 'hair-removal', desc: '医療脱毛など、毛の処理に関する言葉。' },
  // identity & orientation
  'アイデンティティ': { slug: 'identity', desc: '性のあり方・自分が何者かに関する言葉。' },
  '性的指向': { slug: 'orientation', desc: 'どんな性別の人に惹かれるか、に関する言葉。' },
  'ジェンダー表現': { slug: 'expression', desc: '服装・振る舞いなど、外への性の表し方。' },
  // life & society
  'カミングアウト': { slug: 'coming-out', desc: '打ち明けること・公表をめぐる言葉。' },
  '人間関係': { slug: 'relationships', desc: '家族・友人・周囲との関わりに関する言葉。' },
  'メンタルヘルス': { slug: 'mental-health', desc: 'こころの健康や、つらさに関する言葉。' },
  '法律・制度': { slug: 'law', desc: '戸籍・診断書・権利など制度に関する言葉。' },
  'コミュニティ文化': { slug: 'community', desc: '当事者コミュニティの文化や言い回し。' },
  // discrimination
  '差別・偏見': { slug: 'discrimination', desc: '偏見・差別・ハラスメントに関する言葉。' },
  '反トランスの主張': { slug: 'anti-trans', desc: 'トランスの権利に反対する主張に関する言葉。' },
  // population
  'MtF・女性化': { slug: 'transfeminine', desc: '出生時に男性と割り当てられ、女性化に関わる言葉。' },
  'FtM・男性化': { slug: 'transmasculine', desc: '出生時に女性と割り当てられ、男性化に関わる言葉。' },
  'ノンバイナリー': { slug: 'non-binary', desc: '男女の枠にとらわれないあり方に関する言葉。' },
  'インターセックス': { slug: 'intersex', desc: '生まれつきの体の性が典型と異なることに関する言葉。' },
  // register
  '医学用語': { slug: 'clinical', desc: '医療・臨床で使われる専門的な言葉。' },
  '当事者の言葉': { slug: 'community-term', desc: '当事者のあいだで使われる口語・俗語。' },
  '避けたい言い方': { slug: 'avoid', desc: '差別的・侮蔑的で、避けたほうがよい言い方。' },
  '歴史的な語': { slug: 'historical', desc: '古い・歴史的な言い方で、今はあまり使わない語。' },
};

// The drawn tree: facets -> branches -> tags. Some tags appear under more than
// one branch on purpose (poly-hierarchy).
export const FACETS: TagFacet[] = [
  {
    key: 'topic',
    label: '話題',
    desc: '何についての言葉か。',
    branches: [
      { label: 'からだと医療', tags: ['ホルモン療法', '薬', '手術', '検査・数値', 'からだ・解剖', '声', '脱毛'] },
      { label: 'アイデンティティと指向', tags: ['アイデンティティ', '性的指向', 'ジェンダー表現'] },
      { label: '暮らしと社会', tags: ['カミングアウト', '人間関係', 'メンタルヘルス', '法律・制度', 'コミュニティ文化'] },
      { label: '差別・反トランス', tags: ['差別・偏見', '反トランスの主張'] },
    ],
  },
  {
    key: 'population',
    label: '対象の人',
    desc: 'おもにどんな人に関わるか。',
    branches: [{ label: '対象の人', tags: ['MtF・女性化', 'FtM・男性化', 'ノンバイナリー', 'インターセックス'] }],
  },
  {
    key: 'register',
    label: '言葉の種類',
    desc: 'どんな性質の言葉か。',
    branches: [{ label: '言葉の種類', tags: ['医学用語', '当事者の言葉', 'コミュニティ文化', '避けたい言い方', '歴史的な語'] }],
  },
];

export const tagSlug = (label: string): string | undefined => TAGS[label]?.slug;
export const ALL_TAGS = Object.keys(TAGS);
export const slugToTag: Record<string, string> = Object.fromEntries(
  Object.entries(TAGS).map(([label, v]) => [v.slug, label]),
);
