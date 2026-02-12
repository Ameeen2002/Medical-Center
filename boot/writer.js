// ===============================================
//  Writer UI - Initialization & View Management
// ===============================================

let writerPatientsData = []; // Local cache for patient data to avoid refetching
let writerVisitsData = []; // Local cache for visits
let currentUserSession = {}; // NEW: To store user session data (e.g., center)
let availableDoctors = []; // NEW: To store the list of doctors for the dropdown

/**
 * Initializes the Writer UI, fetches necessary data, and renders the view.
 */
async function initializeWriterUI() {
    // NEW: Fetch session info and the list of doctors first
    await loadSessionInfo();
    await loadVisitDoctors();

    // Set the main container's HTML
    document.getElementById('app-container').innerHTML = renderWriterView();

    // Attach event listeners for the new UI
    setupWriterViewListeners();

    // Load the initial list of recent visits
    await loadAndRenderVisits();

    // Make sure the "home" nav link is active for this view
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById('nav-home');
    if (activeLink) activeLink.classList.add('active');
}

/**
 * NEW: Fetches session information for the logged-in user.
 */
async function loadSessionInfo() {
    try {
        const response = await fetch('/session-info');
        if (!response.ok) throw new Error('Failed to fetch session info');
        currentUserSession = await response.json();
    } catch (error) {
        console.error(error);
        showMessage('فشل تحميل بيانات جلسة المستخدم.', 'error');
    }
}

/**
 * NEW: Fetches the list of doctors from the API.
 */
async function loadVisitDoctors() {
    try {
        const response = await fetch('/api/users/doctors');
        if (!response.ok) throw new Error('Failed to fetch doctors');
        availableDoctors = await response.json();
    } catch (error) {
        console.error(error);
        availableDoctors = []; // Ensure it's an empty array on failure
        showMessage('فشل تحميل قائمة الأطباء.', 'error');
    }
}

/**
 * Renders the main HTML structure for the writer's interface.
 */
