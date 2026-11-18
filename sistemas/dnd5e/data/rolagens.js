export function rolarDado(lados, aleatorio = Math.random) {
  return Math.floor(aleatorio() * lados) + 1;
}

export function rolarD20(modificador, modo = 'normal', aleatorio = Math.random) {
  if (!Number.isSafeInteger(modificador)) {
    throw new TypeError('O modificador precisa ser um número inteiro.');
  }

  const dado = rolarDado(20, aleatorio);

  switch (modo) {
    case 'normal':
      return { dados: [dado], escolhido: dado, modificador, total: dado + modificador };
    case 'vantagem':
    case 'desvantagem': {
      const segundo = rolarDado(20, aleatorio);
      const escolhido = modo === 'vantagem' ? Math.max(dado, segundo) : Math.min(dado, segundo);
      return { dados: [dado, segundo], escolhido, modificador, total: escolhido + modificador };
    }
    default:
      throw new TypeError('Modo de rolagem inválido.');
  }
}

export function resolverTesteD20(modificador, { modo = 'normal', cd = null } = {}, aleatorio = Math.random) {
  if (cd !== null && (!Number.isSafeInteger(cd) || cd < 1)) {
    throw new RangeError('A CD precisa ser um número inteiro maior que zero.');
  }
  const rolagem = rolarD20(modificador, modo, aleatorio);
  return { ...rolagem, modo, cd, atingiuCD: cd === null ? null : rolagem.total >= cd };
}
