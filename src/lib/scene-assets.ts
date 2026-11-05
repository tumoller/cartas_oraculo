/**
 * Video loops per oracle state. Empty until the loop videos exist: the stage falls back to the
 * still scenes. To add one, drop the MP4/WebM in public/scenes/loops and map it in LOOPS below.
 * Spec: 3-5 s seamless loop, muted, 1080x1920 (mobile) — see docs/DIRECAO-IMERSAO.md.
 */
export type OracleState = "idle" | "concentrating" | "speaking" | "revealing";
export type OracleLoops = Partial<Record<OracleState, string>>;

const LOOPS: Record<"umbanda" | "cigana" | "cosmico", OracleLoops> = {
  umbanda: {},
  cigana: {},
  cosmico: {},
};

export function sceneLoops(persona: string): OracleLoops {
  if (persona === "Linha de Umbanda") return LOOPS.umbanda;
  if (persona === "Cigana Tradicional") return LOOPS.cigana;
  return LOOPS.cosmico;
}

/** Close do rosto no pagamento. Vazio = zoom na cena estática. waiting em loop; paid/declined tocam uma vez. */
export type PaymentMood = "waiting" | "paid" | "declined";
const PAYMENT_LOOPS: Record<"umbanda" | "cigana" | "cosmico", Partial<Record<PaymentMood, string>>> = {
  umbanda: {},
  cigana: {},
  cosmico: {},
};

export function paymentLoops(persona: string) {
  if (persona === "Linha de Umbanda") return PAYMENT_LOOPS.umbanda;
  if (persona === "Cigana Tradicional") return PAYMENT_LOOPS.cigana;
  return PAYMENT_LOOPS.cosmico;
}

export function sceneAssets(persona: string) {
  if (persona === "Linha de Umbanda") return {
    portrait: "/avatars/umbanda-meio-corpo-realista.png",
    scene: "/scenes/umbanda-mesa-base-v1.webp",
    sceneConcentrating: "/scenes/umbanda-mesa-concentrada-v1.webp",
    sceneExpressing: "/scenes/umbanda-mesa-fala-v1.webp",
    close: "/avatars/umbanda-close-realista.png",
    concentrating: "/avatars/expressions/umbanda-concentrating.png",
    explaining: "/avatars/expressions/umbanda-explaining.png",
    accent: "#d79862",
  };
  if (persona === "Cigana Tradicional") return {
    portrait: "/avatars/cigana-meio-corpo-realista.png",
    scene: "/scenes/cigana-mesa-base-v1.webp",
    sceneConcentrating: "/scenes/cigana-mesa-concentrada-v1.webp",
    sceneExpressing: "/scenes/cigana-mesa-fala-v1.webp",
    close: "/avatars/cigana-close-realista.png",
    concentrating: "/avatars/expressions/cigana-concentrating.png",
    explaining: "/avatars/expressions/cigana-explaining.png",
    accent: "#d5a75f",
  };
  return {
    portrait: "/avatars/cosmico-meio-corpo-realista.png",
    scene: "/scenes/cosmico-mesa-base-v1.webp",
    sceneConcentrating: "/scenes/cosmico-mesa-concentrada-v1.webp",
    sceneExpressing: "/scenes/cosmico-mesa-fala-v1.webp",
    close: "/avatars/cosmico-close-realista.png",
    concentrating: "/avatars/expressions/cosmico-concentrating.png",
    explaining: "/avatars/expressions/cosmico-explaining.png",
    accent: "#b9b3f5",
  };
}