function renderWriterView() {
    // Determine the center name from the session, default to empty string if not available
    const centerName = currentUserSession.center ? currentUserSession.center.name : '';

    // Filter doctors by the current user's center
    const writerCenterId = currentUserSession.center?.id; // Corrected: .id instead of .idCenter
    const doctorsInCenter = availableDoctors.filter(doc => doc.idCenter === writerCenterId);

    return `
        <div class="grid grid-cols-1 gap-8">
            <!-- Top Section: Registration Form -->
            <div>
                <div class="card p-6">
                    <h2 class="text-2xl font-bold mb-4">تسجيل زيارة جديدة</h2>
                    <form id="visit-registration-form" class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="idNumber" class="block mb-1">رقم الهوية (9 أرقام) <span class="text-red-400">*</span></label>
                            <input type="text" id="idNumber" name="idNumber" class="w-full p-2 rounded-md" pattern="[0-9]{9}" maxlength="9" required>
                        </div>
                        <div>
                            <label for="fullName" class="block mb-1">الاسم الرباعي <span class="text-red-400">*</span></label>
                            <input type="text" id="fullName" name="fullName" class="w-full p-2 rounded-md" required>
                        </div>
                        <div>
                            <label for="dob" class="block mb-1">تاريخ الميلاد <span class="text-red-400">*</span></label>
                            <input type="date" id="dob" name="dob" class="w-full p-2 rounded-md" required>
                        </div>

                        <div>
                            <label for="gender" class="block mb-1">الجنس <span class="text-red-400">*</span></label>
                            <select id="gender" name="gender" class="w-full p-2 rounded-md" required>
                                <option value="" disabled selected>اختر</option>
                                <option value="انثى">أنثى</option>
                                <option value="ذكر">ذكر</option>
                            </select>
                        </div>
                        <div>
                            <label for="phoneNumber" class="block mb-1">رقم الجوال</label>
                            <input type="tel" id="phoneNumber" name="phoneNumber" class="w-full p-2 rounded-md" pattern="[0-9]{10}" maxlength="10">
                        </div>
                        <div>
                          <label for="address" class="block mb-1">عنوان السكن الأصلي</label>
                          <input
                            type="text"
                            id="address"
                            name="address"
                            class="w-full p-2 rounded-md"
                          />
                        </div>

                        <div>
                          <label for="displacedAddress" class="block mb-1">عنوان النزوح الحالي</label>
                          <input
                            type="text"
                            id="displacedAddress"
                            name="displacedAddress"
                            class="w-full p-2 rounded-md"
                          />
                        </div>

                        <div>
                            <label for="maritalStatus" class="block mb-1">الحالة الاجتماعية</label>
                            <select id="maritalStatus" name="maritalStatus" class="w-full p-2 rounded-md">
                                <option value="" disabled selected>اختر</option>
                                <option value="متزوج">متزوج</option>
                                <option value="اعزب">أعزب</option>
                                <option value="ارمل">أرمل</option>
                                <option value="مطلق">مطلق</option>
                                <option value="معلقة">معلقة</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="doctor" class="block mb-1">الطبيب المعالج <span class="text-red-400">*</span></label>
                            <select id="doctor" name="doctor" class="w-full p-2 rounded-md" required>
                                <option value="" disabled selected>اختر الطبيب</option>
                                ${doctorsInCenter.map(doc => `<option value="${doc.idUser}">${doc.name}</option>`).join('')}
                                <option value="no_doctor">المريض لن يقابل طبيب</option>
                            </select>
                        </div>
                        <div id="pregnancy-container" class="hidden">
                            <label for="isPregnant" class="block mb-1">هل هي حامل؟</label>
                            <select id="isPregnant" name="isPregnant" class="w-full p-2 rounded-md">
                                <option value="false">لا</option>
                                <option value="true">نعم</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="hasDisability" class="block mb-1">هل الحالة من ذوي الإعاقة؟</label>
                            <select id="hasDisability" name="hasDisability" class="w-full p-2 rounded-md">
                                <option value="false">لا</option>
                                <option value="true">نعم</option>
                            </select>
                        </div>
                        <div id="disability-type-container" class="hidden md:col-span-2">
                            <label for="disabilityType" class="block mb-1">نوع الإعاقة</label>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <select id="disabilityType" name="disabilityType" class="w-full p-2 rounded-md">
                                    <option value="" selected>نوع آخر</option>
                                    <option value="اعاقة سمعية">إعاقة سمعية</option>
                                    <option value="اعاقة بصرية">إعاقة بصرية</option>
                                    <option value="اعاقة حركية">إعاقة حركية</option>
                                    <option value="اعاقة ذهنية">إعاقة ذهنية</option>
                                </select>
                                <input type="text" id="customDisability" name="customDisability" class="w-full p-2 rounded-md" placeholder="أدخل نوع الإعاقة" />
                            </div>
                        </div>

                        <div class="md:col-span-3 mt-4">
                            <button type="submit" class="btn-primary w-full p-3 rounded-md">تسجيل زيارة للمريض</button>
                        </div>
                    </form>
                </div>
            </div>

            <div>
                <div class="card p-6">
                    <h2 class="text-2xl font-bold mb-4">أحدث الزيارات</h2>
                    <div id="recent-visits-list" class="overflow-y-auto" style="max-height: 500px;">
                        <!-- Visit list will be rendered here by JS -->
                        <p class="text-center text-gray-400 p-4">جاري تحميل الزيارات...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * إظهار/إخفاء حقل الحمل بناءً على الجنس
 */
function togglePregnancy(gender) {
    const container = document.getElementById('pregnancy-container');
    if (gender === 'انثى') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        document.getElementById('isPregnant').value = 'false'; // تعيين القيمة الافتراضية
    }
}

function toggleDisabilityType(value) {
    const container = document.getElementById('disability-type-container');
    container.classList.toggle('hidden', value !== 'true');
     if (value !== 'true') {
        document.getElementById('disabilityType').value = '';
        document.getElementById('customDisability').value = '';
    }
}

function handleDisabilityTypeChange(value) {
    const customInput = document.getElementById('customDisability');
    customInput.disabled = value !== '';
    if (value !== '') {
        customInput.value = ''; // مسح النص إذا تم اختيار نوع من القائمة
    }
}


/**
 * Sets up event listeners for the writer UI components.
 */
function setupWriterViewListeners() {
    document.getElementById('idNumber').addEventListener('input', handleIdInput);
    document.getElementById('visit-registration-form').addEventListener('submit', handleVisitRegistration);
    
    // Add explicit event listeners for select changes
    document.getElementById('gender').addEventListener('change', (e) => togglePregnancy(e.target.value));
    document.getElementById('hasDisability').addEventListener('change', (e) => toggleDisabilityType(e.target.value));
    document.getElementById('disabilityType').addEventListener('change', (e) => handleDisabilityTypeChange(e.target.value));

    // Set initial visibility states
    togglePregnancy(document.getElementById('gender').value);
    toggleDisabilityType(document.getElementById('hasDisability').value);
    handleDisabilityTypeChange(document.getElementById('disabilityType').value);
}

// ===============================================
//  Writer UI - Data & Event Handlers
// ===============================================

/**
 * Handles input in the ID number field to auto-fill patient data.
 * @param {Event} e - The input event.
 */
async function handleIdInput(e) {
    const idInput = e.target;
    const form = idInput.form;

    if (idInput.value.length === 9) {
        try {
            const response = await fetch(`/api/patient/by-id/${idInput.value}`);
            if (response.ok) {
                const patient = await response.json();
                if (patient) {
                    // Fill form with existing patient data
                    form.fullName.value = patient.fullName || '';
                    form.dob.value = patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '';
                    form.gender.value = patient.gender || '';
                    form.phoneNumber.value = patient.phoneNumber || '';
                    form.maritalStatus.value = patient.maritalStatus || '';
                    form.address.value = patient.address || '';
                    form.displacedAddress.value = patient.displacedAddress || '';


                    // Fill new fields
                    form.isPregnant.value = patient.isPregnant ? 'true' : 'false';
                    form.hasDisability.value = patient.hasDisability ? 'true' : 'false';
                    
                    const disabilityTypes = ['اعاقة سمعية', 'اعاقة بصرية', 'اعاقة حركية', 'اعاقة ذهنية'];
                    if (patient.hasDisability && patient.disabilityType) {
                        if (disabilityTypes.includes(patient.disabilityType)) {
                            form.disabilityType.value = patient.disabilityType;
                            form.customDisability.value = '';
                        } else {
                            form.disabilityType.value = '';
                            form.customDisability.value = patient.disabilityType;
                        }
                    } else {
                        form.disabilityType.value = '';
                        form.customDisability.value = '';
                    }

                    // Update UI visibility
                    togglePregnancy(form.gender.value);
                    toggleDisabilityType(form.hasDisability.value);
                    handleDisabilityTypeChange(form.disabilityType.value);


                    showMessage(`تم العثور على المريض: ${patient.fullName}`, 'info');
                }
            } else if (response.status === 404) {
                // Patient not found, clear the form for new entry, but keep ID
                const idValue = idInput.value;
                form.reset();
                idInput.value = idValue;
                
                // Reset visibility
                togglePregnancy('');
                toggleDisabilityType('false');

                showMessage('مريض جديد. يرجى إكمال البيانات.', 'info');
            }
        } catch (error) {
            console.error('Error fetching patient by ID:', error);
            showMessage('حدث خطأ أثناء البحث عن المريض.', 'error');
        }
    }
}

/**
 * Handles the submission of the visit registration form.
 * @param {Event} e - The form submission event.
 */
async function handleVisitRegistration(e) {
    e.preventDefault();
    const form = e.target;
    
    const patientData = {
        idNumber: form.idNumber.value.trim(),
        fullName: form.fullName.value.trim(),
        dob: form.dob.value,
        gender: form.gender.value,
        isPregnant: form.gender.value === 'انثى' ? form.isPregnant.value === 'true' : false,
        phoneNumber: form.phoneNumber.value.trim(),
        address: form.address.value.trim(),
        displacedAddress: form.displacedAddress.value.trim(),
        maritalStatus: form.maritalStatus.value,
        hasDisability: form.hasDisability.value === 'true',
        disabilityType: form.hasDisability.value === 'true'
            ? (form.disabilityType.value || form.customDisability.value.trim())
            : null,
        doctorId: form.doctor.value, // NEW: Get the selected doctor's ID
    };

    // Basic validation, now including the doctorId
    if (!patientData.idNumber || !patientData.fullName || !patientData.dob || !patientData.gender || !patientData.doctorId) {
        showMessage('يرجى ملء جميع الحقول الإلزامية (*).', 'error');
        return;
    }

    try {
        const response = await secureFetch('/api/register-visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData),
        });

        const result = await response.json();

        if (response.ok) {
            showMessage(`تم تسجيل زيارة جديدة للمريض ${patientData.fullName} بنجاح.`, 'success');
            form.reset(); // Clear the form for the next entry
            
            // Manually reset UI elements to their initial state
            togglePregnancy('');
            toggleDisabilityType('false');
            handleDisabilityTypeChange('');


            await loadAndRenderVisits(); // Refresh the visits list
        } else {
            throw new Error(result.message || 'فشل تسجيل الزيارة.');
        }
    } catch (error) {
        console.error('Failed to register visit:', error);
        showMessage(error.message, 'error');
    }
}


// ===============================================
//  Writer UI - Visit List Functions
// ===============================================

/**
 * Fetches the most recent visits from the server and renders them.
 */
async function loadAndRenderVisits() {
    const listContainer = document.getElementById('recent-visits-list');
    try {
        const response = await fetch('/api/visits/recent');
        if (!response.ok) {
            throw new Error('Server error fetching visits.');
        }
        writerVisitsData = await response.json();
        listContainer.innerHTML = renderVisitsList(writerVisitsData);
    } catch (error) {
        console.error('Failed to load recent visits:', error);
        listContainer.innerHTML = '<p class="text-center text-red-400 p-4">فشل تحميل قائمة الزيارات.</p>';
    }
}

/**
 * Renders the HTML for the list of recent visits.
 * @param {Array} visits - An array of visit objects.
 */
function renderVisitsList(visits) {
    if (!visits || visits.length === 0) {
        return '<p class="text-center text-gray-400 p-4">لا توجد زيارات مسجلة بعد.</p>';
    }

    const visitItems = visits.map(visit => `
        <div class="p-4 border-b border-gray-200 last:border-b-0 flex justify-between items-center">
            <div>
                <p class="font-semibold text-lg">${visit.patientName}</p>
                <p class="text-sm text-gray-600">
                    <span class="font-medium">رقم الهوية:</span> ${visit.patientIdNumber || 'غير متوفر'}
                </p>
                <p class="text-sm text-gray-600">
                    <span class="font-medium">رقم الجوال:</span> ${visit.patientPhoneNumber || 'غير متوفر'}
                </p>
                <p class="text-xs text-gray-500 mt-1">${formatDateTime(visit.date)}</p>
            </div>
            <div>
                <button
                  class="delete-btn bg-gray-400 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-md text-sm transition-colors"
                  data-visit-id="${visit.visitId}">
                  حذف
                </button>

            </div>
        </div>
    `).join('');

    return visitItems;
}

/**
 * NEW: Handles the deletion of a visit.
 * @param {string} visitId - The ID of the visit to delete.
 */
async function handleDeleteVisit(visitId) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الزيارة؟ لا يمكن التراجع عن هذا الإجراء.')) {
        return;
    }

    try {
        const response = await secureFetch (`/api/visits/${visitId}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showMessage('تم حذف الزيارة بنجاح.', 'success');
            await loadAndRenderVisits(); // Refresh the list
        } else {
            throw new Error(result.message || 'فشل حذف الزيارة.');
        }
    } catch (error) {
        console.error('Failed to delete visit:', error);
        showMessage(error.message, 'error');
    }
}
document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    e.preventDefault(); // مهم جدًا

    const visitId = btn.dataset.visitId;
    await handleDeleteVisit(visitId);
});


initializeWriterUI();
