-- =====================================================================
--  PlaySpot - Dados iniciais (pode rodar mais de uma vez: INSERT IGNORE)
-- =====================================================================
USE playspot;

INSERT INTO MODALIDADE (Nome, Padrao) VALUES
    ('Futebol Society', 1),
    ('Futsal', 1),
    ('Beach Tennis', 1),
    ('Vôlei de Areia', 1),
    ('Vôlei de Quadra', 1),
    ('Futevôlei', 1),
    ('Padel', 1),
    ('Tênis', 1),
    ('Basquete', 1),
    ('Squash', 1)
ON DUPLICATE KEY UPDATE Padrao = 1;

INSERT IGNORE INTO COMODIDADE (Nome, Icone) VALUES
    ('Vestiários', 'fa-people-roof'),
    ('Chuveiro quente', 'fa-shower'),
    ('Estacionamento', 'fa-square-parking'),
    ('Wi-Fi', 'fa-wifi'),
    ('Lanchonete', 'fa-burger'),
    ('Aluguel de bolas', 'fa-futbol'),
    ('Bebedouro', 'fa-glass-water'),
    ('Churrasqueira', 'fa-fire-burner');

INSERT IGNORE INTO ARENA_CATALOGO
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


