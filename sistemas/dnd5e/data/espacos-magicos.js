// Progressão de classe única da ficha de 2014. O índice 0 indica truques conhecidos.
export function calcularSpellSlots(classe, nivel) {
  const nv = Math.min(Math.max(parseInt(nivel) || 1, 1), 20);

  // Full caster: Mago, Clérigo, Druida, Bardo, Feiticeiro — slots níveis 1-9
  const FULL_CASTER_TABLE = [
    [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
    [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
    [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
    [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
    [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
  ];

  // Half caster: Paladino, Patrulheiro — slots níveis 1-5
  const HALF_CASTER_TABLE = [
    [0,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],[4,2,0,0,0],
    [4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],
    [4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],
    [4,3,3,3,2],[4,3,3,3,2],
  ];

  // Pact Magic: Bruxo — slots poucos mas todos no círculo mais alto disponível
  const PACT_MAGIC_TABLE = [
    {qtd:1,circulo:1},{qtd:2,circulo:1},{qtd:2,circulo:2},{qtd:2,circulo:2},{qtd:2,circulo:3},
    {qtd:2,circulo:3},{qtd:2,circulo:4},{qtd:2,circulo:4},{qtd:2,circulo:5},{qtd:2,circulo:5},
    {qtd:3,circulo:5},{qtd:3,circulo:5},{qtd:3,circulo:5},{qtd:3,circulo:5},{qtd:3,circulo:5},
    {qtd:3,circulo:5},{qtd:4,circulo:5},{qtd:4,circulo:5},{qtd:4,circulo:5},{qtd:4,circulo:5},
  ];

  // ── Truques conhecidos por classe e nível (Cantrips Known, PHB) ──────────
  // Mago: 3 no nv 1, +1 nos níveis 4 e 10 → 3/3/3/4/4/4/4/4/4/5/5/5/5/5/5/5/5/5/5/5
  const CANTRIPS_MAGO        = [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5];
  // Clérigo: 3 no nv 1, +1 nos níveis 4 e 10
  const CANTRIPS_CLERIGO     = [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5];
  // Druida: 2 no nv 1, +1 nos níveis 4 e 10
  const CANTRIPS_DRUIDA      = [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
  // Bardo: 2 no nv 1, +1 nos níveis 4 e 10
  const CANTRIPS_BARDO       = [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
  // Feiticeiro: 4 no nv 1, +1 nos níveis 4 e 10
  const CANTRIPS_FEITICEIRO  = [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6];
  // Bruxo: 2 no nv 1, +1 nos níveis 4 e 10
  const CANTRIPS_BRUXO       = [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4];
  // Paladino e Patrulheiro: sem truques (lista vazia → 0 para todos os níveis)
  // Bárbaro, Guerreiro, Ladino, Monge: sem conjuração

  const FULL_CASTERS  = ['Mago','Clérigo','Druida','Bardo','Feiticeiro'];
  const HALF_CASTERS  = ['Paladino','Patrulheiro'];

  // Inicializa slots 0-9 com zero
  const slots = {};
  for (let i = 0; i <= 9; i++) slots[String(i)] = 0;

  if (FULL_CASTERS.includes(classe)) {
    FULL_CASTER_TABLE[nv-1].forEach((qtd, i) => { slots[String(i+1)] = qtd; });
    // Truques por full caster
    const cantripMap = {
      'Mago': CANTRIPS_MAGO, 'Clérigo': CANTRIPS_CLERIGO, 'Druida': CANTRIPS_DRUIDA,
      'Bardo': CANTRIPS_BARDO, 'Feiticeiro': CANTRIPS_FEITICEIRO
    };
    slots['0'] = (cantripMap[classe] || [])[nv-1] || 0;
  } else if (HALF_CASTERS.includes(classe)) {
    HALF_CASTER_TABLE[nv-1].forEach((qtd, i) => { slots[String(i+1)] = qtd; });
    // Paladino e Patrulheiro não têm truques — slots['0'] permanece 0
  } else if (classe === 'Bruxo') {
    const { qtd, circulo } = PACT_MAGIC_TABLE[nv-1];
    slots[String(circulo)] = qtd;
    slots['0'] = CANTRIPS_BRUXO[nv-1] || 0;
  }
  // Bárbaro, Guerreiro, Ladino, Monge, Artífice (não implementado),
  // classe vazia ou não reconhecida → tudo zerado.

  return slots;
}
