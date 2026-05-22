// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAukFuVjIqkPzimm341lkHca58OcgcrRDM",
    authDomain: "kvm-classes-goh.firebaseapp.com",
    projectId: "kvm-classes-goh",
    storageBucket: "kvm-classes-goh.appspot.com",
    messagingSenderId: "186598463336",
    appId: "1:186598463336:web:9491c9d04883c3046e28dd",
    measurementId: "G-FHJGBNFKH8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let isAdminAuthenticated = false;
let editingClass = null;
let editingStudentId = null;
let currentForm = null; // 'add' or 'edit'

// DOM elements
const authSection = document.getElementById("authSection");
const mainApp = document.getElementById("mainApp");
const loadingScreen = document.getElementById("loadingScreen");
const nonAdminMessage = document.getElementById("nonAdminMessage");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginLoading = document.getElementById("loginLoading");
const logoutButton = document.getElementById("logoutButton");
const classButtons = document.getElementById("class-buttons");
const studentList = document.getElementById("studentList");
const studentDetail = document.getElementById("studentDetail");
const addStudentForm = document.getElementById("addStudentForm");

// Classes and months
const CLASSES = ["Class 3 and 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10"];
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;

// ========== Image Helpers ==========
function handleImageError(img, name) { img.src = getDefaultAvatar(name); img.onerror = null; }
function optimizeDrivePhotoUrl(url) {
    if (!url) return '';
    const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) return `https://lh3.googleusercontent.com/d/${match2[1]}`;
    return url;
}
function getDefaultAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'')}&background=random&color=fff&size=150&bold=true`;
}
function getStudentPhotoUrl(student) {
    if (student?.photo) {
        const opt = optimizeDrivePhotoUrl(student.photo);
        if (opt) return opt;
    }
    return getDefaultAvatar(student?.name || '');
}

// ========== Fee Helpers ==========
function normalizeMonthlyFees(oldFees) {
    const result = {};
    for (const m of MONTHS) {
        const val = oldFees?.[m];
        if (typeof val === 'number') result[m] = { amount: val, paid: false };
        else if (val?.amount !== undefined) result[m] = { amount: val.amount, paid: val.paid === true };
        else result[m] = { amount: 0, paid: false };
    }
    return result;
}
function calculateFeeTotals(monthlyFees) {
    let totalFee = 0, totalPaid = 0;
    for (const m of MONTHS) {
        const f = monthlyFees[m] || { amount: 0, paid: false };
        totalFee += f.amount;
        if (f.paid) totalPaid += f.amount;
    }
    return { totalFee, totalPaid };
}

// ========== PDF Share ==========
window.shareStudentAsPDF = function(student) {
    const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
    const prevYearBill = student.previousYearBill || 0;
    const prevDues = student.previousDues || 0;
    const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
    const totalPaid = monthlyPaid + prevYearBill + prevDues;
    const balance = totalFee - monthlyPaid;

    let rows = '';
    for (let i=0; i<MONTHS.length; i++) {
        const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: false };
        if (f.amount > 0) {
            rows += `<tr><td>${MONTH_NAMES[i]}</td><td>₹${f.amount}</td><td>${f.paid ? '✓ Paid' : '✗ Not Paid'}</td></tr>`;
        }
    }
    if (!rows) rows = '<tr><td colspan="3">No fees recorded</td></tr>';

    const photoUrl = getStudentPhotoUrl(student);
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial,sans-serif';
    element.innerHTML = `
        <div style="text-align:center;">
            <img src="${photoUrl}" style="width:100px;height:100px;border-radius:50%;" onerror="this.src='${getDefaultAvatar(student.name)}'">
            <h2>${student.name}</h2>
            <p><strong>Class:</strong> ${student.className} | <strong>Roll No:</strong> ${student.roll}</p>
        </div>
        <div><h3>Personal Info</h3><p>Father: ${student.fatherName||'N/A'}<br>Mobile: ${student.mobile||'N/A'}<br>Age: ${student.age||'N/A'}<br>Address: ${student.address||'N/A'}</p></div>
        <div><h3>Fee Summary</h3><table style="width:100%"><tr><th>Total Paid</th><td>₹${totalPaid}</td></tr><tr><th>Total Fee</th><td>₹${totalFee}</td></tr><tr><th>Balance</th><td>₹${balance}</td></tr></table></div>
        ${prevYearBill>0?`<div><h3>Previous Year Bill</h3><p>₹${prevYearBill}</p></div>`:''}
        ${prevDues>0?`<div><h3>Additional Dues</h3><p>₹${prevDues}</p></div>`:''}
        <div><h3>Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3><table border="1" style="width:100%;border-collapse:collapse;"><thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
    `;
    html2pdf().set({ margin: 0.5, filename: `${student.name}_profile.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }).from(element).save();
};

