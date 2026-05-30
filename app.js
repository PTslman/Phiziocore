// ============================================
// التطبيق الرئيسي - PhysioCare Pro (الإصدار النهائي)
// ============================================

// متغيرات عامة
let patients = [];
let currentPatientId = null;
let confirmCallback = null;
let unsubscribe = null;

// ============================================
// تهيئة التطبيق
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadTheme();
    setupStatusSelector();
});

function initializeApp() {
    checkFirebaseAndSync();
    
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            setTimeout(() => {
                splash.style.display = 'none';
                const app = document.getElementById('app');
                if (app) app.style.display = 'block';
            }, 500);
        }
    }, 2000);
}

// ============================================
// التحقق من Firebase
// ============================================
function checkFirebaseAndSync() {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    
    if (connectionDot) connectionDot.className = 'connection-dot connecting';
    if (connectionText) connectionText.textContent = 'جاري الاتصال بقاعدة البيانات...';
    
    const checkInterval = setInterval(() => {
        const isReady = window.isFirebaseReady && window.isFirebaseReady();
        const database = window.db ? window.db() : null;
        
        if (isReady && database) {
            if (connectionDot) connectionDot.className = 'connection-dot connected';
            if (connectionText) connectionText.textContent = '✅ متصل بقاعدة البيانات';
            clearInterval(checkInterval);
            setupRealtimeSync();
        } else if (document.readyState === 'complete' && !isReady) {
            if (connectionDot) connectionDot.className = 'connection-dot disconnected';
            if (connectionText) connectionText.textContent = '⚠️ غير متصل - وضع عدم الاتصال';
            loadLocalData();
            clearInterval(checkInterval);
        }
    }, 500);
    
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.isFirebaseReady || !window.isFirebaseReady()) {
            if (connectionDot) connectionDot.className = 'connection-dot disconnected';
            if (connectionText) connectionText.textContent = '⚠️ غير متصل - وضع عدم الاتصال';
            loadLocalData();
        }
    }, 10000);
}

function loadLocalData() {
    const savedData = localStorage.getItem('physiocare_patients');
    if (savedData) {
        try {
            patients = JSON.parse(savedData);
            renderPatients();
            updateStats();
        } catch(e) {
            console.error('Error loading local data:', e);
        }
    }
}

function saveLocalData() {
    localStorage.setItem('physiocare_patients', JSON.stringify(patients));
}

// ============================================
// مزامنة Firebase
// ============================================
function setupRealtimeSync() {
    try {
        const database = window.db ? window.db() : null;
        if (!database) {
            loadLocalData();
            return;
        }
        
        const patientsRef = database.collection('patients');
        
        if (unsubscribe) unsubscribe();
        
        unsubscribe = patientsRef.onSnapshot(snapshot => {
            patients = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                patients.push({
                    id: doc.id,
                    name: data.name || '',
                    price: data.price || 50000,
                    status: data.status || 'تحت العلاج',
                    sessions: data.sessions || []
                });
            });
            renderPatients();
            updateStats();
            saveLocalData();
        }, error => {
            console.error("Firestore error:", error);
            loadLocalData();
        });
        
    } catch (error) {
        console.error('Setup error:', error);
        loadLocalData();
    }
}

// ============================================
// محدد الحالة
// ============================================
function setupStatusSelector() {
    const options = document.querySelectorAll('.status-option');
    options.forEach(option => {
        option.addEventListener('click', function() {
            options.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            const status = this.getAttribute('data-status');
            document.getElementById('patientStatus').value = status;
        });
    });
}

