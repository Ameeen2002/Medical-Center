// ===============================================
//  Nurse UI - Initialization
// ===============================================
console.log("✅ nurse.js LOADED");

let nurseVisits = [];
let currentNurseVisitId = null;

async function initializeNurseUI() {
    document.getElementById('app-container').innerHTML = renderNurseView();

    const listContainer = document.getElementById('nurse-waiting-list');
    listContainer.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-visit-id]');
        if (button) {
            openNurseForVisit(button.dataset.visitId);
        }
    });

    const saveButton = document.getElementById('save-nurse-data-btn');
    if (saveButton) {
        saveButton.addEventListener('click', saveNurseDataTemp);
    }

    await loadWaitingVisits();
}

function renderNurseView() {
    return `
        <div class="card p-6">
            <h2 class="text-2xl font-bold mb-4">🩺 قائمة انتظار المرضى</h2>

            <div id="nurse-waiting-list" class="divide-y">
                <p class="text-center text-gray-400 p-4">
                    جاري تحميل قائمة الانتظار...
                </p>
            </div>
        </div>
    `;
}

function renderPrescriptionUploader() {
    return `
        <div class="card p-4 bg-gray-50 mb-4">
            <h3 class="font-bold mb-2">رفع الروشتة (اختياري)</h3>
            <p class="text-sm text-gray-600 mb-3">استخدم هذا الخيار إذا كانت الزيارة تنتهي عند الممرضة فقط</p>

            <label
                for="nursePrescriptionFile"
                class="flex flex-col items-center justify-center border-2 border-dashed
                       border-gray-300 rounded-lg p-4 cursor-pointer
                       hover:border-blue-400 hover:bg-blue-50 transition">

                <span class="text-sm text-gray-600">
                    اضغط لاختيار ملف أو اسحب الروشتة هنا
                </span>
                <span class="text-xs text-gray-500 mt-1">(JPEG, PNG, PDF)</span>

                <input type="file" id="nursePrescriptionFile"
                       accept="image/*,.pdf" class="hidden">
            </label>

            <p id="nurse-selected-file-name"
               class="text-sm text-gray-700 mt-2 hidden"></p>
        </div>
    `;
}

function setupNursePrescriptionUploader() {
    const fileInput = document.getElementById('nursePrescriptionFile');
    const fileName = document.getElementById('nurse-selected-file-name');
    const dropArea = fileInput?.parentElement;

    if (!fileInput || !dropArea) return;

    // عرض اسم الملف عند الاختيار
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            fileName.textContent = `الملف المختار: ${fileInput.files[0].name} (${(fileInput.files[0].size / 1024).toFixed(2)} KB)`;
            fileName.classList.remove('hidden');
        } else {
            fileName.classList.add('hidden');
        }
    });

    // دعم سحب وإفلات الملفات
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('dragover');
    }

    function unhighlight() {
        dropArea.classList.remove('dragover');
    }

    // التعامل مع الملف المسقط
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        }
    }
}

async function loadWaitingVisits() {
    try {
        const res = await secureFetch('/api/nurse/waiting-visits');
        if (!res.ok) throw new Error("Failed to load visits");

        nurseVisits = await res.json();
        renderWaitingList();

    } catch (err) {
        console.error(err);
        document.getElementById('nurse-waiting-list').innerHTML =
            `<p class="text-center text-red-400 p-4">فشل تحميل قائمة الانتظار</p>`;
    }
}

function renderWaitingList() {
    const container = document.getElementById('nurse-waiting-list');

    if (!nurseVisits.length) {
        container.innerHTML = `
            <p class="text-center text-gray-400 p-4">
                لا يوجد مرضى بانتظار الممرضة
            </p>`;
        return;
    }

    container.innerHTML = nurseVisits.map(v => `
        <div class="p-4 flex justify-between items-center">
            <div>
                <p class="font-bold">${v.patientName}</p>
                <p class="text-sm text-gray-500">
                    ${formatDateTime(v.date)}
                </p>
            </div>

            <button
                class="btn-primary px-4 py-2 rounded"
                data-visit-id="${v.visitId}">
                إدخال بيانات
            </button>
        </div>
    `).join('');
}

function openNurseForVisit(visitId) {
    currentNurseVisitId = visitId;
    openNursePopup(visitId);
}

