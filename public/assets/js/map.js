import * as DataFetcher from "./modules/DataFetcher.js";
import { defaultIcon, goldIcon } from "./config.js";
import { renderCameraList } from "./helpers.js";

const bookmarked = new Set(JSON.parse(localStorage.getItem('bookmarkedCameras') || '[]'));
window.bookmarked = bookmarked;

window.toggleBookmark = function(name) {
    const c = DataFetcher.cameras.find(c => c.name === name);
    if (bookmarked.has(c.name)) {
        bookmarked.delete(c.name);
    } else {
        bookmarked.add(c.name);
    }
    localStorage.setItem('bookmarkedCameras', JSON.stringify([...bookmarked]));
    c.marker.setIcon(bookmarked.has(c.name) ? goldIcon : defaultIcon);
    initializeList();
};

window.view = function(name) {
    localStorage.setItem("rname", name);
    localStorage.setItem("lstatus", "Live ●");
    window.location = "./camera.html";
}

init();

function init() {
    initializeMap();
    initializeList();
    initializeFilter();
}

let map;
let heatLayer;

function initializeMap() {
    map = L.map("map").setView([51.21, 3.22], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    DataFetcher.cameras.forEach(c => {
        c.marker = L.marker([c.lat, c.lng], {icon: bookmarked.has(c.name) ? goldIcon : defaultIcon}).addTo(map).bindPopup(() => {
            const isBookmarked = bookmarked.has(c.name);
            return `<div>${c.name}<br><button onclick="view('${c.name}')" style="margin-right: 0.5rem;">View</button><button class="${isBookmarked ? "bookmarked" : ""}" onclick="toggleBookmark('${c.name}')">${isBookmarked ? 'Bookmarked' : 'Bookmark'}</button></div>`;
        });
    });

    // Heatmap support (motion activity mock)
    function intensityFromName(name){
        let h=0; for (let i=0;i<name.length;i++){ h=(h*31 + name.charCodeAt(i))>>>0; }
        return 0.2 + (h % 80) / 100; // 0.2 - 1.0
    }
    function buildHeatPoints(){
        return DataFetcher.cameras.map(c => [c.lat, c.lng, intensityFromName(c.name)]);
    }
    const toggle = document.getElementById('heatToggle');
    if (toggle){
        const ensureLayer = () => {
            if (!heatLayer){ heatLayer = L.heatLayer(buildHeatPoints(), { radius: 18, blur: 15, maxZoom: 10 }); }
        };
        toggle.addEventListener('change', ()=>{
            ensureLayer();
            if (toggle.checked){ heatLayer.addTo(map); } else { if (map && heatLayer) map.removeLayer(heatLayer); }
        });
    }
}

function initializeList(cameras = DataFetcher.cameras) {
    const filtered = cameras.filter(c => c.name.toLowerCase().includes(document.getElementById("search")?.value?.toLowerCase() || ''));
    const sorted = [...filtered].sort((a, b) => {
        const aBook = bookmarked.has(a.name);
        const bBook = bookmarked.has(b.name);
        if (aBook && !bBook) return -1;
        if (!aBook && bBook) return 1;
        return 0;
    });
    renderCameraList(sorted, document.getElementById("cameraList"));
}

function initializeFilter() {
    const $search = document.getElementById("search");
    if (!$search) return;

    $search.addEventListener("input", () => {
        initializeList();
    });
}
