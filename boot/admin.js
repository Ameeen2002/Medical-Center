// ===============================================
//  6. واجهة الإدارة والتقارير (Admin View)
// ===============================================

// NOTE: This file has been refactored to remove its dependency on the global `patientsData` object.
// It now fetches all its data directly from dedicated, performant API endpoints.

function safeText(value, fallback = '—') {
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function shortText(value, length = 50) {
    if (typeof value !== 'string') return '—';
    return value.length > length
        ? value.substring(0, length) + '...'
        : value;
}

/**
 * REFACTORED: Renders statistics using data fetched from the server.
 * @param {object} stats - The statistics object from the API.
 */
function renderStatistics(stats) {
  return `
    <!-- بطاقات الإحصائيات -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="card p-5 text-center">
            <p id="stat-totalPatients" class="text-5xl font-extrabold">${stats.totalPatients || 0}</p>
            <p class="text-gray-400 mt-2">إجمالي المرضى</p>
        </div>
            <div class="card p-5 text-center">
                <p id="stat-totalVisits" class="text-5xl font-extrabold">${stats.totalVisits || 0}</p>
                <p class="text-gray-400 mt-2">إجمالي الزيارات</p>
            </div>
            <div id="stat-newPatientsMonth-wrapper" class="card p-5 text-center hidden">
                <p id="stat-newPatientsMonth" class="text-5xl font-extrabold">${stats.newPatientsMonth || 0}</p>
                <p class="text-gray-400 mt-2">مرضى جدد هذا الشهر</p>
            </div>        <div class="card p-5 text-center">
            <p id="stat-femalePatients" class="text-5xl font-extrabold">${stats.femalePatients || 0}</p>
            <p class="text-gray-400 mt-2">إجمالي الإناث</p>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="card p-5 text-center bg-yellow-900/50 border border-yellow-700">
            <p id="stat-pregnantPatients" class="text-4xl font-extrabold text-yellow-300">${stats.pregnantPatients || 0}</p>
            <p class="text-gray-300 mt-2">الحالات الحامل</p>
        </div>
        <div class="card p-5 text-center bg-red-900/50 border border-red-700">
            <p id="stat-disabledPatients" class="text-4xl font-extrabold text-red-300">${stats.disabledPatients || 0}</p>
            <p class="text-gray-300 mt-2">ذوي الإعاقة</p>
        </div>
    </div>
  `;
}

/**
 * REFACTORED: Updates statistics based on results from a custom report.
 * @param {object} stats - The statistics object from the report API response.
 */
function updateStatistics(stats) {
  document.getElementById('stat-totalPatients').textContent = stats.totalPatients;
  document.getElementById('stat-totalVisits').textContent = stats.totalVisits;
  document.getElementById('stat-newPatientsMonth').textContent = stats.newPatientsMonth || 0;
  document.getElementById('stat-femalePatients').textContent = stats.femalePatients;
  document.getElementById('stat-pregnantPatients').textContent = stats.pregnantPatients;
  document.getElementById('stat-disabledPatients').textContent = stats.disabledPatients;
}

/**
 * REFACTORED: Renders the main admin view using data fetched from the server.
 * @param {object} initialData - An object containing stats, centers, and recentVisits.
 */
function renderAdminView(initialData) {
    const { stats, centers, recentVisits, users } = initialData;

    const centerOptionsHtml = centers.map(center => `
      <label class="flex items-center gap-2">
        <input type="checkbox" value="${center.name}" class="point"> ${center.name}
      </label>
    `).join('');

    return `
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-bold">لوحة الإدارة والتقارير</h2>
          <div class="flex gap-2">
            <button onclick="openImportModal()" class="btn-secondary px-4 py-2 rounded-md">
                Import Patients
            </button>
            <button onclick="openSetupModal()" class="btn-primary px-4 py-2 rounded-md">
              System Setup
            </button>
          </div>
        </div>

        ${renderStatistics(stats)}

        <!-- نموذج إعداد تقرير -->
        <div class="card p-6 mb-8">
            <h3 class="text-xl font-bold mb-4">إعداد تقرير مخصص</h3>
            <form id="report-form" class="space-y-4">
                <!-- Filter controls are unchanged -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="block mb-2">الفترة الزمنية</label>
                    <select id="period" class="w-full p-2 rounded-md">
                      <option value="all">كل الفترات</option>
                      <option value="daily">يومي</option>
                      <option value="monthly">شهري</option>
                      <option value="range">فترة</option>
                    </select>
                  </div>
                  <div id="day-wrapper" class="hidden">
                    <label class="block mb-2">التاريخ</label>
                    <input type="date" id="date-input" class="w-full p-2 rounded-md">
                  </div>
                  <div id="month-wrapper" class="hidden">
                    <label class="block mb-2">الشهر</label>
                    <input type="month" id="month-input" class="w-full p-2 rounded-md">
                  </div>
                  <div id="from-wrapper" class="hidden">
                    <label class="block mb-2">من</label>
                    <input type="date" id="date-from" class="w-full p-2 rounded-md">
                  </div>
                  <div id="to-wrapper" class="hidden">
                    <label class="block mb-2">إلى</label>
                    <input type="date" id="date-to" class="w-full p-2 rounded-md">
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label class="block mb-2">اسم النقطة</label>
                    <div class="flex gap-4">
                       ${centerOptionsHtml}
                    </div>
                    <p class="text-sm text-gray-400 mt-1">ملاحظة: يمكنك اختيار أكثر من خيار.</p>
                  </div>
                  <div>
                    <label class="block mb-2">نوع الخدمة</label>
                    <select id="service" class="w-full p-2 rounded-md">
                      <option value="health">رعاية صحية</option>
                    </select>
                    <p class="text-sm text-gray-400 mt-1">ملاحظة: حالياً يوجد فقط خدمة الرعاية الصحية فقط.</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block mb-2">الجنس</label>
                    <select id="gender" class="w-full p-2 rounded-md">
                      <option value="">الكل</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  <div>
                    <label class="block mb-2">العمر</label>
                    <select id="ageFilter" class="w-full p-2 rounded-md">
                      <option value="">الكل</option>
                      <option value="lt18">أقل من 18</option>
                      <option value="gte18">أكبر أو يساوي 18</option>
                    </select>
                  </div>
                  <div id="pregnant-section" class="hidden">
                    <label class="block mb-2">هل هي حامل؟</label>
                    <select id="pregnant" class="w-full p-2 rounded-md">
                      <option value="">الكل</option>
                      <option value="yes">نعم</option>
                      <option value="no">لا</option>
                    </select>
                  </div>
                  <div>
                    <label class="block mb-2">هل لديه إعاقة؟</label>
                    <select id="disability" class="w-full p-2 rounded-md">
                      <option value="">الكل</option>
                      <option value="yes">نعم</option>
                      <option value="no">لا</option>
                    </select>
                  </div>
                  <div>
                    <label class="block mb-2">الحالة الطبية</label>
                    <select id="medicalStatus" class="w-full p-2 rounded-md">
                      <option value="">الكل</option>
                      <option value="مزمنة">مزمن</option>
                      <option value="طارئة">طارئ</option>
                    </select>
                  </div>
                  <div>
                    <label class="block mb-2">نوع التقرير</label>
                    <select id="reportType" class="w-full p-2 rounded-md">
                      <option value="patient">مريض</option>
                      <option value="visit">زيارة</option>
                      <option value="medicine">أدوية</option>
                    </select>
                  </div>
                </div>

                <div class="flex gap-4">
                  <button type="submit" class="btn-primary px-4 py-2 rounded-md">إنشاء التقرير</button>
                  <button type="button" id="export-report" class="btn-secondary px-4 py-2 rounded-md">تصدير التقرير</button>
                </div>
            </form>
            <!-- Image Modal -->
            <div id="imageModal"
                 class="fixed inset-0 bg-black/70 hidden flex items-center justify-center z-50">
              <div class="bg-white p-4 rounded-lg max-w-3xl max-h-[90vh] overflow-auto">
                <!-- للصورة -->
                <img
                  id="modalImage"
                  class="hidden max-w-full max-h-[80vh] object-contain mx-auto"
                />
                <!-- PDF -->
                <iframe
                  id="modalFrame"
                  class="hidden w-full h-[80vh] border rounded"
                ></iframe>

                <button
                  type="button"
                  class="close-image btn-secondary w-full mt-4"
                >
                  إغلاق
                </button>
              </div>
            </div>
        </div>

        <div id="report-result" class="card p-6 hidden"></div>


        ${renderUsersTable(initialData.users)}

        <div class="card p-6 mt-10">
            <h3 class="text-xl font-bold mb-4">آخر 10 زيارات مسجلة</h3>
            <div id="recent-visits-table-container" class="overflow-x-auto">
                ${renderRecentVisitsTable(recentVisits)}
            </div>
        </div>
    `;
}





function setupAdminListeners() {
    const periodSelect = document.getElementById('period');
    const monthInput = document.getElementById('month-input'); // Get month input
    const newPatientsMonthWrapper = document.getElementById('stat-newPatientsMonth-wrapper'); // Get new stat wrapper

    const toggleNewPatientsMonthStat = () => {
        if (periodSelect.value === 'monthly' && monthInput.value) {
            newPatientsMonthWrapper.classList.remove('hidden');
        } else {
            newPatientsMonthWrapper.classList.add('hidden');
            // Optionally reset the value when hidden
            document.getElementById('stat-newPatientsMonth').textContent = '0';
        }
    };

    periodSelect.addEventListener('change', () => {
      const day = document.getElementById('day-wrapper');
      const month = document.getElementById('month-wrapper');
      const from = document.getElementById('from-wrapper');
      const to = document.getElementById('to-wrapper');

      day.classList.add('hidden');
      month.classList.add('hidden');
      from.classList.add('hidden');
      to.classList.add('hidden');

      if (periodSelect.value === 'daily') day.classList.remove('hidden');
      else if (periodSelect.value === 'monthly') month.classList.remove('hidden');
      else if (periodSelect.value === 'range') {
        from.classList.remove('hidden');
        to.classList.remove('hidden');
      }
      toggleNewPatientsMonthStat(); // Call when period changes
    });

    monthInput.addEventListener('change', toggleNewPatientsMonthStat); // Call when month input changes


    const genderSelect = document.getElementById('gender');
    const ageFilterSelect = document.getElementById('ageFilter');
    const pregnantSection = document.getElementById('pregnant-section');

    function togglePregnantOption() {
        if (genderSelect.value === 'female' && ageFilterSelect.value === 'gte18') {
            pregnantSection.classList.remove('hidden');
        } else {
            pregnantSection.classList.add('hidden');
            document.getElementById('pregnant').value = '';
        }
    }
    genderSelect.addEventListener('change', togglePregnantOption);
    ageFilterSelect.addEventListener('change', togglePregnantOption);

    document.getElementById('report-form').addEventListener('submit', handleReportSubmit);
    document.getElementById('export-report').addEventListener('click', exportReportToExcel);
}

/**
 * REFACTORED: Renders the recent visits table from data fetched from the server.
 * @param {Array} recentVisits - An array of the 10 most recent visit objects.
 */
function renderRecentVisitsTable(recentVisits) {
    if (!recentVisits || recentVisits.length === 0) {
        return '<p class="text-center text-gray-400 p-4">لم يتم تسجيل أي زيارات بعد.</p>';
    }

    const rows = recentVisits.map(v => `
        <tr class="transition duration-150">
            <td class="p-3">${v.patientName}</td>
            <td class="p-3">${formatDateTime(v.date)}</td>
            <td class="p-3 text-sm">${shortText(v.diagnosis)}</td>
        </tr>
    `).join('');

    return `
        <table class="min-w-full rounded-lg overflow-hidden text-sm">
            <thead>
                <tr>
                    <th class="p-3 text-right">اسم المريض</th>
                    <th class="p-3 text-right">تاريخ الزيارة</th>
                    <th class="p-3 text-right">التشخيص (مقتطف)</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderPatientReportTable(data) {
    const patientRows = data.map(p => `
        <tr>
            <td class="p-3">${p.fullName}</td>
            <td class="p-3">${p.idNumber}</td>
            <td class="p-3">${p.gender}</td>
            <td class="p-3">${p.age}</td>
            <td class="p-3">${p.hasDisability ? 'نعم' : 'لا'}</td>
            <td class="p-3">${p.hasDisability ? (p.disabilityType || '—') : '—'}</td>
            <td class="p-3">${p.phoneNumber || '—'}</td>
            <td class="p-3">${p.gender === 'انثى' ? (p.isPregnant ? 'حامل' : 'غير حامل') : '—'}</td>
            <td class="p-3">${p.visitsInPeriod}</td>
        </tr>
    `).join('');

    if (patientRows.length === 0) {
        return `<p class="text-center text-gray-400 p-4">لا توجد نتائج مطابقة للمعايير المحددة.</p>`;
    }

    return `
        <div class="overflow-y-auto" style="max-height: 500px;">
            <table class="min-w-full rounded-lg overflow-hidden text-sm">
                <thead>
                    <tr>
                        <th class="p-3 text-right">الاسم</th>
                        <th class="p-3 text-right">رقم الهوية</th>
                        <th class="p-3 text-right">الجنس</th>
                        <th class="p-3 text-right">العمر</th>
                        <th class="p-3 text-right">ذوي الإعاقة</th>
                        <th class="p-3 text-right">نوع الإعاقة</th>
                        <th class="p-3 text-right">رقم الجوال</th>
                        <th class="p-3 text-right">الحمل</th>
                        <th class="p-3 text-right">عدد الزيارات في الفترة</th>
                    </tr>
                </thead>
                <tbody>${patientRows}</tbody>
            </table>
        </div>
    `;
}

function renderVisitReportTable(data) {
    const visitRows = data.map(v => `
        <tr>
          <td class="p-3">${v.patientName}</td>
          <td class="p-3">${v.patientIdNumber}</td>
          <td class="p-3">${formatDateTime(v.date)}</td>
          <td class="p-3">${safeText(v.nurseNote)}</td>
          <td class="p-3">${safeText(v.diagnosis)}</td>
          <td class="p-3">${safeText(v.doctor)}</td>
          <td class="p-3">${v.center || '—'}</td>
          <td class="p-3">${v.servesTyp || '—'}</td>
          <td class="p-3">${v.medicineName || '—'}</td>
          <td class="p-3">${v.patientPhoneNumber || '—'}</td>
          <td class="px-3 py-2 text-center">
              ${
                v.hasDocument
                  ? `
                    <a
                      href="#"
                      data-src="/api/visits/${v.visitId}/document/view"
                      data-mime="${v.documentMimeType}"
                      class="open-image inline-block mx-1 text-blue-600"
                      title="عرض الروشتة"
                    >👁</a>

                    <a
                      href="/api/visits/${v.visitId}/document/download"
                      title="تنزيل الروشتة"
                      class="inline-block mx-1 text-green-600"
                    >⬇</a>
                  `
                  : '—'
          }</td>

        </tr>
      `).join('');

    if (visitRows.length === 0) {
        return `<p class="text-center text-gray-400 p-4">لا توجد زيارات مطابقة للمعايير المحددة.</p>`;
    }

    return `
        <div class="overflow-y-auto" style="max-height: 500px;">
            <table class="min-w-full rounded-lg overflow-hidden text-sm">
                <thead>
                    <tr>
                        <th class="p-3 text-right">الاسم</th>
                        <th class="p-3 text-right">رقم الهوية</th>
                        <th class="p-3 text-right">تاريخ الزيارة</th>
                        <th class="p-3 text-right">تشخيص الممرض</th>
                        <th class="p-3 text-right">تشخيص الطبيب</th>
                        <th class="p-3 text-right">اسم الطبيب</th>
                        <th class="p-3 text-right">اسم النقطة</th>
                        <th class="p-3 text-right">نوع الخدمة</th>
                        <th class="p-3 text-right">الدواء المصروف</th>
                        <th class="p-3 text-right">رقم الجوال</th>
                        <th class="px-3 py-2 text-center">الروشتة</th>
                    </tr>
                </thead>
                <tbody>${visitRows}</tbody>
            </table>
        </div>
    `;
}

function renderMedicineReportTable(data) {
    const rows = data.map(m => `
        <tr>
          <td class="p-3">${m.name}</td>
          <td class="p-3 text-center">${m.dispenseCount}</td>
          <td class="p-3 text-center">${m.totalQuantity}</td>
        </tr>
      `).join('');

    if (rows.length === 0) {
        return `<p class="text-center text-gray-400 p-4">لا توجد أدوية مصروفة.</p>`;
    }
    return `
        <div class="overflow-y-auto" style="max-height: 500px;">
          <table class="min-w-full text-sm">
            <thead>
              <tr>
                <th class="p-3 text-right">اسم الدواء</th>
                <th class="p-3 text-center">عدد مرات الصرف</th>
                <th class="p-3 text-center">إجمالي الكمية</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const resultContainer = document.getElementById('report-result');
    resultContainer.classList.remove('hidden');
    resultContainer.innerHTML = '<p class="text-center p-4">جاري إنشاء التقرير...</p>';

    const reportType = document.getElementById('reportType').value;
    const filters = {
        reportType,
        period: document.getElementById('period').value,
        day: document.getElementById('date-input').value,
        month: document.getElementById('month-input').value,
        dateFrom: document.getElementById('date-from').value,
        dateTo: document.getElementById('date-to').value,
        points: Array.from(document.querySelectorAll('.point:checked')).map(p => p.value),
        service: document.getElementById('service').value,
        gender: document.getElementById('gender').value,
        ageFilter: document.getElementById('ageFilter').value,
        pregnant: document.getElementById('pregnant').value,
        disability: document.getElementById('disability').value,
        medicalStatus: document.getElementById('medicalStatus').value,
    };

    try {
        const isMedicineReport = reportType === 'medicine';
        const url = isMedicineReport ? '/api/reports/medicines' : '/api/reports/custom';
        const body = isMedicineReport ? { ...filters, centers: filters.points } : filters;

        const response = await secureFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل إنشاء التقرير');
        }

        const data = await response.json();
        let tableHtml;
        if (isMedicineReport) {
            tableHtml = renderMedicineReportTable(data);
        } else {
            // Fetch newPatientsMonth if period is monthly
            if (filters.period === 'monthly' && filters.month) {
                const [year, monthNum] = filters.month.split('-');
                const monthNames = ["January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December"];
                const monthName = monthNames[parseInt(monthNum) - 1]; // Convert '01' to 'January'
                
                const newPatientsResponse = await secureFetch(`/api/statistics/new-patients-monthly?year=${year}&month=${monthName}`);
                if (newPatientsResponse.ok) {
                    const newPatientsData = await newPatientsResponse.json();
                    // The API now returns an array of patients, so we take its length
                    data.stats.newPatientsMonth = newPatientsData.patients ? newPatientsData.patients.length : 0;
                }
            }
            updateStatistics(data.stats);
            if (reportType === 'patient') {
                tableHtml = renderPatientReportTable(data.reportData);
            } else if (reportType === 'visit') {
                tableHtml = renderVisitReportTable(data.reportData);
            }
        }
        
        resultContainer.innerHTML = `<h3 class="text-xl font-bold mb-4">نتيجة التقرير</h3>${tableHtml}`;

    } catch (err) {
        console.error('Report generation error:', err);
        resultContainer.innerHTML = `<p class="text-center text-red-400 p-4">فشل إنشاء التقرير: ${err.message}</p>`;
        showMessage('فشل إنشاء التقرير', 'error');
    }
}

