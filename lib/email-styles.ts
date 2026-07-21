/**
 * Email pitch style presets — the "variable" selector in the Draft Email
 * modal. One dial covering verbose ↔ terse and salesy ↔ consultative.
 * Client-safe (no server deps).
 */
export interface EmailStyle {
  key: string;
  label: string;
  hint: string; // shown in the modal
  instructions: string; // fed to the model
}

export const EMAIL_STYLES: EmailStyle[] = [
  {
    key: "executive",
    label: "Executive brief",
    hint: "40–70 words · C-suite terse, zero filler",
    instructions:
      "40-70 words. Written for a C-level reader: no pleasantries, no filler, one sharp observation about their situation, one concrete ask for a 15-minute call. Confident, peer-to-peer tone.",
  },
  {
    key: "brief",
    label: "Brief & direct",
    hint: "60–90 words · straight to the point, one ask",
    instructions:
      "60-90 words. Direct and efficient: the trigger event, why it matters for connectivity/devices, one clear call to action. No adjectives that don't earn their place.",
  },
  {
    key: "consultative",
    label: "Consultative",
    hint: "110–150 words · insight-led, low pressure",
    instructions:
      "110-150 words. Lead with an insight about their announced plans, connect it to a practical operational question they'll face, position CTS Mobility as having done this before. Low-pressure CTA offering a useful conversation, not a pitch.",
  },
  {
    key: "warm",
    label: "Warm & conversational",
    hint: "90–130 words · friendly, plain-spoken",
    instructions:
      "90-130 words. Friendly and human — write like a person, not a vendor. Plain language, first-person, genuinely curious about their project. Soft CTA.",
  },
  {
    key: "value",
    label: "Detailed value pitch",
    hint: "150–220 words · fuller benefits, salesier",
    instructions:
      "150-220 words. A fuller pitch: the trigger, two or three concrete ways CTS Mobility helps (drawn from the selected play), and a confident close. Enthusiastic but never hype-y; still zero invented claims.",
  },
];

export const DEFAULT_STYLE_KEY = "consultative";
