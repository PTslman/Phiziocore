// ============================================
// إعدادات Firebase - Physical Therapy System
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

// دالة تهيئة Firebase مع معالجة الأخطاء
function initFirebase() {
    try {
        // التحقق من توفر Firebase
        if (typeof firebase === 'undefined') {
            console.warn('Firebase SDK not loaded yet');
            return false;
        }
        
        // تهيئة التطبيق إذا لم يتم تهيئته مسبقاً
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialized successfully');
        }
        
        // الحصول على مرجع Firestore
        db = firebase.firestore();
        
        // تمكين الإعدادات دون اتصال
        db.enablePersistence()
            .then(() => {
                console.log('✅ Offline persistence enabled');
            })
            .catch((err) => {
                if (err.code === 'failed-precondition') {
                    console.warn('⚠️ Multiple tabs open, persistence enabled in first tab only');
                } else if (err.code === 'unimplemented') {
                    console.warn('⚠️ Browser doesn\'t support persistence');
                }
            });
        
        isFirebaseReady = true;
        return true;
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        isFirebaseReady = false;
        return false;
    }
}

// محاولة التهيئة
initFirebase();

// تصدير المتغيرات للاستخدام العام
window.db = () => db;
window.isFirebaseReady = () => isFirebaseReady;
