(async function () {
  const { api, esc, urlFoto, mostrarMensagem } = PlaySpot;
  await UI.sessao;
  if (!PlaySpot.exigirLogin("admin")) return;

  const $ = (id) => document.getElementById(id);
  const idEdicao = Number(new URLSearchParams(location.search).get("id")) || null;
  let novasFotos = [];          // File[] ainda não enviados
  let fotosAtuais = [];         // fotos já salvas (edição)
  let outraId = null;

  // ---------- máscaras ----------
  const dig = (v) => v.replace(/\D/g, "");
  const mascara = (el, fn) => el.addEventListener("input", () => { el.value = fn(dig(el.value)); });
  mascara($("cnpj"), d => d.slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2"));
  mascara($("cep"), d => d.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"));
  mascara($("telefone"), d => d.length > 10 ? d.slice(0, 11).replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3") : d.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3"));

  // CEP -> endereço (ViaCEP, opcional: se não houver internet o usuário digita à mão)
  $("cep").addEventListener("blur", async () => {
    const c = dig($("cep").value); if (c.length !== 8) return;
    try {
      const r = await (await fetch("https://viacep.com.br/ws/" + c + "/json/")).json();
      if (r.erro) return;
      if (!$("rua").value) $("rua").value = r.logradouro || "";
      if (!$("bairro").value) $("bairro").value = r.bairro || "";
      if (!$("cidade").value) $("cidade").value = r.localidade || "";
      if (!$("estado").value) $("estado").value = r.uf || "";
    } catch {}
  });

  // ---------- modalidades (chips + "Outro") e comodidades ----------
  const [{ modalidades }, { comodidades }] = await Promise.all([api("/modalidades"), api("/comodidades")]);
  const padrao = modalidades.filter(m => m.Padrao);
  const chipMod = UI.chips($("modalidades"), {
    opcoes: padrao.map(m => ({ valor: m.ID_Modalidade, rotulo: m.Nome, icone: UI.iconeModalidade(m.Nome) })).concat([{ valor: "outro", rotulo: "Outro", icone: "fa-plus" }]),
    onChange: (v) => $("boxOutra").classList.toggle("hidden", !v.includes("outro"))
  });
  const chipCom = UI.chips($("comodidades"), { opcoes: comodidades.map(c => ({ valor: c.ID_Comodidade, rotulo: c.Nome, icone: c.Icone })) });
  const selDuracao = UI.select($("duracao"), { icone: "fa-hourglass-half", valor: "60",
    opcoes: [["30", "30 minutos"], ["60", "1 hora"], ["90", "1 hora e 30 minutos"], ["120", "2 horas"]].map(([valor, rotulo]) => ({ valor, rotulo })) });
  const chipDias = UI.chips($("dias"), { valores: [0, 1, 2, 3, 4, 5, 6], opcoes: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((r, i) => ({ valor: i, rotulo: r })) });

  // ---------- faixas e bloqueios ----------
  function addFaixa(f = { nome: "", ini: "08:00", fim: "22:00", valor: "" }) {
    const d = document.createElement("div"); d.className = "faixa";
    d.innerHTML = '<div><label>Nome</label><input class="f-nome" maxlength="30" placeholder="Ex: Manhã" value="' + esc(f.nome) + '"></div>' +
      '<div><label>Início</label><input class="f-ini" type="time" value="' + f.ini + '"></div><div><label>Fim</label><input class="f-fim" type="time" value="' + f.fim + '"></div>' +
      '<div><label>R$/hora</label><input class="f-valor" type="number" min="0" step="0.01" placeholder="da quadra" value="' + (f.valor ?? "") + '"></div>' +
      '<button type="button" class="btn btn-danger-outline btn-sm" aria-label="Remover faixa"><i class="fa-solid fa-trash"></i></button>';
    d.querySelector("button").onclick = () => d.remove();
    $("faixas").appendChild(d);
  }
  function addBloqueio(b = { ini: "", fim: "", motivo: "" }) {
    const d = document.createElement("div"); d.className = "bloqueio";
    d.innerHTML = '<div><label>De</label><input class="b-ini" type="date" value="' + b.ini + '"></div><div><label>Até</label><input class="b-fim" type="date" value="' + b.fim + '"></div>' +
      '<div><label>Motivo</label><input class="b-mot" maxlength="100" placeholder="Ex: Ano novo" value="' + esc(b.motivo || "") + '"></div>' +
      '<button type="button" class="btn btn-danger-outline btn-sm" aria-label="Remover período"><i class="fa-solid fa-trash"></i></button>';
    d.querySelector("button").onclick = () => d.remove();
    $("bloqueios").appendChild(d);
  }
  $("addFaixa").onclick = () => addFaixa({ nome: "", ini: "08:00", fim: "22:00", valor: "" });
  $("addBloqueio").onclick = () => addBloqueio();

  // ---------- fotos ----------
  function previas() {
    $("previas").innerHTML = fotosAtuais.map(f => '<div class="previa"><img src="' + esc(urlFoto(f.Caminho)) + '" alt=""><button type="button" data-foto="' + f.ID_Foto + '" aria-label="Remover foto"><i class="fa-solid fa-xmark"></i></button></div>').join("") +
      novasFotos.map((f, i) => '<div class="previa"><img src="' + URL.createObjectURL(f) + '" alt=""><button type="button" data-novo="' + i + '" aria-label="Remover foto"><i class="fa-solid fa-xmark"></i></button></div>').join("");
  }
  function receber(files) {
    for (const f of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { UI.toast("\"" + f.name + "\": use JPG, PNG ou WEBP.", "erro"); continue; }
      if (f.size > 5 * 1024 * 1024) { UI.toast("\"" + f.name + "\" passa de 5 MB.", "erro"); continue; }
      if (fotosAtuais.length + novasFotos.length >= 8) { UI.toast("Máximo de 8 fotos.", "erro"); break; }
      novasFotos.push(f);
    }
    previas();
  }
  $("drop").onclick = () => $("arquivos").click();
  $("drop").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("arquivos").click(); } };
  $("arquivos").onchange = (e) => { receber([...e.target.files]); e.target.value = ""; };
  ["dragover", "dragenter"].forEach(n => $("drop").addEventListener(n, (e) => { e.preventDefault(); $("drop").classList.add("sobre"); }));
  ["dragleave", "drop"].forEach(n => $("drop").addEventListener(n, (e) => { e.preventDefault(); $("drop").classList.remove("sobre"); }));
  $("drop").addEventListener("drop", (e) => receber([...e.dataTransfer.files]));
  $("previas").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.novo !== undefined) { novasFotos.splice(+b.dataset.novo, 1); return previas(); }
    const ok = await UI.confirmar({ titulo: "Remover foto?", icone: "fa-image", perigo: true, confirmar: "Remover", html: "<p>A foto será apagada da arena.</p>",
      acao: async () => { await api("/admin/fotos/" + b.dataset.foto, { method: "DELETE" }); } });
    if (ok) { fotosAtuais = fotosAtuais.filter(f => String(f.ID_Foto) !== b.dataset.foto); previas(); }
  });

  // ---------- modo edição ----------
  if (idEdicao) {
    try {
      const a = (await api("/admin/arenas/" + idEdicao)).arena;
      $("titulo").textContent = "Editar arena"; $("txtSalvar").textContent = "Salvar alterações"; document.title = "PlaySpot - Editar arena";
      const cn = a.CNPJ; $("cnpj").value = cn ? cn.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "";
      $("nome").value = a.Nome; $("descricao").value = a.Descricao || ""; $("cep").value = (a.CEP || "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
      ["rua", "numero", "bairro", "cidade", "estado"].forEach(k => $(k).value = a[k[0].toUpperCase() + k.slice(1)] || "");
      if (a.Telefones[0]) { $("telefone").value = a.Telefones[0]; $("telefone").dispatchEvent(new Event("input")); }
      // modalidades fora do padrão (criadas via "Outro") entram como chip extra já marcado
      const extras = a.Modalidades.filter(m => !m.Padrao);
      chipMod.setOpcoes(padrao.concat(extras).map(m => ({ valor: m.ID_Modalidade, rotulo: m.Nome, icone: UI.iconeModalidade(m.Nome) })).concat([{ valor: "outro", rotulo: "Outro", icone: "fa-plus" }]));
      chipMod.set(a.Modalidades.map(m => m.ID_Modalidade));
      chipCom.set(a.Comodidades.map(c => c.ID_Comodidade));
      selDuracao.set(String(a.Duracao_slot)); chipDias.set(a.Dias_semana);
      fotosAtuais = a.Fotos; previas();
      a.Faixas.forEach(f => addFaixa({ nome: f.Nome, ini: f.Hora_ini, fim: f.Hora_fim, valor: f.Valor_hora }));
      a.Bloqueios.forEach(b => addBloqueio({ ini: b.Data_ini, fim: b.Data_fim, motivo: b.Motivo }));
    } catch (e) { mostrarMensagem($("msg"), e.status === 404 ? "Arena não encontrada." : e.message); return; }
  } else {
    addFaixa({ nome: "Funcionamento", ini: "08:00", fim: "22:00", valor: "" });
  }

  // ---------- envio ----------
  function marcarErro(campo, texto) {
    document.querySelectorAll(".campo-erro").forEach(e => { e.classList.remove("campo-erro"); const m = e.querySelector(".campo-erro-msg"); if (m) m.remove(); });
    const alvo = campo && document.querySelector('[data-campo="' + campo + '"]');
    mostrarMensagem($("msg"), texto);
    if (alvo) {
      alvo.classList.add("campo-erro");
      const m = document.createElement("div"); m.className = "campo-erro-msg"; m.textContent = texto; alvo.appendChild(m);
      alvo.scrollIntoView({ behavior: "smooth", block: "center" });
      const i = alvo.querySelector("input,textarea,button"); if (i) i.focus({ preventScroll: true });
    } else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    marcarErro(null, "");
    const mods = chipMod.get();
    const outro = mods.includes("outro");
    const ids = mods.filter(v => v !== "outro").map(Number);
    if (!$("nome").value.trim()) return marcarErro("nome", "Informe o nome da arena.");
    if (dig($("cnpj").value).length !== 14) return marcarErro("cnpj", "Informe o CNPJ com 14 dígitos.");
    if (dig($("cep").value).length !== 8) return marcarErro("cep", "Informe o CEP.");
    if (!$("rua").value.trim()) return marcarErro("rua", "Informe a rua.");
    if (!$("numero").value.trim()) return marcarErro("numero", "Informe o número.");
    if (!$("cidade").value.trim()) return marcarErro("cidade", "Informe a cidade.");
    if (!/^[A-Za-z]{2}$/.test($("estado").value.trim())) return marcarErro("estado", "Use a sigla do estado (ex.: SP).");
    if (!ids.length && !outro) return marcarErro("modalidades", "Selecione ao menos uma modalidade.");
    if (outro && !$("modalidadeOutra").value.trim()) return marcarErro("modalidadeOutra", "Informe qual é a outra modalidade.");
    if (!chipDias.get().length) return marcarErro("diasSemana", "Selecione ao menos um dia da semana.");

    const faixas = [...document.querySelectorAll(".faixa")].map(d => ({ nome: d.querySelector(".f-nome").value, horaIni: d.querySelector(".f-ini").value, horaFim: d.querySelector(".f-fim").value, valorHora: d.querySelector(".f-valor").value }));
    if (!faixas.length) return marcarErro("faixas", "Adicione ao menos uma faixa de horário.");
    if (faixas.some(f => !f.horaIni || !f.horaFim)) return marcarErro("faixas", "Preencha início e fim de todas as faixas.");
    const bloqueios = [...document.querySelectorAll(".bloqueio")].map(d => ({ dataIni: d.querySelector(".b-ini").value, dataFim: d.querySelector(".b-fim").value, motivo: d.querySelector(".b-mot").value }));
    if (bloqueios.some(b => !b.dataIni || !b.dataFim)) return marcarErro("bloqueios", "Preencha as duas datas dos períodos bloqueados.");

    const ok = await UI.modal({ titulo: idEdicao ? "Salvar alterações?" : "Publicar arena?", icone: "fa-circle-check",
      html: "<p>" + (idEdicao ? "As mudanças valem imediatamente para novas reservas." : "Sua arena ficará visível para os clientes. Você poderá cadastrar as quadras em seguida.") + "</p>",
      botoes: [{ texto: "Revisar", valor: false }, { texto: idEdicao ? "Salvar" : "Publicar", valor: true, classe: "btn-primary" }] });
    if (!ok) return;

    const fd = new FormData();
    const txt = { nome: $("nome").value, cnpj: dig($("cnpj").value), descricao: $("descricao").value, cep: dig($("cep").value), rua: $("rua").value, numero: $("numero").value,
      bairro: $("bairro").value, cidade: $("cidade").value, estado: $("estado").value, telefone: dig($("telefone").value), duracaoSlot: selDuracao.get(), modalidadeOutra: outro ? $("modalidadeOutra").value : "" };
    Object.entries(txt).forEach(([k, v]) => fd.append(k, v));
    fd.append("modalidades", JSON.stringify(ids)); fd.append("comodidades", JSON.stringify(chipCom.get().map(Number)));
    fd.append("diasSemana", JSON.stringify(chipDias.get().map(Number))); fd.append("faixas", JSON.stringify(faixas)); fd.append("bloqueios", JSON.stringify(bloqueios));
    novasFotos.forEach(f => fd.append("fotos", f));

    const btn = $("btnSalvar"); btn.disabled = true;
    try {
      const r = await api(idEdicao ? "/admin/arenas/" + idEdicao : "/admin/arenas", { method: idEdicao ? "PUT" : "POST", corpo: fd });
      if (idEdicao) { UI.toast("Arena atualizada."); setTimeout(() => (location.href = "painel-admin.html"), 500); return; }
      const ir = await UI.modal({ titulo: "Arena publicada!", icone: "fa-circle-check", html: "<p><strong>" + esc(r.arena.Nome) + "</strong> já está no ar. Agora cadastre as quadras para liberar reservas.</p>",
        botoes: [{ texto: "Ir para o painel", valor: false }, { texto: "Cadastrar quadras", valor: true, classe: "btn-primary" }], fechavel: false });
      location.href = ir ? "gerenciar-quadras.html?id=" + r.arena.ID_Arena : "painel-admin.html";
    } catch (err) { marcarErro(err.campo, err.message); btn.disabled = false; }
  });
})();
