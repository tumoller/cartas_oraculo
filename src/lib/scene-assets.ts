export function sceneAssets(persona: string) {
  if (persona === "Linha de Umbanda") return {
    portrait: "/avatars/umbanda-meio-corpo-realista.png",
    scene: "/scenes/umbanda-mesa-base-v1.png",
    sceneConcentrating: "/scenes/umbanda-mesa-concentrada-v1.png",
    sceneExpressing: "/scenes/umbanda-mesa-fala-v1.png",
    close: "/avatars/umbanda-close-realista.png",
    concentrating: "/avatars/expressions/umbanda-concentrating.png",
    explaining: "/avatars/expressions/umbanda-explaining.png",
    accent: "#d79862",
  };
  if (persona === "Cigana Tradicional") return {
    portrait: "/avatars/cigana-meio-corpo-realista.png",
    scene: "/scenes/cigana-mesa-base-v1.png",
    sceneConcentrating: "/scenes/cigana-mesa-concentrada-v1.png",
    sceneExpressing: "/scenes/cigana-mesa-fala-v1.png",
    close: "/avatars/cigana-close-realista.png",
    concentrating: "/avatars/expressions/cigana-concentrating.png",
    explaining: "/avatars/expressions/cigana-explaining.png",
    accent: "#d5a75f",
  };
  return {
    portrait: "/avatars/cosmico-meio-corpo-realista.png",
    scene: "/scenes/cosmico-mesa-base-v1.png",
    sceneConcentrating: "/scenes/cosmico-mesa-concentrada-v1.png",
    sceneExpressing: "/scenes/cosmico-mesa-fala-v1.png",
    close: "/avatars/cosmico-close-realista.png",
    concentrating: "/avatars/expressions/cosmico-concentrating.png",
    explaining: "/avatars/expressions/cosmico-explaining.png",
    accent: "#b9b3f5",
  };
}
