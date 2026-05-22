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

// Global Variables
let currentUser = null;
let isAdminAuthenticated = false;
let editingClass = null;
let editingStudentId = null;
let currentForm = null;

// DOM Elements
const authSection = document.getElementById("authSection");
const mainApp = document.getElementById("mainApp");
const loadingScreen = document.getElementById("loadingScreen");
const loadingMessage = document.getElementById("loadingMessage");
const nonAdminMessage = document.getElementById("nonAdminMessage");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginLoading = document.getElementById("loginLoading");
const logoutButton = document.getElementById("logoutButton");
const classButtons = document.getElementById("class-buttons");
const studentList = document.getElementById("studentList");
const studentDetail = document.getElementById("studentDetail");
const addStudentForm = document.getElementById("addStudentForm");

const CLASSES = ["Class 3 and 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10"];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENT_YEAR = new Date().getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;

// Loading Functions
function showCustomLoading(message) {
    const msgEl = document.getElementById('loadingMessage');
    if (msgEl) msgEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${message}`;
    loadingScreen.style.display = 'flex';
}

function hideLoadingScreen() {
    loadingScreen.style.display = 'none';
}

// Image Functions
window.handleImageError = function(img, name) {
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=150&bold=true`;
    img.onerror = null;
};

function optimizeDrivePhotoUrl(url) {
    if (!url) return '';
    const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
}

