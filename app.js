// app.js

// State Management
let state = {
    mileage: 0,
    lastTireInflate: null,
    history: []
};

let showAllHistory = false;
let pendingDeleteId = null;
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (els.btnInstallPwa) {
        els.btnInstallPwa.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (els.btnInstallPwa) {
        els.btnInstallPwa.classList.add('hidden');
    }
    showToast('¡App instalada correctamente!');
});

// Config for Peugeot 206 1.4 Nafta
const maintenanceConfig = {
    aceite: { km: 10000, months: 12, name: "Aceite y Filtros" },
    distribucion: { km: 60000, months: 48, name: "Correa de Distribución" },
    frenos: { km: 30000, months: 24, name: "Frenos" },
    bateria: { km: 0, months: 36, name: "Batería" }
};

const TIRE_INFLATE_INTERVAL_DAYS = 30;
const TIRE_REMINDER_DAYS = 3;

// DOM Elements
const els = {
    currentMileage: document.getElementById('currentMileage'),
    btnEditMileage: document.getElementById('btnEditMileage'),
    btnInflateTires: document.getElementById('btnInflateTires'),
    tireStatus: document.getElementById('tireStatus'),
    btnAddMaintenance: document.getElementById('btnAddMaintenance'),
    alertsList: document.getElementById('alertsList'),
    historyList: document.getElementById('historyList'),
    btnViewAll: document.getElementById('btnViewAll'),
    
    modalMileage: document.getElementById('modalMileage'),
    formMileage: document.getElementById('formMileage'),
    inputMileage: document.getElementById('inputMileage'),
    
    modalMaintenance: document.getElementById('modalMaintenance'),
    modalMaintenanceTitle: document.getElementById('modalMaintenanceTitle'),
    editMaintenanceId: document.getElementById('editMaintenanceId'),
    formMaintenance: document.getElementById('formMaintenance'),
    btnSubmitMaintenance: document.getElementById('btnSubmitMaintenance'),

    modalConfirmDelete: document.getElementById('modalConfirmDelete'),
    deleteItemDescription: document.getElementById('deleteItemDescription'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),
    
    toastNotification: document.getElementById('toastNotification'),
    toastMessage: document.getElementById('toastMessage'),
    
    splashScreen: document.getElementById('splashScreen'),
    btnInstallPwa: document.getElementById('btnInstallPwa'),
    btnSettings: document.getElementById('btnSettings')
};

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateStr);
}

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if (els.btnInstallPwa) {
        els.btnInstallPwa.classList.remove('hidden');
    }
});

// Initialize
function init() {
    loadState();
    setupEventListeners();
    updateUI();
    
    // Hide splash screen after 1.5 seconds to ensure it's visible
    setTimeout(() => {
        if (els.splashScreen) {
            els.splashScreen.classList.add('hidden');
            // Remove from DOM after transition
            setTimeout(() => els.splashScreen.remove(), 800);
        }
    }, 1500);
}

// Load from LocalStorage
function loadState() {
    const saved = localStorage.getItem('p206_data');
    if (saved) {
        try {
            state = JSON.parse(saved);
            // Ensure every item has an id
            if (Array.isArray(state.history)) {
                state.history.forEach((item, index) => {
                    if (!item.id) {
                        item.id = (Date.now() - index * 1000).toString();
                    }
                });
            }
        } catch(e) {
            console.error("Error parsing local storage data", e);
        }
    }
}

// Save to LocalStorage
function saveState() {
    localStorage.setItem('p206_data', JSON.stringify(state));
}

// Update UI
function updateUI() {
    // Mileage
    els.currentMileage.textContent = state.mileage.toLocaleString('es-AR');
    
    // Tires Status
    updateTireStatus();
    
    // Alerts & History
    renderAlerts();
    renderHistory();
}

