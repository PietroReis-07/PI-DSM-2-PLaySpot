
CREATE DATABASE playspot
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE playspot;



CREATE TABLE ARENA (
    ID_Arena INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL UNIQUE,
    CNPJ CHAR(14) NOT NULL UNIQUE,

    Rua VARCHAR(100) NOT NULL,
    Numero INT NOT NULL,
    CEP CHAR(8) NOT NULL,
    Cidade VARCHAR(60) NOT NULL DEFAULT 'Franca',
    Estado CHAR(2) NOT NULL DEFAULT 'SP',

    Horario_ini TIME NOT NULL,
    Horario_fim TIME NOT NULL,

    Foto_url VARCHAR(500) NULL,
    Latitude DECIMAL(10,7) NULL,
    Longitude DECIMAL(10,7) NULL,

    CONSTRAINT chk_arena_numero
        CHECK (Numero > 0),

    CONSTRAINT chk_arena_horario
        CHECK (Horario_fim > Horario_ini)
);



CREATE TABLE ARENA_TELEFONE (
    ID_Arena_Telefone INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena INT NOT NULL,
    Telefone CHAR(11) NOT NULL,

    CONSTRAINT fk_arena_telefone
        FOREIGN KEY (ID_Arena)
        REFERENCES ARENA(ID_Arena),

    CONSTRAINT uq_arena_telefone
        UNIQUE (ID_Arena, Telefone)
);



CREATE TABLE QUADRA (
    ID_Quadra INT AUTO_INCREMENT PRIMARY KEY,
    ID_Arena INT NOT NULL,
    Tipo_piso VARCHAR(30) NOT NULL,
    Numero INT NOT NULL,
    Valor_hora DECIMAL(7,2) NOT NULL,

    CONSTRAINT fk_quadra_arena
        FOREIGN KEY (ID_Arena)
        REFERENCES ARENA(ID_Arena),

    CONSTRAINT uq_quadra_numero
        UNIQUE (ID_Arena, Numero),

    CONSTRAINT chk_quadra_numero
        CHECK (Numero > 0),

    CONSTRAINT chk_quadra_valor
        CHECK (Valor_hora > 0)
);



CREATE TABLE MODALIDADE (
    ID_Modalidade INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL UNIQUE
);



CREATE TABLE QUADRA_MODALIDADE (
    ID_Quadra_Mdl INT AUTO_INCREMENT PRIMARY KEY,
    ID_Quadra INT NOT NULL,
    ID_Modalidade INT NOT NULL,

    CONSTRAINT fk_quadra_modalidade_quadra
        FOREIGN KEY (ID_Quadra)
        REFERENCES QUADRA(ID_Quadra),

    CONSTRAINT fk_quadra_modalidade_modalidade
        FOREIGN KEY (ID_Modalidade)
        REFERENCES MODALIDADE(ID_Modalidade),

    CONSTRAINT uq_quadra_modalidade
        UNIQUE (ID_Quadra, ID_Modalidade)
);



CREATE TABLE USUARIO (
    ID_Usuario INT AUTO_INCREMENT PRIMARY KEY,
    Nome VARCHAR(100) NOT NULL,
    CPF CHAR(11) NOT NULL UNIQUE,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Senha_hash VARCHAR(255) NOT NULL,
    Telefone CHAR(11) NOT NULL,
    Data_nasc DATE NOT NULL,

    Tipo_usuario ENUM('cliente', 'admin')
        NOT NULL DEFAULT 'cliente',

    ID_Arena INT NULL,

    CONSTRAINT fk_usuario_arena
        FOREIGN KEY (ID_Arena)
        REFERENCES ARENA(ID_Arena),

  
    CONSTRAINT uq_usuario_arena
        UNIQUE (ID_Arena),

    CONSTRAINT chk_usuario_tipo_arena
        CHECK (
            (Tipo_usuario = 'cliente' AND ID_Arena IS NULL)
            OR
            (Tipo_usuario = 'admin' AND ID_Arena IS NOT NULL)
        )
);



CREATE TABLE RESERVA (
    ID_Reserva INT AUTO_INCREMENT PRIMARY KEY,
    ID_Quadra INT NOT NULL,
    ID_Usuario INT NOT NULL,

    Valor_hora DECIMAL(7,2) NOT NULL,
    Data DATE NOT NULL,
    Hora_inicio TIME NOT NULL,
    Hora_fim TIME NOT NULL,

    Status ENUM('CONFIRMADA', 'CANCELADA')
        NOT NULL DEFAULT 'CONFIRMADA',

    CONSTRAINT fk_reserva_quadra
        FOREIGN KEY (ID_Quadra)
        REFERENCES QUADRA(ID_Quadra),

    CONSTRAINT fk_reserva_usuario
        FOREIGN KEY (ID_Usuario)
        REFERENCES USUARIO(ID_Usuario),

    CONSTRAINT chk_reserva_valor
        CHECK (Valor_hora > 0),

    CONSTRAINT chk_reserva_horario
        CHECK (Hora_fim > Hora_inicio)
);