function getStudentPhotoUrl(student) {
    if (student?.photo) {
        const opt = optimizeDrivePhotoUrl(student.photo);
        if (opt) return opt;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(student?.name || '')}&background=random&color=fff&size=150&bold=true`;
}

// Fee Functions
function normalizeMonthlyFees(oldFees) {
    const result = {};
    for (const m of MONTHS) {
        const val = oldFees?.[m];
        if (typeof val === 'number') result[m] = { amount: val, paid: true };
        else if (val?.amount !== undefined) result[m] = { amount: val.amount, paid: val.paid !== false };
        else result[m] = { amount: 0, paid: true };
    }
    return result;
}

function calculateFeeTotals(monthlyFees) {
    let totalFee = 0, totalPaid = 0;
    for (const m of MONTHS) {
        const f = monthlyFees[m] || { amount: 0, paid: true };
        totalFee += f.amount;
        if (f.paid) totalPaid += f.amount;
    }
    return { totalFee, totalPaid };
}

// Print Receipt Function - WORKING
window.printStudentReceipt = function(student) {
    showCustomLoading("Preparing Receipt...");
    
    setTimeout(() => {
        try {
            const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
            const previousYearBill = student.previousYearBill || 0;
            const isPreviousYearPaid = student.previousYearPaid === true;
            const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
            const totalPaid = monthlyPaid + (isPreviousYearPaid ? previousYearBill : 0);
            const amountDue = totalFee - monthlyPaid + (isPreviousYearPaid ? 0 : previousYearBill);
            
            let feeRows = '';
            for (let i = 0; i < MONTHS.length; i++) {
                const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: true };
                if (f.amount > 0) {
                    feeRows += `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 10px; border: 1px solid #ddd;">${MONTH_NAMES[i]}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹${f.amount}</td>
                            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${f.paid ? '✓ PAID' : '✗ NOT PAID'}</td>
                        </tr>
                    `;
                }
            }
            if (!feeRows) feeRows = '<tr><td colspan="3" style="padding: 20px; text-align: center;">No fees recorded</td></tr>';
            
            const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Fee Receipt - ${student.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        .receipt {
            max-width: 800px;
            width: 100%;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .receipt-header {
            background: linear-gradient(135deg, #1f4f5e, #0d2f3a);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .receipt-header h1 { font-size: 28px; margin-bottom: 5px; }
        .receipt-header p { opacity: 0.9; }
        .receipt-body { padding: 30px; }
        .student-info {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
        }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .fee-summary {
            background: linear-gradient(135deg, #f0fdf4, #dcfce7);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
        }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
        .summary-amount { font-size: 24px; font-weight: bold; }
        .amount-paid { color: #10b981; }
        .amount-due { color: #dc2626; }
        .fee-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .fee-table th { background: #1f4f5e; color: white; padding: 12px; text-align: left; border: 1px solid #1f4f5e; }
        .fee-table td { padding: 10px; }
        .previous-bill {
            background: #fef3c7;
            border-radius: 12px;
            padding: 15px 20px;
            margin: 20px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .total-section {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #e5e7eb;
            text-align: right;
            font-weight: bold;
            font-size: 16px;
        }
        .receipt-footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #e5e7eb;
        }
        .print-btn {
            display: block;
            width: 200px;
            margin: 20px auto 0;
            padding: 12px;
            background: #1f4f5e;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        }
        .print-btn:hover { background: #0d2f3a; }
        @media print {
            body { background: white; padding: 0; margin: 0; }
            .print-btn { display: none; }
            .receipt { box-shadow: none; border-radius: 0; margin: 0; }
        }
        @media (max-width: 600px) {
            .info-grid { grid-template-columns: 1fr; }
            .summary-grid { grid-template-columns: 1fr; gap: 10px; }
            .previous-bill { flex-direction: column; text-align: center; }
            .receipt-body { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="receipt-header">
            <h1>🎓 KVM CLASSES</h1>
            <p>Goh Aurangabad - Fee Receipt</p>
        </div>
        <div class="receipt-body">
            <div class="student-info">
                <h3 style="margin-bottom: 15px;">📋 STUDENT INFORMATION</h3>
                <div class="info-grid">
                    <div><strong>Name:</strong> ${escapeHtml(student.name)}</div>
                    <div><strong>Class:</strong> ${student.className}</div>
                    <div><strong>Roll No:</strong> ${student.roll}</div>
                    <div><strong>Father's Name:</strong> ${escapeHtml(student.fatherName) || 'N/A'}</div>
                    <div><strong>Mobile:</strong> ${escapeHtml(student.mobile) || 'N/A'}</div>
                    <div><strong>Address:</strong> ${escapeHtml(student.address) || 'N/A'}</div>
                </div>
            </div>
            <div class="fee-summary">
                <h3 style="margin-bottom: 15px;">💰 FEE SUMMARY</h3>
                <div class="summary-grid">
                    <div><div>Total Paid</div><div class="summary-amount amount-paid">₹${totalPaid}</div></div>
                    <div><div>Total Fee</div><div class="summary-amount">₹${totalFee}</div></div>
                    <div><div>Amount Due</div><div class="summary-amount amount-due">₹${amountDue}</div></div>
                </div>
            </div>
            ${previousYearBill > 0 ? `
            <div class="previous-bill">
                <span><strong>📅 Previous Year Bill</strong></span>
                <span><strong>₹${previousYearBill}</strong></span>
                <span>${isPreviousYearPaid ? '✅ PAID' : '❌ NOT PAID'}</span>
            </div>
            ` : ''}
            <h3 style="margin: 20px 0 15px;">📆 Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3>
            <table class="fee-table">
                <thead>
                    <tr>
                        <th style="width: 40%;">Month</th>
                        <th style="width: 30%; text-align: right;">Amount</th>
                        <th style="width: 30%; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>${feeRows}</tbody>
            </table>
            <div class="total-section">Total Current Year Fee: ₹${totalFee}</div>
        </div>
        <div class="receipt-footer">
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>This is a computer generated receipt | Valid without signature</p>
        </div>
        <button class="print-btn" onclick="window.print();">🖨️ Print / Save as PDF</button>
    </div>
    <script>
        // Auto open print dialog
        setTimeout(function() { window.print(); }, 500);
    </script>
</body>
</html>`;
            
            hideLoadingScreen();
            const printWindow = window.open('', '_blank');
            printWindow.document.write(receiptHTML);
            printWindow.document.close();
        } catch (error) {
            console.error("Error:", error);
            hideLoadingScreen();
            alert("Error preparing receipt. Please try again.");
        }
    }, 100);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Navigation Functions
window.navigateToClass = function(className) {
    window.location.href = `?class=${encodeURIComponent(className)}`;
};

window.navigateToStudent = function(studentId) {
    window.location.href = `?student=${studentId}`;
};

window.goBack = function() {
    window.location.href = window.location.pathname;
};

