// ===============================
// Doctor View
// ===============================

let doctorVisits = [];

function renderDoctorView() {
  return `
    <div class="card p-6">
      <h2 class="text-2xl font-bold mb-4">قائمة انتظار الطبيب</h2>
      <div id="doctor-waiting-list" class="space-y-3"></div>
      <div id="doctor-visit-panel" class="mt-6"></div>
    </div>
  `;
}

async function setupDoctorView() {
  const res = await fetch('/api/doctor/waiting-visits');
  doctorVisits = await res.json();

  const list = document.getElementById('doctor-waiting-list');
  list.addEventListener('click', e => {
  const item = e.target.closest('[data-visit]');
  if (!item) return;

  const visitId = item.dataset.visit;
  openDoctorVisit(visitId);
});

  const panel = document.getElementById('doctor-visit-panel');

  panel.innerHTML = '';
  list.style.display = 'block';

  if (!doctorVisits.length) {
    list.innerHTML = `<p class="text-gray-400">لا توجد زيارات</p>`;
    return;
  }

list.innerHTML = doctorVisits.map(v => `
  <div class="border p-3 rounded cursor-pointer hover:bg-gray-100"
       data-visit="${v.idVisit}">
      <strong class="text-teal-400">
          ${v.patient.fullName}
        </strong><br>

        <span class="text-teal-400">
          هوية: ${v.patient.ID}
        </span>
    </div>
  `).join('');
}


function openDoctorVisit(visitId) {
  const visit = doctorVisits.find(v => v.idVisit === visitId);
  if (!visit) return;

  // إخفاء القائمة
  document.getElementById('doctor-waiting-list').style.display = 'none';

  document.getElementById('doctor-visit-panel').innerHTML = `
    <!-- معلومات المريض -->
    <div class="mb-4 p-3 border rounded bg-gray-50">
  <div class="flex flex-wrap gap-6">
    <div>
      <strong>اسم المريض:</strong> ${visit.patient.fullName}
    </div>
    <div>
      <strong>رقم الهوية:</strong> ${visit.patient.ID}
    </div>
    <div>
      <strong>الجنس:</strong> ${visit.patient.gender || '—'}
    </div>
    <div>
      <strong>الحالة الطبية:</strong>
      <span class="${visit.patient.medicalStatus === 'طارئة' ? 'text-red-600 font-bold' : 'text-gray-700'}">
        ${visit.patient.medicalStatus || 'غير محددة'}
      </span>
    </div>
    <button id="back-to-doctor-list" class="btn-secondary">←</button>
  </div>


</div>


    <!-- العلامات الحيوية -->
    <h3 class="font-bold mb-2">العلامات الحيوية (الممرض)</h3>
    <pre class=" p-2 border p-3 rounded mb-4">
${visit.nurseVisit?.nurseNote || 'لا يوجد'}
    </pre>

    <h3 class="font-bold mb-2">الحالة الطبية العامة</h3>
     <!--حالة المريض الطبية  -->
    <select id="medicalStatus" class="w-full p-2 border rounded mb-4" required>
      <option value="" disabled>اختر الحالة</option>
      <option value="مزمنة">مزمنة</option>
      <option value="طارئة">طارئة</option>
    </select>



    <!-- التشخيص -->
    <h3 class="font-bold mb-2">تشخيص الطبيب</h3>
    <textarea id="doctor-diagnosis"
      class="w-full p-2 border rounded mb-4"></textarea>

    <!-- العلاج -->
    <h3 class="font-bold mb-2">العلاج</h3>
    <textarea id="doctor-medications"
      class="w-full p-2 border rounded mb-4"></textarea>

    <label class="flex items-center gap-2 mb-2">
      <input type="checkbox" id="needFurtherTest">
      يحتاج إلى تحاليل
    </label>

    <label class="flex items-center gap-2 mb-4">
      <input type="checkbox" id="isContagious">
      توجد عدوى
    </label>


    <button id="save-diagnosis-btn" class="btn-primary w-full mb-3">
      حفظ التشخيص
    </button>


  `;

const medicalStatusSelect = document.getElementById('medicalStatus');

if (visit.patient?.medicalStatus) {
  medicalStatusSelect.value = visit.patient.medicalStatus;
} else {
  medicalStatusSelect.value = "";
}

  document
  .getElementById('back-to-doctor-list')
  ?.addEventListener('click', backToDoctorList);

  document
  .getElementById('save-diagnosis-btn')
  ?.addEventListener('click', () => saveDoctorDiagnosis(visit.idVisit));


}


async function saveDoctorDiagnosis(visitId) {
  const diagnosis = document.getElementById('doctor-diagnosis').value.trim();
  const medications = document.getElementById('doctor-medications').value.trim();
  const medicalStatus = document.getElementById('medicalStatus').value;
  const needFurtherTest = document.getElementById('needFurtherTest').checked;
  const isContagious = document.getElementById('isContagious').checked;

  if (!diagnosis) {
    showMessage("التشخيص مطلوب", "error");
    return;
  }
  if (!medications) {
    showMessage("العلاج مطلوب", "error");
    return;
  }
  if (!medicalStatus) {
      showMessage("يرجى تحديد الحالة الطبية", "error");
      return;
  }

  await secureFetch(`/api/doctor/visit/${visitId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ diagnosis, medications,medicalStatus,needFurtherTest,isContagious })
  });

  showMessage("تم حفظ التشخيص", "success");

  // Re-render the view
  document.getElementById('app-container').innerHTML = renderDoctorView();
  await setupDoctorView();
}

function backToDoctorList() {
  document.getElementById('doctor-visit-panel').innerHTML = '';
  document.getElementById('doctor-waiting-list').style.display = 'block';
  // No need to call setupDoctorView() again if we are just hiding/showing sections.
}

// Initialization for the doctor view
(async () => {
    // Nav links are hidden for doctor, so no need to set active
    const container = document.getElementById('app-container');
    container.innerHTML = renderDoctorView();
    await setupDoctorView();
})();