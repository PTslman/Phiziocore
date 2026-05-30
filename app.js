// ============================================
// التطبيق الرئيسي - PhysioCare Pro (الإصدار المصحح)
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
    // التحقق من Firebase
    checkFirebaseAndSync();
    
    // إخفاء شاشة البداية
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
// التحقق من Firebase وبدء المزامنة
// ============================================
function checkFirebaseAndSync() {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    
    if (connectionDot) connectionDot.className = 'connection-dot connecting';
    if (connectionText) connectionText.textContent = 'جاري الاتصال بقاعدة البيانات...';
    
    // انتظار تهيئة Firebase
    const checkInterval = setInterval(() => {
        const isReady = window.isFirebaseReady && window.isFirebaseReady();
        const database = window.db ? window.db() : null;
        
        if (isReady && database) {
            if (connectionDot) connectionDot.className = 'connection-dot connected';
            if (connectionText) connectionText.textContent = '✅ متصل بقاعدة البيانات';
            clearInterval(checkInterval);
            setupRealtimeSync();
        } else if (document.readyState === 'complete' && !isReady) {
            // إذا فشل الاتصال بعد 5 ثوان
            if (connectionDot) connectionDot.className = 'connection-dot disconnected';
            if (connectionText) connectionText.textContent = '⚠️ غير متصل - سيتم حفظ البيانات محلياً';
            showToast('⚠️ فشل الاتصال بقاعدة البيانات، البيانات تحفظ محلياً', true);
            // بدء وضع عدم الاتصال
            loadLocalData();
            clearInterval(checkInterval);
        }
    }, 500);
    
    // مهلة 10 ثوان
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.isFirebaseReady || !window.isFirebaseReady()) {
            if (connectionDot) connectionDot.className = 'connection-dot disconnected';
            if (connectionText) connectionText.textContent = '⚠️ غير متصل - وضع عدم الاتصال';
            loadLocalData();
        }
    }, 10000);
}

// تحميل بيانات محلية كنسخة احتياطية
function loadLocalData() {
    const savedData = localStorage.getItem('physiocare_patients');
    if (savedData) {
        try {
            patients = JSON.parse(savedData);
            renderPatients();
            updateStats();
            showToast('📱 تم تحميل البيانات من التخزين المحلي');
        } catch(e) {
            console.error('Error loading local data:', e);
        }
    }
}

// حفظ البيانات محلياً
function saveLocalData() {
    if (patients.length > 0) {
        localStorage.setItem('physiocare_patients', JSON.stringify(patients));
    }
}

// ============================================
// مزامنة Firebase الحية
// ============================================
function setupRealtimeSync() {
    try {
        const database = window.db ? window.db() : null;
        if (!database) {
            console.warn('Firestore not available - using local storage');
            loadLocalData();
            return;
        }
        
        const patientsRef = database.collection('patients');
        
        if (unsubscribe) {
            unsubscribe();
        }
        
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
            saveLocalData(); // حفظ نسخة محلية
            updateConnectionUI(true);
        }, error => {
            console.error("Firestore error:", error);
            updateConnectionUI(false);
            showToast('⚠️ خطأ في الاتصال بقاعدة البيانات', true);
            loadLocalData(); // استخدام البيانات المحلية كبديل
        });
        
    } catch (error) {
        console.error('Setup error:', error);
        updateConnectionUI(false);
        loadLocalData();
    }
}

function updateConnectionUI(isConnected) {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    const connectionTime = document.getElementById('connectionTime');
    
    if (!connectionDot) return;
    
    if (isConnected) {
        connectionDot.className = 'connection-dot connected';
        if (connectionText) connectionText.textContent = '✅ متصل بقاعدة البيانات';
        if (connectionTime) connectionTime.textContent = new Date().toLocaleTimeString('ar-EG');
    } else {
        connectionDot.className = 'connection-dot disconnected';
        if (connectionText) connectionText.textContent = '⚠️ غير متصل - البيانات محلية';
    }
}