function updateTireStatus() {
    if (!state.lastTireInflate) {
        els.tireStatus.textContent = "Sin registro";
        els.tireStatus.style.color = "var(--warning-color)";
        return;
    }
    
    const lastDate = parseLocalDate(state.lastTireInflate);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfLast = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const diffDays = Math.floor(Math.abs(startOfToday - startOfLast) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        els.tireStatus.textContent = "Hoy";
        els.tireStatus.style.color = "var(--success-color)";
    } else if (diffDays >= (TIRE_INFLATE_INTERVAL_DAYS - TIRE_REMINDER_DAYS)) {
        els.tireStatus.textContent = `Hace ${diffDays} días (Pronto)`;
        els.tireStatus.style.color = "var(--danger-color)";
    } else {
        els.tireStatus.textContent = `Hace ${diffDays} días`;
        els.tireStatus.style.color = "var(--text-secondary)";
    }
}

function getIconForType(type) {
    const icons = {
        aceite: "ph-drop",
        distribucion: "ph-gear",
        frenos: "ph-stop-circle",
        bateria: "ph-lightning",
        neumaticos: "ph-tire",
        otro: "ph-wrench"
    };
    return icons[type] || "ph-wrench";
}

function renderHistory() {
    els.historyList.innerHTML = '';
    
    if (!state.history || state.history.length === 0) {
        els.historyList.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem 0;">No hay registros aún.</p>';
        if (els.btnViewAll) els.btnViewAll.style.display = 'none';
        return;
    }
    
    // Manage "Ver todos" button visibility & text
    if (els.btnViewAll) {
        if (state.history.length > 5) {
            els.btnViewAll.style.display = 'block';
            els.btnViewAll.textContent = showAllHistory ? 'Ver menos' : 'Ver todos';
        } else {
            els.btnViewAll.style.display = 'none';
        }
    }
    
    // Sort by date descending
    const sortedHistory = [...state.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    const itemsToDisplay = showAllHistory ? sortedHistory : sortedHistory.slice(0, 5);
    
    itemsToDisplay.forEach(item => {
        const dateObj = parseLocalDate(item.date);
        const dateStr = dateObj ? dateObj.toLocaleDateString('es-AR') : item.date;
        
        let typeName = maintenanceConfig[item.type] ? maintenanceConfig[item.type].name : 
            (item.type.charAt(0).toUpperCase() + item.type.slice(1));

        const wrapper = document.createElement('div');
        wrapper.className = 'swipe-item-wrapper';
        wrapper.dataset.id = item.id;
        
        wrapper.innerHTML = `
            <div class="swipe-actions-bg">
                <div class="swipe-action swipe-action-right" title="Eliminar registro">
                    <i class="ph ph-trash"></i>
                    <span>Borrar</span>
                </div>
                <div class="swipe-action swipe-action-left" title="Modificar registro">
                    <i class="ph ph-pencil-simple"></i>
                    <span>Modificar</span>
                </div>
            </div>
            <div class="history-item swipe-content" data-id="${item.id}">
                <div class="history-info">
                    <div class="history-icon"><i class="ph ${getIconForType(item.type)}"></i></div>
                    <div class="history-details">
                        <h4>${typeName}</h4>
                        <p>${dateStr} ${item.notes ? '· ' + item.notes : ''}</p>
                    </div>
                </div>
                <div class="history-km">${item.km.toLocaleString('es-AR')} km</div>
            </div>
        `;

        const swipeContent = wrapper.querySelector('.swipe-content');
        attachSwipeListeners(swipeContent, item.id);

        // Allow direct click on background action buttons if revealed
        const btnDeleteAction = wrapper.querySelector('.swipe-action-right');
        btnDeleteAction.addEventListener('click', () => {
            requestDeleteMaintenance(item.id);
        });

        const btnEditAction = wrapper.querySelector('.swipe-action-left');
        btnEditAction.addEventListener('click', () => {
            openEditMaintenance(item.id);
        });

        els.historyList.appendChild(wrapper);
    });
}

function attachSwipeListeners(itemEl, id) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isDragging = false;
    let isHorizontal = null; // null: unknown, true: horizontal swipe, false: vertical scroll
    const SWIPE_THRESHOLD = 70; // pixels to trigger action

    itemEl.addEventListener('pointerdown', (e) => {
        // Only primary button
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        startX = e.clientX;
        startY = e.clientY;
        currentX = 0;
        isDragging = true;
        isHorizontal = null;
        itemEl.classList.remove('dragging');
    });

    itemEl.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const diffX = e.clientX - startX;
        const diffY = e.clientY - startY;

        // Determine direction
        if (isHorizontal === null) {
            if (Math.abs(diffX) > 7 || Math.abs(diffY) > 7) {
                if (Math.abs(diffX) >= Math.abs(diffY)) {
                    isHorizontal = true;
                    itemEl.classList.add('dragging');
                    try {
                        itemEl.setPointerCapture(e.pointerId);
                    } catch (err) {}
                } else {
                    isHorizontal = false;
                    isDragging = false;
                    return;
                }
            } else {
                return;
            }
        }

        if (isHorizontal) {
            // Apply slight resistance when dragged far
            let moveX = diffX;
            if (Math.abs(moveX) > 110) {
                const extra = Math.abs(moveX) - 110;
                moveX = (moveX > 0 ? 1 : -1) * (110 + extra * 0.25);
            }
            currentX = moveX;
            itemEl.style.transform = `translateX(${moveX}px)`;
        }
    });

    const endDrag = (e) => {
        if (!isDragging && isHorizontal !== true) return;

        isDragging = false;
        itemEl.classList.remove('dragging');

        if (isHorizontal) {
            try {
                if (itemEl.hasPointerCapture(e.pointerId)) {
                    itemEl.releasePointerCapture(e.pointerId);
                }
            } catch (err) {}

            const thresholdReached = Math.abs(currentX) >= SWIPE_THRESHOLD;

            if (thresholdReached) {
                if (currentX < 0) {
                    // Desplazado a la izquierda -> Modificar
                    itemEl.style.transform = 'translateX(0px)';
                    openEditMaintenance(id);
                } else {
                    // Desplazado a la derecha -> Borrar
                    itemEl.style.transform = 'translateX(0px)';
                    requestDeleteMaintenance(id);
                }
            } else {
                // Snap back smoothly
                itemEl.style.transform = 'translateX(0px)';
            }
        }

        isHorizontal = null;
        currentX = 0;
    };

    itemEl.addEventListener('pointerup', endDrag);
    itemEl.addEventListener('pointercancel', endDrag);
}

