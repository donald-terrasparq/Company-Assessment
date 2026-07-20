/** Deterministic monogram gradient per company name (prototype look). */
const GRADIENTS = [
  "linear-gradient(150deg,#0E8F6E,#12b083)",
  "linear-gradient(150deg,#1c3d5a,#2a5680)",
  "linear-gradient(150deg,#7a1f2b,#a83345)",
  "linear-gradient(150deg,#12683a,#1c8f52)",
  "linear-gradient(150deg,#0b3d2e,#12684d)",
  "linear-gradient(150deg,#14427a,#1f66b8)",
  "linear-gradient(150deg,#b0361f,#e05a34)",
  "linear-gradient(150deg,#4c2a85,#7A3FF2)",
];

export function monogramFor(name: string): { letter: string; gradient: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return {
    letter: (name.trim()[0] ?? "?").toUpperCase(),
    gradient: GRADIENTS[Math.abs(hash) % GRADIENTS.length],
  };
}
