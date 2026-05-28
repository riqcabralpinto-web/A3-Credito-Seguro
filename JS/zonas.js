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

/* --- Busca de endereço estilo GPS (Zona Modal) --- */
let zonaAddressDebounce = null;
let zonaAddressSelected = false;

async function buscarEnderecoZona(query) {
    const statusEl = document.getElementById('endereco-zona-status');
    const suggestionsEl = document.getElementById('endereco-zona-suggestions');

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
            item.onmouseenter = () => item.style.background = '#f0f7ff';
            item.onmouseleave = () => item.style.background = '';
            // mousedown dispara antes do onblur do input, evitando o fechamento prematuro do dropdown
            item.addEventListener('mousedown', (e) => { e.preventDefault(); selecionarEnderecoZona(place); });
            suggestionsEl.appendChild(item);
        });

    } catch (e) {
        statusEl.textContent = '❌ Erro ao buscar endereço. Verifique sua conexão.';
        statusEl.style.color = '#ef4444';
        suggestionsEl.style.display = 'none';
    }
}

function selecionarEnderecoZona(place) {
    const inputEl = document.getElementById('endereco-zona-input');
    const suggestionsEl = document.getElementById('endereco-zona-suggestions');
    const statusEl = document.getElementById('endereco-zona-status');

    zonaAddressSelected = true;
    inputEl.value = place.display_name;
    suggestionsEl.style.display = 'none';

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    if (zonaMap && zonaMarker && zonaCircle) {
        zonaMap.setView([lat, lon], 16);
        zonaMarker.setLatLng([lat, lon]);
        zonaCircle.setLatLng([lat, lon]);
        selectedLat = lat;
        selectedLon = lon;
        updateMapHint(lat, lon);
    }

    statusEl.textContent = `✅ Endereço selecionado — confirme no mapa`;
    statusEl.style.color = '#16a34a';

    // Preenche descrição automaticamente se estiver vazia
    const addr = place.address || {};
    const bairro = addr.suburb || addr.neighbourhood || addr.quarter || '';
    const cidade = addr.city || addr.town || addr.municipality || '';
    const descInput = document.getElementById('modal-zona-desc');
    if (!descInput.value.trim() && (bairro || cidade)) {
        descInput.value = [bairro, cidade].filter(Boolean).join(', ');
    }
}

function onEnderecoZonaInput(input) {
    zonaAddressSelected = false;
    const query = input.value.trim();
    clearTimeout(zonaAddressDebounce);
    if (query.length < 3) {
        document.getElementById('endereco-zona-suggestions').style.display = 'none';
        document.getElementById('endereco-zona-status').textContent = '';
        return;
    }
    zonaAddressDebounce = setTimeout(() => buscarEnderecoZona(query), 400);
}

function fecharSugestoesZona() {
    setTimeout(() => {
        document.getElementById('endereco-zona-suggestions').style.display = 'none';
    }, 200);
}

/* --- Modal --- */
function openAddZona() {
    document.getElementById('modal-zona-title').textContent = 'Adicionar Zona Segura';
    document.getElementById('modal-zona-id').value = '';
    document.getElementById('modal-zona-desc').value = '';
    document.getElementById('endereco-zona-input').value = '';
    document.getElementById('endereco-zona-status').textContent = '';
    document.getElementById('endereco-zona-suggestions').style.display = 'none';
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
    document.getElementById('endereco-zona-input').value = '';
    document.getElementById('endereco-zona-status').textContent = '';
    document.getElementById('endereco-zona-suggestions').style.display = 'none';
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
    if (!selectedLat || !selectedLon) { showStatus('modal-status', 400, '❌ Selecione uma localização no mapa ou pesquise um endereço.'); return; }
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