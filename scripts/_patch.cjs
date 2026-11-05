const fs=require("fs");const p="scripts/audio-worker.cjs";let s=fs.readFileSync(p,"utf8");
const a=`    const bytes = await generate(job, fetcher);`;
const b=`    // Modelo do job primeiro; em qualquer erro, cai direto para os reservas (ORACLE_TTS_MODEL_FALLBACK, _FALLBACK2).
    const models = [...new Set([job.model, process.env.ORACLE_TTS_MODEL_FALLBACK, process.env.ORACLE_TTS_MODEL_FALLBACK2].filter(Boolean))];
    let bytes;
    let lastError;
    for (const model of models) {
      try { bytes = await generate({ ...job, model }, fetcher); break; }
      catch (error) { lastError = error; console.error(\`[audio-worker] \${job.key} \${model}: \${error.message}\`); }
    }
    if (!bytes) throw lastError;`;
if(!s.includes(a))throw "a";s=s.replace(a,b);
const c=`  for (const name of jobs.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {`;
const d=`  // Ordem de chegada: a pré-carga enfileira linha 1, linha 2… e é nessa ordem que a voz fica pronta.
  const queued = await Promise.all(jobs.filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).map(async (name) => {
    try { return { name, at: (await fs.stat(path.join(root(), "jobs", name))).mtimeMs }; } catch { return { name, at: Infinity }; }
  }));
  for (const { name } of queued.sort((x, y) => x.at - y.at)) {`;
if(!s.includes(c))throw "c";s=s.replace(c,d);fs.writeFileSync(p,s);
