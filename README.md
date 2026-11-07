# PlaySpot — Sistema de Reserva de Arenas

Projeto Integrador (DSM). Site para **clientes** reservarem quadras por hora e **proprietários** cadastrarem arenas, fotos, quadras e acompanharem as reservas.

**Stack:** HTML/CSS/JS puro (frontend) · Node.js + Express (API) · MySQL (banco).

---

## Como rodar (5 passos)

Pré-requisitos: **Node 18+** e **MySQL 8** (ou MariaDB 10.4+) instalados e ligados.

```bash
cd Backend
npm install                 # 1. instala as dependências
cp .env.example .env        # 2. crie o .env e preencha DB_USER, DB_PASSWORD e JWT_SECRET
npm run db:setup            # 3. cria/atualiza o banco, as tabelas e os dados iniciais
npm start                   # 4. sobe o servidor
```

5. Abra **http://localhost:3000** — o próprio backend serve o site (frontend), a API (`/api/...`) e as fotos (`/uploads/...`). Tudo na mesma origem, então não há problema de CORS.

Opcional: `npm run geocodificar` descobre a latitude/longitude das arenas do catálogo (precisa de internet) para aparecerem no mapa.

> Usando o Live Server do VS Code (porta 5500)? Funciona: o `js/api.js` detecta e chama o backend em `localhost:3000`. Defina `CORS_ORIGIN=http://127.0.0.1:5500` no `.env`.

---

## Onde fica o banco de dados?

| Situação | O que fazer |
|---|---|
| **Desenvolvimento** (cada integrante no seu PC) | MySQL local. Cada um roda `npm run db:setup` e tem o seu banco. **Não** se compartilha o banco pelo Git, só o *script* (`database/schema.sql`). |
| **Apresentação/demonstração online** | Um MySQL hospedado (ex.: Railway, Aiven, Clever Cloud, PlanetScale-compatível) + backend em Railway/Render. Preencha `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` com os dados do serviço e rode `npm run db:setup` uma vez apontando para ele. |

Regras de ouro: crie um usuário próprio do MySQL (não use `root`), nunca suba o `.env` para o GitHub e, em produção, use `JWT_SECRET` longo e aleatório.

## Como as imagens são salvas?

- **O arquivo da foto vai para uma pasta** (`Backend/uploads/arenas/`), com nome aleatório (`ab12...jpg`).
- **O banco guarda apenas o caminho** (tabela `ARENA_FOTO`, coluna `Caminho` = `/uploads/arenas/ab12....jpg`). Nunca guarde a imagem dentro do banco (BLOB): deixa tudo lento e pesado.
- O Express serve a pasta em `/uploads`, e o frontend monta `<img src="/uploads/arenas/...">`.
- Segurança do upload: só JPG/PNG/WebP, máx. 5 MB por foto e 8 por arena; o servidor confere o **conteúdo real** do arquivo (não só a extensão) e gera o nome do arquivo (o nome enviado pelo usuário é ignorado).
- ⚠️ **Hospedagem na nuvem:** muitos serviços apagam o disco a cada deploy. Para a demo online, anexe um *volume/disco persistente* e aponte `UPLOADS_DIR` para ele — ou, num projeto maior, use um serviço de armazenamento (Cloudinary, S3). Como o banco só guarda o caminho/URL, essa troca mexe em um único lugar (`middlewares/upload.js`).

---

## Estrutura

```
Backend/
  database/schema.sql        tabelas (pode rodar várias vezes sem perder dados)
  database/seed.sql          modalidades + catálogo de arenas de Franca
  src/app.js                 monta o Express: rotas, arquivos estáticos, erros
  src/config/                conexão MySQL (database.js) e caminhos (paths.js)
  src/middlewares/           auth.js (JWT), upload.js (fotos), validarId.js
  src/routes/                só liga URL -> controller
  src/controllers/           regras de cada endpoint
  src/models/                consultas SQL
  src/services/              geocodingService.js (endereço -> lat/long)
  src/scripts/               setupDb.js, geocodificarArenas.js
  src/utils/validacao.js     CPF, CNPJ, e-mail, datas, fuso de Brasília
  uploads/arenas/            fotos enviadas (ignorado pelo Git)
Frontend/Playspot/
  index.html                 busca e lista de arenas
  pages/                     login, cadastros, perfil da arena (reserva), minhas reservas, painel do proprietário
  js/api.js                  fetch com token, sessão, formatação — usado por todas as páginas
  js/*.js                    um arquivo por página
```

## Modelo do banco (resumo)

- **USUARIO** — `cliente` ou `admin` (proprietário). Cliente informa CPF e proprietário informa CNPJ obrigatório (RN003). Senha guardada com **bcrypt** (hash), nunca em texto puro.
- **ARENA** — pertence a um proprietário (`ID_Proprietario`); um proprietário pode ter várias arenas. Tem CNPJ (RN003), endereço, horário de funcionamento e coordenadas.
- **ARENA_FOTO / ARENA_TELEFONE** — fotos (caminho do arquivo) e telefones da arena.
- **QUADRA** + **MODALIDADE** + **QUADRA_MODALIDADE** — cada arena tem quadras com piso, número e valor/hora; cada quadra aceita várias modalidades.
- **RESERVA** — **1 linha = 1 hora** de uma quadra. Reservar 2 horas cria 2 linhas com o mesmo código de comprovante. O banco tem um índice `UNIQUE` que **impede duas reservas confirmadas no mesmo horário**, mesmo se duas pessoas clicarem juntas; reservas canceladas liberam o horário. O comprovante aparece em “Minhas Reservas”.
- **ARENA_CATALOGO** — arenas de Franca levantadas na internet (ainda não parceiras), usadas só no mapa.
- Excluir arena/quadra é *soft delete* (`Ativa = 0`): some do site, mas o histórico de reservas não se perde.