function openEditMaintenance(id) {
    const record = state.history.find(h => h.id === id);
    if (!record) return;

    if (els.modalMaintenanceTitle) els.modalMaintenanceTitle.textContent = "Modificar Servicio";
    if (els.btnSubmitMaintenance) els.btnSubmitMaintenance.textContent = "Guardar Cambios";
    if (els.editMaintenanceId) els.editMaintenanceId.value = record.id;

    document.getElementById('inputType').value = record.type;
    document.getElementById('inputDate').value = record.date;
    document.getElementById('inputKm').value = record.km;
    document.getElementById('inputNotes').value = record.notes || '';

    els.modalMaintenance.classList.remove('hidden');
}

function requestDeleteMaintenance(id) {
    const record = state.history.find(h => h.id === id);
    if (!record) return;

    pendingDeleteId = id;
    const typeName = maintenanceConfig[record.type] ? maintenanceConfig[record.type].name : 
        (record.type.charAt(0).toUpperCase() + record.type.slice(1));
    
    const dateObj = parseLocalDate(record.date);
    const dateStr = dateObj ? dateObj.toLocaleDateString('es-AR') : record.date;

    if (els.deleteItemDescription) {
        els.deleteItemDescription.textContent = `¿Deseas eliminar el registro de "${typeName}" (${dateStr} · ${record.km.toLocaleString('es-AR')} km)?`;
    }
    if (els.modalConfirmDelete) {
        els.modalConfirmDelete.classList.remove('hidden');
    }
}