function exportReportToExcel() {
  const table = document.querySelector('#report-result table');
  if (!table) {
    showMessage("لا يوجد تقرير لتصديره.", "error");
    return;
  }
  const wb = XLSX.utils.table_to_book(table, { sheet: "Report" });
  XLSX.writeFile(wb, `medical_report_${new Date().toISOString().slice(0,10)}.xlsx`);
  showMessage("تم تصدير التقرير إلى Excel.", "info");
}

/**
 * NEW: Main initialization function for the admin view.
 * Fetches all necessary data from the server before rendering the UI.
 */
async function initializeAdminView() {
    const container = document.getElementById('app-container');
    try {
        // Set active nav link
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));
        document.getElementById('nav-admin')?.classList.add('active');

        // Fetch all initial data in parallel
        const [stats, centers, recentVisits, users] = await Promise.all([
            secureFetch('/api/statistics/initial').then(res => res.json()),
            secureFetch('/api/centers/all').then(res => res.json()),
            secureFetch('/api/visits/recent-admin').then(res => res.json()),
            fetchUsers()
        ]);
        
        // Render the view with the fetched data
        container.innerHTML = renderAdminView({ stats, centers, recentVisits,users });
        
        // Attach event listeners to the newly rendered DOM
        setupAdminListeners();
        // Ensure the new patients month stat is correctly hidden/shown on initial load
        document.getElementById('period').dispatchEvent(new Event('change'));

    } catch (error) {
        console.error("Failed to initialize admin view:", error);
        container.innerHTML = `<p class="text-center text-red-500 p-8">فشل تحميل واجهة الإدارة. يرجى تحديث الصفحة.</p>`;
    }
}
//جلب المستخدمين
async function fetchUsers() {
  const res = await secureFetch('/api/admin/users');
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

//جدول المستخدمين
function renderUsersTable(users) {
  if (!users.length) {
    return `<p class="text-center text-gray-400">لا يوجد مستخدمون</p>`;
  }

  const rows = users.map(u => `
    <tr>
      <td class="p-3">${u.name}</td>
      <td class="p-3">${u.userName}</td>
      <td class="p-3">${u.role}</td>
      <td class="p-3">${u.center?.name || '—'}</td>
      <td class="p-3">
        ${u.isActive
          ? '<span class="text-green-600 font-bold">نشط</span>'
          : '<span class="text-red-600 font-bold">معطّل</span>'}
      </td>
      <td class="p-3">
        <button
          class="btn-primary px-3 py-1 text-sm user-toggle-btn"
          data-user-id="${u.idUser}"
          data-active="${u.isActive}">
          ${u.isActive ? 'تعطيل' : 'تفعيل'}
        </button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="p-6 mt-10 rounded-lg border border-blue-300 bg-white">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold">إدارة المستخدمين</h3>
        <button onclick="openSetupModal()" class="btn-primary px-4 py-2">
          إضافة مستخدم
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-sm ">
          <thead>
            <tr>
              <th class="p-3 text-right">الاسم</th>
              <th class="p-3 text-right">اسم المستخدم</th>
              <th class="p-3 text-right">الدور</th>
              <th class="p-3 text-right">المركز</th>
              <th class="p-3 text-right">الحالة</th>
              <th class="p-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}
// لتفعيل / التعطيل
async function toggleUser(userId, isActive) {
  const action = isActive ? 'disable' : 'enable';

  const res = await secureFetch(`/api/admin/users/${userId}/${action}`, {
    method: 'PATCH'
  });

  if (!res.ok) {
    showMessage('فشل تحديث حالة المستخدم', 'error');
    return;
  }

  showMessage('تم تحديث حالة المستخدم', 'success');
  initializeAdminView();
}
function viewModal(src,mime) {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('modalImage');
  const frame = document.getElementById('modalFrame');
  // إعادة ضبط
  img.classList.add('hidden');
  frame.classList.add('hidden');
  img.src = '';
  frame.src = '';

  // كشف النوع
  if (mime === 'application/pdf') {
    frame.src = src;
    frame.classList.remove('hidden');
  } else {
    img.src = src;
    img.classList.remove('hidden');
  }
    modal.classList.remove('hidden');


}

function closeModal() {
  const modal = document.getElementById('imageModal');
  const img = document.getElementById('modalImage');
  const frame = document.getElementById('modalFrame');

  frame.src = '';
  img.src = '';
  modal.classList.add('hidden');
}


document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.user-toggle-btn');
  if (!btn) return;

  const userId = Number(btn.dataset.userId);
  const isActive = btn.dataset.active === 'true';

  await toggleUser(userId, isActive);
});

document.addEventListener('click', (e) => {

  // فتح الصورة
  const openBtn = e.target.closest('.open-image');
  if (openBtn) {
    e.preventDefault();
    const src = openBtn.dataset.src;
    const mime = openBtn.dataset.mime;
    if (src) viewModal(src, mime);
    return;
  }

  // إغلاق الصورة
  const closeBtn = e.target.closest('.close-image');
  if (closeBtn) {
    e.preventDefault();
    closeModal();
    return;
  }

});




// Entry point for the admin view
window.initializeAdminView = initializeAdminView;
initializeAdminView();
