(function () {
  const { api, salvarSessao, getToken, getUsuario, mostrarMensagem, destinoSeguro } = PlaySpot;
  const msg = document.getElementById("loginMsg");
  const senha = document.getElementById("loginPassword");
  const toggle = document.getElementById("togglePassword");

  toggle.addEventListener("click", () => {
    const mostrar = senha.type === "password";
    senha.type = mostrar ? "text" : "password";
    toggle.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    toggle.setAttribute("aria-pressed", String(mostrar));
    toggle.querySelector("i").className = mostrar ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  const destinoPadrao = (u) => (u.tipo === "admin" ? "painel-admin.html" : "../index.html");

  // Já logado? Vai direto para a área certa.
  const jaLogado = getUsuario();
  if (getToken() && jaLogado) location.replace(destinoPadrao(jaLogado));

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarMensagem(msg, "");
    const botao = document.getElementById("btnLogin");
    botao.disabled = true;
    try {
      const tipo = document.querySelector('input[name="loginRole"]:checked').value === "proprietario" ? "admin" : "cliente";
      const r = await api("/auth/login", {
        method: "POST",
        corpo: { email: document.getElementById("loginEmail").value, senha: senha.value, tipo }
      });
      salvarSessao(r.token, r.usuario);

      const next = destinoSeguro(new URLSearchParams(location.search).get("next"));
      // "next" é relativo a /pages/ (ou à raiz quando começa com index.html).
      location.href = next && r.usuario.tipo === "cliente"
        ? (next.startsWith("index.html") ? "../" + next : next)
        : destinoPadrao(r.usuario);
    } catch (err) {
      mostrarMensagem(msg, err.message);
      botao.disabled = false;
    }
  });
})();
