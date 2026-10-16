/* eslint-disable @next/next/no-img-element */
export const PRESETS: { emoji: string; from: string; to: string }[] = [
  { emoji: "🦁", from: "#F59E0B", to: "#EF4444" }, { emoji: "🐘", from: "#64748B", to: "#334155" },
  { emoji: "🦅", from: "#2563EB", to: "#06B6D4" }, { emoji: "🐆", from: "#F97316", to: "#CA8A04" },
  { emoji: "🦓", from: "#1E293B", to: "#64748B" }, { emoji: "🐢", from: "#16A34A", to: "#0D9488" },
  { emoji: "🦉", from: "#7C3AED", to: "#2563EB" }, { emoji: "🐝", from: "#FACC15", to: "#F97316" },
  { emoji: "🦊", from: "#EA580C", to: "#DB2777" }, { emoji: "🐬", from: "#0EA5E9", to: "#6366F1" },
  { emoji: "🌟", from: "#8B5CF6", to: "#EC4899" }, { emoji: "🚀", from: "#0F172A", to: "#2563EB" },
];

/** A person's picture: their uploaded photo, one of the built-in looks, or their first letter. */
export default function Avatar({ avatar, name, size = 34 }: { avatar?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.46) };
  if (avatar?.startsWith("data:image/")) return <img src={avatar} alt="" className="av av-img" style={style} />;
  const m = avatar?.match(/^preset:(\d+)$/);
  const p = m ? PRESETS[Number(m[1])] : undefined;
  if (p) return <span className="av" style={{ ...style, background: `linear-gradient(135deg, ${p.from}, ${p.to})` }} aria-hidden="true">{p.emoji}</span>;
  return <span className="av" style={{ ...style, background: "linear-gradient(135deg, var(--primary), #7C3AED)" }} aria-hidden="true">{(name || "?").slice(0, 1).toUpperCase()}</span>;
}

/** Shrinks a chosen photo to a small centred square so it stays light to store and send. */
export function shrinkImage(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { reject(new Error("Please choose a PNG, JPEG or WebP photo.")); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not open that image."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) { reject(new Error("Your browser cannot resize images.")); return; }
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