function renderAlerts() {
    els.alertsList.innerHTML = '';
    let alerts = [];
    
    // Check Tires
    if (state.lastTireInflate) {
        const lastDate = new Date(state.lastTireInflate);
        const now = new Date();
        const diffDays = Math.floor(Math.abs(now - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= (TIRE_INFLATE_INTERVAL_DAYS - TIRE_REMINDER_DAYS)) {
            alerts.push({
                type: 'neumaticos',
                title: 'Inflar Neumáticos',
                msg: `Hace ${diffDays} días que no se inflan.`,
                danger: diffDays >= TIRE_INFLATE_INTERVAL_DAYS
            });
        }
    } else {
        alerts.push({
            type: 'neumaticos',
            title: 'Inflar Neumáticos',
            msg: 'No hay registro de inflado.',
            danger: false
        });
    }

    // Check Maintenance Configs based on history
    Object.keys(maintenanceConfig).forEach(type => {
        const config = maintenanceConfig[type];
        // Find last record of this type
        const typeHistory = state.history.filter(h => h.type === type);
        if (typeHistory.length > 0) {
            // Sort to get the latest
            typeHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastRecord = typeHistory[0];
            
            // Check KM
            if (config.km > 0) {
                const kmDiff = state.mileage - lastRecord.km;
                const kmRemaining = config.km - kmDiff;
                
                if (kmRemaining <= 1000) {
                    alerts.push({
                        type: type,
                        title: config.name,
                        msg: kmRemaining <= 0 ? `Servicio vencido por ${Math.abs(kmRemaining)} km` : `Faltan ${kmRemaining} km`,
                        danger: kmRemaining <= 0
                    });
                }
            }
            
            // Check Months
            if (config.months > 0) {
                const lastDate = parseLocalDate(lastRecord.date);
                const now = new Date();
                const monthDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
                const monthsRemaining = config.months - monthDiff;
                
                if (monthsRemaining <= 1) { // 1 month warning
                    // Prevent duplicate alert if km alert already triggered
                    if (!alerts.some(a => a.type === type)) {
                        alerts.push({
                            type: type,
                            title: config.name,
                            msg: monthsRemaining <= 0 ? `Servicio vencido por tiempo` : `Vence el próximo mes`,
                            danger: monthsRemaining <= 0
                        });
                    }
                }
            }
            
        } else {
            // No history, maybe suggest? (Optional, let's keep it clean for now)
        }
    });

    if (alerts.length === 0) {
        els.alertsList.innerHTML = '<p style="color: var(--success-color); text-align: center;"><i class="ph ph-check-circle"></i> Todo en orden</p>';
        return;
    }

    alerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = `alert-item ${alert.danger ? 'danger' : ''}`;
        div.innerHTML = `
            <div class="alert-icon"><i class="ph ph-warning-circle"></i></div>
            <div class="alert-content">
                <h4>${alert.title}</h4>
                <p>${alert.msg}</p>
            </div>
        `;
        els.alertsList.appendChild(div);
    });
}

