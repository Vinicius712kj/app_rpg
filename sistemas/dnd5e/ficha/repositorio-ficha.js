const ID_EXEMPLO = 'ficha-de-teste';
const CHAVE_EXEMPLO = 'forja:dnd5e:ficha-de-teste';

function abrirFichaDeTeste() {
  function ler() {
    try {
      const salvo = JSON.parse(sessionStorage.getItem(CHAVE_EXEMPLO));
      if (salvo?.id === ID_EXEMPLO) return salvo;
    } catch {
      // Se o rascunho estiver corrompido, volta ao personagem de exemplo.
    }
    return {
      id: ID_EXEMPLO,
      nome: 'Ficha de teste',
      sistema: 'dnd5e',
      dados: {
        cls: 'Mago', clsId: 'mago', race: 'Humano', raceId: 'humano', level: 3,
        attrs: { str: 8, dex: 14, con: 12, int: 16, wis: 12, cha: 10 },
        hp: { atual: 17, max: 17, temp: 0 },
        spellSlots: { 0: { max: 3, usados: 0 }, 1: { max: 4, usados: 0 }, 2: { max: 2, usados: 0 } }
      }
    };
  }

  return {
    idExemplo: ID_EXEMPLO,
    async carregar(id) {
      return id === ID_EXEMPLO ? { data: ler() } : { data: null };
    },
    async listar() {
      return { data: [ler()] };
    },
    async salvar(id, campos) {
      if (id !== ID_EXEMPLO) return { error: new Error('Ficha de teste não encontrada.') };
      try {
        sessionStorage.setItem(CHAVE_EXEMPLO, JSON.stringify({ ...ler(), ...campos }));
        return { error: null };
      } catch (error) {
        return { error };
      }
    }
  };
}

export async function abrirRepositorioFicha(janelaDoApp) {
  const url = new URL(window.location.href);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.searchParams.get('preview') === '1') {
    return abrirFichaDeTeste();
  }

  const importarAuth = () => import('../../../core/js/auth-supabase.js');
  const sb = janelaDoApp.supabaseClient ?? (await importarAuth()).supabase;
  const personagens = () => sb.from('personagens');

  return {
    carregar(id) {
      return personagens().select('*').eq('id', id).eq('sistema', 'dnd5e').single();
    },
    listar() {
      return personagens().select('*').eq('sistema', 'dnd5e').order('criado_em', { ascending: true });
    },
    async salvar(id, campos, { exigirSessao = false } = {}) {
      if (exigirSessao) {
        const login = janelaDoApp.exigirLogin ?? (await importarAuth()).exigirLogin;
        const sessao = await login('Faça login para salvar as alterações no seu personagem.');
        if (!sessao) return { cancelado: true };
      }
      const { data, error } = await personagens().update(campos)
        .eq('id', id).eq('sistema', 'dnd5e').select('id').maybeSingle();
      if (error) return { error };
      if (!data) return { error: new Error('Ficha não encontrada ou sem permissão para editar.') };
      return { error: null };
    }
  };
}
