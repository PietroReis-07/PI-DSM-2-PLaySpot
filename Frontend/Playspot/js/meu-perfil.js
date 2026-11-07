(async function () {
  const { api, esc, telefone, dataBR } = PlaySpot;
  await UI.sessao;
  if (!PlaySpot.exigirLogin()) return;       // o perfil é sempre o do dono do token

  const { perfil: p } = await api("/perfil");
  const { modalidades } = await api("/modalidades");
  const admin = p.tipo === "admin";
  const cnpjF = (c) => c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "—";
  const linha = (r, v) => "<li><span>" + r + "</span><span>" + (v || "—") + "</span></li>";
  let chips;

  function ver() {
    document.getElementById("conteudo").innerHTML =
      '<aside class="perfil-card"><div class="avatar">' + esc(p.nome[0].toUpperCase()) + "</div><h2>" + esc(p.nome) + '</h2><span class="pill">' + (admin ? "Proprietário" : "Cliente") + "</span>" +
      '<p class="muted">Membro desde ' + dataBR(p.desde.slice(0, 10)) + "</p>" +
      (admin ? '<p class="muted"><strong>' + p.totalArenas + "</strong> arena(s) cadastrada(s)</p>" : "") +
      '<div style="display:grid;gap:8px;margin-top:14px"><button class="btn btn-primary" id="editar"><i class="fa-solid fa-pen"></i> Editar dados</button>' +
      '<button class="btn btn-outline" id="senha"><i class="fa-solid fa-key"></i> Alterar senha</button></div></aside>' +
      '<section class="form-section"><h3>' + (admin ? "Dados do proprietário" : "Dados pessoais") + '</h3><ul class="dados">' +
      linha("Nome", esc(p.nome)) + linha("E-mail", esc(p.email)) + linha("Telefone", esc(telefone(p.telefone))) +
      (admin ? linha("CNPJ", cnpjF(p.cnpj)) + linha("Razão social", esc(p.razaoSocial)) + linha("Cidade", esc([p.cidade, p.estado].filter(Boolean).join(" - ")))
             : linha("CPF", esc(p.cpfMascarado)) + linha("Data de nascimento", p.dataNasc ? dataBR(p.dataNasc) : "") + linha("Cidade", esc([p.cidade, p.estado].filter(Boolean).join(" - ")))) +
      (admin ? "" : linha("Modalidades favoritas", esc(modalidades.filter(m => p.modalidades.includes(m.ID_Modalidade)).map(m => m.Nome).join(", ")))) +
      "</ul></section>";
    document.getElementById("editar").onclick = editar;
    document.getElementById("senha").onclick = trocarSenha;
  }

  async function editar() {
    const ok = await UI.modal({ titulo: "Editar dados", icone: "fa-pen",
      html: '<p class="alert alert-error hidden" id="eErro"></p><div class="grid2"><div class="form-group span2"><label>Nome *</label><input id="eNome" maxlength="100" value="' + esc(p.nome) + '"></div>' +
        '<div class="form-group"><label>Telefone *</label><input id="eTel" value="' + esc(telefone(p.telefone)) + '"></div>' +
        '<div class="form-group"><label>E-mail</label><input class="input-ro" value="' + esc(p.email) + '" disabled></div>' +
        (admin ? '<div class="form-group span2"><label>Razão social</label><input id="eRazao" maxlength="120" value="' + esc(p.razaoSocial || "") + '"></div>'
               : '<div class="form-group"><label>Data de nascimento</label><input id="eNasc" type="date" value="' + (p.dataNasc || "") + '"></div>') +
        '<div class="form-group"><label>Cidade</label><input id="eCid" maxlength="60" value="' + esc(p.cidade || "") + '"></div><div class="form-group"><label>UF</label><input id="eUf" maxlength="2" value="' + esc(p.estado || "") + '"></div></div>' +
        (admin ? "" : '<label class="mini">Modalidades favoritas</label><div id="eMods"></div>'),
      aoAbrir: (el) => { if (!admin) chips = UI.chips(el.querySelector("#eMods"), { valores: p.modalidades, opcoes: modalidades.filter(m => m.Padrao).map(m => ({ valor: m.ID_Modalidade, rotulo: m.Nome, icone: UI.iconeModalidade(m.Nome) })) }); },
      botoes: [{ texto: "Cancelar", valor: false }, { texto: "Salvar", valor: true, classe: "btn-primary", acao: async (el) => {
        const q = (s) => el.querySelector(s);
        try {
          await api("/perfil", { method: "PUT", corpo: { nome: q("#eNome").value, telefone: q("#eTel").value, cidade: q("#eCid").value, estado: q("#eUf").value,
            razaoSocial: admin ? q("#eRazao").value : undefined, dataNasc: admin ? undefined : q("#eNasc").value, modalidades: admin ? undefined : chips.get().map(Number) } });
        } catch (e) { const er = q("#eErro"); er.textContent = e.message; er.classList.remove("hidden"); return false; }
      } }] });
    if (ok) { UI.toast("Dados atualizados."); location.reload(); }
  }

  async function trocarSenha() {
    const ok = await UI.modal({ titulo: "Alterar senha", icone: "fa-key",
      html: '<p class="alert alert-error hidden" id="sErro"></p><div class="form-group"><label>Senha atual</label><input id="sAtual" type="password" autocomplete="current-password"></div>' +
        '<div class="form-group" style="margin-top:10px"><label>Nova senha (mín. 8)</label><input id="sNova" type="password" autocomplete="new-password"></div>',
      botoes: [{ texto: "Cancelar", valor: false }, { texto: "Alterar", valor: true, classe: "btn-primary", acao: async (el) => {
        try { await api("/perfil/senha", { method: "PUT", corpo: { senhaAtual: el.querySelector("#sAtual").value, novaSenha: el.querySelector("#sNova").value } }); }
        catch (e) { const er = el.querySelector("#sErro"); er.textContent = e.message; er.classList.remove("hidden"); return false; }
      } }] });
    if (ok) UI.toast("Senha alterada.");
  }
  ver();
})();
