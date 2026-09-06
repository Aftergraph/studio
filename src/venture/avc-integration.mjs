// V6.5 Venture OS — AVC Integration Manifest
// Invariant: federation boundary, authority never includes execute

export class AVCIntegration {
  #manifest = {
    name: 'avc',
    version: '1.0.0',
    authority: ['read', 'observe'],
    surfaces: ['product-cells', 'goals', 'missions', 'outcomes'],
    boundary: 'federation-only'
  };
  
  getManifest() {
    return { ...this.#manifest, authority: [...this.#manifest.authority] };
  }
  
  getSurface(name) {
    if (!this.#manifest.surfaces.includes(name)) {
      throw new Error(`Unknown AVC surface: ${name}`);
    }
    return { surface: name, authority: 'read' };
  }
}
