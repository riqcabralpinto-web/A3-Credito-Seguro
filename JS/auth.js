/* =====================================================
   auth.js — Cadastro, login e acesso de emergência
   ===================================================== */

let currentEmail = null;
let currentUserId = null;
let currentToken = null;
let modoRuaAtivo = true;

// Controla se o usuário selecionou uma localização no mapa de cadastro
let registroLat = null;
let registroLon = null;
let registroMap = null;
let registroMarker = null;
let registroCircle = null;

function toggleModoRua() {
    modoRuaAtivo = !modoRuaAtivo;
    document.getElementById('toggle-modoRua').classList.toggle('on', modoRuaAtivo);
    const mapaRegistro = document.getElementById('registro-mapa-container');
    if (mapaRegistro) {
        mapaRegistro.style.display = modoRuaAtivo ? 'block' : 'none';
    }
}

/* --- Inicializa mapa no cadastro --- */
function initRegistroMap() {
    if (registroMap) return;
    const lat = getLat();
    const lon = getLon();
    registroLat = lat;
    registroLon = lon;

    setTimeout(() => {
        registroMap = L.map('registro-map').setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(registroMap);

        registroMarker = L.marker([lat, lon], { draggable: true }).addTo(registroMap);
        registroCircle = L.circle([lat, lon], {
            radius: 500, color: '#CC092F', fillColor: '#CC092F', fillOpacity: 0.15
        }).addTo(registroMap);

        updateRegistroMapHint(lat, lon);

        registroMarker.on('dragend', e => {
            const p = e.target.getLatLng();
            registroLat = p.lat;
            registroLon = p.lng;
            registroCircle.setLatLng(p);
            updateRegistroMapHint(p.lat, p.lng);
        });

        registroMap.on('click', e => {
            registroLat = e.latlng.lat;
            registroLon = e.latlng.lng;
            registroMarker.setLatLng(e.latlng);
            registroCircle.setLatLng(e.latlng);
            updateRegistroMapHint(registroLat, registroLon);
        });
    }, 150);
}

function updateRegistroMapHint(lat, lon) {
    const el = document.getElementById('registro-map-hint');
    if (el) el.textContent = `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — Arraste o marcador para ajustar`;
}

function usarLocalizacaoAtualRegistro() {
    const lat = getLat();
    const lon = getLon();
    if (registroMap && registroMarker && registroCircle) {
        registroMap.setView([lat, lon], 15);
        registroMarker.setLatLng([lat, lon]);
        registroCircle.setLatLng([lat, lon]);
        registroLat = lat;
        registroLon = lon;
        updateRegistroMapHint(lat, lon);
    }
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
    if (modoRuaAtivo && (!registroLat || !registroLon)) {
        showStatus('register-status', 400, '❌ Selecione uma localização no mapa para ativar o Modo Rua.');
        return;
    }

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
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
            const lr = await apiLogin(email, senha, registroLat, registroLon);
            const ld = await lr.json();
            currentToken = ld.token;
            currentUserId = ld.id;
            await apiToggleModoRua(currentUserId, currentToken);
            await apiCreateZona(currentUserId, currentToken, {
                latitude: registroLat,
                longitude: registroLon,
                raioMetros: 500,
                descricao: 'Zona inicial'
            });
        }

        // Limpa mapa de registro para próximo uso
        if (registroMap) { registroMap.remove(); registroMap = null; registroMarker = null; registroCircle = null; }
        registroLat = null; registroLon = null;

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