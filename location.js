/* =====================================================
   location.js — Geolocalização do usuário
   ===================================================== */

let currentLat = null;
let currentLon = null;

function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) { useFallback(); resolve(); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                currentLat = pos.coords.latitude;
                currentLon = pos.coords.longitude;
                updateLocationUI();
                resolve();
            },
            () => { useFallback(); resolve(); }
        );
    });
}

function useFallback() {
    currentLat = -23.5505;
    currentLon = -46.6333;
    updateLocationUI();
}

function updateLocationUI() {
    const el = document.getElementById('location-status');
    if (el) el.textContent = `📍 ${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`;
    const li = document.getElementById('login-location-info');
    if (li) li.textContent = `${currentLat.toFixed(4)}, ${currentLon.toFixed(4)}`;
}

function getLat() { return currentLat ?? -23.5505; }
function getLon() { return currentLon ?? -46.6333; }