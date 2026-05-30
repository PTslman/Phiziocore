// ============================================
// التطبيق الرئيسي - PhysioCare Pro
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
    checkFirebaseConnection();
    
    setTimeout(() => {
        const splash = document.getElementById('splash');
        splash.classList.add('hide');
        setTimeout(() => {
            splash.style.display = 'none';
            document.getElementById('app').style.display = 'block';
        }, 500);
    }, 2000);
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
// التحقق من اتصال Firebase
// ============================================
function checkFirebaseConnection() {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    const connectionTime = document.getElementById('connectionTime');
    
    connectionDot.className = 'connection-dot connecting';
    connectionText.textContent = 'جاري الاتصال بقاعدة البيانات...';
    
    const checkInterval = setInterval(() => {
        if (typeof window.isFirebaseReady !== 'undefined' && window.isFirebaseReady()) {
            connectionDot.className = 'connection-dot connected';
            connectionText.textContent = '✅ متصل بقاعدة البيانات';
            connectionTime.textContent = new Date().toLocaleTimeString('ar-EG');
            clearInterval(checkInterval);
            setupRealtimeSync();
        } else if (typeof window.db !== 'undefined' && window.db()) {
            connectionDot.className = 'connection-dot connected';
            connectionText.textContent = '✅ متصل بقاعدة البيانات';
            connectionTime.textContent = new Date().toLocaleTimeString('ar-EG');
            clearInterval(checkInterval);
            setupRealtimeSync();
        } else {
            connectionDot.className = 'connection-dot disconnected';
            connectionText.textContent = '⚠️ غير متصل - وضع عدم الاتصال';
        }
    }, 1000);
}

