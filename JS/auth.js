/* =====================================================
   auth.js — Cadastro, login e acesso de emergência
   ===================================================== */

let currentEmail = null;
let currentUserId = null;
let currentToken = null;
let modoRuaAtivo = true;

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

/* --- Mapa do cadastro --- */
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

/* --- Busca de endereço estilo GPS (Cadastro) --- */
let registroAddressDebounce = null;

async function buscarEnderecoRegistro(query) {
    const statusEl = document.getElementById('cep-registro-status');
    const suggestionsEl = document.getElementById('registro-address-suggestions');

    if (!query || query.length < 3) {
        suggestionsEl.style.display = 'none';
        statusEl.textContent = '';
        return;
    }

    statusEl.textContent = '🔍 Buscando...';
    statusEl.style.color = '#6b7280';

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=br&addressdetails=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
        );
        const data = await res.json();

        if (!data.length) {
            statusEl.textContent = '⚠ Nenhum endereço encontrado. Tente ser mais específico.';
            statusEl.style.color = '#f59e0b';
            suggestionsEl.style.display = 'none';
            return;
        }

        statusEl.textContent = '';
        suggestionsEl.innerHTML = '';
        suggestionsEl.style.display = 'block';

        data.forEach(place => {
            const item = document.createElement('div');
            item.className = 'address-suggestion-item';
            item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.4;transition:background 0.15s;';
            item.innerHTML = `<span style="font-weight:600;">📍</span> ${place.display_name}`;
            item.onmouseenter = () => item.style.background = '#fff8f8';
            item.onmouseleave = () => item.style.background = '';
            // mousedown dispara antes do onblur do input, evitando o fechamento prematuro do dropdown
            item.addEventListener('mousedown', (e) => { e.preventDefault(); selecionarEnderecoRegistro(place); });
            suggestionsEl.appendChild(item);
        });

    } catch (e) {
        statusEl.textContent = '❌ Erro ao buscar endereço. Verifique sua conexão.';
        statusEl.style.color = '#ef4444';
        suggestionsEl.style.display = 'none';
    }
}

function selecionarEnderecoRegistro(place) {
    const inputEl = document.getElementById('registro-endereco-input');
    const suggestionsEl = document.getElementById('registro-address-suggestions');
    const statusEl = document.getElementById('cep-registro-status');

    inputEl.value = place.display_name;
    suggestionsEl.style.display = 'none';

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    if (registroMap && registroMarker && registroCircle) {
        registroMap.setView([lat, lon], 16);
        registroMarker.setLatLng([lat, lon]);
        registroCircle.setLatLng([lat, lon]);
        registroLat = lat;
        registroLon = lon;
        updateRegistroMapHint(lat, lon);
    }

    statusEl.textContent = '✅ Endereço selecionado — confirme no mapa';
    statusEl.style.color = '#16a34a';
}

function onEnderecoRegistroInput(input) {
    const query = input.value.trim();
    clearTimeout(registroAddressDebounce);
    if (query.length < 3) {
        document.getElementById('registro-address-suggestions').style.display = 'none';
        document.getElementById('cep-registro-status').textContent = '';
        return;
    }
    registroAddressDebounce = setTimeout(() => buscarEnderecoRegistro(query), 400);
}

function fecharSugestoesRegistro() {
    setTimeout(() => {
        document.getElementById('registro-address-suggestions').style.display = 'none';
    }, 200);
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
