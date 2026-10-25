export function physicalChapter(position: number, spread?: string): number {
  const columns = spread === "grand36" ? 9 : 3;
  return Math.floor((position - 1) / columns);
}

export function chapterForPosition(sections: ReadonlyArray<{ positions: readonly number[] }>, activeChapter: number, position: number): number {
  return sections[activeChapter]?.positions.includes(position) ? activeChapter : sections.findIndex((section) => section.positions.includes(position));
}
