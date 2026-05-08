/* =====================================================
   auth.js — Cadastro, login e acesso de emergência
   ===================================================== */

let currentEmail = null;
let currentUserId = null;
let currentToken = null;
let modoRuaAtivo = true;

function toggleModoRua() {
    modoRuaAtivo = !modoRuaAtivo;
    document.getElementById('toggle-modoRua').classList.toggle('on', modoRuaAtivo);
}

/* --- Cadastro --- */
async function doRegister() {
    const nome = document.getElementById('reg-nome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const senha = document.getElementById('reg-senha').value;
    const emailSec = document.getElementById('reg-email2').value.trim();

    clearStatus('register-status');
    if (!nome || !email || !senha) {
        showStatus('register-status', 400, '❌ Preencha todos os campos obrigatórios.');
        return;
    }
    if (senha.length < 6) {
        showStatus('register-status', 400, '❌ A senha deve ter pelo menos 6 caracteres.');
        return;
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Obtendo localização...';
    await getLocation();
    btn.innerHTML = '<span class="spinner"></span>Criando conta...';

    try {
        const res = await apiRegistro({ nome, email, senha, emailSecundario: emailSec || email });
        const data = await res.json();

        if (!res.ok) {
            showStatus('register-status', res.status, getStatusMsg(data, res.status));
            btn.disabled = false;
            btn.textContent = 'Criar conta e ativar proteção';
            return;
        }

        currentUserId = data.id;
        currentEmail = email;

        if (modoRuaAtivo) {
            const lr = await apiLogin(email, senha, getLat(), getLon());
            const ld = await lr.json();
            currentToken = ld.token;
            currentUserId = ld.id;
            await apiToggleModoRua(currentUserId, currentToken);
            await apiCreateZona(currentUserId, currentToken, {
                latitude: getLat(), longitude: getLon(),
                raioMetros: 500, descricao: 'Zona inicial'
            });
        }

        btn.disabled = false;
        btn.textContent = 'Criar conta e ativar proteção';
        document.getElementById('login-email').value = email;
        simShow('sim-login');
        getLocation();
    } catch (e) {
        showStatus('register-status', 500, '❌ Erro ao conectar ao servidor. Verifique se o backend está rodando.');
        btn.disabled = false;
        btn.textContent = 'Criar conta e ativar proteção';
    }
}

/* --- Login --- */
async function doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    clearStatus('login-status');
    if (!email || !senha) {
        showStatus('login-status', 400, '❌ Preencha e-mail e senha.');
        return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Verificando localização...';
    await getLocation();
    currentEmail = email;

    try {
        const res = await apiLogin(email, senha, getLat(), getLon());
        btn.disabled = false;
        btn.textContent = 'Entrar na minha conta';

        if (res.status === 403) {
            document.getElementById('denied-location').textContent =
                `${getLat().toFixed(4)}, ${getLon().toFixed(4)}`;
            simShow('sim-denied');
            return;
        }

        if (res.ok) {
            const data = await res.json();
            currentToken = data.token;
            currentUserId = data.id;
            document.getElementById('success-name').textContent = data.nome || 'Usuário';
            document.getElementById('success-badge').textContent = '✓ Acesso Liberado — 200 OK';
            document.getElementById('success-subtitle').textContent = 'Localização verificada — Modo Rua ativo';
            simShow('sim-success');
            switchTab('conta');
            await carregarProtecao();
            await carregarPerfil();
        } else {
            let data = {};
            try { data = await res.json(); } catch (e) {}
            showStatus('login-status', res.status, getStatusMsg(data, res.status));
        }
    } catch (e) {
        showStatus('login-status', 500, '❌ Erro ao conectar ao servidor. Verifique se o backend está rodando.');
        btn.disabled = false;
        btn.textContent = 'Entrar na minha conta';
    }
}

/* --- OTP / Emergência --- */
async function requestOTP() {
    if (!currentEmail) return;
    try {
        await apiSolicitarOTP(currentEmail);
        document.getElementById('otp-email-info').textContent =
            'Código enviado para o e-mail secundário. Válido por 10 minutos.';
    } catch (e) {}
}

function goToEmergency() {
    requestOTP();
    simShow('sim-emergency');
}

async function doOTP() {
    const codigo = document.getElementById('otp-code').value.trim();
    clearStatus('emergency-status');

    if (codigo.length !== 6) {
        showStatus('emergency-status', 400, '❌ Digite exatamente 6 dígitos.');
        return;
    }

    const btn = document.getElementById('btn-otp');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Verificando...';

    try {
        const res = await apiLoginEmergencia(currentEmail, codigo);
        btn.disabled = false;
        btn.textContent = 'Verificar código';

        if (res.ok) {
            const data = await res.json();
            currentToken = data.token;
            currentUserId = data.id;
            document.getElementById('success-name').textContent = data.nome || 'Usuário';
            document.getElementById('success-badge').textContent = '✓ Acesso via Emergência — 200 OK';
            document.getElementById('success-subtitle').textContent = 'Acesso liberado via código de emergência';
            simShow('sim-success');
            switchTab('conta');
            await carregarProtecao();
            await carregarPerfil();
        } else {
            let data = {};
            try { data = await res.json(); } catch (e) {}
            showStatus('emergency-status', res.status, getStatusMsg(data, res.status));
        }
    } catch (e) {
        showStatus('emergency-status', 500, '❌ Erro ao conectar ao servidor.');
        btn.disabled = false;
        btn.textContent = 'Verificar código';
    }
}