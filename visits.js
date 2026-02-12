// ===============================================
//  5. واجهة المعاينة (Visit View)
// ===============================================
// (Render function is unchanged)
function renderVisitView(patientId) {
    const patient = patientsData.find(p => p.id === patientId);
    if (!patient) return `<p class="text-red-500 text-center p-8">خطأ: لم يتم العثور على سجل المريض.</p>`;

    const visitHistory = patient.visits.length > 0
  ? patient.visits.map(v => `
      <div class="card p-4 mb-3 border-r-4 ${ (v.diagnosis || '').toLowerCase().includes('طوارئ') ? 'border-red-500' : 'border-green-500'}">

          <p class="text-sm text-gray-300"><strong>التاريخ:</strong> ${formatDateTime(v.date)}</p>

          <p class="mt-2"><strong>الطبيب:</strong> <span class="text-blue-300">${v.doctor || '—'}</span></p>

          <p><strong>المركز:</strong> <span class="text-blue-300">${v.center || '—'}</span></p>

          ${Array.isArray(v.nurseNote) ?
`
          <p><strong>بيانات الممرض:</strong></p>
          <ul class="text-blue-300 text-sm pl-4">
              <li>ضغط: ${v.nurseNote[0]}</li>
              <li>نبض: ${v.nurseNote[1]}</li>
              <li>حرارة: ${v.nurseNote[2]}</li>
              <li>تنفس: ${v.nurseNote[3]}</li>
              <li>تبخيرة: ${v.nurseNote[4]}</li>
              <li>حقنة: ${v.nurseNote[5]}</li>
              <li>غيار: ${v.nurseNote[6]}</li>
              <li>ملاحظات: ${v.nurseNote[7]}</li>
          </ul>
        `
        : (v.nurseNote ? `<p><strong>ملاحظة الممرض:</strong> ${v.nurseNote}</p>` : '')
        }


          <p><strong>نوع الخدمة:</strong> ${v.servesTyp || '—'}</p>

          <p><strong>التشخيص:</strong> <span class="text-green-300">${v.diagnosis || 'غير مسجل'}</span></p>

          <p><strong>الأدوية المصروفة:</strong> ${v.medications || 'لا يوجد'}</p>

      </div>
  `).join('')
  : '<p class="text-center text-gray-400 p-4">لا توجد زيارات سابقة لهذا المريض.</p>';

    return `
        <div class="card p-6 mb-8">
            <button onclick="showView('home')" class="btn-secondary px-4 py-2 rounded-md mb-4 flex items-center">
                <span class="ml-2">→</span> العودة إلى البحث
            </button>
            <h2 class="text-3xl font-bold mb-4">${patient.fullName}</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
                <p><strong>رقم الهوية:</strong> ${patient.idNumber}</p>
                <p><strong>العمر:</strong> ${patient.age ?? '—'}</p>
                <p><strong>الجنس:</strong> ${patient.gender}</p>
                <p><strong>ذوي الإعاقة:</strong> ${patient.hasDisability ? '<span class="text-red-400">نعم</span>' : 'لا'}</p>
                ${patient.gender === 'انثى' ? `<p class="col-span-2"><strong>الحمل:</strong> ${patient.isPregnant ? '<span class="text-red-400">حامل</span>' : 'غير حامل'}</p>` : ''}
            </div>

            <hr class="border-gray-300 my-4">

            <!-- تسجيل زيارة جديدة -->
            <h3 class="text-xl font-bold mb-3">تسجيل زيارة جديدة</h3>
            <form id="new-visit-form-${patientId}">
                <div class="mb-4">
                <label class="block mb-1">ملاحظات الممرض</label>
                <button type="button"
                        onclick="openNursePopup()"
                        class="btn-secondary w-full p-3 rounded-md">
                    إدخال ملاحظات الممرض
                </button>
            </div>

                <div class="mb-4">
                    <label for="doctorDiagnosis" class="block mb-1">تشخيص الطبيب <span class="text-red-400">*</span></label>
                    <textarea id="doctorDiagnosis" rows="3" class="w-full p-2 rounded-md" required placeholder="يرجى كتابة التشخيص الطبيب هنا..."></textarea>
                    <label class="block mt-2">الدكتور</label>
                    <select id="visit-doctor" class="w-full p-2 border rounded">
                        <option value="">اختر الدكتور</option>
                    </select>

                </div>
                <div class="mb-4">
                    <label for="medications" class="block mb-1">الأدوية المصروفة (مع الكميات)</label>
                    <textarea id="medications" rows="3" class="w-full p-2 rounded-md" placeholder="مثل: مسكن (10 حبات)، مضاد حيوي (علبة)..."></textarea>
                </div>
                <button type="submit" class="btn-primary w-full p-3 rounded-md">حفظ الزيارة والتشخيص</button>
            </form>
        </div>

        <!-- سجل الزيارات السابق -->
        <div class="card p-6">
            <h3 class="text-xl font-bold mb-3">سجل الزيارات السابقة (${patient.visits.length} زيارة)</h3>
            <div id="visit-history-list">
                ${visitHistory}
            </div>
        </div>
    `;
}

