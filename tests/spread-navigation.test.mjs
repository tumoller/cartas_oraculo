import assert from "node:assert/strict";
import test from "node:test";
import { chapterForPosition, physicalChapter } from "../src/lib/spread-navigation.ts";
import { canReadChapter } from "../src/lib/reading-chapters.ts";

test("a carta revelada acompanha a linha física da mesa", () => {
  assert.deepEqual([1, 9, 10, 18, 19, 27, 28, 36].map((position) => physicalChapter(position, "grand36")), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.deepEqual([1, 3, 4, 6, 7, 9].map((position) => physicalChapter(position, "box9")), [0, 0, 1, 1, 2, 2]);
});

test("selecionar uma vizinha preserva o capítulo e seu recorte", () => {
  const rows = Array.from({length:4},(_,row)=>({positions:Array.from({length:9},(_,column)=>row*9+column+1)}));
  const sections = [...rows,{positions:[19,20,28,29]},{positions:[1,9,28,36]}];
  for (const position of [19,20,28,29]) assert.equal(chapterForPosition(sections,4,position),4);
  assert.equal(chapterForPosition(sections,4,8),0);
  assert.equal(chapterForPosition(sections,5,28),5);
  assert.equal(chapterForPosition(sections,0,12),1);
});

test("interpretação espera o grupo e textos antigos cruzados esperam a mesa", () => {
  assert.equal(canReadChapter("line3", "section1", [1,2,3], 2, 3), false);
  assert.equal(canReadChapter("line3", "section1", [1,2,3], 3, 3), true);
  assert.equal(canReadChapter("box9", "section1", [1,2,3], 3, 9), false);
  assert.equal(canReadChapter("box9", "section1", [1,2,3], 9, 9), true);
  assert.equal(canReadChapter("grand36", "section1", [1,2,3,4,5,6,7,8,9], 8, 36, "lenormand-grand36-v2"), false);
  assert.equal(canReadChapter("grand36", "section1", [1,2,3,4,5,6,7,8,9], 9, 36, "lenormand-grand36-v2"), true);
  assert.equal(canReadChapter("grand36", "section1", [1,2,3,4,5,6,7,8,9], 9, 36, "lenormand-grand36-v1"), false);
  assert.equal(canReadChapter("grand36", "section5", [1,2,10,11], 18, 36, "lenormand-grand36-v2"), false);
  assert.equal(canReadChapter("grand36", "synthesis", Array.from({length:36},(_,i)=>i+1), 36, 36), true);
});
