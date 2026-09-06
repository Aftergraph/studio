export function diffSurfaceEntries(previousIds=new Set(), currentIds=[]) {
  const previous = previousIds instanceof Set ? previousIds : new Set(previousIds || []);
  return [...currentIds].filter(id => id && !previous.has(id));
}
