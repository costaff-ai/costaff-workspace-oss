/**
 * Every assumption the workspace shell makes about the three frameworks.
 *
 * The shell is downstream of three independently released packages. When one of
 * them changes something we lean on, this file is what must break — loudly, and
 * naming the assumption — instead of the site quietly rendering wrong. Anything
 * coupled to a framework belongs here and nowhere else.
 *
 * The assumptions are ranked by how likely they are to move:
 *
 *   CLI flags, `base`, `home`   public config, semver-protected      low
 *   build output layout          conventional but undocumented        medium
 *   `meta` read by regex         same technique the frameworks use    medium
 *   design tokens                internal — so we derive, not copy    high
 */

export const CONTRACT_VERSION = 1;

/**
 * 一個「面」＝一個框架，加上工作區對它做的每一個假設。
 *
 * 這些 signature 是搬進 publisher 時補上的；行為一個字都沒動。型別存在的理由和
 * 這個檔案存在的理由一樣：框架改掉我們依賴的東西時，要在這裡大聲壞掉。
 */
export type Entry = {
  id: string;
  title?: string;
  subtitle?: string;
  description?: string;
  pageSize?: string;
};

export type Surface = {
  id: string;
  label: string;
  kindLabel: string;
  /** 專案裡放這種項目的資料夾。 */
  dir: string;
  cli: string;
  mount: string;
  type: 'spa' | 'files';
  stage: string;
  buildArgs: (out: string) => string[];
  /** 寫進暫存專案，讓單一項目以自己為根建置。 */
  itemConfig?: { file: string; body: (token: string) => string };
  itemRoute: (id: string) => string;
  metaFields: readonly string[];
  backLink?: string;
  wrap?: boolean;
  href: (id: string) => string;
  detail: (e: Entry) => string;
  paletteSource?: boolean;
};

export const SURFACES: Surface[] = [
  {
    id: 'docs',
    label: '文件',
    kindLabel: 'Document',
    dir: 'docs',
    cli: 'open-doc',
    mount: 'd',
    type: 'spa',
    stage: 'docs',
    buildArgs: (out: string) => ['build', '--out-dir', out],
    /** Written into the staged project so the item builds at its own root. */
    itemConfig: {
      file: 'open-doc.config.ts',
      /*
       * The document browser is switched off. A per-item bundle holds one
       * document, so its index is a list of one that the receiver redirects
       * past anyway — and while it was on, the viewer's back arrow was a
       * `<Link to="/">` into that index, which bounced straight back here.
       * Off, open-doc puts the theme toggle in the document header instead,
       * which is the only place a reader could reach it.
       *
       * `home` is deliberately not set: the workspace bar the receiver injects
       * is the way back, and a second arrow pointing at the same place — one
       * the bundle would have to bake an address for — is one too many.
       */
      body: (token: string) =>
        `export default {\n` +
        `  base: '/${token}/',\n` +
        `  build: { showDocBrowser: false },\n` +
        `};\n`,
    },
    /** Where the framework's own router puts the item once mounted at root. */
    itemRoute: (id: string) => `/d/${id}`,
    metaFields: ['title', 'subtitle', 'pageSize'],
    /*
     * The receiver's injected bar carries the way back. open-doc does NOT drop
     * its own arrow when the browser is off — showDocBrowser:false swaps `/`
     * for a 404 page and leaves the arrow pointing at it, so a reader sees two
     * back arrows and the inner one says Nothing here. The receiver hides that
     * link (BUNDLE_TRIM in content-bar.ts); this note is here because that is
     * the assumption, and this file is where assumptions about the frameworks
     * are supposed to be written down.
     */
    backLink: 'bar',
    href: (id: string) => `/d/d/${id}`,
    detail: (e: Entry) => `${e.pageSize ?? 'A4'} · open-doc`,
    /** The palette the shell adopts comes from this surface's built stylesheet. */
    paletteSource: true,
  },
  {
    id: 'sheets',
    label: '試算表',
    kindLabel: 'Workbook',
    dir: 'sheets',
    cli: 'open-sheet',
    mount: 's',
    type: 'files',
    stage: 'sheets',
    // open-sheet has no static-site build — `build` compiles to xlsx/csv, and
    // `--html` adds a self-contained page per workbook. The workspace wraps
    // that page in its own chrome (see `wrap`) rather than asking the export to
    // carry a link back, which would be dead once the file is downloaded.
    buildArgs: (out: string) => ['build', '--out', out, '--html'],
    itemRoute: () => '/',
    metaFields: ['title', 'description'],
    wrap: true,
    href: (id: string) => `/s/${id}/`,
    detail: () => 'HTML · xlsx · open-sheet',
  },
  {
    id: 'slides',
    label: '簡報',
    kindLabel: 'Deck',
    dir: 'slides',
    cli: 'open-slide',
    mount: 'p',
    type: 'spa',
    stage: 'slides',
    buildArgs: (out: string) => ['build', '--out-dir', out],
    itemConfig: {
      file: 'open-slide.config.ts',
      /*
       * Same reasoning as open-doc: one deck per bundle, so its browser is a
       * list of one and the back arrow that points at it only loops. open-slide
       * has no `home` option — not ours to add — and switching the browser off
       * removes that arrow, leaving the receiver's bar as the way back.
       */
      body: (token: string) =>
        `export default {\n` +
        `  base: '/${token}/',\n` +
        `  build: { showSlideBrowser: false },\n` +
        `};\n`,
    },
    itemRoute: (id: string) => `/s/${id}`,
    metaFields: ['title'],
    // Not ours to change: the deck viewer's back affordance is tied to its own
    // slide browser, so switching that browser off takes the arrow with it.
    // The receiver's bar carries the way back for every surface instead.
    backLink: 'bar',
    href: (id: string) => `/p/s/${id}`,
    detail: () => '16:9 · open-slide',
  },
];

