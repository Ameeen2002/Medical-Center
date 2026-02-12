// ===============================
// Pharmacist View (BOOT MODULE)
// ===============================

let pharmacyVisits = [];
let medicines = [];

/* ---------- View ---------- */
function renderPharmacistView() {
    return `
      <div class="card p-6">
        <h2 id="pharmacy-title" class="text-2xl font-bold mb-4">قائمة انتظار الصيدلية</h2>
        <div id="pharmacy-waiting-list" class="space-y-3"></div>

        <div id="pharmacy-visit-panel" class="mt-6"></div>
      </div>
    `;
}

/* ---------- Setup ---------- */
async function setupPharmacistView() {
    document.getElementById('pharmacy-waiting-list').innerHTML = '';


    const [visitsRes, medicinesRes] = await Promise.all([
        secureFetch('/api/pharmacy/waiting-visits'),
        secureFetch('/api/medicines')
    ]);
    pharmacyVisits = await visitsRes.json();
    medicines = await medicinesRes.json();

    const list = document.getElementById('pharmacy-waiting-list');
    const panel = document.getElementById('pharmacy-visit-panel');

    panel.innerHTML = '';
    list.style.display = 'block';

    if (!pharmacyVisits.length) {
        list.innerHTML = `<p class="text-gray-400">لا توجد وصفات بانتظار الصرف</p>`;
        return;
    }

    list.innerHTML = pharmacyVisits.map(v => `
        <div class="border p-3 rounded cursor-pointer hover:bg-gray-100"
             data-visit="${v.idVisit}">
            <strong class="text-teal-400">${v.patient.fullName}</strong><br>
            <span class="text-sm">
              هوية: ${v.patient.ID}
            </span>
        </div>
    `).join('');

   list.onclick = e => {
      const item = e.target.closest('[data-visit]');
      if (!item) return;
      openPharmacyVisit(item.dataset.visit);
   };


}
function renderPrescriptionUploader(visitId) {
  return `
    <div class="card p-6 bg-gray-100 mb-6 !bg-gray-100">
      <h3 class="font-bold mb-2">رفع الروشتة</h3>

      <label
        for="prescriptionFile"
        class="flex flex-col items-center justify-center border-2 border-dashed
               border-gray-300 rounded-lg p-6 cursor-pointer
               hover:border-blue-400 hover:bg-blue-50 transition">

        <span class="text-sm text-gray-600">
          اضغط لاختيار ملف أو اسحب الروشتة هنا
        </span>

        <input type="file" id="prescriptionFile"
               accept="image/*,.pdf" class="hidden">
      </label>

      <p id="selected-file-name"
         class="text-sm text-gray-700 mt-3 hidden"></p>

      <button
        id="upload-prescription-btn"
        class="btn-secondary w-full mt-4 !bg-blue-100 hover:!bg-blue-200">
        رفع الروشتة
      </button>
    </div>
  `;
}
function setupPrescriptionUploader(visitId) {
  let prescriptionUploaded = false;

  const fileInput = document.getElementById('prescriptionFile');
  const fileName = document.getElementById('selected-file-name');
  const uploadBtn = document.getElementById('upload-prescription-btn');


  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      fileName.textContent = `الملف المختار: ${fileInput.files[0].name}`;
      fileName.classList.remove('hidden');
    }
  });

  uploadBtn.addEventListener('click', async () => {
    if (prescriptionUploaded) return;

    const file = fileInput.files[0];
    if (!file) {
      showMessage('اختر ملف أولًا', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      await secureFetch(
        `/api/pharmacy/visit/${visitId}/document`,
        { method: 'POST', body: formData }
      );

      prescriptionUploaded = true;
      showMessage('تم رفع الروشتة', 'success');

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'تم رفع الروشتة';
      const container = document.getElementById('app-container');


    } catch (err) {
      if (err.message?.includes('409')) {
        prescriptionUploaded = true;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'تم رفع الروشتة';
        showMessage('تم رفع الروشتة مسبقًا', 'info');
        return;
      }
      showMessage('فشل رفع الروشتة', 'error');
    }
  });
}



