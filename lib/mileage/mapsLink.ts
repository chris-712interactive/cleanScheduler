/** Opens a driving route. The page does not read a distance back from Maps. */
export function googleMapsLegUrl(origin: string, destination: string): string {
  const params = new URLSearchParams({
    api: '1',
    origin: origin.trim(),
    destination: destination.trim(),
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