CREATE TABLE ARENA_CATALOGO (
    ID_Local INT AUTO_INCREMENT PRIMARY KEY,

    Nome VARCHAR(120) NOT NULL UNIQUE,
    Endereco_completo VARCHAR(255) NOT NULL,

    Cidade VARCHAR(60) NOT NULL DEFAULT 'Franca',
    Estado CHAR(2) NOT NULL DEFAULT 'SP',

    CEP CHAR(8) NULL,
    Telefone VARCHAR(20) NULL,

    Latitude DECIMAL(10,7) NULL,
    Longitude DECIMAL(10,7) NULL,

    Fonte_url VARCHAR(500) NULL,

    Situacao ENUM(
        'PENDENTE',
        'VERIFICAR',
        'CONFIRMADO'
    ) NOT NULL DEFAULT 'VERIFICAR',

    Data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO ARENA_CATALOGO
(Nome, Endereco_completo, CEP, Telefone, Fonte_url, Situacao)
VALUES

(
    'Arena Branco',
    'Av. Jaime Tellini, 4692 - Franca - SP',
    '14412248',
    '16993420332',
    'https://www.cylex.com.br/franca/arena-branco---nacional-centro-esportivo-13293515.html',
    'VERIFICAR'
),

(
    'Arena Rossato',
    'Av. Rio Branco, 807 - Estacao - Franca - SP',
    '14405080',
    '16992445084',
    'https://www.cylex.com.br/franca/arena-rossato-13293512.html',
    'VERIFICAR'
),

(
    'Arena Integração Sports',
    'Av. Chico Júlio, 2921 - Jardim Integracao - Franca - SP',
    '14405252',
    '16992703041',
    'https://www.locaisdobrasil.com.br/encontre/quadra-de-esportes/franca-sp',
    'VERIFICAR'
),

(
    'Arena Showbol Franca',
    'R. Major Moura Mattos, 1311 - Vila Rezende - Franca - SP',
    '14406528',
    '16992049911',
    'https://www.solutudo.com.br/empresas/sp/franca/campos-de-futebol-quadras/arena-showbol-franca-23065521',
    'VERIFICAR'
),

(
    'Arena São Gabriel',
    'R. Roza Gonzales Meneghetti, 2931 - Chacara Santo Antonio - Franca - SP',
    '14403260',
    '16991488980',
    'https://acharei.com.br/sp/franca/empresas/lazer_esportes_e_entretenimento/quadras_esportivas_aluguel',
    'VERIFICAR'
),

(
    'Lounge Beach Sport Bar',
    'Av. Rio Amazonas, 1404 - Residencial Amazonas - Franca - SP',
    '14406010',
    '16992958020',
    'https://acharei.com.br/sp/franca/empresas/lazer_esportes_e_entretenimento/quadras_esportivas_aluguel',
    'VERIFICAR'
),

(
    'Beach Club',
    'R. Bolivia, 1160 - Jardim Consolacao - Franca - SP',
    '14400070',
    '16994012259',
    'https://acharei.com.br/sp/franca/empresas/lazer_esportes_e_entretenimento/quadras_esportivas_aluguel',
    'VERIFICAR'
),

(
    'Gol de Placa',
    'R. Couto Magalhaes, 770 - Centro - Franca - SP',
    '14400020',
    '16991259071',
    'https://www.locaisdobrasil.com.br/encontre/quadra-de-esportes/franca-sp',
    'VERIFICAR'
),

(
    'Arena Total 90',
    'Av. Dom Pedro I, 940 - Jardim Dr. Antonio Petraglia - Franca - SP',
    '14409180',
    '16994515178',
    'https://acharei.com.br/sp/franca/empresas/lazer_esportes_e_entretenimento/quadras_esportivas_aluguel',
    'VERIFICAR'
),

(
    'Arena Paraty',
    'R. Angelo Naldi, s/n - Chacara - Franca - SP',
    '14403796',
    NULL,
    'https://www.locaisdobrasil.com.br/encontre/quadra-de-esportes/franca-sp',
    'VERIFICAR'
),

(
    'Arena Premium Franca',
    'R. Jose Garcia Gomes - Franca - SP',
    '14407101',
    '16992817889',
    'https://www.solutudo.com.br/empresas/sp/franca/campos-de-futebol-quadras',
    'VERIFICAR'
),

(
    'Personal Beach',
    'Av. Emilio Paludeto, 6170 - Vila Hipica - Franca - SP',
    NULL,
    '16999697446',
    'https://www.solutudo.com.br/empresas/sp/franca/campos-de-futebol-quadras',
    'VERIFICAR'
),

(
    'Saideira Sport Bar',
    'Av. Sao Vicente, 4981 - Jardim Noemia - Franca - SP',
    NULL,
    '16994433210',
    'https://www.solutudo.com.br/empresas/sp/franca/campos-de-futebol-quadras',
    'VERIFICAR'
);


