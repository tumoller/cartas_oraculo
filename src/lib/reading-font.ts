const key = "oracle_reading_font_size";

export const readingFontSizes = [16, 18, 20, 22] as const;

export function getReadingFontSize(): number {
  try {
    const saved = Number(localStorage.getItem(key));
    return readingFontSizes.some((size) => size === saved) ? saved : 18;
  } catch {
    return 18;
  }
}

export function setReadingFontSize(size: number): void {
  document.documentElement.style.setProperty("--reading-font-size", `${size}px`);
  document.documentElement.style.setProperty("--ui-text-scale", String(size / 18));
  try { localStorage.setItem(key, String(size)); } catch { /* Reading remains adjustable without storage. */ }
}