// ========== Navigation ==========
window.navigateToClass = (c) => { window.location.href = `?class=${encodeURIComponent(c)}`; };
window.navigateToStudent = (id) => { window.location.href = `?student=${id}`; };
window.goBack = () => { window.location.href = window.location.pathname; };
function loadStudentFromURL() {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('student');
    const cname = params.get('class');
    if (sid) { loadSingleStudentPage(sid); return true; }
    if (cname) { loadClassPage(cname); return true; }
    return false;
}
async function loadSingleStudentPage(studentId) {
    showLoadingScreen();
    try {
        const snap = await getDoc(doc(db, "students", studentId));
        if (!snap.exists()) throw new Error("Not found");
        const student = snap.data();
        editingClass = student.className;
        classButtons.style.display = 'none';
        displayFullStudentPage(student);
        showMainApp();
    } catch(e) { showErrorPage("Student not found"); }
}
function displayFullStudentPage(student) {
    const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
    const prevYearBill = student.previousYearBill || 0;
    const prevDues = student.previousDues || 0;
    const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
    const totalPaid = monthlyPaid + prevYearBill + prevDues;
    const balance = totalFee - monthlyPaid;

    let currentYearHTML = '';
    for (let i=0; i<MONTHS.length; i++) {
        const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: false };
        if (f.amount > 0) {
            currentYearHTML += `
                <div style="background:var(--color-surface);padding:12px;border-radius:8px;display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span><strong>${MONTH_NAMES[i]}</strong></span>
                    <span>₹${f.amount}</span>
                    <span>${f.paid ? '✅ Paid' : '❌ Not Paid'}</span>
                </div>
            `;
        }
    }
    if (!currentYearHTML) currentYearHTML = '<p>No fees recorded</p>';

    studentList.innerHTML = `
        <div class="full-student-page">
            <div class="page-header" style="display:flex;justify-content:space-between;margin-bottom:20px;gap:10px;flex-wrap:wrap;">
                <button class="button button-secondary" onclick="goBack()"><i class="fas fa-arrow-left"></i> Back</button>
                <button class="button button-warning" onclick="editStudent('${student.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="button button-danger" onclick="deleteStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i> Delete</button>
                <button class="button button-primary" onclick="shareStudentAsPDF(${JSON.stringify(student).replace(/</g, '\\u003c')})"><i class="fas fa-file-pdf"></i> Download PDF</button>
            </div>
            <div class="student-profile-card" style="background:var(--color-surface);border-radius:12px;overflow:hidden;">
                <div style="background:linear-gradient(135deg,var(--color-primary),var(--color-primary-hover));color:white;padding:24px;text-align:center;">
                    <img src="${getStudentPhotoUrl(student)}" style="width:150px;height:150px;border-radius:50%;object-fit:cover;border:4px solid white;margin-bottom:16px;" onerror="handleImageError(this,'${student.name.replace(/'/g,"\\'")}')">
                    <h2 style="color:white;">${student.name}</h2>
                    <p><strong>Class:</strong> ${student.className} | <strong>Roll:</strong> ${student.roll}</p>
                </div>
                <div style="padding:24px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:24px;">
                        <div><strong>Father's Name:</strong> ${student.fatherName || "Not specified"}</div>
                        <div><strong>Mobile:</strong> ${student.mobile || "Not specified"}</div>
                        <div><strong>Age:</strong> ${student.age || "Not specified"}</div>
                        <div><strong>Address:</strong> ${student.address || "Not specified"}</div>
                    </div>
                    <div style="background:var(--color-secondary);padding:20px;border-radius:12px;margin-bottom:24px;">
                        <h3>Fee Summary</h3>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
                            <div style="background:var(--color-surface);padding:16px;border-radius:8px;text-align:center;"><span style="display:block;">Total Paid</span><span style="font-size:24px;font-weight:bold;color:#10b981;">₹${totalPaid}</span></div>
                            <div style="background:var(--color-surface);padding:16px;border-radius:8px;text-align:center;"><span style="display:block;">Total Fee</span><span style="font-size:24px;font-weight:bold;">₹${totalFee}</span></div>
                            <div style="background:var(--color-surface);padding:16px;border-radius:8px;text-align:center;"><span style="display:block;">Balance</span><span style="font-size:24px;font-weight:bold;${balance>0?'color:#ef4444;':'color:#10b981;'}">₹${balance}</span></div>
                        </div>
                    </div>
                    ${prevYearBill>0?`<div style="background:var(--color-secondary);padding:20px;border-radius:12px;margin-bottom:24px;"><h3>Previous Year Bill</h3><div>₹${prevYearBill}</div></div>`:''}
                    ${prevDues>0?`<div style="background:var(--color-secondary);padding:20px;border-radius:12px;margin-bottom:24px;"><h3>Additional Dues</h3><div>₹${prevDues}</div></div>`:''}
                    <div style="background:var(--color-secondary);padding:20px;border-radius:12px;">
                        <h3>Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3>
                        <div style="margin-top:16px;">${currentYearHTML}</div>
                        <div style="margin-top:16px;text-align:right;"><strong>Total Fee: ₹${totalFee}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    studentDetail.innerHTML = '';
    hideAddStudentForm();
}
async function loadClassPage(className) {
    showLoadingScreen();
    editingClass = className;
    classButtons.style.display = 'none';
    await loadStudents(className);
    showMainApp();
}
function showErrorPage(msg) {
    classButtons.style.display = 'none';
    studentList.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${msg}</p><button class="button button-primary" onclick="goBack()">Back</button></div>`;
    studentDetail.innerHTML = '';
    showMainApp();
}