function loadStudentFromURL() {
    const params = new URLSearchParams(window.location.search);
    const studentId = params.get('student');
    const className = params.get('class');
    if (studentId) { loadSingleStudentPage(studentId); return true; }
    if (className) { loadClassPage(className); return true; }
    return false;
}

async function loadSingleStudentPage(studentId) {
    showCustomLoading("Loading student details...");
    try {
        const snap = await getDoc(doc(db, "students", studentId));
        if (snap.exists()) {
            const student = snap.data();
            student.id = studentId;
            editingClass = student.className;
            classButtons.style.display = 'none';
            displayFullStudentPage(student);
            hideLoadingScreen();
            showMainApp();
        } else {
            hideLoadingScreen();
            showErrorPage("Student not found");
        }
    } catch(e) {
        hideLoadingScreen();
        showErrorPage("Error loading profile");
    }
}

function displayFullStudentPage(student) {
    // Mobile fix - prevent horizontal scroll
    if (window.innerWidth <= 768) {
        document.body.style.overflowX = 'hidden';
        const container = document.querySelector('.container');
        if (container) container.style.overflowX = 'hidden';
        window.scrollTo(0, 0);
    }

    const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
    const previousYearBill = student.previousYearBill || 0;
    const isPreviousYearPaid = student.previousYearPaid === true;
    const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
    const totalPaid = monthlyPaid + (isPreviousYearPaid ? previousYearBill : 0);
    const amountDue = totalFee - monthlyPaid + (isPreviousYearPaid ? 0 : previousYearBill);
    
    // VERTICAL LAYOUT FOR MOBILE - FIXED
    let currentYearHTML = '';
    for (let i = 0; i < MONTHS.length; i++) {
        const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: true };
        if (f.amount > 0) {
            currentYearHTML += `
                <div style="background: var(--color-surface); padding: 14px; border-radius: 10px; display: flex; flex-direction: column; gap: 8px; text-align: center; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <span style="font-weight: bold; font-size: 16px;">${MONTH_NAMES[i]}</span>
                    <span style="font-size: 20px; font-weight: bold; color: #1f4f5e;">₹${f.amount}</span>
                    <span style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                        ${f.paid ? '✅ <span style="color: #10b981; font-weight: 500;">Paid</span>' : '❌ <span style="color: #dc2626; font-weight: 500;">Not Paid</span>'}
                    </span>
                </div>
            `;
        }
    }
    if (!currentYearHTML) currentYearHTML = '<p style="text-align: center; padding: 20px;">No fees recorded for current year</p>';
    
    studentList.innerHTML = `
        <div style="width: 100%; max-width: 100%; overflow-x: hidden;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 10px; flex-wrap: wrap;">
                <button class="button button-secondary" onclick="goBack()"><i class="fas fa-arrow-left"></i> Back</button>
                <button class="button button-warning" onclick="editStudent('${student.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="button button-danger" onclick="deleteStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i> Delete</button>
                <button class="button button-primary" onclick="printStudentReceipt(${JSON.stringify(student).replace(/</g, '\\u003c')})"><i class="fas fa-receipt"></i> Print Receipt</button>
            </div>
            <div style="background: var(--color-surface); border-radius: 12px; overflow: hidden; width: 100%;">
                <div style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)); color: white; padding: 24px; text-align: center;">
                    <img src="${getStudentPhotoUrl(student)}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid white; margin-bottom: 16px;" onerror="handleImageError(this, '${student.name.replace(/'/g, "\\'")}')">
                    <h2 style="color: white; font-size: 20px; margin: 10px 0 5px;">${escapeHtml(student.name)}</h2>
                    <p><strong>Class:</strong> ${student.className} | <strong>Roll:</strong> ${student.roll}</p>
                </div>
                <div style="padding: 20px;">
                    <!-- Personal Information -->
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--color-primary);">📋 Personal Information</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div><strong>Father's Name:</strong> ${escapeHtml(student.fatherName) || "Not specified"}</div>
                            <div><strong>Mobile:</strong> ${escapeHtml(student.mobile) || "Not specified"}</div>
                            <div><strong>Age:</strong> ${student.age || "Not specified"}</div>
                            <div><strong>Address:</strong> ${escapeHtml(student.address) || "Not specified"}</div>
                        </div>
                    </div>
                    
                    <!-- Fee Summary -->
                    <div style="background: var(--color-secondary); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--color-primary);">💰 Fee Summary</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="background: var(--color-surface); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                <span>Total Paid:</span>
                                <span style="font-weight: bold; color: #10b981;">₹${totalPaid}</span>
                            </div>
                            <div style="background: var(--color-surface); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                <span>Total Fee:</span>
                                <span style="font-weight: bold;">₹${totalFee}</span>
                            </div>
                            <div style="background: var(--color-surface); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                                <span>Amount Due:</span>
                                <span style="font-weight: bold; ${amountDue > 0 ? 'color: #ef4444;' : 'color: #10b981;'}">₹${amountDue}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Previous Year Bill -->
                    ${previousYearBill > 0 ? `
                    <div style="background: var(--color-secondary); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--color-primary);">📅 Previous Year Bill</h3>
                        <div style="background: var(--color-surface); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <span><strong>Previous Year Bill:</strong> ₹${previousYearBill}</span>
                            <span style="display: flex; align-items: center; gap: 5px;">
                                ${isPreviousYearPaid ? '✅ <span style="color: #10b981;">Paid</span>' : '❌ <span style="color: #dc2626;">Not Paid</span>'}
                            </span>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Current Year Fees - VERTICAL LAYOUT -->
                    <div style="background: var(--color-secondary); padding: 16px; border-radius: 12px;">
                        <h3 style="font-size: 16px; margin-bottom: 12px; color: var(--color-primary);">📆 Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${currentYearHTML}
                        </div>
                        <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--color-border); text-align: right;">
                            <strong>Total Fee: ₹${totalFee}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    studentDetail.innerHTML = '';
    hideAddStudentForm();
}