/** Token names the shell reads out of the palette source's stylesheet. */
export const TOKENS = [
  'background',
  'foreground',
  'canvas',
  'muted',
  'muted-foreground',
  'accent',
  'border',
];

/**
 * Used only when extraction fails, so a framework reshuffling its stylesheet
 * degrades the shell to "slightly off" rather than "unreadable". The build
 * warns when this is in play.
 */
export const FALLBACK_PALETTE = {
  light: {
    background: 'oklch(99% 0 0)',
    foreground: 'oklch(14.5% 0 0)',
    canvas: 'oklch(93% 0 0)',
    muted: 'oklch(95.5% 0 0)',
    'muted-foreground': 'oklch(50% 0 0)',
    accent: 'oklch(94.5% 0 0)',
    border: 'oklch(90% 0 0)',
  },
  dark: {
    background: 'oklch(16% 0 0)',
    foreground: 'oklch(97% 0 0)',
    canvas: 'oklch(12% 0 0)',
    muted: 'oklch(24% 0 0)',
    'muted-foreground': 'oklch(68% 0 0)',
    accent: 'oklch(25% 0 0)',
    border: 'oklch(28% 0 0)',
  },
};

function readBlock(css: string, selector: string): Record<string, string> | null {
  const at = css.indexOf(`${selector}{`);
  if (at === -1) return null;
  const end = css.indexOf('}', at);
  if (end === -1) return null;
  const body = css.slice(at + selector.length + 1, end);
  const out: Record<string, string> = {};
  for (const decl of body.split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const name = decl.slice(0, colon).trim();
    if (!name.startsWith('--')) continue;
    out[name.slice(2)] = decl.slice(colon + 1).trim();
  }
  return out;
}

/**
 * Pulls the viewer's own palette out of its built stylesheet so the shell
 * tracks it. Copying the values would mean a palette change upstream silently
 * leaves the index looking like a different product — which is the whole thing
 * this integration is trying to avoid.
 */
export function extractPalette(css: string) {
  const light = readBlock(css, ':root');
  const dark = readBlock(css, '.dark');
  if (light === null || dark === null) {
    return { palette: FALLBACK_PALETTE, missing: TOKENS, derived: false };
  }
  const missing = TOKENS.filter((t) => light[t] === undefined || dark[t] === undefined);
  if (missing.length > 0) {
    return { palette: FALLBACK_PALETTE, missing, derived: false };
  }
  const pick = (src: Record<string, string>) => Object.fromEntries(TOKENS.map((t) => [t, src[t]]));
  return { palette: { light: pick(light), dark: pick(dark) }, missing: [], derived: true };
}

/**
 * next-themes with `attribute="class"` and no `storageKey`. The shell reads the
 * same key so toggling the theme inside a viewer carries back to the index —
 * two surfaces disagreeing about light or dark is the most visible way an
 * integration looks unintegrated.
 */
export const THEME = { storageKey: 'theme', darkClass: 'dark' };

/** Assumptions about a surface's build output, checked after every build. */
export function checkOutput(surface: Surface, files: string[]): string[] {
  const problems: string[] = [];
  if (surface.type === 'spa') {
    if (!files.includes('index.html')) {
      problems.push(`${surface.cli} build produced no index.html — the mount at /${surface.mount}/ needs one.`);
    }
    if (!files.some((f: string) => f.startsWith('assets/'))) {
      problems.push(`${surface.cli} build produced no assets/ directory — the base may have moved.`);
    }
  }
  if (surface.type === 'files' && !files.some((f: string) => f.endsWith('.html'))) {
    problems.push(`${surface.cli} build produced no .html — did --html stop working?`);
  }
  return problems;
}

/** The mounted SPA must reference its assets under its own mount, not the root. */
export function checkBase(surface: Surface, indexHtml: string): string[] {
  if (surface.type !== 'spa') return [];
  const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const wrong = refs.filter((r) => r.startsWith('/') && !r.startsWith(`/${surface.mount}/`));
  return wrong.length === 0
    ? []
    : [
        `${surface.cli} emitted root-absolute asset paths (${wrong.slice(0, 2).join(', ')}) — ` +
          `\`base: '/${surface.mount}/'\` did not take effect, so every asset will 404.`,
      ];
}