// ============================================
// إعداد المستمعين
// ============================================
function setupEventListeners() {
    // أزرار التنقل
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.onclick = toggleTheme;
    
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) syncBtn.onclick = manualSync;
    
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.onclick = () => showModal('settingsModal');
    
    const filesBtn = document.getElementById('filesBtn');
    if (filesBtn) filesBtn.onclick = () => showModal('filesModal');
    
    // أزرار المرضى
    const addPatientBtn = document.getElementById('addPatientBtn');
    if (addPatientBtn) addPatientBtn.onclick = () => {
        resetPatientForm();
        showModal('patientModal');
    };
    
    const emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) emptyAddBtn.onclick = () => {
        resetPatientForm();
        showModal('patientModal');
    };
    
    const confirmAdd = document.getElementById('confirmAdd');
    if (confirmAdd) confirmAdd.onclick = addPatient;
    
    // أزرار التقارير
    const pdfReportBtn = document.getElementById('pdfReportBtn');
    if (pdfReportBtn) pdfReportBtn.onclick = generateGeneralPDF;
    
    // أزرار النسخ الاحتياطي
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) backupBtn.onclick = backupData;
    
    const restoreBtn = document.getElementById('restoreBtn');
    if (restoreBtn) restoreBtn.onclick = () => document.getElementById('restoreFileInput').click();
    
    const restoreFileInput = document.getElementById('restoreFileInput');
    if (restoreFileInput) {
        restoreFileInput.onchange = (e) => {
            if (e.target.files[0]) restoreData(e.target.files[0]);
            e.target.value = '';
        };
    }
    
    // أزرار الجلسات
    const addSessionBtn = document.getElementById('addSessionBtn');
    if (addSessionBtn) addSessionBtn.onclick = addSession;
    
    const resetSessionsBtn = document.getElementById('resetSessionsBtn');
    if (resetSessionsBtn) resetSessionsBtn.onclick = resetSessions;
    
    // أزرار التأكيد
    const cancelConfirm = document.getElementById('cancelConfirm');
    if (cancelConfirm) cancelConfirm.onclick = hideConfirmModal;
    
    const confirmAction = document.getElementById('confirmAction');
    if (confirmAction) {
        confirmAction.onclick = () => {
            if (confirmCallback) {
                confirmCallback();
                hideConfirmModal();
            }
        };
    }
    
    // بحث
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    if (searchInput) {
        searchInput.oninput = () => {
            filterPatients();
            if (clearSearch) clearSearch.style.display = searchInput.value ? 'flex' : 'none';
        };
    }
    
    if (clearSearch) {
        clearSearch.onclick = () => {
            if (searchInput) {
                searchInput.value = '';
                filterPatients();
                clearSearch.style.display = 'none';
            }
        };
    }
    
    // إغلاق المودالات
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
        };
    });
    
    window.onclick = (e) => {
        if (e.target.classList && e.target.classList.contains('modal-overlay')) {
            e.target.classList.remove('show');
        }
    };
}

function resetPatientForm() {
    const nameInput = document.getElementById('patientName');
    const priceInput = document.getElementById('patientPrice');
    const statusInput = document.getElementById('patientStatus');
    
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '50000';
    if (statusInput) statusInput.value = 'تحت العلاج';
    
    const options = document.querySelectorAll('.status-option');
    options.forEach(opt => {
        opt.classList.remove('active');
        if (opt.getAttribute('data-status') === 'تحت العلاج') {
            opt.classList.add('active');
        }
    });
}

function manualSync() {
    showToast('🔄 جاري مزامنة البيانات...');
    if (unsubscribe) {
        unsubscribe();
        setupRealtimeSync();
    }
}

// ============================================
// عرض المرضى
// ============================================
function getStatusClass(status) {
    switch(status) {
        case 'تحت العلاج': return 'status-active';
        case 'مستقر': return 'status-stable';
        case 'مكتمل': return 'status-completed';
        case 'متوقف': return 'status-stopped';
        default: return 'status-active';
    }
}