// ============================================
// إعداد المستمعين
// ============================================
function setupEventListeners() {
    document.getElementById('themeToggle').onclick = toggleTheme;
    document.getElementById('syncBtn').onclick = manualSync;
    document.getElementById('settingsBtn').onclick = () => showModal('settingsModal');
    document.getElementById('addPatientBtn').onclick = () => showModal('patientModal');
    document.getElementById('emptyAddBtn').onclick = () => showModal('patientModal');
    document.getElementById('confirmAdd').onclick = addPatient;
    document.getElementById('pdfReportBtn').onclick = generateGeneralPDF;
    document.getElementById('backupBtn').onclick = backupData;
    document.getElementById('restoreBtn').onclick = () => document.getElementById('restoreFileInput').click();
    document.getElementById('restoreFileInput').onchange = (e) => {
        if (e.target.files[0]) restoreData(e.target.files[0]);
        e.target.value = '';
    };
    document.getElementById('addSessionBtn').onclick = addSession;
    document.getElementById('resetSessionsBtn').onclick = resetSessions;
    document.getElementById('cancelConfirm').onclick = hideConfirmModal;
    document.getElementById('confirmAction').onclick = () => {
        if (confirmCallback) {
            confirmCallback();
            hideConfirmModal();
        }
    };
    
    // بحث
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');
    
    searchInput.oninput = () => {
        filterPatients();
        clearSearch.style.display = searchInput.value ? 'flex' : 'none';
    };
    
    clearSearch.onclick = () => {
        searchInput.value = '';
        filterPatients();
        clearSearch.style.display = 'none';
    };
    
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
// مزامنة Firebase
// ============================================
function setupRealtimeSync() {
    try {
        const database = window.db ? window.db() : null;
        if (!database) {
            console.warn('Firestore not available');
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
            updateConnectionStatus(true);
        }, error => {
            console.error("Firestore error:", error);
            updateConnectionStatus(false);
            showToast('⚠️ خطأ في الاتصال بقاعدة البيانات', true);
            setTimeout(() => {
                if (unsubscribe) {
                    unsubscribe();
                    setupRealtimeSync();
                }
            }, 5000);
        });
        
    } catch (error) {
        console.error('Setup error:', error);
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(isConnected) {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    
    if (isConnected) {
        connectionDot.className = 'connection-dot connected';
        connectionText.textContent = '✅ متصل بقاعدة البيانات';
    } else {
        connectionDot.className = 'connection-dot disconnected';
        connectionText.textContent = '⚠️ غير متصل - البيانات محلية';
    }
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

function getStatusDot(status) {
    switch(status) {
        case 'تحت العلاج': return 'active-status';
        case 'مستقر': return 'stable-status';
        case 'مكتمل': return 'completed-status';
        case 'متوقف': return 'stopped-status';
        default: return 'active-status';
    }
}

function renderPatients() {
    const container = document.getElementById('patientsList');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = patients.filter(p => p.name && p.name.toLowerCase().includes(searchTerm));
    
    if (filtered.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        container.innerHTML = '';
        document.getElementById('patientCount').textContent = '0';
        return;
    }
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('patientCount').textContent = filtered.length;
    
    container.innerHTML = filtered.map(patient => {
        const sessionCount = patient.sessions?.length || 0;
        const totalAmount = sessionCount * (patient.price || 0);
        const statusClass = getStatusClass(patient.status);
        const statusDot = getStatusDot(patient.status);
        
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
                                <span class="status-dot ${statusDot}" style="width: 6px; height: 6px;"></span>
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
                    <div class="stat-chip">
                        <i class="fas fa-clock"></i>
                        آخر جلسة: ${getLastSessionDate(patient.sessions)}
                    </div>
                </div>
                <div class="patient-actions">
                    <button class="icon-btn" onclick="openSessions('${patient.id}')" title="سجل الجلسات">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="icon-btn" onclick="generatePatientPDF('${patient.id}')" title="تقرير PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="icon-btn" onclick="deletePatient('${patient.id}')" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getLastSessionDate(sessions) {
    if (!sessions || sessions.length === 0) return 'لا يوجد';
    const lastDate = new Date(sessions[sessions.length - 1].date);
    return lastDate.toLocaleDateString('ar-EG');
}

function updateStats() {
    const totalPatients = patients.length;
    const totalSessions = patients.reduce((sum, p) => sum + (p.sessions?.length || 0), 0);
    const totalRevenue = patients.reduce((sum, p) => sum + ((p.sessions?.length || 0) * (p.price || 0)), 0);
    
    document.getElementById('totalPatients').textContent = totalPatients;
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString();
}

function filterPatients() {
    renderPatients();
}

// ============================================
// إضافة مريض
// ============================================
async function addPatient() {
    const name = document.getElementById('patientName').value.trim();
    const price = parseFloat(document.getElementById('patientPrice').value);
    const status = document.getElementById('patientStatus').value;
    
    if (!name) {
        showToast('❌ يرجى إدخال اسم المريض', true);
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showToast('❌ يرجى إدخال سعر صحيح', true);
        return;
    }
    
    try {
        const database = window.db ? window.db() : null;
        if (!database) throw new Error('Firestore not available');
        
        await database.collection('patients').add({ 
            name: name, 
            price: price,
            status: status,
            sessions: [],
            createdAt: new Date().toISOString()
        });
        
        showToast('✅ تمت إضافة المريض بنجاح');
        hideModal('patientModal');
        
        // تنظيف الحقول
        document.getElementById('patientName').value = '';
        document.getElementById('patientPrice').value = '50000';
        document.getElementById('patientStatus').value = 'تحت العلاج';
        
        // إعادة تعيين محدد الحالة
        const options = document.querySelectorAll('.status-option');
        options.forEach(opt => {
            opt.classList.remove('active');
            if (opt.getAttribute('data-status') === 'تحت العلاج') {
                opt.classList.add('active');
            }
        });
        
    } catch (error) {
        console.error('Add patient error:', error);
        showToast('❌ فشل إضافة المريض', true);
    }
}

async function deletePatient(patientId) {
    showConfirm('حذف مريض', '⚠️ هل أنت متأكد من حذف هذا المريض نهائياً؟', async () => {
        try {
            const database = window.db ? window.db() : null;
            if (!database) throw new Error('Firestore not available');
            
            await database.collection('patients').doc(patientId).delete();
            showToast('✅ تم حذف المريض');
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
    
    document.getElementById('sessionPatientName').innerHTML = patient.name;
    document.getElementById('sessionDate').value = new Date().toISOString().slice(0, 10);
    await renderSessions();
    updateSessionStats(patient);
    showModal('sessionsModal');
}

function updateSessionStats(patient) {
    const sessionCount = patient.sessions?.length || 0;
    const totalAmount = sessionCount * (patient.price || 0);
    document.getElementById('totalSessionsCount').textContent = sessionCount;
    document.getElementById('totalAmountDue').textContent = totalAmount.toLocaleString();
}

async function renderSessions() {
    const patient = patients.find(p => p.id === currentPatientId);
    const container = document.getElementById('sessionsList');
    
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
            <button class="session-delete" onclick="removeSession(${index})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

async function addSession() {
    const date = document.getElementById('sessionDate').value;
    if (!date) {
        showToast('❌ يرجى اختيار التاريخ', true);
        return;
    }
    
    const patient = patients.find(p => p.id === currentPatientId);
    if (patient) {
        const newSessions = [...(patient.sessions || []), { date }];
        try {
            const database = window.db ? window.db() : null;
            if (!database) throw new Error('Firestore not available');
            
            await database.collection('patients').doc(currentPatientId).update({ sessions: newSessions });
            showToast('✅ تمت إضافة الجلسة');
            
            // تحديث الإحصائيات
            const updatedPatient = patients.find(p => p.id === currentPatientId);
            if (updatedPatient) {
                updateSessionStats(updatedPatient);
            }
        } catch (error) {
            console.error('Add session error:', error);
            showToast('❌ فشل إضافة الجلسة', true);
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
                if (!database) throw new Error('Firestore not available');
                
                await database.collection('patients').doc(currentPatientId).update({ sessions: newSessions });
                showToast('✅ تم حذف الجلسة');
                
                const updatedPatient = patients.find(p => p.id === currentPatientId);
                if (updatedPatient) {
                    updateSessionStats(updatedPatient);
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
            if (!database) throw new Error('Firestore not available');
            
            await database.collection('patients').doc(currentPatientId).update({ sessions: [] });
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
    
    const html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; background: white;">
            <div style="text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 25px;">
                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas fa-hand-holding-heart" style="font-size: 2rem; color: white;"></i>
                </div>
                <h2 style="color: #1e1b4b; margin: 0;">PhysioCare Pro</h2>
                <p style="color: #64748b; margin: 5px 0 0;">تقرير المريض - ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
                <h3 style="color: #1e1b4b; margin-bottom: 15px;">👤 بيانات المريض</h3>
                <table style="width: 100%;">
                    <tr><td style="padding: 8px 0;"><strong>الاسم:</strong></td><td>${escapeHtml(patient.name)}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>الحالة:</strong></td><td>${patient.status || 'تحت العلاج'}</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>سعر الجلسة:</strong></td><td>${patient.price.toLocaleString()} ل.س</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>عدد الجلسات:</strong></td><td>${sessionsList.length} جلسة</td></tr>
                    <tr><td style="padding: 8px 0;"><strong>الإجمالي المستحق:</strong></td><td style="color: #10b981; font-weight: bold;">${totalAmount.toLocaleString()} ل.س</td></tr>
                </table>
            </div>
            
            <div style="background: #ffffff; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0;">
                <h3 style="color: #1e1b4b; margin-bottom: 15px;">📅 تفاصيل الجلسات</h3>
                ${sessionRows || '<p style="text-align: center; color: #64748b;">لا توجد جلسات مسجلة</p>'}
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
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
        const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff' });
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
    
    const patientRows = patients.map((p, i) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; text-align: center;">${i + 1}</td>
            <td style="padding: 10px;">${escapeHtml(p.name)}</td>
            <td style="padding: 10px; text-align: center;">${p.status || 'تحت العلاج'}</td>
            <td style="padding: 10px; text-align: center;">${p.sessions?.length || 0}</td>
            <td style="padding: 10px; text-align: center;">${(p.price || 0).toLocaleString()}</td>
            <td style="padding: 10px; text-align: center; color: #10b981;">${((p.sessions?.length || 0) * (p.price || 0)).toLocaleString()}</td>
        </tr>
    `).join('');
    
    const html = `
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; padding: 30px; background: white;">
            <div style="text-align: center; border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 25px;">
                <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                    <i class="fas fa-chart-line" style="font-size: 2rem; color: white;"></i>
                </div>
                <h2 style="color: #1e1b4b;">تقرير PhysioCare Pro الشامل</h2>
                <p style="color: #64748b;">${new Date().toLocaleString('ar-EG')}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">#</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">المريض</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">الحالة</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">الجلسات</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">سعر الجلسة</th>
                        <th style="padding: 12px; border: 1px solid #e2e8f0;">الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${patientRows}
                </tbody>
                <tfoot>
                    <tr style="background: #f1f5f9; font-weight: bold;">
                        <td colspan="3" style="padding: 12px; border: 1px solid #e2e8f0;">الإجمالي الكلي</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center;">${totalSessions} جلسة</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">-</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: center; color: #10b981;">${totalRevenue.toLocaleString()} ل.س</td>
                    </tr>
                </tfoot>
            </table>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
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
        const canvas = await html2canvas(pdfDiv, { scale: 2, backgroundColor: '#ffffff' });
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
            if (!database) throw new Error('Firestore not available');
            
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
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.remove('light');
        document.body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function loadTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'light') {
        document.body.classList.add('light');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.add('dark');
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ============================================
// دوال مساعدة
// ============================================
function showModal(id) {
    document.getElementById(id).classList.add('show');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('show');
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'}"></i> ${message}`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
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
