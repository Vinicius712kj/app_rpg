import { rolarDado } from './rolagens.js';

function validarQuantidade(valor, nome, minimo = 0, maximo = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(`${nome} precisa ser um inteiro entre ${minimo} e ${maximo}.`);
  }
}

export function ajustarPvMaximos(hp, maximo) {
  validarQuantidade(maximo, 'PV máximos', 1);
  return { ...hp, max: maximo, atual: Math.min(hp.atual, maximo) };
}

function inteiro(valor, padrao = 0) {
  const numero = Math.trunc(Number(valor));
  return Number.isSafeInteger(numero) ? numero : padrao;
}

export function normalizarPontosVida(hp) {
  const max = Math.max(1, inteiro(hp.max, 1));
  return {
    ...hp,
    max,
    atual: Math.min(max, Math.max(0, inteiro(hp.atual))),
    temp: Math.max(0, inteiro(hp.temp))
  };
}

export function atualizarPontosVida(ficha, hp) {
  const deathSaves = hp.atual > ficha.hp.atual ? { sucesso: 0, falha: 0 } : ficha.deathSaves;
  return { ...ficha, hp, deathSaves };
}

export function aplicarDano(hp, dano) {
  validarQuantidade(dano, 'Dano', 1);
  const temporariosPerdidos = Math.min(dano, hp.temp);
  const pvPerdidos = Math.min(dano - temporariosPerdidos, hp.atual);
  return {
    hp: { ...hp, atual: hp.atual - pvPerdidos, temp: hp.temp - temporariosPerdidos },
    temporariosPerdidos,
    pvPerdidos
  };
}

export function curar(hp, pontos) {
  validarQuantidade(pontos, 'Cura');
  const recuperados = Math.min(pontos, hp.max - hp.atual);
  return { hp: { ...hp, atual: hp.atual + recuperados }, recuperados };
}

export function receberPvTemporarios(hp, pontos) {
  validarQuantidade(pontos, 'PV temporários', 1);
  return { ...hp, temp: Math.max(hp.temp, pontos) };
}

export function configurarEspaco(spellSlots, nivel, maximo) {
  validarQuantidade(nivel, 'Nível do espaço', 1, 9);
  validarQuantidade(maximo, 'Quantidade de espaços', 0, 99);
  return {
    ...spellSlots,
    [nivel]: { max: maximo, usados: Math.min(spellSlots[nivel]?.usados ?? 0, maximo) }
  };
}

export function espacosDisponiveis(spellSlots, nivelMinimo) {
  return Object.entries(spellSlots)
    .map(([nivel, espaco]) => ({ nivel: Number(nivel), restantes: espaco.max - espaco.usados }))
    .filter(espaco => espaco.nivel >= Math.max(1, nivelMinimo) && espaco.restantes > 0)
    .sort((a, b) => a.nivel - b.nivel);
}

const CLASSES_COM_PREPARACAO = new Set(['mago', 'clerigo', 'druida', 'paladino', 'artifice']);

function idDaClasse(ficha) {
  return (ficha.cls || ficha.clsId || '').trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function precisaPrepararMagia(ficha, nivel) {
  return nivel > 0 && CLASSES_COM_PREPARACAO.has(idDaClasse(ficha));
}

export function temAcessoAoNivelDaMagia(spellSlots, nivel) {
  if (nivel === 0) return (spellSlots[0]?.max ?? 0) > 0;
  return Object.entries(spellSlots).some(([circulo, espaco]) => Number(circulo) >= nivel && espaco.max > 0);
}

export function conjurarMagia(ficha, magia, nivelDoEspaco = 0) {
  validarQuantidade(magia.nivel, 'Nível da magia', 0, 9);
  if (precisaPrepararMagia(ficha, magia.nivel) && !magia.preparada) {
    throw new RangeError('Prepare esta magia antes de conjurar.');
  }
  let { spellSlots } = ficha;
  if (magia.nivel > 0) {
    const disponiveis = espacosDisponiveis(spellSlots, magia.nivel);
    if (!disponiveis.some(espaco => espaco.nivel === nivelDoEspaco)) {
      throw new RangeError('Escolha um espaço disponível do nível da magia ou superior.');
    }
    const espaco = spellSlots[nivelDoEspaco];
    spellSlots = { ...spellSlots, [nivelDoEspaco]: { ...espaco, usados: espaco.usados + 1 } };
  }
  return {
    ...ficha,
    spellSlots,
    concentracao: magia.concentracao ? { nome: magia.nome } : ficha.concentracao
  };
}

const DADOS_DE_VIDA = new Map([
  ['mago', 6], ['feiticeiro', 6],
  ['artifice', 8], ['bardo', 8], ['bruxo', 8], ['clerigo', 8], ['druida', 8], ['ladino', 8], ['monge', 8],
  ['guerreiro', 10], ['paladino', 10], ['patrulheiro', 10],
  ['barbaro', 12]
]);

export function dadosDeVida(ficha) {
  const total = Math.min(20, Math.max(1, inteiro(ficha.level, 1)));
  const usados = Math.min(total, Math.max(0, inteiro(ficha.hitDiceUsados)));
  return { total, usados, disponiveis: total - usados, lados: DADOS_DE_VIDA.get(idDaClasse(ficha)) };
}

export function gastarDadoDeVida(ficha, modificadorCon, aleatorio = Math.random) {
  const { lados, usados, disponiveis } = dadosDeVida(ficha);
  if (!lados) throw new RangeError('Escolha a classe para rolar o dado de vida.');
  if (!disponiveis) throw new RangeError('Sem dados de vida disponíveis.');
  const dado = rolarDado(lados, aleatorio);
  const { hp, recuperados } = curar(ficha.hp, Math.max(0, dado + modificadorCon));
  return {
    ficha: { ...atualizarPontosVida(ficha, hp), hitDiceUsados: usados + 1 },
    dado, lados, recuperados
  };
}

function recuperarEspacos(spellSlots) {
  return Object.fromEntries(Object.entries(spellSlots).map(([nivel, espaco]) =>
    [nivel, { ...espaco, usados: 0 }]
  ));
}

export function concluirDescansoCurto(ficha) {
  return idDaClasse(ficha) === 'bruxo'
    ? { ...ficha, spellSlots: recuperarEspacos(ficha.spellSlots) }
    : ficha;
}

export function concluirDescansoLongo(ficha) {
  if (ficha.hp.atual === 0) throw new RangeError('O personagem precisa começar o descanso com pelo menos 1 PV.');
  const { total, usados } = dadosDeVida(ficha);
  const recuperados = Math.min(usados, Math.max(1, Math.floor(total / 2)));
  return {
    ...atualizarPontosVida(ficha, { ...ficha.hp, atual: ficha.hp.max, temp: 0 }),
    hitDiceUsados: usados - recuperados,
    spellSlots: recuperarEspacos(ficha.spellSlots)
  };
}
