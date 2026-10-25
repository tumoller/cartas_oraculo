export function sceneAssets(persona: string) {
  if (persona === "Linha de Umbanda") return {
    portrait: "/avatars/umbanda-meio-corpo-realista.png",
    close: "/avatars/umbanda-close-realista.png",
    accent: "#d79862",
  };
  if (persona === "Cigana Tradicional") return {
    portrait: "/avatars/cigana-meio-corpo-realista.png",
    close: "/avatars/cigana-close-realista.png",
    accent: "#d5a75f",
  };
  return {
    portrait: "/avatars/cosmico-meio-corpo-realista.png",
    close: "/avatars/cosmico-close-realista.png",
    accent: "#b9b3f5",
  };
}