/**
 * تهيئة المستمعين لواجهة المعاينة
 */
function setupVisitListeners(patientId) {
    document.getElementById(`new-visit-form-${patientId}`).addEventListener('submit', (e) => handleNewVisit(e, patientId));
    // تعبئة قائمة الدكاترة
    const docSelect = document.getElementById("visit-doctor");
    docSelect.innerHTML =
        '<option value="">اختر الدكتور</option>' +
        doctorsList.map(name => `<option value="${name}">${name}</option>`).join('');

}

/**
 * معالجة طلب تسجيل زيارة جديدة
 * MODIFIED: Now calls saveData()
 */
async function handleNewVisit(e, patientId) {
    e.preventDefault();
    const form = e.target;
    const diagnosis = form.doctorDiagnosis.value.trim();     // القديم doctorDiagnosis → الجديد diagnosis
    const medications = form.medications.value.trim();
    const now = new Date().toISOString();

    if (!diagnosis && !window.tempNurseData ) {
        showMessage(" لا يمكن أن يكون حقل تشخيص الطبيب و ملاحظات الممرض فارغين.ً", 'error');
        return;
    }
    //if (!window.tempNurseData) {
      //  showMessage("يجب على الممرض إدخال بياناته قبل حفظ الزيارة.", "error");
        //return;
    //}

    const newVisit = {
        visitId: generateUUID(),
        date: now,
        doctor: document.getElementById("visit-doctor").value,
        center: window.appCenterName || "",
        servesTyp: "رعاية صحية",//should be changed
        nurseNote: window.tempNurseData,
        diagnosis: diagnosis,
        medications: medications
    };

    const patientIndex = patientsData.findIndex(p => p.id === patientId);

    if (patientIndex !== -1) {

        patientsData[patientIndex].visits.unshift(newVisit);
        await saveData();


        showMessage("تم حفظ الزيارة بنجاح.", 'success');
        clearNursePopup();
        showView('visit', patientId);
    }else {showMessage("خطأ: لم يتم العثور على سجل المريض لإضافة الزيارة.", 'error');}
}
function clearNursePopup() {
    window.tempNurseData = null;

    document.getElementById("bp").value = "";
    document.getElementById("pulse").value = "";
    document.getElementById("temp").value = "";
    document.getElementById("resp").value = "";
    document.getElementById("sugar").value = "";

    document.getElementById("nebula").checked = false;
    document.getElementById("injection").checked = false;
    document.getElementById("gyar").checked = false;
    document.getElementById("nurseExtraNotes").value = "";
}
function openNursePopup() {
    document.getElementById("nurse-popup").classList.remove("hidden");
}

function closeNursePopup() {
    document.getElementById("nurse-popup").classList.add("hidden");
}

function saveNurseDataTemp() {

    const bp = document.getElementById("bp").value.trim();
    const pulse = document.getElementById("pulse").value.trim();
    const temp = document.getElementById("temp").value.trim();
    const resp = document.getElementById("resp").value.trim();
    const sugar = document.getElementById("sugar").value.trim();


    const nebula = document.getElementById("nebula").checked ? "نعم" : "";
    const injection = document.getElementById("injection").checked ? "نعم" : "";
    const gyar = document.getElementById("gyar").checked ? "نعم" : "";

    const extraNotes = document.getElementById("nurseExtraNotes").value.trim();

    // ✨ نص منسّق بدون empty fields
    let note = "";

    if (bp) note += `الضغط: ${bp}\n`;
    if (pulse) note += `النبض: ${pulse}\n`;
    if (temp) note += `الحرارة: ${temp}\n`;
    if (resp) note += `التنفس: ${resp}\n`;
    if (sugar) note += `السكر: ${sugar}\n`;


    if (nebula) note += `تبخيرة: ${nebula}\n`;
    if (injection) note += `حقنة: ${injection}\n`;
    if (gyar) note += `غيار: ${gyar}\n`;

    if (extraNotes) note += `ملاحظات: ${extraNotes}`;

    // إزالة الفراغات الزائدة
    note = note.trim();

    // تخزين مؤقت للنص فقط
    window.tempNurseData = note;

    closeNursePopup();

    showMessage("تم حفظ بيانات الممرض مؤقتًا.", "success");
}