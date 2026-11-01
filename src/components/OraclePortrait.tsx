import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { sceneAssets } from "@/lib/scene-assets";
import styles from "./OraclePortrait.module.css";

export function OraclePortrait({ persona, preparing, playing }: { persona: string; preparing: boolean; playing: boolean }) {
  const art = sceneAssets(persona);
  const [missing, setMissing] = useState<string[]>([]);
  return <div className={styles.scene} style={{ "--portrait-accent": art.accent } as CSSProperties}>
    <div className={styles.figure}>
      <Image src={art.close} alt={`Personagem ${persona}`} fill sizes="(max-width: 700px) 100vw, 700px" className={styles.image} />
      <Image src={art.portrait} alt="" fill sizes="(max-width: 700px) 100vw, 700px" className={`${styles.image} ${styles.halfBody} ${preparing ? styles.active : ""}`} />
      {!missing.includes(art.concentrating) && <Image src={art.concentrating} onError={() => setMissing((items) => [...items, art.concentrating])} alt="" fill sizes="(max-width: 700px) 100vw, 700px" className={`${styles.image} ${styles.concentration} ${preparing ? styles.active : ""}`} />}
      {playing && !preparing && !missing.includes(art.explaining) && <Image src={art.explaining} onError={() => setMissing((items) => [...items, art.explaining])} alt="" fill sizes="(max-width: 700px) 100vw, 700px" className={`${styles.image} ${styles.expression}`} />}
    </div>
    <div className={styles.vignette} /><div className={styles.smoke} />
  </div>;
}
