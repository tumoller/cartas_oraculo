const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
function load(file, overrides = {}) {
  const filename = path.resolve(file);
  const module = new Module(filename);
  module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  module.require = (id) => {
    if (id in overrides) return overrides[id];
    if (id.startsWith('@/') && id.endsWith('.json')) return require('../src/' + id.slice(2));
    if (id.startsWith('@/')) return load('src/' + id.slice(2) + '.ts', overrides);
    if (id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(filename),id + '.ts'))) return load(path.resolve(path.dirname(filename),id + '.ts'), overrides);
    return Module.prototype.require.call(module,id);
  };
  module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return module.exports;
}
const cards = require('../src/data/baralho.json');

test('nova consulta cigana preserva a carta 28 e inclui sua arte corrigida', async () => {
  const prior = process.env.ORACLE_ACCESS_SECRET;
  process.env.ORACLE_ACCESS_SECRET = 'test-only-secret';
  let saved;
  const drawn = [cards.find(card => card.id === 28), ...cards.slice(0, 4)];
  const reading = {card1Reading:'um',card2Reading:'dois',card3Teaser:'três'};
  const route = load('src/app/api/reading/start/route.ts', {
    '@/lib/paid-part': {paidPartReady:()=>true,startPaidPart:()=>{},waitPaidPart:async()=>null},
    '@/lib/prisma': {prisma: {readingSession: {
      findUnique: async () => undefined,
      create: async ({data}) => (saved = {...data, createdAt:new Date()}),
      update: async ({data}) => (saved = {...saved, ...data}),
    }}},
    '@/lib/draw': {drawDistinctCards: () => drawn},
    '@/lib/gemini': {generateFreeReading: async () => reading},
  });
  try {
    const response = await route.POST(new NextRequest('http://localhost/api/reading/start', {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
        userName:'Teste', persona:'Cigana Tradicional', theme:'Amor & Relacionamento',
        requestId:'33333333-3333-4333-8333-333333333333', requestKey:'44444444-4444-4444-8444-444444444444',
      }),
    }));
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.cardsDrawn[0].id, 28);
    assert.equal(result.cardsDrawn[0].imageUrl, '/cards/cigano/card-28.jpg');
    assert.deepEqual(saved.cardsDrawn.map(card => card.id), drawn.map(card => card.id));
    assert.equal(result.cardsDrawn[3].imageUrl, null);
  } finally {
    if (prior === undefined) delete process.env.ORACLE_ACCESS_SECRET; else process.env.ORACLE_ACCESS_SECRET = prior;
  }
});
test('nome da carta 11 acompanha a arte cigana sem alterar outros baralhos ou o acervo', () => {
  const {cardNameForDeck} = load('src/lib/card-name.ts');
  const card = cards.find(c => c.id === 11);
  assert.equal(cardNameForDeck(card, 'Cigana Tradicional'), '11. A Vassoura');
  assert.equal(cardNameForDeck(card, 'Linha de Umbanda'), '11. O Chicote');
  const {sanitizeReadingSession} = load('src/lib/sanitize.ts');
  const session = {id:'test',userName:'Teste',persona:'Cigana Tradicional',theme:'Amor',cardsDrawn:[card],aiReading:{},isPaid:true,createdAt:new Date()};
  assert.equal(sanitizeReadingSession(session).cardsDrawn[0].name, '11. A Vassoura');
  assert.equal(card.name, '11. O Chicote');
});
test('mesa de 36 preserva todas as posições e vizinhança não atravessa linha', () => {
  const {spreadSections} = load('src/lib/spreads.ts');
  const deck = [...cards]; const heart = deck.findIndex(c=>c.id===24); [deck[8],deck[heart]]=[deck[heart],deck[8]];
  const plan = spreadSections('grand36',deck,'Amor & Relacionamento');
  assert.deepEqual(plan[4].positions,[8,9,17,18]);
  assert.equal(new Set(plan.slice(0,4).flatMap(s=>s.positions)).size,36);
  assert.equal(plan[4].title,'Vizinhança do tema · mesa de 36 cartas');
  assert.equal(plan[5].title,'Os quatro cantos da mesa');
  assert.deepEqual(plan[5].positions,[1,9,28,36]);
  const box = spreadSections('box9',deck.slice(0,9),'Amor & Relacionamento');
  assert.deepEqual(box.slice(0,3).map(s=>s.positions),[[1,2,3],[4,5,6],[7,8,9]]);
  assert.deepEqual(box[3].positions,[1,4,7,2,5,8,3,6,9]);
  assert.deepEqual(box[4].positions,[1,5,9,3,7]);
  assert.deepEqual(spreadSections('box9',deck.slice(0,9),'Amor & Relacionamento','basic').map(s=>s.id),['section1','section2','section3']);
  assert.deepEqual(spreadSections('grand36',deck,'Amor & Relacionamento','basic').map(s=>s.id),['section1','section2','section3','section4']);
  assert.equal(box[3].title,'Colunas e carta central');
  assert.equal(box[4].title,'Diagonais do quadro');
  assert.deepEqual(spreadSections('line3',deck.slice(0,3),'Amor & Relacionamento').map(s=>s.positions),[[1,2,3]]);
  assert.throws(()=>spreadSections('line5',deck,'Amor & Relacionamento'));
  const {drawDistinctCards} = load('src/lib/draw.ts');
  assert.equal(new Set(drawDistinctCards(36).map(c=>c.id)).size,36);
});