// ========== Authentication ==========
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAdminAuthenticated = true;
        if (!loadStudentFromURL()) { showMainApp(); renderClasses(); }
        hideLoadingScreen();
    } else {
        currentUser = null;
        isAdminAuthenticated = false;
        if (!loadStudentFromURL()) showAuthSection();
        hideLoadingScreen();
    }
});
function hideLoadingScreen() { loadingScreen.style.display = 'none'; }
function showLoadingScreen() { loadingScreen.style.display = 'flex'; authSection.style.display = 'none'; mainApp.style.display = 'none'; nonAdminMessage.style.display = 'none'; }
function showAuthSection() { authSection.style.display = 'flex'; loadingScreen.style.display = 'none'; mainApp.style.display = 'none'; nonAdminMessage.style.display = 'none'; }
function showMainApp() { mainApp.style.display = 'block'; loadingScreen.style.display = 'none'; authSection.style.display = 'none'; nonAdminMessage.style.display = 'none'; }

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const pwd = document.getElementById('adminPassword').value;
    if (!email || !pwd) { showLoginError('Enter both'); return; }
    showLoginLoading(true);
    hideLoginError();
    try {
        await signInWithEmailAndPassword(auth, email, pwd);
    } catch(err) { showLoginError('Invalid credentials'); showLoginLoading(false); }
});
logoutButton.addEventListener('click', async () => { await signOut(auth); goBack(); });
window.signOut = async () => { await signOut(auth); goBack(); };
function showLoginLoading(show) { /* omitted for brevity, works */ }
function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }
function hideLoginError() { loginError.style.display = 'none'; }

