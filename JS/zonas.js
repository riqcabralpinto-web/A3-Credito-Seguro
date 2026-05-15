/* =====================================================
   zonas.js — CRUD de zonas seguras e mapa Leaflet
   ===================================================== */

let zonaMap = null;
let zonaMarker = null;
let zonaCircle = null;
let selectedLat = null;
let selectedLon = null;

/* --- Mapa --- */
function initMap(lat, lon) {
    if (zonaMap) { zonaMap.remove(); zonaMap = null; zonaMarker = null; zonaCircle = null; }
    selectedLat = lat;
    selectedLon = lon;

    setTimeout(() => {
        zonaMap = L.map('zona-map').setView([lat, lon], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(zonaMap);

        const raio = parseInt(document.getElementById('modal-zona-raio').value);
        zonaMarker = L.marker([lat, lon], { draggable: true }).addTo(zonaMap);
        zonaCircle = L.circle([lat, lon], {
            radius: raio, color: '#CC092F', fillColor: '#CC092F', fillOpacity: 0.15
        }).addTo(zonaMap);

        updateMapHint(lat, lon);

        zonaMarker.on('dragend', e => {
            const p = e.target.getLatLng();
            selectedLat = p.lat;
            selectedLon = p.lng;
            zonaCircle.setLatLng(p);
            updateMapHint(p.lat, p.lng);
        });

        zonaMap.on('click', e => {
            selectedLat = e.latlng.lat;
            selectedLon = e.latlng.lng;
            zonaMarker.setLatLng(e.latlng);
            zonaCircle.setLatLng(e.latlng);
            updateMapHint(selectedLat, selectedLon);
        });
    }, 150);
}

function updateMapHint(lat, lon) {
    document.getElementById('map-coords-hint').textContent =
        `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)} — Arraste o marcador para ajustar`;
}

function updateRaioLabel(val) {
    document.getElementById('raio-label').textContent =
        val >= 1000 ? `${(val / 1000).toFixed(1)}km` : `${val}m`;
}

function updateMapCircle() {
    if (zonaCircle) zonaCircle.setRadius(parseInt(document.getElementById('modal-zona-raio').value));
}

// Centraliza o mapa na localização atual do dispositivo
function usarLocalizacaoAtual() {
    const lat = getLat();
    const lon = getLon();
    if (zonaMap && zonaMarker && zonaCircle) {
        zonaMap.setView([lat, lon], 15);
        zonaMarker.setLatLng([lat, lon]);
        zonaCircle.setLatLng([lat, lon]);
        selectedLat = lat;
        selectedLon = lon;
        updateMapHint(lat, lon);
    }
}

// Busca endereço pelo CEP e centraliza o mapa
async function buscarCEP() {
    const cep = document.getElementById('modal-zona-cep').value.replace(/\D/g, '');
    const btnCep = document.getElementById('btn-buscar-cep');
    const cepStatus = document.getElementById('cep-status');

    if (cep.length !== 8) {
        cepStatus.textContent = '❌ CEP deve ter 8 dígitos.';
        cepStatus.style.color = '#ef4444';
        return;
    }

    cepStatus.textContent = '🔍 Buscando endereço...';
    cepStatus.style.color = '#6b7280';
    btnCep.disabled = true;

    try {
        // 1. ViaCEP: busca endereço pelo CEP
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const viaCepData = await viaCepRes.json();

        if (viaCepData.erro) {
            cepStatus.textContent = '❌ CEP não encontrado.';
            cepStatus.style.color = '#ef4444';
            btnCep.disabled = false;
            return;
        }

        const endereco = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
        cepStatus.textContent = `📍 ${viaCepData.logradouro}, ${viaCepData.bairro} — ${viaCepData.localidade}/${viaCepData.uf}`;
        cepStatus.style.color = '#16a34a';

        // 2. Nominatim: converte endereço em lat/lon
        const nominatimRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
        );
        const nominatimData = await nominatimRes.json();

        if (!nominatimData.length) {
            cepStatus.textContent = '⚠ Endereço encontrado mas não foi possível localizar no mapa. Ajuste manualmente.';
            cepStatus.style.color = '#f59e0b';
            btnCep.disabled = false;
            return;
        }

        const lat = parseFloat(nominatimData[0].lat);
        const lon = parseFloat(nominatimData[0].lon);

        // 3. Centraliza o mapa nas coordenadas encontradas
        if (zonaMap && zonaMarker && zonaCircle) {
            zonaMap.setView([lat, lon], 16);
            zonaMarker.setLatLng([lat, lon]);
            zonaCircle.setLatLng([lat, lon]);
            selectedLat = lat;
            selectedLon = lon;
            updateMapHint(lat, lon);
        }

        // Preenche descrição automaticamente se estiver vazia
        const descInput = document.getElementById('modal-zona-desc');
        if (!descInput.value.trim()) {
            descInput.value = `${viaCepData.bairro}, ${viaCepData.localidade}`;
        }

    } catch (e) {
        cepStatus.textContent = '❌ Erro ao buscar CEP. Verifique sua conexão.';
        cepStatus.style.color = '#ef4444';
    }

    btnCep.disabled = false;
}