/* ---------- Open Visit ---------- */
function openPharmacyVisit(visitId) {


    const visit = pharmacyVisits.find(v => v.idVisit === visitId);
    if (!visit) return;

    document.getElementById('pharmacy-waiting-list').style.display = 'none';
    document.getElementById('pharmacy-title').style.display = 'none';


    document.getElementById('pharmacy-visit-panel').innerHTML = `
        <div class="mb-4 p-3 border rounded bg-gray-50 flex flex-wrap gap-6">
            <div>
                <strong>اسم المريض:</strong> ${visit.patient.fullName}
            </div>
            <div>
                <strong>رقم الهوية:</strong> ${visit.patient.ID}
            </div>
            <div>
                <strong>العمر:</strong> ${visit.patient.age}
            </div>
            <div>
                <strong>الجنس:</strong> ${visit.patient.gender}
            </div>
            ${
                visit.patient.isPregnant
                    ? `<div class="text-red-600 font-bold"><strong>الحمل:</strong> حامل</div>`
                    : ''
            }
            <button id="back-to-pharmacy-list" class="btn-secondary">←</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 class="font-bold mb-2">تشخيص الطبيب</h3>
            <div class="p-4 border rounded-lg bg-gray-50 text-gray-900 leading-7 min-h-[120px]">
              ${visit.doctorDiagnosis || '—'}
            </div>
          </div>
          <div>
            <h3 class="font-bold mb-2">العلاج الموصوف</h3>
            <div class="p-4 border-l-4 border-teal-500 rounded-lg bg-teal-50 text-blue-800 font-bold leading-7 min-h-[120px] shadow-sm">
              ${visit.doctorMedications || '—'}
            </div>
          </div>
        </div>
        <hr class="my-10 border-gray-500">

        <h3 class="font-bold mb-2">صرف الدواء</h3>

        <div class="relative flex items-center">
            <input type="text" id="dispensedMedication"
              class="w-full p-2 border rounded mb-2"
              placeholder="ابحث عن دواء..." autocomplete="off">
            <span id="medicine-type-display" class="ml-4 text-gray-500"></span>
            <div id="medicine-suggestions" class="absolute z-10 w-full bg-white border rounded shadow-lg hidden max-h-60 overflow-y-auto" style="top: 100%;"></div>
        </div>

        <div id="new-medicine-fields" class="hidden mt-2 p-3 border rounded bg-gray-50">
            <h4 class="font-bold mb-2">إضافة دواء جديد</h4>
            <select id="medicineType" class="w-full p-2 border rounded">
                <option value="">اختر نوع الدواء</option>
                <option value="TABLET">TABLET</option>
                <option value="CAPSULE">CAPSULE</option>
                <option value="SYRUP">SYRUP</option>
                <option value="INJECTION">INJECTION</option>
                <option value="DROPS">DROPS</option>
                <option value="CREAM">CREAM</option>
                <option value="OTHER">OTHER</option>
            </select>
        </div>

        <input id="dispenseQty"
          type="number"
          min="1"
          class="w-full p-2 border rounded my-2"
          placeholder="الكمية">

        <textarea id="pharmacyNote"
          class="w-full p-2 border rounded mb-4"
          placeholder="ملاحظة (بديل، عدم توفر...)">
        </textarea>

        <button id="add-another-btn" class="btn-secondary block ms-auto mt-4">
             إضافة دواء ➕
        </button>

          <div class="mt-6">
              <h3 class="font-bold mb-2">رفع الروشتة - اجباري</h3>
              <!-- Drop Area -->
              ${renderPrescriptionUploader(visitId)}

          </div>


          <button id="finish-dispense-btn" class="btn-primary w-full">
             إنهاء الصرف
          </button>
    `;
 // كود إظهار اسم الملف
setupPrescriptionUploader(visitId);


    document.getElementById('back-to-pharmacy-list').addEventListener('click', backToPharmacyList);
    document.getElementById('add-another-btn').addEventListener('click', () => saveDispense(visit.idVisit, false));
    document.getElementById('finish-dispense-btn').addEventListener('click', () => saveDispense(visit.idVisit, true));
    
    const medInput = document.getElementById('dispensedMedication');
    const suggestionsPanel = document.getElementById('medicine-suggestions');
    const newMedFields = document.getElementById('new-medicine-fields');

    medInput.addEventListener('input', () => {
        document.getElementById('medicine-type-display').textContent = '';
        const inputText = medInput.value.trim().toLowerCase();
        if (!inputText) {
            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
            newMedFields.classList.add('hidden');
            return;
        }

        const suggestions = medicines.filter(m => m.name.toLowerCase().includes(inputText));
        
        if (suggestions.length > 0) {
            suggestionsPanel.innerHTML = suggestions.map(s => `
                <div class="p-2 cursor-pointer hover:bg-gray-100" data-med-id="${s.idMedicine}" data-med-name="${s.name}">
                    ${s.name}
                </div>
            `).join('');
            suggestionsPanel.classList.remove('hidden');
            newMedFields.classList.add('hidden');
        } else {
            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
            newMedFields.classList.remove('hidden');
        }
    });

    suggestionsPanel.addEventListener('click', e => {
        const medItem = e.target.closest('[data-med-id]');
        if (medItem) {
            medInput.value = medItem.dataset.medName;
            medInput.dataset.selectedId = medItem.dataset.medId;
            
            const selectedMedicine = medicines.find(m => m.idMedicine == medItem.dataset.medId);
            if (selectedMedicine) {
                document.getElementById('medicine-type-display').textContent = selectedMedicine.type;
            }

            suggestionsPanel.innerHTML = '';
            suggestionsPanel.classList.add('hidden');
            newMedFields.classList.add('hidden');
        }
    });
}




