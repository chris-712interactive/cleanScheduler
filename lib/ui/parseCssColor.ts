/** Turn a hex code or RGB value into a stored `#RRGGBB` color. */
export function parseCssColorToHex(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const hex6 = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex6) return `#${hex6[1]!.toUpperCase()}`;

  const hex3 = value.match(/^#([0-9a-fA-F]{3})$/);
  if (hex3) {
    const [red, green, blue] = hex3[1]!.split('');
    return `#${red}${red}${green}${green}${blue}${blue}`.toUpperCase();
  }

  const rgb = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
  );
  if (rgb) return channelsToHex(rgb[1]!, rgb[2]!, rgb[3]!);

  const loose = value.match(/^(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})$/);
  if (loose) return channelsToHex(loose[1]!, loose[2]!, loose[3]!);

  return null;
}

function channelsToHex(red: string, green: string, blue: string): string | null {
  const channels = [red, green, blue].map((channel) => Number(channel));
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    return null;
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
