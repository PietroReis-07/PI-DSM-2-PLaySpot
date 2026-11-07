-- =====================================================================
--  PlaySpot - Schema do banco de dados (MySQL 8+ / MariaDB 10.4+)
--
--  Como rodar:   mysql -u root -p < database/schema.sql
--  Depois:       mysql -u root -p playspot < database/seed.sql
--  (ou simplesmente: npm run db:setup)
--
--  Este arquivo pode ser executado mais de uma vez sem apagar dados
--  (usa IF NOT EXISTS).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS playspot
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE playspot;

-- ---------------------------------------------------------------------
--  USUARIO: clientes (atletas) e admins (proprietários de arenas).
--  Clientes informam CPF; proprietários informam CNPJ obrigatório no cadastro (RN003).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USUARIO (
    ID_Usuario   INT AUTO_INCREMENT PRIMARY KEY,
    Nome         VARCHAR(100) NOT NULL,
    CPF          CHAR(11)     NULL UNIQUE,
    CNPJ         CHAR(14)     NULL UNIQUE,
    Email        VARCHAR(100) NOT NULL UNIQUE,
    Senha_hash   VARCHAR(255) NOT NULL,
    Telefone     VARCHAR(15)  NOT NULL,
    Data_nasc    DATE         NULL,
    Cidade       VARCHAR(60)  NULL,
    Estado       CHAR(2)      NULL,
    Razao_social VARCHAR(120) NULL,          -- só proprietários
    Tipo_usuario ENUM('cliente', 'admin') NOT NULL DEFAULT 'cliente',
    Criado_em    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
--  ARENA: um proprietário (admin) pode ter VÁRIAS arenas.
--  Ativa = 0 significa "excluída" (soft delete): preserva o histórico
--  de reservas sem quebrar as chaves estrangeiras.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA (
    ID_Arena        INT AUTO_INCREMENT PRIMARY KEY,
    ID_Proprietario INT          NOT NULL,
    Nome            VARCHAR(100) NOT NULL,
    CNPJ            VARCHAR(14)  NOT NULL,
    Descricao       TEXT         NULL,

    Rua     VARCHAR(100) NOT NULL,
    Numero  VARCHAR(10)  NOT NULL,            -- aceita "s/n"
    Bairro  VARCHAR(60)  NULL,
    CEP     CHAR(8)      NOT NULL,
    Cidade  VARCHAR(60)  NOT NULL DEFAULT 'Franca',
    Estado  CHAR(2)      NOT NULL DEFAULT 'SP',

    -- Horario_ini/fim = menor início e maior fim das faixas ativas (ARENA_FAIXA);
    -- são mantidos pelo sistema só para consulta rápida.
    Horario_ini TIME NOT NULL,
    Horario_fim TIME NOT NULL,

    -- Duração de cada bloco reservável, em minutos (30, 60, 90, 120...).
    Duracao_slot SMALLINT NOT NULL DEFAULT 60,
    -- Dias da semana em que a arena aceita reservas (0=domingo ... 6=sábado).
    Dias_semana VARCHAR(20) NOT NULL DEFAULT '0,1,2,3,4,5,6',

    Latitude  DECIMAL(10,7) NULL,
    Longitude DECIMAL(10,7) NULL,

    Ativa     TINYINT(1)   NOT NULL DEFAULT 1,
    Criado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Nome único entre arenas ativas; um mesmo CNPJ pode possuir várias unidades.
    Nome_ativo VARCHAR(100) GENERATED ALWAYS AS (IF(Ativa = 1, Nome, NULL)) STORED,

    CONSTRAINT uq_arena_nome UNIQUE (Nome_ativo),
    CONSTRAINT fk_arena_proprietario
        FOREIGN KEY (ID_Proprietario) REFERENCES USUARIO(ID_Usuario),
    CONSTRAINT chk_arena_horario CHECK (Horario_fim > Horario_ini),
    INDEX idx_arena_cidade (Cidade, Ativa)
);

CREATE TABLE IF NOT EXISTS ARENA_TELEFONE (
    ID_Arena_Telefone INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena INT NOT NULL,
    Telefone VARCHAR(15) NOT NULL,
    CONSTRAINT fk_arena_telefone
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT uq_arena_telefone UNIQUE (ID_Arena, Telefone)
);

-- ---------------------------------------------------------------------
--  ARENA_FOTO: o BANCO guarda só o CAMINHO da imagem
--  (ex.: /uploads/arenas/ab12cd.jpg). O arquivo em si fica na pasta
--  Backend/uploads/. Nunca salve a imagem (BLOB) dentro do banco.
--  A foto com menor "Ordem" é a capa da arena.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA_FOTO (
    ID_Foto  INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena INT          NOT NULL,
    Caminho  VARCHAR(255) NOT NULL,
    Ordem    INT          NOT NULL DEFAULT 0,
    CONSTRAINT fk_foto_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS QUADRA (
    ID_Quadra  INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena   INT NOT NULL,
    Tipo_piso  VARCHAR(30) NOT NULL,
    Numero     INT NOT NULL,
    Valor_hora DECIMAL(7,2) NOT NULL,
    Ativa      TINYINT(1) NOT NULL DEFAULT 1,

    -- Número da quadra único só entre quadras ativas (mesmo truque da ARENA).
    Numero_ativo INT GENERATED ALWAYS AS (IF(Ativa = 1, Numero, NULL)) STORED,

    CONSTRAINT fk_quadra_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT uq_quadra_numero UNIQUE (ID_Arena, Numero_ativo),
    CONSTRAINT chk_quadra_numero CHECK (Numero > 0),
    CONSTRAINT chk_quadra_valor  CHECK (Valor_hora > 0)
);

CREATE TABLE IF NOT EXISTS MODALIDADE (
    ID_Modalidade INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL UNIQUE,
    -- 1 = modalidade da lista oficial; 0 = criada por um proprietário na opção "Outro".
    Padrao TINYINT(1) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS QUADRA_MODALIDADE (
    ID_Quadra_Mdl INT AUTO_INCREMENT PRIMARY KEY,
    ID_Quadra     INT NOT NULL,
    ID_Modalidade INT NOT NULL,
    CONSTRAINT fk_qm_quadra
        FOREIGN KEY (ID_Quadra) REFERENCES QUADRA(ID_Quadra) ON DELETE CASCADE,
    CONSTRAINT fk_qm_modalidade
        FOREIGN KEY (ID_Modalidade) REFERENCES MODALIDADE(ID_Modalidade),
    CONSTRAINT uq_quadra_modalidade UNIQUE (ID_Quadra, ID_Modalidade)
);

-- ---------------------------------------------------------------------
--  RESERVA: cada linha = 1 hora reservada em 1 quadra.
--  Codigo_comprovante identifica os horários de uma mesma solicitação.
--  (Reservar 2 horas seguidas cria 2 linhas.)
--
--  Anti-conflito no próprio banco: a coluna gerada "Ativa" vale 1 quando
--  a reserva está CONFIRMADA e NULL quando CANCELADA. Como o UNIQUE
--  ignora NULL, a mesma quadra/data/hora só pode ter UMA reserva
--  confirmada, mas pode ser reservada de novo após um cancelamento.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS RESERVA (
    ID_Reserva INT AUTO_INCREMENT PRIMARY KEY,
    ID_Quadra  INT NOT NULL,
    ID_Usuario INT NOT NULL,

    Valor_hora  DECIMAL(7,2) NOT NULL,      -- preço congelado no momento da reserva
    Data        DATE NOT NULL,
    Hora_inicio TIME NOT NULL,
    Hora_fim    TIME NOT NULL,

    Status ENUM('CONFIRMADA', 'CANCELADA') NOT NULL DEFAULT 'CONFIRMADA',
    Codigo_comprovante CHAR(12) NULL,
    Criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    Ativa TINYINT GENERATED ALWAYS AS (IF(Status = 'CONFIRMADA', 1, NULL)) STORED,

    CONSTRAINT fk_reserva_quadra
        FOREIGN KEY (ID_Quadra) REFERENCES QUADRA(ID_Quadra),
    CONSTRAINT fk_reserva_usuario
        FOREIGN KEY (ID_Usuario) REFERENCES USUARIO(ID_Usuario),
    CONSTRAINT chk_reserva_valor   CHECK (Valor_hora > 0),
    CONSTRAINT chk_reserva_horario CHECK (Hora_fim > Hora_inicio),
    CONSTRAINT uq_reserva_horario_ativo
        UNIQUE (ID_Quadra, Data, Hora_inicio, Ativa),
    INDEX idx_reserva_usuario (ID_Usuario, Data)
);


-- ---------------------------------------------------------------------
--  Modalidades que a ARENA oferece (a quadra escolhe entre elas).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA_MODALIDADE (
    ID_Arena      INT NOT NULL,
    ID_Modalidade INT NOT NULL,
    PRIMARY KEY (ID_Arena, ID_Modalidade),
    CONSTRAINT fk_am_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT fk_am_modalidade
        FOREIGN KEY (ID_Modalidade) REFERENCES MODALIDADE(ID_Modalidade)
);

-- ---------------------------------------------------------------------
--  Infraestrutura & comodidades (vestiários, wifi, estacionamento...).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS COMODIDADE (
    ID_Comodidade INT AUTO_INCREMENT PRIMARY KEY,
    Nome  VARCHAR(60) NOT NULL UNIQUE,
    Icone VARCHAR(40) NOT NULL DEFAULT 'fa-check'
);

CREATE TABLE IF NOT EXISTS ARENA_COMODIDADE (
    ID_Arena      INT NOT NULL,
    ID_Comodidade INT NOT NULL,
    PRIMARY KEY (ID_Arena, ID_Comodidade),
    CONSTRAINT fk_ac_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT fk_ac_comodidade
        FOREIGN KEY (ID_Comodidade) REFERENCES COMODIDADE(ID_Comodidade)
);

-- ---------------------------------------------------------------------
--  Horários em que a arena aceita reservas (ex.: Manhã 08-12, Tarde 14-18).
--  Os blocos reservaveis são gerados a partir daqui, usando ARENA.Duracao_slot.
--  Valor_hora preenchido = preço da faixa; NULL = usa o valor da quadra.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA_FAIXA (
    ID_Faixa   INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena   INT NOT NULL,
    Nome       VARCHAR(30) NOT NULL,
    Hora_ini   TIME NOT NULL,
    Hora_fim   TIME NOT NULL,
    Valor_hora DECIMAL(7,2) NULL,
    Ativa      TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_faixa_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT chk_faixa_horario CHECK (Hora_fim > Hora_ini),
    CONSTRAINT chk_faixa_valor CHECK (Valor_hora IS NULL OR Valor_hora > 0)
);

-- ---------------------------------------------------------------------
--  Períodos em que a arena NÃO aceita reservas (ex.: semana do ano novo).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA_BLOQUEIO (
    ID_Bloqueio INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena    INT NOT NULL,
    Data_ini    DATE NOT NULL,
    Data_fim    DATE NOT NULL,
    Motivo      VARCHAR(100) NULL,
    CONSTRAINT fk_bloqueio_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT chk_bloqueio_datas CHECK (Data_fim >= Data_ini)
);

-- ---------------------------------------------------------------------
--  Esportes preferidos do usuário (tela "Meu perfil").
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USUARIO_MODALIDADE (
    ID_Usuario    INT NOT NULL,
    ID_Modalidade INT NOT NULL,
    PRIMARY KEY (ID_Usuario, ID_Modalidade),
    CONSTRAINT fk_um_usuario
        FOREIGN KEY (ID_Usuario) REFERENCES USUARIO(ID_Usuario) ON DELETE CASCADE,
    CONSTRAINT fk_um_modalidade
        FOREIGN KEY (ID_Modalidade) REFERENCES MODALIDADE(ID_Modalidade)
);

-- ---------------------------------------------------------------------
--  NOTIFICACAO: avisos mostrados em modal (nova reserva, cancelamento).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS NOTIFICACAO (
    ID_Notificacao INT AUTO_INCREMENT PRIMARY KEY,
    ID_Usuario     INT NOT NULL,                 -- quem recebe
    Tipo           ENUM('NOVA_RESERVA', 'CANCELAMENTO') NOT NULL,
    Titulo         VARCHAR(100) NOT NULL,
    Mensagem       VARCHAR(500) NOT NULL,
    Lida           TINYINT(1) NOT NULL DEFAULT 0,
    Criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_usuario
        FOREIGN KEY (ID_Usuario) REFERENCES USUARIO(ID_Usuario) ON DELETE CASCADE,
    INDEX idx_notif_usuario (ID_Usuario, Lida, Criado_em)
);

-- ---------------------------------------------------------------------
--  AVALIACAO: o cliente avalia a arena depois de jogar. Uma avaliação por
--  usuário / arena / dia de jogo.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS AVALIACAO (
    ID_Avaliacao INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena     INT NOT NULL,
    ID_Usuario   INT NOT NULL,
    Data_jogo    DATE NOT NULL,
    Nota         TINYINT NOT NULL,
    Comentario   VARCHAR(1000) NULL,
    Criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aval_arena
        FOREIGN KEY (ID_Arena) REFERENCES ARENA(ID_Arena) ON DELETE CASCADE,
    CONSTRAINT fk_aval_usuario
        FOREIGN KEY (ID_Usuario) REFERENCES USUARIO(ID_Usuario) ON DELETE CASCADE,
    CONSTRAINT chk_aval_nota CHECK (Nota BETWEEN 1 AND 5),
    CONSTRAINT uq_aval UNIQUE (ID_Arena, ID_Usuario, Data_jogo),
    INDEX idx_aval_arena (ID_Arena, Criado_em)
);

-- ---------------------------------------------------------------------
--  ARENA_CATALOGO: arenas de Franca levantadas na internet (ainda NÃO
--  são parceiras). Servem para popular o mapa.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ARENA_CATALOGO (
    ID_Local INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(120) NOT NULL UNIQUE,
    Endereco_completo VARCHAR(255) NOT NULL,
    Cidade VARCHAR(60) NOT NULL DEFAULT 'Franca',
    Estado CHAR(2) NOT NULL DEFAULT 'SP',
    CEP CHAR(8) NULL,
    Telefone VARCHAR(20) NULL,
    Latitude  DECIMAL(10,7) NULL,
    Longitude DECIMAL(10,7) NULL,
    Fonte_url VARCHAR(500) NULL,
    Situacao ENUM('PENDENTE', 'VERIFICAR', 'CONFIRMADO') NOT NULL DEFAULT 'VERIFICAR',
    Data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