async function loadClassPage(className) {
    showCustomLoading(`Loading ${className}...`);
    editingClass = className;
    classButtons.style.display = 'none';
    await loadStudents(className);
    hideLoadingScreen();
    showMainApp();
}

function showErrorPage(message) {
    classButtons.style.display = 'none';
    studentList.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${message}</p><button class="button button-primary" onclick="goBack()">Go Back</button></div>`;
    studentDetail.innerHTML = '';
    showMainApp();
}

// Authentication
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        isAdminAuthenticated = true;
        if (!loadStudentFromURL()) { showMainApp(); renderClasses(); hideLoadingScreen(); }
    } else {
        currentUser = null;
        isAdminAuthenticated = false;
        if (!loadStudentFromURL()) showAuthSection();
        hideLoadingScreen();
    }
});

function showAuthSection() {
    authSection.style.display = 'flex';
    loadingScreen.style.display = 'none';
    mainApp.style.display = 'none';
    nonAdminMessage.style.display = 'none';
}

function showMainApp() {
    mainApp.style.display = 'block';
    loadingScreen.style.display = 'none';
    authSection.style.display = 'none';
    nonAdminMessage.style.display = 'none';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const pwd = document.getElementById('adminPassword').value;
    if (!email || !pwd) { showLoginError('Enter both'); return; }
    showLoginLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, pwd);
    } catch(err) { showLoginError('Invalid credentials'); showLoginLoading(false); }
});

logoutButton.addEventListener('click', async () => { await signOut(auth); goBack(); });
window.signOut = async () => { await signOut(auth); goBack(); };

function showLoginLoading(show) {
    if (show) {
        loginLoading.style.display = 'block';
        loginForm.style.opacity = '0.6';
        loginForm.style.pointerEvents = 'none';
    } else {
        loginLoading.style.display = 'none';
        loginForm.style.opacity = '1';
        loginForm.style.pointerEvents = 'auto';
    }
}

function showLoginError(msg) { loginError.textContent = msg; loginError.style.display = 'block'; }
function hideLoginError() { loginError.style.display = 'none'; }

// Render Classes
function renderClasses() {
    studentList.innerHTML = '';
    studentDetail.innerHTML = '';
    hideAddStudentForm();
    classButtons.style.display = 'block';
    classButtons.innerHTML = `
        <div class="add-student-home-section">
            <h2><i class="fas fa-user-plus"></i> Add New Student</h2>
            <button class='button button-primary' onclick='showAddStudentForm()'><i class="fas fa-plus"></i> Add Student</button>
        </div>
        <h2><i class="fas fa-school"></i> Select Class</h2>
        <div class="card-grid">
            ${CLASSES.map(c => `<div class="card" onclick="navigateToClass('${c.replace(/'/g,"\\'")}')"><i class="fas fa-users"></i><h3>${c}</h3><p>View Students</p></div>`).join('')}
        </div>
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
                html += `<div class="student-name" data-name="${s.name.toLowerCase()}" data-roll="${s.roll}" onclick="navigateToStudent('${s.id}')"><div><strong>${escapeHtml(s.name)}</strong><br><small>Roll: ${s.roll}</small></div><i class="fas fa-chevron-right"></i></div>`;
            }
            html += `</div><button class="button button-primary" onclick="showAddStudentForm()" style="margin-top:20px;width:100%;">Add New Student to ${className}</button>`;
            studentList.innerHTML = html;
        }
        studentDetail.innerHTML = '';
        hideAddStudentForm();
    } catch(e) { studentList.innerHTML = `<div class="error-state">Error: ${e.message}</div>`; }
}