function openNursePopup(visitId) {
    const popup = document.getElementById('nurse-popup');
    if (!popup) return;

    // Reset form
    document.getElementById('bp').value = '';
    document.getElementById('pulse').value = '';
    document.getElementById('temp').value = '';
    document.getElementById('resp').value = '';
    document.getElementById('sugar').value = '';
    document.getElementById('nebula').checked = false;
    document.getElementById('injection').checked = false;
    document.getElementById('gyar').checked = false;
    document.getElementById('nurseExtraNotes').value = '';

    // Add prescription uploader section
    const formContainer = document.querySelector('#nurse-popup .space-y-3');
    if (formContainer && !document.getElementById('nursePrescriptionFile')) {
        const uploaderHTML = renderPrescriptionUploader();
        const extraNotesField = document.getElementById('nurseExtraNotes');
        if (extraNotesField) {
            extraNotesField.insertAdjacentHTML('afterend', uploaderHTML);
            setupNursePrescriptionUploader();
        }
    }

    popup.classList.remove('hidden');
}

function closeNursePopup() {
    const popup = document.getElementById('nurse-popup');
    popup.classList.add('hidden');
    currentNurseVisitId = null;
}

async function saveNurseDataTemp() {
    const bp = document.getElementById("bp").value.trim();
    const pulse = document.getElementById("pulse").value.trim();
    const temp = document.getElementById("temp").value.trim();
    const resp = document.getElementById("resp").value.trim();
    const sugar = document.getElementById("sugar").value.trim();

    const nebula = document.getElementById("nebula").checked ? "نعم" : "";
    const injection = document.getElementById("injection").checked ? "نعم" : "";
    const gyar = document.getElementById("gyar").checked ? "نعم" : "";

    const extraNotes = document.getElementById("nurseExtraNotes").value.trim();

    let note = "";
    if (bp) note += `الضغط: ${bp}\n`;
    if (pulse) note += `النبض: ${pulse}\n`;
    if (temp) note += `الحرارة: ${temp}\n`;
    if (resp) note += `التنفس: ${resp}\n`;
    if (sugar) note += `السكر: ${sugar}\n`;
    if (nebula) note += `تبخيرة: نعم\n`;
    if (injection) note += `حقنة: نعم\n`;
    if (gyar) note += `غيار: نعم\n`;
    if (extraNotes) note += `ملاحظات: ${extraNotes}`;

    note = note.trim();

    if (!note) {
        showMessage("يرجى إدخال بيانات الممرضة", "error");
        return;
    }

    try {
        // 1. حفظ بيانات الممرضة أولاً
        await secureFetch(`/api/visits/${currentNurseVisitId}/nurse`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nurseNote: note
            })
        });

        // 2. التحقق مما إذا كان يمكن رفع روشتة
        const canUploadRes = await secureFetch(`/api/nurse/visit/${currentNurseVisitId}/can-upload`);
        const canUploadData = await canUploadRes.json();

        // 3. إذا كان هناك ملف، قم برفعه
        const fileInput = document.getElementById('nursePrescriptionFile');
        if (fileInput && fileInput.files.length > 0) {

            if (!canUploadData.canUpload) {
                showMessage(`لا يمكن رفع الروشتة: ${canUploadData.message}`, "error");
                closeNursePopup();
                loadWaitingVisits();
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const uploadRes = await secureFetch(
                `/api/nurse/visit/${currentNurseVisitId}/document`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json();
                throw new Error(errorData.message || 'فشل رفع الروشتة');
            }

            showMessage("تم حفظ بيانات الممرضة ورفع الروشتة بنجاح", "success");
        } else {
            // إذا لم يكن هناك ملف، فقط أظهر رسالة النجاح
            showMessage("تم حفظ بيانات الممرضة بنجاح", "success");
        }

        closeNursePopup();
        await loadWaitingVisits();

    } catch (err) {
        console.error(err);
        if (err.message?.includes('409') || err.message?.includes('مسبقًا')) {
            showMessage(err.message, "info");
            closeNursePopup();
            loadWaitingVisits();
            return;
        }
        showMessage(`فشل الحفظ: ${err.message}`, "error");
    }
}
initializeNurseUI();