## API

| Método e rota | Quem | O que faz |
|---|---|---|
| `POST /api/auth/cadastro` · `POST /api/auth/login` · `GET /api/auth/me` | público / logado | cadastro (`tipo`: `cliente` ou `admin`), login, dados do usuário |
| `GET /api/arenas?nome=&cidade=&modalidade=` | público | lista com capa, preço mínimo e modalidades |
| `GET /api/arenas/:id` · `GET /api/arenas/:id/horarios?data=&quadra=` | público | detalhe completo · horários livres/ocupados do dia |
| `GET /api/modalidades` · `GET /api/catalogo` | público | filtros · locais do mapa |
| `POST /api/reservas` · `GET /api/reservas/minhas` | cliente | reservar (várias horas) · listar as minhas |
| `PATCH /api/reservas/:id/cancelar` | cliente dono ou proprietário da arena | cancelar |
| `GET/POST /api/admin/arenas` · `PUT/DELETE /api/admin/arenas/:id` | proprietário | CRUD das próprias arenas (POST/PUT em `multipart/form-data` com `fotos`) |
| `POST /api/admin/arenas/:id/fotos` · `DELETE /api/admin/fotos/:id` | proprietário | gerenciar fotos |
| `POST /api/admin/arenas/:id/quadras` · `PUT/DELETE /api/admin/quadras/:id` | proprietário | gerenciar quadras |
| `GET /api/admin/reservas` | proprietário | reservas recebidas |

Login devolve um **JWT** (7 dias); o frontend o envia em `Authorization: Bearer ...`. Um proprietário só consegue mexer nas **suas** arenas.

## Ajustes conforme a documentação (PI-DSM-2)

- **Cabeçalho do proprietário:** só *Minhas Arenas*, *Explorar Arenas* e *Minhas Reservas*. As reservas recebidas ficam em *Minhas Arenas* (com botão atalho).
- **Reservas seguidas** da mesma quadra/dia aparecem como uma só: `2x · R$ 100,00` (cliente e proprietário).
- **Filtro por dia, mês ou ano** nas reservas do cliente e nas recebidas pelo proprietário.
- **Horários e duração:** o proprietário define faixas de horário com preço, a duração da reserva (30 min, 1h, 1h30, 2h) e os dias da semana atendidos; pode bloquear períodos (ex.: semana do ano novo).
- **Cadastro de arena** em seções (informações, modalidades com opção *Outro*, comodidades, fotos com arrastar e soltar, horários) + tela **Quadras** por arena.
- **Reserva com modal** de confirmação e de sucesso; **cancelamento com modal**, permitido até **8 h antes** (o servidor também valida) e **o proprietário é avisado por modal**.
- **Avaliações:** ao entrar após a data da reserva, um modal pede a nota; as avaliações aparecem na página da arena (média, distribuição, comentários).
- **Perfil** (`Meu perfil`) com dados diferentes para cliente (CPF, nascimento, modalidades favoritas) e proprietário (CNPJ, razão social, nº de arenas).
- Removido o botão *Ver no mapa*. Pagamento continua **na arena** (UC001).
- **Bug de segurança do "Meu Painel":** a sessão agora é uma única chave (token + usuário juntos), validada no servidor (`/api/auth/me`) a cada página; se outra aba entrar com outra conta, a aba antiga recarrega em vez de misturar contas. Todas as rotas de proprietário só devolvem dados do dono do token.

Se você já tinha o banco da versão anterior, rode `npm run db:setup` de novo: ele migra sem apagar dados.

## O que foi corrigido neste projeto

- Frontend era só protótipo estático (dados fixos, login que só redirecionava, reserva salva no `localStorage`). Agora tudo usa API + banco.
- Backend só tinha `GET /api/arenas` lendo o catálogo. Agora há autenticação, CRUD, upload de fotos e reservas.
- Banco: o vínculo admin↔arena era circular (admin exigia arena, arena exigia admin) e limitava 1 arena por dono → agora `ARENA.ID_Proprietario`. Não havia proteção contra reserva dupla → índice único + transação. Fotos: só uma URL → tabela `ARENA_FOTO`.
- `geocodificarArenas.js` só imprimia as coordenadas e nunca gravava → agora grava no banco.
- Corrigido o fuso horário (datas "voltavam" um dia) e o carregamento em UTF-8 do seed.
- Cadastro de proprietário exige CNPJ validado e persistido na conta (RN003). O cadastro da arena também registra os dados do estabelecimento; um mesmo CNPJ pode estar associado a mais de uma unidade.
- Removidos "Lembrar de mim" e "Esqueceu a senha?" (não existiam de fato). Recuperação de senha fica como melhoria futura.

## Próximos passos sugeridos

Recuperação de senha por e-mail · pagamento online · editar horários por dia da semana/feriados · testes automatizados · backup do banco.
