import Link from "next/link";

export default function ComoFunciona() {
  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-12 text-slate-200">
      <Link href="/baralho-cigano" className="text-sm text-purple-300 underline underline-offset-4">← Voltar à leitura</Link>
      <h1 className="mt-8 text-3xl font-bold font-serif text-slate-100">Como funciona</h1>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-slate-100">Tradição e inspiração</h2>
          <p>Nossas leituras são inspiradas na tradição do baralho Lenormand e em seus 36 símbolos. Você pode escolher a atmosfera cósmica do Oráculo da Galáxia, a inspiração da cartomancia tradicional ou a espiritualidade da Umbanda, abordada com respeito e de forma simbólica.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100">Um momento para você</h2>
          <p>Escolha um tema, pense no que deseja compreender e, se quiser, escreva sua pergunta. Reserve um instante para respirar e firmar sua intenção antes de abrir as cartas.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-100">Sua experiência</h2>
          <p>Escolha uma leitura de três, cinco, nove ou 36 cartas. Cada uma reúne interpretações para o tema escolhido e um panorama geral para sua reflexão. Na consulta de cinco cartas, você pode conhecer as primeiras cartas antes de abrir o restante.</p>
          <p className="mt-2">Nos jogos de nove e 36 cartas, o básico reúne as linhas e a síntese geral. O completo acrescenta colunas, centro e diagonais no quadro de nove; na mesa de 36, acrescenta a vizinhança do tema e os quatro cantos. Nas tiragens de três e cinco, centro e combinações fazem parte da própria leitura da linha.</p>
          <p className="mt-2">Você pode ouvir a leitura ou acompanhar somente o texto. Com sua escolha de ouvir, a narração dos capítulos é preparada enquanto as cartas são abertas. O áudio lê o mesmo texto da consulta; não há uma narração separada para cada carta. Toque nas cartas para ver a arte ampliada.</p>
          <p className="mt-2">Esta é uma demonstração: nenhum pagamento é solicitado ou feito. O botão apenas abre o restante da leitura.</p>
        </section>

        <p className="text-sm text-slate-400">Esta é uma interpretação digital baseada no Petit Lenormand, também conhecido como baralho cigano, com texto gerado por inteligência artificial a partir das cartas sorteadas. Receba a leitura de acordo com sua fé e intenção. Ela não é uma verdade absoluta nem substitui uma consulta presencial. Nenhuma leitura, digital ou presencial, determina o futuro ou suas decisões. As combinações podem apontar situações favoráveis, desafios ou perdas, sem garantia de acontecimentos.</p>
      </div>
    </main>
  );
}