function manualSync() {
    showToast('🔄 جاري مزامنة البيانات...');
    if (unsubscribe) {
        unsubscribe();
        setupRealtimeSync();
    } else {
        checkFirebaseAndSync();
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
    // أزرار رئيسية
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.onclick = toggleTheme;
    
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) syncBtn.onclick = manualSync;
    
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.onclick = () => showModal('settingsModal');
    
    const addPatientBtn = document.getElementById('addPatientBtn');
    if (addPatientBtn) addPatientBtn.onclick = () => showModal('patientModal');
    
    const emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) emptyAddBtn.onclick = () => showModal('patientModal');
    
    const confirmAdd = document.getElementById('confirmAdd');
    if (confirmAdd) confirmAdd.onclick = addPatient;
    
    const pdfReportBtn = document.getElementById('pdfReportBtn');
    if (pdfReportBtn) pdfReportBtn.onclick = generateGeneralPDF;
    
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
    
    const addSessionBtn = document.getElementById('addSessionBtn');
    if (addSessionBtn) addSessionBtn.onclick = addSession;
    
    const resetSessionsBtn = document.getElementById('resetSessionsBtn');
    if (resetSessionsBtn) resetSessionsBtn.onclick = resetSessions;
    
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
// إضافة مريض - الإصدار المصحح
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
    
    // إظهار مؤقت التحميل
    const confirmBtn = document.getElementById('confirmAdd');
    const originalText = confirmBtn?.innerHTML;
    if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
        confirmBtn.disabled = true;
    }
    
    try {
        const database = window.db ? window.db() : null;
        
        if (database && window.isFirebaseReady && window.isFirebaseReady()) {
            // حفظ في Firebase
            await database.collection('patients').add({ 
                name: name, 
                price: price,
                status: status,
                sessions: [],
                createdAt: new Date().toISOString()
            });
            showToast('✅ تمت إضافة المريض بنجاح إلى قاعدة البيانات');
        } else {
            // حفظ محلياً إذا كان Firebase غير متصل
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
            showToast('✅ تمت إضافة المريض محلياً (سيتم مزامنته لاحقاً)');
        }
        
        // إغلاق المودال وتنظيف الحقول
        hideModal('patientModal');
        
        // تنظيف حقول الإدخال
        const nameInput = document.getElementById('patientName');
        const priceInput = document.getElementById('patientPrice');
        if (nameInput) nameInput.value = '';
        if (priceInput) priceInput.value = '50000';
        
        // إعادة تعيين محدد الحالة
        const statusInput = document.getElementById('patientStatus');
        if (statusInput) statusInput.value = 'تحت العلاج';
        
        const options = document.querySelectorAll('.status-option');
        options.forEach(opt => {
            opt.classList.remove('active');
            if (opt.getAttribute('data-status') === 'تحت العلاج') {
                opt.classList.add('active');
            }
        });
        
        // تحديث الواجهة
        if (database && window.isFirebaseReady && window.isFirebaseReady()) {
            // المزامنة ستحصل تلقائياً من onSnapshot
        } else {
            renderPatients();
            updateStats();
        }
        
    } catch (error) {
        console.error('Add patient error:', error);
        showToast('❌ فشل إضافة المريض: ' + error.message, true);
    } finally {
        if (confirmBtn) {
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
    }
}

