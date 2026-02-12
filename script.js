// ===============================================
//  1. تهيئة وثوابت (Initialization and Constants)
// ===============================================

// NOTE: The global patientsData variable has been removed to prevent loading the entire database into the browser.
// Each part of the application is now responsible for fetching its own required data from the server.
let currentView = 'home';
let doctorsList = [];

// =_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=
//  MODIFIED: Server Communication Functions
// =_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=_=

// NOTE: loadData() and saveData() have been removed. They were a performance bottleneck.
async function loadDoctors() {
    const res = await fetch('/api/doctors');
    doctorsList = await res.json();
}
async function loadCenter() {
    const res = await fetch('/api/center');
    const data = await res.json();
    window.appCenterName = data.name;  // store only the value
}

// ===============================================
//  2. وظائف مساعدة (Utility Functions)
// ===============================================
// (These functions remain unchanged from the original file)

/**
 * إنشاء معرف فريد (UUID)
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * عرض رسالة تنبيه للمستخدم
 * @param {string} message - نص الرسالة
 * @param {string} type - نوع الرسالة ('success', 'error', 'info')
 */
function showMessage(message, type = 'info') {
    const container = document.getElementById('message-container');
    const colorMap = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };
    const div = document.createElement('div');
    // We use the colorMap classes but our CSS above will intercept them
    div.className = `${colorMap[type]} p-3 rounded-lg shadow-xl mb-3 transition-opacity duration-300 opacity-0`;
    div.textContent = message;

    container.appendChild(div);

    // إظهار الرسالة
    setTimeout(() => div.classList.remove('opacity-0'), 10);

    // إخفاء الرسالة بعد 5 ثواني
    setTimeout(() => {
        div.classList.add('opacity-0');
        div.addEventListener('transitionend', () => div.remove());
    }, 5000);
}

/**
 * تنسيق التاريخ والوقت المحلي
 * @param {Date | string} dateInput - مدخل التاريخ
 */
function formatDateTime(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const options = {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',};
    return date.toLocaleString('ar-EG', options).replace(',', '');
}


/**
 * فحص تطابق تاريخ الزيارة مع يوم محدد
 * @param {string} visitIso - تاريخ الزيارة ISO
 * @param {string} dayStr - اليوم المطلوب YYYY-MM-DD
 */
function isSameDay(visitIso, dayStr) {
    if (!visitIso || !dayStr) return false;
    const v = new Date(visitIso);
    const [y, m, d] = dayStr.split('-').map(Number);
    return v.getFullYear() === y && (v.getMonth() + 1) === m && v.getDate() === d;
}

/**
 * فحص تطابق تاريخ الزيارة مع شهر محدد
 * @param {string} visitIso - تاريخ الزيارة ISO
 * @param {string} monthStr - الشهر المطلوب YYYY-MM
 */
function isSameMonth(visitIso, monthStr) {
    if (!visitIso || !monthStr) return false;
    const v = new Date(visitIso);
    const [y, m] = monthStr.split('-').map(Number);
    return v.getFullYear() === y && (v.getMonth() + 1) === m;
}

// ===============================================
//  MODAL FOR SYSTEM SETUP
// ===============================================

/**
 * Fetches the setup HTML, injects it into the modal, and displays it.
 * It also finds and executes the script from the fetched HTML to make the forms work.
 */
async function openSetupModal() {
    const modal = document.getElementById('setup-modal');
    const content = document.getElementById('setup-modal-content');

    if (!modal || !content) {
        console.error('Setup modal elements not found!');
        return;
    }

    try {
        const response = await fetch('/StartUp.html');

        if (!response.ok) {
            content.innerHTML =
                '<p class="text-red-500 text-center p-8">Failed to load setup interface. Please try again.</p>';
            modal.classList.remove('hidden');
            return;
        }

        const html = await response.text();
        content.innerHTML = html;

        // Extract and execute ALL scripts inside StartUp.html
        const scriptElements = content.querySelectorAll('script');

        scriptElements.forEach((oldScript) => {
            const newScript = document.createElement('script');

            // Copy all attributes (src, type, defer, etc.)
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });

            // Inline script support
            if (!oldScript.src) {
                newScript.textContent = oldScript.textContent;
            }

            // Execute script in global context
            document.body.appendChild(newScript);
            document.body.removeChild(newScript);
        });

        modal.classList.remove('hidden');

    } catch (error) {
        console.error('Error opening setup modal:', error);
        content.innerHTML =
            '<p class="text-red-500 text-center p-8">An error occurred. Please see the console.</p>';
        modal.classList.remove('hidden');
    }
}

/**
 * Closes the setup modal and clears its content.
 */
function closeSetupModal() {
    const modal = document.getElementById('setup-modal');
    const content = document.getElementById('setup-modal-content');
    if (modal) {
        modal.classList.add('hidden');
    }
    if (content) {
        content.innerHTML = ''; // Clear content to ensure scripts are re-loaded next time
    }
}

// ===============================================
//  MODAL FOR PATIENT IMPORT
// ===============================================

function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
}