// Formata CEP enquanto o usuário digita (00000-000)
function formatarCEP(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 5) val = val.slice(0, 5) + '-' + val.slice(5, 8);
    input.value = val;
    // Busca automaticamente quando o CEP está completo
    if (val.replace(/\D/g, '').length === 8) buscarCEP();
}

/* --- Modal --- */
function openAddZona() {
    document.getElementById('modal-zona-title').textContent = 'Adicionar Zona Segura';
    document.getElementById('modal-zona-id').value = '';
    document.getElementById('modal-zona-desc').value = '';
    document.getElementById('modal-zona-cep').value = '';
    document.getElementById('cep-status').textContent = '';
    document.getElementById('modal-zona-raio').value = 500;
    clearStatus('modal-status');
    updateRaioLabel(500);
    document.getElementById('modal-zona').classList.add('open');
    initMap(getLat(), getLon());
}

function openEditZona(id, desc, lat, lon, raio) {
    document.getElementById('modal-zona-title').textContent = 'Editar Zona Segura';
    document.getElementById('modal-zona-id').value = id;
    document.getElementById('modal-zona-desc').value = desc;
    document.getElementById('modal-zona-cep').value = '';
    document.getElementById('cep-status').textContent = '';
    document.getElementById('modal-zona-raio').value = raio;
    clearStatus('modal-status');
    updateRaioLabel(raio);
    document.getElementById('modal-zona').classList.add('open');
    initMap(lat, lon);
}

function closeModal() {
    document.getElementById('modal-zona').classList.remove('open');
    if (zonaMap) { zonaMap.remove(); zonaMap = null; }
}

async function salvarZona() {
    const id = document.getElementById('modal-zona-id').value;
    const desc = document.getElementById('modal-zona-desc').value.trim();
    const raio = parseFloat(document.getElementById('modal-zona-raio').value);

    clearStatus('modal-status');
    if (!desc) { showStatus('modal-status', 400, '❌ Informe uma descrição para a zona.'); return; }
    if (!selectedLat || !selectedLon) { showStatus('modal-status', 400, '❌ Selecione uma localização no mapa ou busque pelo CEP.'); return; }
    if (!currentUserId) { showStatus('modal-status', 401, '❌ Sessão inválida. Faça login novamente.'); return; }

    const dados = { descricao: desc, latitude: selectedLat, longitude: selectedLon, raioMetros: raio };

    try {
        const res = id
            ? await apiUpdateZona(id, currentToken, dados)
            : await apiCreateZona(currentUserId, currentToken, dados);

        if (res.ok) {
            closeModal();
            await carregarProtecao();
        } else {
            let data = {};
            try { data = await res.json(); } catch (e) {}
            showStatus('modal-status', res.status, getStatusMsg(data, res.status));
        }
    } catch (e) {
        showStatus('modal-status', 500, '❌ Erro ao conectar ao servidor.');
    }
}

async function deletarZona(id) {
    if (!confirm('Deseja remover esta zona segura?')) return;
    try {
        await apiDeleteZona(id, currentToken);
        await carregarProtecao();
    } catch (e) {}
}

/* --- Renderização --- */
function renderZonas(zonas) {
    const el = document.getElementById('zonas-list');
    if (!zonas || !zonas.length) {
        el.innerHTML = '<p class="empty-state">Nenhuma zona segura cadastrada.<br>Adicione uma zona para usar o Modo Rua.</p>';
        return;
    }
    el.innerHTML = zonas.map(z => `
        <div class="zona-card">
            <div>
                <p style="font-weight:600;font-size:13px;margin:0 0 2px;color:#111;">📍 ${z.descricao || 'Zona segura'}</p>
                <p style="font-size:11px;color:#888;margin:0;">${z.raioMetros}m de raio</p>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="zona-btn zona-btn-edit" onclick="openEditZona(${z.id},'${z.descricao}',${z.latitude},${z.longitude},${z.raioMetros})">Editar</button>
                <button class="zona-btn zona-btn-del" onclick="deletarZona(${z.id})">✕</button>
            </div>
        </div>`).join('');
}