// Usado por cadastro-usuario.html (cliente) e cadastro-admin.html (proprietário).
(function () {
  const { api, salvarSessao, mostrarMensagem } = PlaySpot;
  const ehAdmin = !!document.getElementById("registerAdminForm");
  const form = document.getElementById(ehAdmin ? "registerAdminForm" : "registerUserForm");
  const msg = document.getElementById("msg");
  const v = (id) => document.getElementById(id).value;
  const p = ehAdmin ? "admin" : "user";

  // Olho só no campo "Senha" (o de confirmação continua oculto, como pedido).
  const campoSenha = document.getElementById(p + "Password");
  const olho = document.getElementById("togglePassword");
  olho.addEventListener("click", () => {
    const mostrar = campoSenha.type === "password";
    campoSenha.type = mostrar ? "text" : "password";
    olho.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    olho.setAttribute("aria-pressed", String(mostrar));
    olho.querySelector("i").className = mostrar ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensagem(msg, "");

    if (v(p + "Password") !== v(p + "ConfirmPassword")) {
      return mostrarMensagem(msg, "As senhas não conferem.");
    }

    const botao = document.getElementById("btnEnviar");
    botao.disabled = true;
    try {
      const corpo = {
        nome: v(p + "Name"),
        email: v(p + "Email"),
        telefone: v(p + "Phone"),
        senha: v(p + "Password"),
        tipo: ehAdmin ? "admin" : "cliente"
      };
      if (!ehAdmin) corpo.cpf = v("userCPF");
      else corpo.cnpj = v("adminCNPJ");

      const r = await api("/auth/cadastro", { method: "POST", corpo });
      salvarSessao(r.token, r.usuario);
      location.href = ehAdmin ? "painel-admin.html" : "../index.html";
    } catch (err) {
      mostrarMensagem(msg, err.message);
      botao.disabled = false;
    }
  });
})();