test('profundidade básica é salva, aplicada na geração e não entrega relações extras', async () => {
  const oldDemo = process.env.ORACLE_DEMO_MODE;
  const oldSecret = process.env.ORACLE_ACCESS_SECRET;
  const oldEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  process.env.ORACLE_DEMO_MODE = 'true';
  process.env.ORACLE_ACCESS_SECRET = 'test-only-secret';
  let state; const generatedDepths=[];
  const db = {readingSession:{findUnique:async()=>state,create:async({data})=>(state={...data,createdAt:new Date()}),update:async({data})=>(state={...state,...data}),updateMany:async({data})=>{state={...state,...data};return {count:1}}}};
  const route = load('src/app/api/reading/start/route.ts', {
    '@/lib/paid-part': {paidPartReady:()=>true,startPaidPart:()=>{},waitPaidPart:async()=>null},
    '@/lib/prisma':{prisma:db},
    '@/lib/draw':{drawDistinctCards:()=>cards.slice(0,9)},
    '@/lib/spreads':{SPREADS:load('src/lib/spread-config.ts').SPREADS,generateSpreadReading:async({readingDepth})=>{
      generatedDepths.push(readingDepth);
      return {sections:[
        ...[1,2,3].map(n=>({id:`section${n}`,title:`Linha ${n}`,positions:[n],text:`Linha ${n}`})),
        {id:'section4',title:'Colunas',positions:[1,4,7],text:'Não entregar'},
      ],cardNotes:[],generalSynthesis:'Síntese básica'};
    }},
  });
  const body={userName:'Teste',persona:'Oráculo da Galáxia',theme:'Amor & Relacionamento',spread:'box9',readingDepth:'basic',demoAccess:true,requestId:'55555555-5555-4555-8555-555555555555',requestKey:'66666666-6666-4666-8666-666666666666'};
  const request=()=>new NextRequest('http://localhost/api/reading/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try {
    const response=await route.POST(request());
    assert.equal(response.status,201);
    const result=await response.json();
    assert.deepEqual(generatedDepths,['basic']);
    assert.equal(result.readingDepth,'basic');
    assert.deepEqual(result.sections.map(s=>s.id),['section1','section2','section3']);
    assert.equal(state.aiReading.readingDepth,'basic');
    const repeat=await route.POST(request());
    assert.equal(repeat.status,200);
    assert.deepEqual((await repeat.json()).sections,result.sections);
    state.aiReading={...state.aiReading,status:'failed'};
    const retry=await route.POST(new NextRequest('http://localhost/api/reading/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,readingDepth:'complete'})}));
    assert.equal(retry.status,201);
    assert.deepEqual(generatedDepths,['basic','basic']);
    assert.equal((await retry.json()).readingDepth,'basic');
    const invalid=await route.POST(new NextRequest('http://localhost/api/reading/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,readingDepth:'premium'})}));
    assert.equal(invalid.status,400);
  } finally {
    if(oldDemo===undefined) delete process.env.ORACLE_DEMO_MODE; else process.env.ORACLE_DEMO_MODE=oldDemo;
    if(oldSecret===undefined) delete process.env.ORACLE_ACCESS_SECRET; else process.env.ORACLE_ACCESS_SECRET=oldSecret;
    if(oldEnv===undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=oldEnv;
  }
});

test('vizinhança do tema respeita canto, interior e borda da mesa de 36', () => {
  const {spreadSections} = load('src/lib/spreads.ts');
  const cases = [
    {theme:'Trabalho & Dinheiro',id:34,position:28,expected:[19,20,28,29]},
    {theme:'Amor & Relacionamento',id:24,position:14,expected:[4,5,6,13,14,15,22,23,24]},
    {theme:'Amizades & Caminhos',id:22,position:5,expected:[4,5,6,13,14,15]},
  ];
  for (const {theme,id,position,expected} of cases) {
    const deck = [...cards];
    const focus = deck.findIndex(card => card.id === id);
    [deck[position - 1],deck[focus]] = [deck[focus],deck[position - 1]];
    const originalIds = deck.map(card => card.id);
    const sections = spreadSections('grand36',deck,theme);
    assert.deepEqual(sections[4].positions,expected);
    assert.equal(new Set(sections[4].positions).size,expected.length);
    assert.deepEqual(sections.slice(0,4).flatMap(section => section.positions),Array.from({length:36},(_,index)=>index+1));
    assert.deepEqual(deck.map(card => card.id),originalIds);
  }
});
test('apresentação de capítulos salvos altera só o título e distingue a mesa de 36', () => {
  const {presentationSections,chapterHint} = load('src/lib/reading-chapters.ts');
  const saved = [{id:'section5',title:'O tema e suas cartas vizinhas',positions:[8,9,17,18],text:'Leitura já salva.'}];
  const presented = presentationSections('grand36',saved);
  assert.equal(presented[0].title,'Vizinhança do tema · mesa de 36 cartas');
  assert.equal(presented[0].text,saved[0].text);
  assert.deepEqual(presented[0].positions,saved[0].positions);
  assert.equal(saved[0].title,'O tema e suas cartas vizinhas');
  assert.match(chapterHint('grand36','section5'),/mesa de 36/);
  assert.match(chapterHint('box9','section5'),/diagonais/);
  assert.deepEqual(presentationSections('line5',saved),saved);
});

test('áudio só entra na fila com pedido explícito de capítulo permitido', async () => {
  const reading = {spread:'line5',generalSynthesis:'Leitura conjunta',card1Reading:'Carta antiga'};
  const session = {isPaid:true,persona:'Oráculo da Galáxia',aiReading:reading};
  const realAudio = load('src/lib/audio.ts');
  const queued = [];
  const route = load('src/app/api/reading/[id]/audio/route.ts', {
    '@/lib/prisma':{prisma:{readingSession:{findUnique:async()=>session}}},
    '@/lib/reading-access':{requireReadingAccess:()=>true},
    '@/lib/audio':{...realAudio,enqueueAudio:async(job)=>queued.push(job),audioStatus:async()=> 'pending'},
  });
  const request = (body) => new NextRequest('http://localhost/api/reading/test/audio', {method:'POST',headers:{'content-type':'application/json'},body});
  for (const body of ['{', '{}', JSON.stringify({chapter:'card1'}), JSON.stringify({chapter:'synthesis',extra:true})]) {
    assert.equal((await route.POST(request(body),{params:{id:'test'}})).status,400);
  }
  assert.equal(queued.length,0);
  const result = await route.POST(request(JSON.stringify({chapter:'synthesis'})),{params:{id:'test'}});
  assert.equal(result.status,202);
  assert.deepEqual((await result.json()).chapters.map(item=>item.chapter),['synthesis']);
  assert.equal(queued.length,1);
  assert.equal(queued[0].text,reading.generalSynthesis);
});

test('áudios antigos salvos continuam disponíveis sem criar novo job', async () => {
  const audio = load('src/lib/audio.ts');
  const folder = fs.mkdtempSync(path.join(require('node:os').tmpdir(),'oracle-old-audio-'));
  const prior = process.env.ORACLE_AUDIO_DIR;
  process.env.ORACLE_AUDIO_DIR = folder;
  const reading = {spread:'box9',sections:Array.from({length:5},(_,index)=>({text:`Trecho ${index+1}`})),generalSynthesis:'Resumo'};
  const session = {isPaid:true,persona:'Oráculo da Galáxia',aiReading:reading};
  const route = load('src/app/api/reading/[id]/audio/[chapter]/route.ts', {
    '@/lib/prisma':{prisma:{readingSession:{findUnique:async()=>session}}},
    '@/lib/reading-access':{requireReadingAccess:()=>true},
    '@/lib/audio':audio,
  });
  try {
    const file = audio.audioPaths(audio.chapterJob(reading,session.persona,'section5').key).file;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const wav = Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVE'),Buffer.alloc(64)]);
    fs.writeFileSync(file,wav);
    const request = new NextRequest('http://localhost/api/reading/test/audio/section5');
    const response = await route.GET(request,{params:{id:'test',chapter:'section5'}});
    assert.equal(response.status,200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),wav);
    assert.equal((await route.GET(request,{params:{id:'test',chapter:'section6'}})).status,404);
    session.aiReading = {spread:'line5',card1Reading:'Carta antiga',generalSynthesis:'Resumo'};
    const oldCard = audio.audioPaths(audio.chapterJob(session.aiReading,session.persona,'card1').key).file;
    fs.writeFileSync(oldCard,wav);
    assert.equal((await route.GET(request,{params:{id:'test',chapter:'card1'}})).status,200);
    assert.equal(fs.existsSync(path.join(folder,'jobs')),false);
  } finally {
    if (prior === undefined) delete process.env.ORACLE_AUDIO_DIR; else process.env.ORACLE_AUDIO_DIR = prior;
    fs.rmSync(folder,{recursive:true,force:true});
  }
});
test('repetir mesma consulta pronta não chama IA nem sorteia outra mesa', async () => {
  process.env.ORACLE_ACCESS_SECRET='test-only-secret';
  process.env.ORACLE_DEMO_MODE='true';
  let state; let draws=0; let generations=0;
  const reading={card1Reading:'um',card2Reading:'dois',card3Teaser:'três'};
  const db={readingSession:{findUnique:async()=>state,create:async({data})=>(state={...data,createdAt:new Date()}),update:async({data})=>(state={...state,...data})}};
  const route=load('src/app/api/reading/start/route.ts',{'@/lib/paid-part': {paidPartReady:()=>true,startPaidPart:()=>{},waitPaidPart:async()=>null},'@/lib/prisma':{prisma:db},'@/lib/draw':{drawDistinctCards:()=>{draws++;return cards.slice(0,5)}},'@/lib/gemini':{generateFreeReading:async()=>{generations++;return reading}}});
  const body={userName:'Teste',persona:'Oráculo da Galáxia',theme:'Amor & Relacionamento',requestId:'11111111-1111-4111-8111-111111111111',requestKey:'22222222-2222-4222-8222-222222222222'};
  const request=()=>new NextRequest('http://localhost:3000/api/reading/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const first=await route.POST(request()); const firstData=await first.json();
  const repeat=await route.POST(request()); const repeatData=await repeat.json();
  assert.equal(first.status,201); assert.equal(repeat.status,200);
  assert.equal(draws,1); assert.equal(generations,1); assert.deepEqual(firstData,repeatData);
  assert.equal(firstData.cardsDrawn[3].name,null); assert.equal(firstData.aiReading.generalSynthesis,null);
  assert.match(first.headers.get('set-cookie'),/HttpOnly/);
  const {requireReadingAccess}=load('src/lib/reading-access.ts');
  assert.equal(requireReadingAccess(new NextRequest('http://localhost:3000'),body.requestId),false);
  const cookie=first.headers.get('set-cookie').split(';')[0];
  assert.equal(requireReadingAccess(new NextRequest('http://localhost:3000',{headers:{cookie}}),body.requestId),true);
  assert.equal(requireReadingAccess(new NextRequest('http://0.0.0.0:3000',{method:'POST',headers:{cookie,host:'192.168.15.70:3000',origin:'http://192.168.15.70:3000'}}),body.requestId),true);
  assert.equal(requireReadingAccess(new NextRequest('http://0.0.0.0:3000',{method:'POST',headers:{cookie,host:'192.168.15.70:3000',origin:'http://outro-site.test'}}),body.requestId),false);
});
