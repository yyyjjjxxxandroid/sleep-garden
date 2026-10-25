// The cairn beside the pond bench (10, -1) is the reference for the cat nook.
// Keep one shared clearing for scenery generation, props and navigation tests.
export const PET_LAYOUT={
  nook:{x:10,z:-1,r:1.45},
  meal:{x:8.5,z:1.4,r:.46},water:{x:10,z:1.5,r:.46},
  box:{x:8,z:4.1,r:1.35},scratch:{x:10.9,z:4.5,r:.95}
};
export function inPetClearing(x,z,margin=0){return ((x-10.2)/(4.4+margin))**2+((z-1.7)/(4.7+margin))**2<1}
export function overlapsPetProp(x,z,r,props){return Object.values(props).some(o=>Math.hypot(x-o.position.x,z-o.position.z)<r+(o.userData.radius||1)+.25)}