// Event Listeners
function setupEventListeners() {
    // Modals Close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Close on outside click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
            }
        });
    });

    // Mileage Edit
    els.btnEditMileage.addEventListener('click', () => {
        els.inputMileage.value = state.mileage || '';
        els.modalMileage.classList.remove('hidden');
        els.inputMileage.focus();
    });

    els.formMileage.addEventListener('submit', (e) => {
        e.preventDefault();
        const newKm = parseInt(els.inputMileage.value);
        if (!isNaN(newKm)) {
            state.mileage = newKm;
            saveState();
            updateUI();
            els.modalMileage.classList.add('hidden');
            showToast('Kilometraje actualizado');
        }
    });

    // Inflate Tires
    els.btnInflateTires.addEventListener('click', () => {
        // Quick Action: log today as inflate date
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        state.lastTireInflate = today;
        saveState();
        updateUI();
        showToast('Inflado de neumáticos registrado');
    });

    // Add Maintenance
    els.btnAddMaintenance.addEventListener('click', () => {
        // Pre-fill form for new record
        if (els.modalMaintenanceTitle) els.modalMaintenanceTitle.textContent = "Registrar Servicio";
        if (els.btnSubmitMaintenance) els.btnSubmitMaintenance.textContent = "Guardar Registro";
        if (els.editMaintenanceId) els.editMaintenanceId.value = '';

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('inputDate').value = today;
        document.getElementById('inputKm').value = state.mileage;
        document.getElementById('inputType').value = 'aceite';
        document.getElementById('inputNotes').value = '';
        
        els.modalMaintenance.classList.remove('hidden');
    });

    els.formMaintenance.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('inputType').value;
        const date = document.getElementById('inputDate').value;
        const km = parseInt(document.getElementById('inputKm').value);
        const notes = document.getElementById('inputNotes').value.trim();
        const editId = els.editMaintenanceId ? els.editMaintenanceId.value : '';

        if (editId) {
            // Edit existing record
            const idx = state.history.findIndex(h => h.id === editId);
            if (idx !== -1) {
                state.history[idx] = {
                    id: editId,
                    type,
                    date,
                    km,
                    notes
                };
            }
            if (km > state.mileage) {
                state.mileage = km;
            }
            saveState();
            updateUI();
            els.modalMaintenance.classList.add('hidden');
            showToast('Servicio modificado');
        } else {
            // Create new record
            const newRecord = {
                id: Date.now().toString(),
                type,
                date,
                km,
                notes
            };
            
            state.history.push(newRecord);
            
            // Auto-update global mileage if record km is higher
            if (km > state.mileage) {
                state.mileage = km;
            }
            
            saveState();
            updateUI();
            els.modalMaintenance.classList.add('hidden');
            showToast('Servicio registrado');
        }
    });

    // Confirm Delete Actions
    if (els.btnConfirmDelete) {
        els.btnConfirmDelete.addEventListener('click', () => {
            if (!pendingDeleteId) return;
            const toDeleteId = pendingDeleteId;
            pendingDeleteId = null;
            els.modalConfirmDelete.classList.add('hidden');

            const wrapper = document.querySelector(`.swipe-item-wrapper[data-id="${toDeleteId}"]`);
            if (wrapper) {
                wrapper.classList.add('deleting');
            }

            setTimeout(() => {
                state.history = state.history.filter(h => h.id !== toDeleteId);
                saveState();
                updateUI();
                showToast('Registro eliminado');
            }, 300);
        });
    }

    if (els.btnCancelDelete) {
        els.btnCancelDelete.addEventListener('click', () => {
            pendingDeleteId = null;
            els.modalConfirmDelete.classList.add('hidden');
        });
    }

    // Toggle View All History
    if (els.btnViewAll) {
        els.btnViewAll.addEventListener('click', () => {
            showAllHistory = !showAllHistory;
            renderHistory();
        });
    }

    // PWA Install
    if (els.btnInstallPwa) {
        els.btnInstallPwa.addEventListener('click', async () => {
            if (deferredPrompt) {
                // Show the install prompt
                deferredPrompt.prompt();
                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    els.btnInstallPwa.classList.add('hidden');
                }
                deferredPrompt = null;
            }
        });
    }

    // Settings info
    if (els.btnSettings) {
        els.btnSettings.addEventListener('click', () => {
            showToast('Peugeot 206 1.4 Nafta (2012) · v1.2');
        });
    }
}

function showToast(msg) {
    els.toastMessage.textContent = msg;
    els.toastNotification.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        els.toastNotification.classList.add('hidden');
    }, 3000);
}

// Start
init();