/* ---------- Actions ---------- */
function backToPharmacyList() {
  document.getElementById('pharmacy-visit-panel').innerHTML = '';
  document.getElementById('pharmacy-waiting-list').style.display = 'block';
  document.getElementById('pharmacy-title').style.display = 'block';
  setupPharmacistView();
}


async function saveDispense(visitId, finish) {
    const addAnotherBtn = document.getElementById('add-another-btn');
    const finishDispenseBtn = document.getElementById('finish-dispense-btn');

    const medInput = document.getElementById('dispensedMedication');
    const medicineName = medInput.value.trim();
    const quantity = Number(document.getElementById('dispenseQty').value);
    const note = document.getElementById('pharmacyNote').value.trim();

    if (!medicineName || !quantity) {
        showMessage('الدواء والكمية مطلوبة', 'error');
        return;
    }

    // Disable buttons to prevent multiple clicks
    if(addAnotherBtn) addAnotherBtn.disabled = true;
    if(finishDispenseBtn) finishDispenseBtn.disabled = true;

    let idMedicine = medInput.dataset.selectedId;

    // If idMedicine is not set, it's either a new medicine or user didn't select from suggestions
    if (!idMedicine) {
        const existingMedicine = medicines.find(m => m.name.toLowerCase() === medicineName.toLowerCase());
        if (existingMedicine) {
            idMedicine = existingMedicine.idMedicine;
        } else {
            // Create a new medicine
            const type = document.getElementById('medicineType').value;
            if (!type) {
                showMessage('الرجاء اختيار نوع الدواء الجديد', 'error');
                if(addAnotherBtn) addAnotherBtn.disabled = false;
                if(finishDispenseBtn) finishDispenseBtn.disabled = false;
                return;
            }
            try {
                const res = await secureFetch('/api/medicines', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: medicineName, type: type })
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    showMessage(errorData.message || 'فشل في إضافة الدواء الجديد', 'error');
                    if(addAnotherBtn) addAnotherBtn.disabled = false;
                    if(finishDispenseBtn) finishDispenseBtn.disabled = false;
                    return;
                }

                const newMedicine = await res.json();
                idMedicine = newMedicine.idMedicine;
                medicines.push(newMedicine); // Add to local cache
            } catch (error) {
                console.error('Failed to create medicine:', error);
                showMessage('فشل في إضافة الدواء الجديد', 'error');
                if(addAnotherBtn) addAnotherBtn.disabled = false;
                if(finishDispenseBtn) finishDispenseBtn.disabled = false;
                return;
            }
        }
    }

    try {
        const response = await secureFetch(`/api/pharmacy/visit/${visitId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idMedicine: parseInt(idMedicine), quantity, note })
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ message: 'فشل في حفظ عملية الصرف' }));
            showMessage(errorBody.message, 'error');
            // Re-enable buttons on failure
            if(addAnotherBtn) addAnotherBtn.disabled = false;
            if(finishDispenseBtn) finishDispenseBtn.disabled = false;
            return; // Stop here, don't show success message or navigate away
        }

        showMessage('تم صرف الدواء بنجاح', 'success');

        if (finish) {
          // إنهاء الصرف
          pharmacyVisits = pharmacyVisits.filter(v => v.idVisit !== visitId);
          backToPharmacyList();
          // No need to re-enable, we are navigating away
          return;
        }

        // إضافة دواء
        const medInput = document.getElementById('dispensedMedication');
        medInput.value = '';
        medInput.dataset.selectedId = '';

        document.getElementById('dispenseQty').value = '';
        document.getElementById('pharmacyNote').value = '';
        document.getElementById('medicineType').value = '';

        medInput.focus();
        
        // Re-enable buttons for next entry
        if(addAnotherBtn) addAnotherBtn.disabled = false;
        if(finishDispenseBtn) finishDispenseBtn.disabled = false;


    } catch (error) {
        console.error('Failed to save dispense (network error):', error);
        showMessage('فشل في حفظ عملية الصرف, قد تكون هناك مشكلة بالشبكة', 'error');
        // Re-enable buttons on error
        if(addAnotherBtn) addAnotherBtn.disabled = false;
        if(finishDispenseBtn) finishDispenseBtn.disabled = false;
    }
}

/* ---------- BOOT (مثل doctor.js تمامًا) ---------- */
(async () => {
    const container = document.getElementById('app-container');
    container.innerHTML = renderPharmacistView();
    await setupPharmacistView();
})();