async function openImportModal() {
    const modal = document.getElementById('import-modal');
    const content = document.getElementById('import-modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = '<p>Loading...</p>';

    try {
        const centers = await secureFetch('/api/centers/all').then(res => res.json());
        const centerOptions = centers.map(c => `<option value="${c.idCenter}">${c.name}</option>`).join('');

        content.innerHTML = `
            <div>
                <label for="import-file-input" class="block mb-2 font-bold">ملف JSON</label>
                <input type="file" id="import-file-input" accept=".json" class="w-full p-2 border rounded">
            </div>
            <div>
                <label for="import-center-select" class="block mb-2 font-bold">اختر المركز</label>
                <select id="import-center-select" class="w-full p-2 border rounded">
                    ${centerOptions}
                </select>
            </div>
            <div class="flex justify-end gap-2 mt-4">
                <button type="button" onclick="closeImportModal()" class="btn-secondary px-4 py-2 rounded">إلغاء</button>
                <button type="button" id="import-submit-button" class="btn-primary px-4 py-2 rounded">استيراد</button>
            </div>
        `;

        document.getElementById('import-submit-button').addEventListener('click', handleImportSubmit);
    } catch (error) {
        content.innerHTML = '<p class="text-red-500">Failed to load centers. Please try again.</p>';
        console.error('Failed to open import modal:', error);
    }
}

async function handleImportSubmit() {
    const fileInput = document.getElementById('import-file-input');
    const centerSelect = document.getElementById('import-center-select');
    const file = fileInput.files[0];
    const centerId = centerSelect.value;
    const submitButton = document.getElementById('import-submit-button');

    if (!file) {
        showMessage('Please select a file to import.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('centerId', centerId);

    submitButton.disabled = true;
    submitButton.textContent = 'Importing...';
    showMessage('Starting file import...', 'info');

    try {
        const response = await secureFetch('/api/import/patients', {
            method: 'POST',
            body: formData,
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(result.message, 'success');
            closeImportModal();
            // Optionally, refresh some data on the admin page
            initializeAdminView(); // This function is in boot/admin.js, cannot call directly
        } else {
            throw new Error(result.message || 'An unknown error occurred.');
        }

    } catch (error) {
        console.error('Import failed:', error);
        showMessage(`Import failed: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'استيراد';
    }
}

let csrfToken = null;
async function loadCsrfToken() {
  const res = await fetch('/api/csrf-token');
  const data = await res.json();
  csrfToken = data.csrfToken;
}
async function secureFetch(url, options = {}) {
  const headers = options.headers || {};

  if (options.method && options.method !== 'GET') {
    headers['CSRF-Token'] = csrfToken;
  }

  return fetch(url, {
    ...options,
    headers
  });
}


/**
 * MODIFIED: New function to initialize the app
 * This loads data from the server first, then shows the view.
 */
async function initializeApp() {
    // NOTE: loadData() has been removed for performance.
    await loadDoctors();
    await loadCenter();
    // showView('home') is removed as it's no longer the default view.
}
async function logout() {
    try {
        const res = await secureFetch("/logout", { method: "POST" });
        const data = await res.json();

        if (data.success) {
            window.location.href = "/login";
        } else {
            alert("خطأ أثناء تسجيل الخروج");
        }
    } catch (err) {
        console.error("Logout error:", err);
        alert("فشل الاتصال بالخادم.");
    }
}
async function checkUserRole() {
    const res = await fetch("/session-info");
    const user = await res.json();
    window.currentUser = user;

    const adminBtn = document.getElementById("nav-admin");
    const homeBtn = document.getElementById("nav-home");

    // Hide all role-specific buttons by default
    if(adminBtn) adminBtn.style.display = "none";
    if(homeBtn) homeBtn.style.display = "none";

    // Show buttons based on role
    if (user.role === "admin") {
        if(adminBtn) adminBtn.style.display = "block";
    } else if (user.role === "writer") {
        if(homeBtn) homeBtn.style.display = "block";
    }
    // Doctor has no nav buttons
}



// بدء تشغيل التطبيق
// MODIFIED: Call the new async initializer
window.onload = async () => {
    await checkUserRole(); // This sets window.currentUser
     await loadCsrfToken();
    const container = document.getElementById('app-container');
    container.innerHTML = '<p class="text-center text-gray-400 p-8">جاري تحميل الواجهة...</p>';

    try {
        switch (window.currentUser.role) {
            case 'admin':
                await import('./boot/admin.js');
                break;
            case 'doctor':
                await import('./boot/doctor.js');
                break;
            case 'writer':
                await import('./boot/writer.js');
                break;
             case 'pharmacist':
                await import('./boot/pharmacist.js');
                break;
            case 'nurse':
                await import('./boot/nurse.js');
                break;
            default:
                showMessage('دور المستخدم غير معروف. لا يمكن تحميل الواجهة.', 'error');
                container.innerHTML = '<p class="text-center text-red-500 p-8">خطأ: دور المستخدم غير معروف.</p>';
        }
    } catch (err) {
        console.error("Failed to load role-specific module:", err);
        showMessage('حدث خطأ فادح أثناء تحميل واجهة المستخدم.', 'error');
        container.innerHTML = '<p class="text-center text-red-500 p-8">حدث خطأ فادح. يرجى مراجعة الـ console.</p>';
    }
};