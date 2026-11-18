import { calcularSpellSlots } from '../data/espacos-magicos.js';
import { normalizarPontosVida } from '../data/recursos.js';
import { resolverTesteD20 } from '../data/rolagens.js';

const $ = id => document.getElementById(id);
const noShell = window.parent !== window;
const iniciativa = new Map();
let sb;
let campanha;
let usuario;
let ehMestre = false;
let fichas = [];
let grupo = [];
let perfis = new Map();

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function avisarShell(tipo, payload) {
  if (noShell) window.parent.postMessage({ tipo, payload }, window.location.origin);
}

function mostrarVazio(container, mensagem) {
  $(container).innerHTML = `<div class="empty-state"><div class="empty-state-text">${esc(mensagem)}</div></div>`;
}

function showToast(mensagem) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensagem;
  toast.setAttribute('role', 'status');
  $('toastContainer').append(toast);
  setTimeout(() => toast.remove(), 4500);
}

function rotuloClasse(dados) {
  return [dados.race, dados.cls, `Nível ${dados.level ?? 1}`].filter(Boolean).join(' · ');
}

function recursosDaFicha(dados) {
  const hp = normalizarPontosVida({ max: 10, atual: 10, temp: 0, ...dados.hp });
  const maximos = calcularSpellSlots(dados.cls, dados.level);
  const espacos = [];
  for (let nivel = 1; nivel <= 9; nivel++) {
    const slot = dados.spellSlots?.[nivel] ?? { max: maximos[nivel], usados: 0 };
    if (slot.max > 0) espacos.push(`N${nivel}: ${Math.max(0, slot.max - (Number(slot.usados) || 0))}/${slot.max}`);
  }
  return `<div class="char-mini-info"><strong>PV ${hp.atual}/${hp.max}</strong>${hp.temp > 0 ? ` · ${hp.temp} temporários` : ''}</div>
    ${espacos.length ? `<div class="char-mini-info">Espaços livres: ${esc(espacos.join(' · '))}</div>` : ''}`;
}

async function carregarGrupo() {
  const [detalhes, membros] = await Promise.all([
    sb.from('personagens').select('id,nome,dono_id,dados')
      .eq('campanha_id', campanha.id).eq('sistema', 'dnd5e').order('criado_em', { ascending: true }),
    sb.rpc('listar_jogadores_campanha', { p_campanha_id: campanha.id })
  ]);
  if (detalhes.error && membros.error) {
    mostrarVazio('charsList', 'Não foi possível carregar o grupo.');
    return;
  }

  fichas = detalhes.data || [];
  grupo = membros.data ?? fichas.map(p => ({ personagem_id: p.id, personagem_nome: p.nome, dono_id: p.dono_id }));
  const ids = [...new Set(grupo.map(p => p.dono_id))];
  const { data } = ids.length ? await sb.from('usuarios').select('id,username').in('id', ids) : { data: [] };
  perfis = new Map((data || []).map(p => [p.id, p.username]));
  renderizarGrupo();
  renderizarIniciativa();
}

function renderizarGrupo() {
  if (!grupo.length) {
    mostrarVazio('charsList', 'Nenhum personagem entrou na campanha.');
    return;
  }
  const porId = new Map(fichas.map(p => [p.id, p]));
  $('charsList').innerHTML = grupo.map(membro => {
    const ficha = porId.get(membro.personagem_id);
    const nome = membro.personagem_nome;
    const jogador = perfis.get(membro.dono_id);
    const dados = ficha?.dados || {};
    return `<article class="char-mini-card">
      <div class="char-mini-dados">
        <div class="char-mini-name">${esc(nome)}</div>
        ${jogador ? `<div class="char-mini-info">${esc(jogador)}</div>` : ''}
        ${ficha ? `<div class="char-mini-info">${esc(rotuloClasse(dados))}</div>${recursosDaFicha(dados)}` : ''}
      </div>
      ${ficha ? `<button type="button" class="btn-action" data-ficha="${esc(ficha.id)}" aria-label="Abrir ficha de ${esc(nome)}">Abrir ficha</button>` : ''}
    </article>`;
  }).join('');
}

$('charsList').addEventListener('click', evento => {
  const botao = evento.target.closest('[data-ficha]');
  if (!botao) return;
  const url = `/sistemas/dnd5e/ficha/ficha.html?id=${encodeURIComponent(botao.dataset.ficha)}`;
  if (noShell) avisarShell('ficha:abrir', url);
  else window.location.href = url;
});

function chaveIniciativa() {
  return `forja:dnd5e:iniciativa:${usuario.id}:${campanha.id}`;
}

function lerIniciativa() {
  try {
    const salvos = JSON.parse(sessionStorage.getItem(chaveIniciativa())) || {};
    for (const [id, numero] of Object.entries(salvos)) if (Number.isSafeInteger(numero)) iniciativa.set(id, numero);
  } catch {
    // A iniciativa ainda pode ser usada até sair da página.
  }
}