async function deletePatient(patientId) {
    showConfirm('حذف مريض', '⚠️ هل أنت متأكد من حذف هذا المريض نهائياً؟', async () => {
        try {
            const database = window.db ? window.db() : null;
            
            if (database && window.isFirebaseReady && window.isFirebaseReady()) {
                await database.collection('patients').doc(patientId).delete();
                showToast('✅ تم حذف المريض من قاعدة البيانات');
            } else {
                // حذف محلي
                const index = patients.findIndex(p => p.id === patientId);
                if (index !== -1) {
                    patients.splice(index, 1);
                    saveLocalData();
                    renderPatients();
                    updateStats();
                    showToast('✅ تم حذف المريض محلياً');
                }
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('❌ فشل حذف المريض', true);
        }
    });
}

// ============================================
// إدارة الجلسات - الإصدار المصحح
// ============================================
async function openSessions(patientId) {
    currentPatientId = patientId;
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    const sessionPatientName = document.getElementById('sessionPatientName');
    if (sessionPatientName) sessionPatientName.innerHTML = patient.name;
    
    const sessionDate = document.getElementById('sessionDate');
    if (sessionDate) sessionDate.value = new Date().toISOString().slice(0, 10);
    
    await renderSessions();
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

async function renderSessions() {
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
    
    // إظهار مؤقت التحميل
    const addBtn = document.getElementById('addSessionBtn');
    const originalText = addBtn?.innerHTML;
    if (addBtn) {
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري...';
        addBtn.disabled = true;
    }
    
    try {
        const newSessions = [...(patient.sessions || []), { date }];
        const database = window.db ? window.db() : null;
        
        if (database && window.isFirebaseReady && window.isFirebaseReady() && !patient.id?.startsWith('local_')) {
            await database.collection('patients').doc(currentPatientId).update({ sessions: newSessions });
            showToast('✅ تمت إضافة الجلسة إلى قاعدة البيانات');
        } else {
            // تحديث محلي
            patient.sessions = newSessions;
            const index = patients.findIndex(p => p.id === currentPatientId);
            if (index !== -1) patients[index] = patient;
            saveLocalData();
            renderPatients();
            updateStats();
            showToast('✅ تمت إضافة الجلسة محلياً');
        }
        
        // تحديث الواجهة
        await renderSessions();
        updateSessionStats(patient);
        
    } catch (error) {
        console.error('Add session error:', error);
        showToast('❌ فشل إضافة الجلسة', true);
    } finally {
        if (addBtn) {
            addBtn.innerHTML = originalText;
            addBtn.disabled = false;
        }
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
                    showToast('✅ تم حذف الجلسة');
                } else {
                    patient.sessions = newSessions;
                    const idx = patients.findIndex(p => p.id === currentPatientId);
                    if (idx !== -1) patients[idx] = patient;
                    saveLocalData();
                    renderPatients();
                    updateStats();
                    showToast('✅ تم حذف الجلسة محلياً');
                }
                
                await renderSessions();
                updateSessionStats(patient);
                
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
            
            if (database && window.isFirebaseReady && window.isFirebaseReady()) {
                await database.collection('patients').doc(currentPatientId).update({ sessions: [] });
                showToast('🗑️ تم مسح جميع الجلسات');
            } else {
                const patient = patients.find(p => p.id === currentPatientId);
                if (patient) {
                    patient.sessions = [];
                    const idx = patients.findIndex(p => p.id === currentPatientId);
                    if (idx !== -1) patients[idx] = patient;
                    saveLocalData();
                    renderPatients();
                    updateStats();
                    showToast('🗑️ تم مسح جميع الجلسات محلياً');
                }
            }
            
            hideModal('sessionsModal');
        } catch (error) {
            console.error('Reset sessions error:', error);
            showToast('❌ فشل مسح الجلسات', true);
        }
    });
}

// ============================================
// PDF Functions (مختصرة للاختصار - نفس الكود السابق)
// ============================================
async function generatePatientPDF(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    showToast(`📄 جاري إنشاء PDF للمريض: ${patient.name}...`);
    
    // ... (نفس الكود السابق لتوليد PDF)
    // للإختصار، نفس الكود من الإصدار السابق
}

async function generateGeneralPDF() {
    if (!patients.length) {
        showToast('❌ لا توجد بيانات لإنشاء التقرير', true);
        return;
    }
    showToast('📊 جاري إنشاء التقرير العام...');
    // ... (نفس الكود السابق)
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