window.filterStudents = function() {
    const term = document.getElementById('searchInput')?.value.toLowerCase() || '';
    document.querySelectorAll('#studentNames .student-name').forEach(el => {
        const name = el.dataset.name, roll = el.dataset.roll;
        el.style.display = (name?.includes(term) || roll?.includes(term)) ? 'flex' : 'none';
    });
};

// Student Form
window.showAddStudentForm = function(isEdit = false) {
    addStudentForm.innerHTML = '';
    const classOptions = CLASSES.map(c => `<option value="${c}" ${c===editingClass?'selected':''}>${c}</option>`).join('');
    let monthlyHtml = '';
    for (let i=0; i<MONTHS.length; i++) {
        monthlyHtml += `
            <div style="margin-bottom:12px; padding:12px; border:1px solid #ddd; border-radius:8px;">
                <label><strong>${MONTH_NAMES[i]}</strong></label>
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <input type="number" id="${MONTHS[i]}Amount" placeholder="Amount" min="0" value="0" style="flex:2;">
                    <label><input type="checkbox" id="${MONTHS[i]}Paid" checked> Paid</label>
                </div>
            </div>
        `;
    }
    addStudentForm.innerHTML = `
        <div class="form-container-inner">
            <h2><i class="fas fa-${isEdit ? 'user-edit' : 'user-plus'}"></i> ${isEdit ? 'Edit Student' : 'Add Student'}</h2>
            <form id="studentForm">
                <div class="form-field"><label>Class*</label><select id="className" required>${classOptions}</select></div>
                <div class="form-field"><label>Student Name*</label><input type="text" id="studentName" required></div>
                <div class="form-field"><label>Father's Name</label><input type="text" id="fatherName"></div>
                <div class="form-field"><label>Mobile</label><input type="tel" id="mobile"></div>
                <div class="form-field"><label>Roll Number*</label><input type="number" id="roll" min="1" required></div>
                <div class="form-field"><label>Age</label><input type="number" id="age"></div>
                <div class="form-field"><label>Address</label><textarea id="address" rows="2"></textarea></div>
                <div class="form-field"><label>Photo URL</label><input type="url" id="photo" placeholder="Google Drive link"><small>Paste Google Drive share link</small></div>
                <div class="fee-form-section">
                    <h3><i class="fas fa-history"></i> Previous Year Bill</h3>
                    <div class="form-field">
                        <label>Previous Year's Month Bill (₹)</label>
                        <input type="number" id="previousYearBill" min="0" value="0">
                    </div>
                    <div class="form-field">
                        <label><input type="checkbox" id="previousYearPaid"> Previous Year Bill Paid</label>
                    </div>
                </div>
                <div class="fee-form-section">
                    <h3><i class="fas fa-calendar-alt"></i> Monthly Fees (Current Year)</h3>
                    <p><small>✅ Checked = Paid, Uncheck = Not Paid</small></p>
                    ${monthlyHtml}
                </div>
                <div class="action-buttons">
                    <button type="submit" class="button button-primary"><i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Add'}</button>
                    <button type="button" class="button button-warning" onclick="hideAddStudentForm()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    currentForm = isEdit ? 'edit' : 'add';
    const formEl = document.getElementById('studentForm');
    if (formEl) { formEl.removeEventListener('submit', handleFormSubmit); formEl.addEventListener('submit', handleFormSubmit); }
    addStudentForm.style.display = 'block';
    addStudentForm.scrollIntoView({ behavior: 'smooth' });
};

window.hideAddStudentForm = function() {
    addStudentForm.style.display = 'none';
    addStudentForm.innerHTML = '';
    editingStudentId = null;
};

window.editStudent = async function(studentId) {
    editingStudentId = studentId;
    try {
        const snap = await getDoc(doc(db,"students",studentId));
        if (snap.exists()) {
            const student = snap.data();
            editingClass = student.className;
            showAddStudentForm(true);
            setTimeout(() => {
                document.getElementById('className').value = student.className || '';
                document.getElementById('studentName').value = student.name || '';
                document.getElementById('fatherName').value = student.fatherName || '';
                document.getElementById('mobile').value = student.mobile || '';
                document.getElementById('roll').value = student.roll || '';
                document.getElementById('age').value = student.age || '';
                document.getElementById('address').value = student.address || '';
                document.getElementById('photo').value = student.photo || '';
                document.getElementById('previousYearBill').value = student.previousYearBill || 0;
                document.getElementById('previousYearPaid').checked = student.previousYearPaid === true;
                const fees = normalizeMonthlyFees(student.monthlyFees);
                for (const m of MONTHS) {
                    const amt = document.getElementById(m+'Amount');
                    const chk = document.getElementById(m+'Paid');
                    if (amt) amt.value = fees[m]?.amount || 0;
                    if (chk) chk.checked = fees[m]?.paid !== false;
                }
            }, 100);
        }
    } catch(e) { alert("Error loading student"); }
};

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isAdminAuthenticated) { alert("Auth required"); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    const orig = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    try {
        const className = document.getElementById('className').value;
        const name = document.getElementById('studentName').value.trim();
        const fatherName = document.getElementById('fatherName').value.trim();
        const mobile = document.getElementById('mobile').value.trim();
        const roll = parseInt(document.getElementById('roll').value) || 0;
        const age = parseInt(document.getElementById('age').value) || 0;
        const address = document.getElementById('address').value.trim();
        const photo = document.getElementById('photo').value.trim();
        const previousYearBill = parseInt(document.getElementById('previousYearBill').value) || 0;
        const previousYearPaid = document.getElementById('previousYearPaid').checked;
        if (!className || !name || !roll) throw new Error("Required fields missing");
        const monthlyFees = {};
        for (const m of MONTHS) {
            const amount = parseInt(document.getElementById(m+'Amount').value) || 0;
            const paid = document.getElementById(m+'Paid').checked;
            monthlyFees[m] = { amount, paid };
        }
        const data = { name, fatherName, mobile, roll, age, address, photo, monthlyFees, previousYearBill, previousYearPaid, className, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
        if (editingStudentId && currentForm === 'edit') {
            await updateDoc(doc(db,"students",editingStudentId), data);
            alert("Student updated successfully!");
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(db,"students"), data);
            alert("Student added successfully!");
        }
        hideAddStudentForm();
        if (editingClass && className === editingClass) loadStudents(editingClass);
        else loadStudents(className);
    } catch(err) { alert(err.message); } finally { btn.disabled = false; btn.innerHTML = orig; }
}

window.deleteStudent = async function(studentId, studentName) {
    if (confirm(`Delete ${studentName}?`)) {
        await deleteDoc(doc(db,"students",studentId));
        alert("Student deleted successfully!");
        if (editingClass) loadStudents(editingClass);
    }
};

// Initialize
showCustomLoading("Initializing KVM Classes...");
setTimeout(() => {
    if (authSection.style.display !== 'flex' && mainApp.style.display !== 'block') {
        showAuthSection();
        hideLoadingScreen();
    }
}, 3000);