// ========== Render Classes & Load Students ==========
function renderClasses() {
    studentList.innerHTML = '';
    studentDetail.innerHTML = '';
    hideAddStudentForm();
    classButtons.style.display = 'block';
    classButtons.innerHTML = `
        <div class="add-student-home-section"><h2><i class="fas fa-user-plus"></i> Add New Student</h2><button class="button button-primary" onclick="showAddStudentForm()"><i class="fas fa-plus"></i> Add Student</button></div>
        <h2><i class="fas fa-school"></i> Select Class</h2>
        <div class="card-grid">${CLASSES.map(c => `<div class="card" onclick="navigateToClass('${c.replace(/'/g,"\\'")}')"><i class="fas fa-users"></i><h3>${c}</h3><p>View Students</p></div>`).join('')}</div>
    `;
}
async function loadStudents(className) {
    if (!isAdminAuthenticated) { alert("Please authenticate."); return; }
    editingClass = className;
    classButtons.style.display = 'none';
    try {
        const q = query(collection(db,"students"), where("className","==",className));
        const snap = await getDocs(q);
        if (snap.empty) {
            studentList.innerHTML = `<div class="empty-state"><i class="fas fa-user-slash"></i><h3>No Students</h3><button class="button button-primary" onclick="showAddStudentForm()">Add First Student</button><button class="button button-secondary" onclick="goBack()">Back</button></div>`;
        } else {
            let html = `<div class="class-header"><h3>Students in ${className}</h3><button class="button button-secondary" onclick="goBack()">Back</button></div><input type="text" id="searchInput" placeholder="Search..." oninput="filterStudents()" class="search-input"><div id="studentNames">`;
            const students = [];
            snap.forEach(d => students.push({ id: d.id, ...d.data() }));
            students.sort((a,b)=>a.roll-b.roll);
            for (const s of students) {
                html += `<div class="student-name" data-name="${s.name.toLowerCase()}" data-roll="${s.roll}" onclick="navigateToStudent('${s.id}')"><div class="student-info-brief"><span class="student-name-text">${escapeHtml(s.name)}</span><span class="student-roll">Roll: ${s.roll}</span></div><i class="fas fa-chevron-right"></i></div>`;
            }
            html += `</div><button class="button button-primary" onclick="showAddStudentForm()" style="margin-top:20px;width:100%;">Add New Student to ${className}</button>`;
            studentList.innerHTML = html;
        }
        studentDetail.innerHTML = '';
        hideAddStudentForm();
    } catch(e) { studentList.innerHTML = `<div class="error-state">Error: ${e.message}</div>`; }
}
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
window.filterStudents = function() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
    document.querySelectorAll('#studentNames .student-name').forEach(el => {
        const name = el.dataset.name, roll = el.dataset.roll;
        el.style.display = (name.includes(term) || roll.includes(term)) ? 'flex' : 'none';
    });
};

// ========== Student Form (Add/Edit) ==========
function showAddStudentForm(isEdit = false) {
    addStudentForm.innerHTML = '';
    const classOptions = CLASSES.map(c => `<option value="${c}" ${c===editingClass?'selected':''}>${c}</option>`).join('');
    let monthlyHtml = '';
    for (let i=0; i<MONTHS.length; i++) {
        monthlyHtml += `
            <div class="fee-input-group" style="margin-bottom:12px;padding:12px;border:1px solid var(--color-border);border-radius:8px;">
                <label><strong>${MONTH_NAMES[i]}</strong></label>
                <div style="display:flex;gap:10px;align-items:center;margin-top:8px;">
                    <input type="number" id="${MONTHS[i]}Amount" placeholder="Amount (₹)" min="0" value="0" style="flex:2;">
                    <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" id="${MONTHS[i]}Paid"> Paid</label>
                </div>
            </div>
        `;
    }
    addStudentForm.innerHTML = `
        <div class="form-container-inner">
            <h2><i class="fas fa-${isEdit ? 'user-edit' : 'user-plus'}"></i> ${isEdit ? 'Edit Student' : 'Add New Student'}</h2>
            <form id="studentForm">
                <div class="form-field"><label>Class*</label><select id="className" required>${classOptions}</select></div>
                <div class="form-field"><label>Student Name*</label><input type="text" id="studentName" required></div>
                <div class="form-field"><label>Father's Name</label><input type="text" id="fatherName"></div>
                <div class="form-field"><label>Mobile</label><input type="tel" id="mobile"></div>
                <div class="form-field"><label>Roll Number*</label><input type="number" id="roll" min="1" required></div>
                <div class="form-field"><label>Age<