function renderPatients() {
    const container = document.getElementById('patientsList');
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const filtered = patients.filter(p => p.name && p.name.toLowerCase().includes(searchTerm));
    
    if (!container) return;
    
    if (filtered.length === 0) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'block';
        container.innerHTML = '';
        const patientCount = document.getElementById('patientCount');
        if (patientCount) patientCount.textContent = '0';
        return;
    }
    
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';
    
    const patientCount = document.getElementById('patientCount');
    if (patientCount) patientCount.textContent = filtered.length;
    
    container.innerHTML = filtered.map(patient => {
        const sessionCount = patient.sessions?.length || 0;
        const totalAmount = sessionCount * (patient.price || 0);
        const statusClass = getStatusClass(patient.status);
        
        return `
            <div class="patient-card" data-id="${patient.id}">
                <div class="patient-header">
                    <div class="patient-info">
                        <div class="patient-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="patient-details">
                            <h4>${escapeHtml(patient.name)}</h4>
                            <div class="patient-status ${statusClass}">
                                <span class="status-dot" style="width: 6px; height: 6px; display: inline-block; border-radius: 50%; margin-left: 5px;"></span>
                                ${patient.status || 'تحت العلاج'}
                            </div>
                        </div>
                    </div>
                    <div class="stat-chip">
                        <i class="fas fa-coins"></i>
                        ${totalAmount.toLocaleString()} ل.س
                    </div>
                </div>
                <div class="patient-stats">
                    <div class="stat-chip">
                        <i class="fas fa-calendar-alt"></i>
                        ${sessionCount} جلسة
                    </div>
                    <div class="stat-chip">
                        <i class="fas fa-tag"></i>
                        ${(patient.price || 0).toLocaleString()} ل.س/جلسة
                    </div>
                </div>
                <div class="patient-actions">
                    <button class="icon-btn" onclick="window.openSessions('${patient.id}')" title="سجل الجلسات">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="icon-btn" onclick="window.generatePatientPDF('${patient.id}')" title="تقرير PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="icon-btn" onclick="window.deletePatient('${patient.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    const totalPatients = patients.length;
    const totalSessions = patients.reduce((sum, p) => sum + (p.sessions?.length || 0), 0);
    const totalRevenue = patients.reduce((sum, p) => sum + ((p.sessions?.length || 0) * (p.price || 0)), 0);
    
    const totalPatientsEl = document.getElementById('totalPatients');
    const totalSessionsEl = document.getElementById('totalSessions');
    const totalRevenueEl = document.getElementById('totalRevenue');
    
    if (totalPatientsEl) totalPatientsEl.textContent = totalPatients;
    if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
    if (totalRevenueEl) totalRevenueEl.textContent = totalRevenue.toLocaleString();
}

function filterPatients() {
    renderPatients();
}

// ============================================
// إضافة مريض
// ============================================
async function addPatient() {
    const name = document.getElementById('patientName')?.value.trim();
    const price = parseFloat(document.getElementById('patientPrice')?.value);
    const status = document.getElementById('patientStatus')?.value || 'تحت العلاج';
    
    if (!name) {
        showToast('❌ يرجى إدخال اسم المريض', true);
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast('❌ يرجى إدخال سعر صحيح', true);
        return;
    }
    
    // إغلاق المودال فوراً
    hideModal('patientModal');
    showToast('💾 جاري حفظ المريض...');
    
    try {
        const database = window.db ? window.db() : null;
        
        if (database && window.isFirebaseReady && window.isFirebaseReady()) {
            database.collection('patients').add({ 
                name: name, 
                price: price,
                status: status,
                sessions: [],
                createdAt: new Date().toISOString()
            }).then(() => {
                showToast('✅ تمت إضافة المريض بنجاح');
            }).catch((error) => {
                console.error('Firebase add error:', error);
                showToast('⚠️ تم الحفظ محلياً بسبب خطأ في الشبكة');
                const newPatient = {
                    id: 'local_' + Date.now(),
                    name: name,
                    price: price,
                    status: status,
                    sessions: []
                };
                patients.push(newPatient);
                saveLocalData();
                renderPatients();
                updateStats();
            });
        } else {
            const newPatient = {
                id: 'local_' + Date.now(),
                name: name,
                price: price,
                status: status,
                sessions: []
            };
            patients.push(newPatient);
            saveLocalData();
            renderPatients();
            updateStats();
            showToast('✅ تمت إضافة المريض محلياً');
        }
        
        resetPatientForm();
        
    } catch (error) {
        console.error('Add patient error:', error);
        showToast('❌ فشل إضافة المريض: ' + error.message, true);
    }
}

async function deletePatient(patientId) {
    showConfirm('حذف مريض', '⚠️ هل أنت متأكد من حذف هذا المريض نهائياً؟', async () => {
        try {
            const database = window.db ? window.db() : null;
            
            if (database && window.isFirebaseReady && window.isFirebaseReady() && !patientId.startsWith('local_')) {
                await database.collection('patients').doc(patientId).delete();
                showToast('✅ تم حذف المريض');
            } else {
                const index = patients.findIndex(p => p.id === patientId);
                if (index !== -1) {
                    patients.splice(index, 1);
                    saveLocalData();
                    renderPatients();
                    updateStats();
                    showToast('✅ تم حذف المريض');
                }
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('❌ فشل حذف المريض', true);
        }
    });
}

// ============================================
// إدارة الجلسات
// ============================================
async function openSessions(patientId) {
    currentPatientId = patientId;
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    const sessionPatientName = document.getElementById('sessionPatientName');
    if (sessionPatientName) sessionPatientName.innerHTML = patient.name;
    
    const sessionDate = document.getElementById('sessionDate');
    if (sessionDate) sessionDate.value = new Date().toISOString().slice(0, 10);
    
    renderSessions();
    updateSessionStats(patient);
    showModal('sessionsModal');
}

function updateSessionStats(patient) {
    const sessionCount = patient.sessions?.length || 0;
    const totalAmount = sessionCount * (patient.price || 0);
    
    const totalSessionsCount = document.getElementById('totalSessionsCount');
    const totalAmountDue = document.getElementById('totalAmountDue');
    
    if (totalSessionsCount) totalSessionsCount.textContent = sessionCount;
    if (totalAmountDue) totalAmountDue.textContent = totalAmount.toLocaleString();
}

function renderSessions() {
    const patient = patients.find(p => p.id === currentPatientId);
    const container = document.getElementById('sessionsList');
    
    if (!container) return;
    
    if (!patient?.sessions?.length) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px">
                <i class="fas fa-calendar-times" style="font-size: 3rem; opacity: 0.5;"></i>
                <p style="margin-top: 12px;">لا توجد جلسات مسجلة</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = patient.sessions.map((session, index) => `
        <div class="session-item">
            <div style="display:flex;align-items:center;gap:12px">
                <span class="session-number">${index + 1}</span>
                <div class="session-date">
                    <i class="fas fa-calendar-day"></i>
                    ${formatDate(session.date)}
                </div>
            </div>
            <button class="session-delete" onclick="window.removeSession(${index})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

async function addSession() {
    const date = document.getElementById('sessionDate')?.value;
    if (!date) {
        showToast('❌ يرجى اختيار التاريخ', true);
        return;
    }
    
    const patient = patients.find(p => p.id === currentPatientId);
    if (!patient) return;
    
    hideModal('sessionsModal');
    showToast('💾 جاري حفظ الجلسة...');
    
    try {
        const newSessions = [...(patient.sessions || []), { date }];
        const database = window.db ? window.db() : null;
        
        if (database && window.isFirebaseReady && window.isFirebaseReady() && !patient.id?.startsWith('local_')) {
            database.collection('patients').doc(currentPatientId).update({ sessions: newSessions })
                .then(() => {
                    showToast('✅ تمت إضافة الجلسة');
                })
                .catch((error) => {
                    console.error('Firebase session error:', error);
                    patient.sessions = newSessions;
                    const index = patients.findIndex(p => p.id === currentPatientId);
                    if (index !== -1) patients[index] = patient;
                    saveLocalData();
                    renderPatients();
                    updateStats();
                    showToast('✅ تمت إضافة الجلسة محلياً');
                });
        } else {
            patient.sessions = newSessions;
            const index = patients.findIndex(p => p.id === currentPatientId);
            if (index !== -1) patients[index] = patient;
            saveLocalData();
            renderPatients();
            updateStats();
            showToast('✅ تمت إضافة الجلسة');
        }
        
    } catch (error) {
        console.error('Add session error:', error);
        showToast('❌ فشل إضافة الجلسة', true);
    }
}

async function removeSession(index) {
    showConfirm('حذف جلسة', '🗑️ هل تريد حذف هذه الجلسة؟', async () => {
        const patient = patients.find(p => p.id === currentPatientId);
        if (patient && patient.sessions) {
            const newSessions = [...patient.sessions];
            newSessions.splice(index, 1);
            
            try {
                const database = window.db ? window.db() : null;
                
                if (database && window.isFirebaseReady && window.isFirebaseReady() && !patient.id?.startsWith('local_')) {
                    await database.collection('patients').doc(currentPatientId).update({ sessions: newSessions });
                } else {
                    patient.sessions = newSessions;
                    const idx = patients.findIndex(p => p.id === currentPatientId);
                    if (idx !== -1) patients[idx] = patient;
                    saveLocalData();
                    renderPatients();
                    updateStats();
                }
                
                showToast('✅ تم حذف الجلسة');
                if (document.getElementById('sessionsModal').classList.contains('show')) {
                    renderSessions();
                    updateSessionStats(patient);
                }
                
            } catch (error) {
                console.error('Remove session error:', error);
                showToast('❌ فشل حذف الجلسة', true);
            }
        }
    });
}

async function resetSessions() {
    showConfirm('مسح الجلسات', '⚠️ هل تريد مسح جميع جلسات هذا المريض؟', async () => {
        try {
            const database = window.db ? window.db() : null;
            const patient = patients.find(p => p.id === currentPatientId);
            
            if (database && window.isFirebaseReady && window.isFirebaseReady() && !patient?.id?.startsWith('local_')) {
                await database.collection('patients').doc(currentPatientId).update({ sessions: [] });
            } else if (patient) {
                patient.sessions = [];
                const idx = patients.findIndex(p => p.id === currentPatientId);
                if (idx !== -1) patients[idx] = patient;
                saveLocalData();
                renderPatients();
                updateStats();
            }
            
            showToast('🗑️ تم مسح جميع الجلسات');
            hideModal('sessionsModal');
        } catch (error) {
            console.error('Reset sessions error:', error);
            showToast('❌ فشل مسح الجلسات', true);
        }
    });
}

// ============================================
// PDF Functions
// ============================================
async function generatePatientPDF(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    showToast(`📄 جاري إنشاء PDF للمريض: ${patient.name}...`);
    
    const sessionsList = patient.sessions || [];
    const sessionRows = sessionsList.map((s, idx) => `
        <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
            <span style="font-weight: 600;">جلسة ${idx + 1}</span>
            <span>${formatDate(s.date)}</span>
        </div>
    `).join('');
    
    const totalAmount = sessionsList.length * patient.price;
    
    // تحديد ألوان PDF حسب وضع الثيم
    const isDarkMode = document.body.classList.contains('dark');
    const bgColor = isDarkMode ? '#1a1a2e' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#1e1b4b';
    const cardBg = isDarkMode ? '#16213e' : '#f8fafc';
    const borderColor = isDarkMode ? '#2a2a3e' : '#e2e8f0';
    
    const html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; background: ${bgColor}; color: ${textColor};">
            <div style="text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 25px;">
                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas fa-hand-holding-heart" style="font-size: 2rem; color: white;"></i>
                </div>
                <h2 style="color: ${isDarkMode ? '#a5b4fc' : '#4f46e5'}; margin: 0;">PhysioCare Pro</h2>
                <p style="color: ${isDarkMode ? '#94a3b8' : '#64748b'}; margin: 5px 0 0;">تقرير المريض - ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            
            <div style="background: ${cardBg}; border-radius: 16px; padding: 20px; margin-bottom: 25px; border: 1px solid ${borderColor};">
                <h3 style="color: ${textColor}; margin-bottom: 15px;">👤 بيانات المريض</h3>
                <table style="width: 100%;">
                    <tr><td style="padding: 8px 0; color: ${textColor};"><strong>الاسم:</strong></td><td style="color: ${textColor};">${escapeHtml(patient.name)}</td></tr>
                    <tr><td style="padding: 8px 0; color: ${textColor};"><strong>الحالة:</strong></td><td style="color: ${textColor};">${patient.status || 'تحت العلاج'}</td></tr>
                    <tr><td style="padding: 8px 0; color: ${textColor};"><strong>سعر الجلسة:</strong></td><td style="color: ${textColor};">${patient.price.toLocaleString()} ل.س</td></tr>
                    <tr><td style="padding: 8px 0; color: ${textColor};"><strong>عدد الجلسات:</strong></td><td style="color: ${textColor};">${sessionsList.length} جلسة</td></tr>
                    <tr><td style="padding: 8px 0; color: ${textColor};"><strong>الإجمالي المستحق:</strong></td><td style="color: #10b981; font-weight: bold;">${totalAmount.toLocaleString()} ل.س</td></tr>
                </table>
            </div>
            
            <div style="background: ${bgColor}; border-radius: 16px; padding: 20px; border: 1px solid ${borderColor};">
                <h3 style="color: ${textColor}; margin-bottom: 15px;">📅 تفاصيل الجلسات</h3>
                ${sessionRows || '<p style="text-align: center; color: #64748b;">لا توجد جلسات مسجلة</p>'}
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor}; font-size: 11px; color: ${isDarkMode ? '#94a3b8' : '#94a3b8'};">
                تم إنشاء هذا التقرير بواسطة PhysioCare Pro
            </div>
        </div>
    `;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.style.position = 'absolute';
    tempDiv.style.top = '-10000px';
    tempDiv.style.left = '-10000px';
    document.body.appendChild(tempDiv);
    
    try {
        const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: bgColor });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`${patient.name}_تقرير_طبي.pdf`);
        showToast(`✅ تم تنزيل PDF للمريض ${patient.name}`);
    } catch (err) {
        console.error('PDF error:', err);
        showToast('❌ حدث خطأ أثناء إنشاء PDF', true);
    } finally {
        document.body.removeChild(tempDiv);
    }
}

async function generateGeneralPDF() {
    if (!patients.length) {
        showToast('❌ لا توجد بيانات لإنشاء التقرير', true);
        return;
    }
    
    showToast('📊 جاري إنشاء التقرير العام...');
    
    let totalSessions = 0, totalRevenue = 0;
    patients.forEach(p => {
        const cnt = p.sessions?.length || 0;
        totalSessions += cnt;
        totalRevenue += cnt * (p.price || 0);
    });
    
    const isDarkMode = document.body.classList.contains('dark');
    const bgColor = isDarkMode ? '#1a1a2e' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#1e1b4b';
    const cardBg = isDarkMode ? '#16213e' : '#f8fafc';
    const borderColor = isDarkMode ? '#2a2a3e' : '#e2e8f0';
    
    const patientRows = patients.map((p, i) => `
        <tr style="border-bottom: 1px solid ${borderColor};">
            <td style="padding: 10px; text-align: center; color: ${textColor};">${i + 1}</td>
            <td style="padding: 10px; color: ${textColor};">${escapeHtml(p.name)}</td>
            <td style="padding: 10px; text-align: center; color: ${textColor};">${p.status || 'تحت العلاج'}</td>
            <td style="padding: 10px; text-align: center; color: ${textColor};">${p.sessions?.length || 0}</td>
            <td style="padding: 10px; text-align: center; color: ${textColor};">${(p.price || 0).toLocaleString()}</td>
            <td style="padding: 10px; text-align: center; color: #10b981;">${((p.sessions?.length || 0) * (p.price || 0)).toLocaleString()}</td>
         </tr>
    `).join('');
    
    const html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 30px; background: ${bgColor}; color: ${textColor};">
            <div style="text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 25px;">
                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas fa-chart-line" style="font-size: 2rem; color: white;"></i>
                </div>
                <h2 style="color: ${isDarkMode ? '#a5b4fc' : '#4f46e5'};">تقرير PhysioCare Pro الشامل</h2>
                <p style="color: ${isDarkMode ? '#94a3b8' : '#64748b'};">${new Date().toLocaleString('ar-EG')}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: ${cardBg};">
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">#</th>
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">المريض</th>
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">الحالة</th>
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">الجلسات</th>
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">سعر الجلسة</th>
                        <th style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${patientRows}
                </tbody>
                <tfoot>
                    <tr style="background: ${cardBg}; font-weight: bold;">
                        <td colspan="3" style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">الإجمالي الكلي</td>
                        <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; color: ${textColor};">${totalSessions} جلسة</td>
                        <td style="padding: 12px; border: 1px solid ${borderColor}; color: ${textColor};">-</td>
                        <td style="padding: 12px; border: 1px solid ${borderColor}; text-align: center; color: #10b981;">${totalRevenue.toLocaleString()} ل.س</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor}; font-size: 11px; color: ${isDarkMode ? '#94a3b8' : '#94a3b8'};">
                تم إنشاء هذا التقرير بواسطة PhysioCare Pro
            </div>
        </div>
    `;
    
    const pdfDiv = document.createElement('div');
    pdfDiv.innerHTML = html;
    pdfDiv.style.position = 'absolute';
    pdfDiv.style.top = '-10000px';
    pdfDiv.style.left = '-10000px';
    document.body.appendChild(pdfDiv);
    
    try {
        const canvas = await html2canvas(pdfDiv, { scale: 2, backgroundColor: bgColor });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
        pdf.save(`PhysioCare_تقرير_عام.pdf`);
        showToast('✅ تم إنشاء التقرير العام');
    } catch (err) {
        console.error('PDF error:', err);
        showToast('❌ حدث خطأ في إنشاء PDF', true);
    } finally {
        document.body.removeChild(pdfDiv);
    }
}

// ============================================
// نسخ احتياطي واستعادة
// ============================================
function backupData() {
    const data = JSON.stringify(patients, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PhysioCare_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ تم إنشاء النسخة الاحتياطية');
}

async function restoreData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error();
            
            showToast('🔄 جاري استعادة البيانات...');
            
            const database = window.db ? window.db() : null;
            
            if (database && window.isFirebaseReady && window.isFirebaseReady()) {
                const batch = database.batch();
                const snapshot = await database.collection('patients').get();
                snapshot.forEach(doc => batch.delete(doc.ref));
                
                imported.forEach(pat => {
                    const ref = database.collection('patients').doc(pat.id);
                    batch.set(ref, {
                        name: pat.name,
                        price: pat.price,
                        status: pat.status || 'تحت العلاج',
                        sessions: pat.sessions || []
                    });
                });
                await batch.commit();
            } else {
                patients = imported;
                saveLocalData();
                renderPatients();
                updateStats();
            }
            
            showToast('✅ تمت استعادة البيانات بنجاح');
        } catch (err) {
            console.error('Restore error:', err);
            showToast('❌ الملف غير صالح أو تالف', true);
        }
    };
    reader.readAsText(file);
}

// ============================================
// الثيم
// ============================================
function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    if (isDark) {
        document.body.classList.remove('dark');
        document.body.classList.add('light');
        localStorage.setItem('theme', 'light');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.remove('light');
        document.body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
        document.body.classList.add('light');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.add('dark');
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ============================================
// دوال مساعدة
// ============================================
function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('show');
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('show');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showConfirm(title, message, callback) {
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    
    if (confirmTitle) confirmTitle.textContent = title;
    if (confirmMessage) confirmMessage.textContent = message;
    
    confirmCallback = callback;
    showModal('confirmModal');
}

function hideConfirmModal() {
    hideModal('confirmModal');
    confirmCallback = null;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// تصدير الدوال للاستخدام العام
window.openSessions = openSessions;
window.generatePatientPDF = generatePatientPDF;
window.deletePatient = deletePatient;
window.removeSession = removeSession;
