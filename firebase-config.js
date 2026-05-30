// ============================================
// إعدادات Firebase - الإصدار الصحيح
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyDwVa68TGBMnzLMNoSIOGh4lGTgwu4BBvU",
    authDomain: "physicalpt-a9241.firebaseapp.com",
    projectId: "physicalpt-a9241",
    storageBucket: "physicalpt-a9241.firebasestorage.app",
    messagingSenderId: "458863728401",
    appId: "1:458863728401:web:dd74373c866cbbee1a1eb0",
    measurementId: "G-1YJHMW0VYE"
};

// تهيئة Firebase
let db = null;
let isFirebaseReady = false;

// دالة تهيئة Firebase
function initFirebase() {
    try {
        // التحقق من وجود Firebase SDK
        if (typeof firebase === 'undefined') {
            console.error('Firebase SDK not loaded!');
            return false;
        }
        
        // التحقق من عدم وجود تطبيق مهيأ مسبقاً
        let app;
        if (firebase.apps.length === 0) {
            app = firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized successfully');
        } else {
            app = firebase.apps[0];
            console.log('✅ Firebase already initialized');
        }
        
        // الحصول على مرجع Firestore
        db = firebase.firestore();
        
        // تمكين التخزين دون اتصال (اختياري)
        db.enablePersistence()
            .then(() => console.log('✅ Offline persistence enabled'))
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Browser does not support persistence');
                }
            });
        
        isFirebaseReady = true;
        
        // اختبار الاتصال - كتابة بيانات اختبارية للتأكد
        testFirebaseConnection();
        
        return true;
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        isFirebaseReady = false;
        db = null;
        return false;
    }
}

// اختبار الاتصال بقاعدة البيانات
async function testFirebaseConnection() {
    try {
        if (!db) return;
        
        const testRef = db.collection('_test').doc('connection_test');
        await testRef.set({ timestamp: new Date().toISOString(), test: true });
        await testRef.delete();
        console.log('✅ Firebase connection test passed');
        
        // تحديث حالة الاتصال في الواجهة
        updateConnectionUI(true);
        
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        updateConnectionUI(false);
    }
}

function updateConnectionUI(isConnected) {
    const connectionDot = document.getElementById('connectionDot');
    const connectionText = document.getElementById('connectionText');
    
    if (!connectionDot) return;
    
    if (isConnected) {
        connectionDot.className = 'connection-dot connected';
        if (connectionText) connectionText.textContent = '✅ متصل بقاعدة البيانات';
    } else {
        connectionDot.className = 'connection-dot disconnected';
        if (connectionText) connectionText.textContent = '⚠️ غير متصل - البيانات محلية فقط';
    }
}

// تصدير المتغيرات للاستخدام العام
window.db = () => db;
window.isFirebaseReady = () => isFirebaseReady;

// بدء التهيئة فوراً
initFirebase();

// محاولة إعادة التهيئة إذا فشلت
setTimeout(() => {
    if (!isFirebaseReady) {
        console.log('Retrying Firebase initialization...');
        initFirebase();
    }
}, 2000);