function guardarIniciativa() {
  try {
    sessionStorage.setItem(chaveIniciativa(), JSON.stringify(Object.fromEntries(iniciativa)));
  } catch {
    // A ordem continua disponível na página aberta.
  }
}

function baseIniciativa(ficha) {
  const dados = ficha.dados || {};
  const ajuste = Number(dados.overrides?.iniciativa);
  if (dados.overrides?.iniciativa != null && dados.overrides.iniciativa !== '' && Number.isSafeInteger(ajuste)) return ajuste;
  return Math.floor(((parseInt(dados.attrs?.dex, 10) || 10) - 10) / 2);
}

function renderizarIniciativa() {
  const ordenadas = [...fichas].sort((a, b) => {
    if (!iniciativa.has(a.id)) return iniciativa.has(b.id) ? 1 : 0;
    if (!iniciativa.has(b.id)) return -1;
    return iniciativa.get(b.id) - iniciativa.get(a.id);
  });
  $('ordemIniciativa').innerHTML = ordenadas.length ? ordenadas.map(ficha => `
    <li><div class="ordem-linha">
      <span>${esc(ficha.nome)}</span>
      <form class="campanha-acoes" data-definir="${esc(ficha.id)}">
        <input class="spell-meta-input" type="number" step="1" aria-label="Iniciativa de ${esc(ficha.nome)}"
          name="total" value="${iniciativa.get(ficha.id) ?? ''}">
        <button class="btn-action" type="submit" aria-label="Definir iniciativa de ${esc(ficha.nome)}">Definir</button>
        <button class="btn-action" type="button" data-rolar="${esc(ficha.id)}" aria-label="Rolar iniciativa de ${esc(ficha.nome)}">Rolar</button>
      </form>
    </div></li>`).join('') : '<li>Nenhuma ficha disponível para rolar iniciativa.</li>';
  $('rolarIniciativa').hidden = !ehMestre;
  $('rolarIniciativa').disabled = !fichas.length;
}

$('ordemIniciativa').addEventListener('submit', evento => {
  evento.preventDefault();
  const form = evento.target;
  const valor = form.elements.total.value;
  if (valor === '') iniciativa.delete(form.dataset.definir);
  else if (Number.isSafeInteger(Number(valor))) iniciativa.set(form.dataset.definir, Number(valor));
  guardarIniciativa();
  renderizarIniciativa();
});

$('ordemIniciativa').addEventListener('click', evento => {
  const ficha = fichas.find(p => p.id === evento.target.closest('[data-rolar]')?.dataset.rolar);
  if (!ficha) return;
  const resultado = resolverTesteD20(baseIniciativa(ficha));
  iniciativa.set(ficha.id, resultado.total);
  guardarIniciativa();
  renderizarIniciativa();
  showToast(`${ficha.nome}: ${resultado.escolhido} no d20, iniciativa ${resultado.total}.`);
});

$('rolarIniciativa').addEventListener('click', () => {
  if (!ehMestre) return;
  for (const ficha of fichas) iniciativa.set(ficha.id, resolverTesteD20(baseIniciativa(ficha)).total);
  guardarIniciativa();
  renderizarIniciativa();
});

$('roladorCampanha').addEventListener('submit', evento => {
  evento.preventDefault();
  if (!campanha) return;
  const { modificador, cd, modo } = evento.currentTarget.elements;
  const resultado = resolverTesteD20(Number(modificador.value), { modo: modo.value, cd: cd.value ? Number(cd.value) : null });
  const sinal = resultado.modificador < 0 ? '−' : '+';
  const alvo = resultado.cd === null ? '' : ` · ${resultado.atingiuCD ? 'Atingiu' : 'Ficou abaixo da'} CD ${resultado.cd}.`;
  $('resultadoDados').textContent = `Dados: ${resultado.dados.join(' e ')} · ${resultado.escolhido} ${sinal} ${Math.abs(resultado.modificador)} = ${resultado.total}${alvo}`;
});

async function carregarConvite() {
  const { data, error } = await sb.from('convites_campanha').select('codigo').eq('campanha_id', campanha.id).maybeSingle();
  if (!error && data?.codigo) {
    $('codigoConvite').textContent = data.codigo;
    $('campanhaConvite').hidden = false;
  }
}

$('copiarConvite').addEventListener('click', async () => {
  if (!ehMestre) return;
  try {
    await navigator.clipboard.writeText($('codigoConvite').textContent);
    showToast('Código copiado.');
  } catch {
    showToast('Selecione o código para copiar.');
  }
});

