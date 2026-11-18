# Prévia da Forja em Next.js

Rode a partir da raiz do repositório com Node.js 20.9 ou mais recente.

```powershell
cd next-preview
npm ci
npm run dev
```

- `http://127.0.0.1:3000/` abre o site atual servido pelo Next.js.
- `http://127.0.0.1:3000/dnd5e` abre a ficha de D&D 5e já existente, com um personagem de exemplo.
- `npm run build` gera o build local. Use `npm start` depois para conferir o build.

As páginas antigas e seus arquivos são copiados para `public/` ao iniciar ou compilar. Edite os originais na raiz e reinicie a prévia para atualizar a cópia. O Next.js preserva os endereços das fichas, campanhas e livros.

A ficha de teste usa o HTML, o CSS e as abas em `sistemas/dnd5e/ficha`. Ela inclui o grimório integrado e guarda as alterações localmente durante a sessão da aba.

As fichas abertas normalmente na Forja continuam usando o Supabase. Para testar esse login localmente com dados separados, configure um projeto de testes e autorize o endereço local nos redirecionamentos dele.