async function carregarPedidos() {
  const { data, error } = await sb.from('solicitacoes_entrada').select('id,personagem_nome')
    .eq('campanha_id', campanha.id).eq('status', 'pendente').order('criado_em', { ascending: true });
  if (error) {
    mostrarVazio('listaPedidos', 'Não foi possível carregar os pedidos.');
    return;
  }
  $('listaPedidos').innerHTML = data?.length ? data.map(pedido => `
    <div class="ordem-linha" data-pedido="${esc(pedido.id)}">
      <span>${esc(pedido.personagem_nome)}</span>
      <div class="campanha-acoes">
        <button class="btn-action" type="button" data-decisao="aprovar">Aprovar</button>
        <button class="btn-action" type="button" data-decisao="rejeitar">Recusar</button>
      </div>
    </div>`).join('') : '<p>Nenhum pedido pendente.</p>';
}

$('listaPedidos').addEventListener('click', async evento => {
  const botao = evento.target.closest('[data-decisao]');
  if (!ehMestre || !botao || botao.disabled) return;
  const linha = botao.closest('[data-pedido]');
  const aprovar = botao.dataset.decisao === 'aprovar';
  const botoes = $('listaPedidos').querySelectorAll('button');
  botoes.forEach(item => { item.disabled = true; });
  try {
    const funcao = aprovar ? 'aprovar_solicitacao_entrada' : 'rejeitar_solicitacao_entrada';
    const { error } = await sb.rpc(funcao, { p_solicitacao_id: linha.dataset.pedido });
    if (error) throw error;
    showToast(aprovar ? 'Pedido aprovado.' : 'Pedido recusado.');
    await Promise.all([carregarPedidos(), ...(aprovar ? [carregarGrupo()] : [])]);
  } catch (error) {
    showToast(error.message || 'Não foi possível atualizar o pedido.');
  } finally {
    botoes.forEach(item => { item.disabled = false; });
  }
});

$('salvarDiario').addEventListener('click', async () => {
  if (!ehMestre || $('salvarDiario').disabled) return;
  const botao = $('salvarDiario');
  const diario = $('camp_diario').value;
  botao.disabled = true;
  try {
    const atual = await sb.from('campanhas').select('dados').eq('id', campanha.id).single();
    if (atual.error || !atual.data) throw atual.error ?? new Error('Campanha indisponível.');
    const dados = { ...atual.data.dados, diario };
    const { data, error } = await sb.from('campanhas').update({ dados })
      .eq('id', campanha.id).eq('mestre_id', usuario.id).select('id').maybeSingle();
    if (error || !data) throw error ?? new Error('Nenhuma alteração confirmada.');
    showToast('Diário salvo.');
    avisarShell('ficha:salvo');
  } catch (error) {
    console.error('[campanha-dnd] erro ao salvar diário:', error.message);
    showToast('Não foi possível salvar o diário.');
    avisarShell('ficha:erro-salvo');
  } finally {
    botao.disabled = false;
  }
});

function switchTab(tab) {
  document.querySelectorAll('.sheet-tab').forEach(botao => {
    const ativo = botao.dataset.tab === tab;
    botao.classList.toggle('active', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
  });
  document.querySelectorAll('.sheet-panel').forEach(painel => painel.classList.toggle('active', painel.id === 'panel-' + tab));
}
window.switchTab = switchTab;

$('btnVoltar').addEventListener('click', () => {
  if (noShell) avisarShell('ficha:voltar');
  else window.location.href = '/';
});
if (noShell) $('topbarInterno').hidden = true;

async function init() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    mostrarVazio('charsList', 'Nenhuma campanha informada.');
    return;
  }
  sb = (noShell && window.parent.supabaseClient) || (await import('../../../core/js/auth-supabase.js')).supabase;
  const [sessao, resultado] = await Promise.all([
    sb.auth.getUser(),
    sb.from('campanhas').select('*').eq('id', id).eq('sistema', 'dnd5e').single()
  ]);
  usuario = sessao.data?.user;
  if (!usuario || resultado.error || !resultado.data) {
    mostrarVazio('charsList', 'Campanha indisponível. Entre na Forja e confira seu acesso.');
    return;
  }
  campanha = resultado.data;
  ehMestre = campanha.mestre_id === usuario.id;
  lerIniciativa();
  $('camp_nome').value = campanha.nome;
  $('campanhaInfo').hidden = false;
  $('campanhaPapel').textContent = ehMestre ? 'Você é o mestre' : 'Você é jogador';
  avisarShell('ficha:titulo', campanha.nome);
  $('roladorCampanha').querySelector('button[type="submit"]').disabled = false;

  const dados = campanha.dados || {};
  if (dados.banner) {
    $('camp_banner').src = dados.banner;
    $('camp_banner').style.display = 'block';
  }
  $('camp_diario').value = dados.diario || '';
  $('camp_diario').readOnly = !ehMestre;
  $('salvarDiario').hidden = !ehMestre;
  $('diarioLeitura').hidden = ehMestre;
  $('pedidosEntrada').hidden = !ehMestre;
  await Promise.all([carregarGrupo(), ...(ehMestre ? [carregarConvite(), carregarPedidos()] : [])]);
}

init().catch(erro => {
  console.error('[campanha-dnd] erro ao abrir campanha:', erro);
  mostrarVazio('charsList', 'Não foi possível abrir a campanha.');
});
