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

// Initialize Firebase
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
const nonAdminMessage = document.getElementById("nonAdminMessage");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginLoading = document.getElementById("loginLoading");
const logoutButton = document.getElementById("logoutButton");
const classButtons = document.getElementById("class-buttons");
const studentList = document.getElementById("studentList");
const studentDetail = document.getElementById("studentDetail");
const addStudentForm = document.getElementById("addStudentForm");

// Updated class list
const CLASSES = [
    "Class 3 and 4",
    "Class 5", 
    "Class 6", 
    "Class 7", 
    "Class 8",
    "Class 9",
    "Class 10"
];

// Months for fee structure
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENT_YEAR = new Date().getFullYear();
const NEXT_YEAR = CURRENT_YEAR + 1;

// ======================
// IMAGE HANDLING FUNCTIONS
// ======================

window.handleImageError = function(imgElement, studentName) {
    imgElement.src = getDefaultAvatar(studentName);
    imgElement.onerror = null;
};

function optimizeDrivePhotoUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return '';
    }
    let cleanUrl = url.trim();
    let fileId = null;
    const pattern1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const pattern2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    if (pattern1.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern1)[1];
    } else if (pattern2.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern2)[1];
    }
    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return cleanUrl;
}

function getDefaultAvatar(name) {
    if (!name) name = '';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=150&bold=true`;
}

function getStudentPhotoUrl(student) {
    if (!student) return getDefaultAvatar('');
    if (student.photo && student.photo.trim() !== '') {
        const optimizedUrl = optimizeDrivePhotoUrl(student.photo.trim());
        return optimizedUrl || getDefaultAvatar(student.name);
    }
    return getDefaultAvatar(student.name || '');
}

// ======================
// FEE HELPERS
// ======================

function normalizeMonthlyFees(oldFees) {
    if (!oldFees) return {};
    const newFees = {};
    for (const month of MONTHS) {
        const val = oldFees[month];
        if (val === undefined || val === null) {
            newFees[month] = { amount: 0, paid: false };
        } else if (typeof val === 'number') {
            newFees[month] = { amount: val, paid: false };
        } else if (typeof val === 'object' && val !== null) {
            newFees[month] = { amount: val.amount || 0, paid: val.paid === true };
        } else {
            newFees[month] = { amount: 0, paid: false };
        }
    }
    return newFees;
}

function calculateFeeTotals(monthlyFees) {
    let totalFee = 0;
    let totalPaid = 0;
    for (const month of MONTHS) {
        const feeObj = monthlyFees[month] || { amount: 0, paid: false };
        const amount = feeObj.amount || 0;
        totalFee += amount;
        if (feeObj.paid) totalPaid += amount;
    }
    return { totalFee, totalPaid };
}

// ======================
// PDF SHARE FUNCTION
// ======================

window.shareStudentAsPDF = function(student) {
    const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
    const previousYearBill = student.previousYearBill || 0;
    const previousDues = student.previousDues || 0;
    const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
    const totalPaid = monthlyPaid + previousYearBill + previousDues;
    const balance = totalFee - monthlyPaid;
    
    let rows = '';
    for (let i = 0; i < MONTHS.length; i++) {
        const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: false };
        if (f.amount > 0) {
            rows += `<tr><td>${MONTH_NAMES[i]}</td><td>₹${f.amount}</td><td>${f.paid ? '✓ Paid' : '✗ Not Paid'}</td></tr>`;
        }
    }
    if (!rows) rows = '<tr><td colspan="3">No fees recorded</td></tr>';
    
    const photoUrl = getStudentPhotoUrl(student);
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    element.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img src="${photoUrl}" style="width: 100px; height: 100px; border-radius: 50%;" onerror="this.src='${getDefaultAvatar(student.name)}'">
            <h2>${student.name}</h2>
            <p><strong>Class:</strong> ${student.className} | <strong>Roll No:</strong> ${student.roll}</p>
        </div>
        <div style="margin-bottom: 20px;">
            <h3>Personal Information</h3>
            <p><strong>Father's Name:</strong> ${student.fatherName || 'Not specified'}</p>
            <p><strong>Mobile:</strong> ${student.mobile || 'Not specified'}</p>
            <p><strong>Age:</strong> ${student.age || 'Not specified'}</p>
            <p><strong>Address:</strong> ${student.address || 'Not specified'}</p>
        </div>
        <div style="margin-bottom: 20px;">
            <h3>Fee Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td><strong>Total Paid:</strong></td><td>₹${totalPaid}</td></tr>
                <tr><td><strong>Total Fee:</strong></td><td>₹${totalFee}</td></tr>
                <tr><td><strong>Balance:</strong></td><td>₹${balance}</td></tr>
            </table>
        </div>
        ${previousYearBill > 0 ? `<div><h3>Previous Year Bill</h3><p>₹${previousYearBill}</p></div>` : ''}
        ${previousDues > 0 ? `<div><h3>Additional Dues</h3><p>₹${previousDues}</p></div>` : ''}
        <div>
            <h3>Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3>
            <table border="1" style="width: 100%; border-collapse: collapse;">
                <thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
    
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${student.name}_profile.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
};

// ======================
// URL NAVIGATION FUNCTIONS
// ======================

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
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('student');
    const className = urlParams.get('class');
    if (studentId) {
        loadSingleStudentPage(studentId);
        return true;
    } else if (className) {
        loadClassPage(className);
        return true;
    }
    return false;
}

async function loadSingleStudentPage(studentId) {
    showLoadingScreen();
    try {
        const studentRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            student.id = studentId;
            editingClass = student.className;
            classButtons.style.display = 'none';
            displayFullStudentPage(student);
            showMainApp();
        } else {
            showErrorPage("Student not found");
        }
    } catch (error) {
        console.error("Error loading student:", error);
        showErrorPage("Error loading student profile");
    }
}

function displayFullStudentPage(student) {
    const photoUrl = getStudentPhotoUrl(student);
    const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
    const previousYearBill = student.previousYearBill || 0;
    const previousDues = student.previousDues || 0;
    const { totalFee, totalPaid: monthlyPaid } = calculateFeeTotals(monthlyFees);
    const totalPaid = monthlyPaid + previousYearBill + previousDues;
    const balance = totalFee - monthlyPaid;
    
    let currentYearHTML = '';
    for (let i = 0; i < MONTHS.length; i++) {
        const f = monthlyFees[MONTHS[i]] || { amount: 0, paid: false };
        if (f.amount > 0) {
            currentYearHTML += `
                <div style="background: var(--color-surface); padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span><strong>${MONTH_NAMES[i]}</strong></span>
                    <span>₹${f.amount}</span>
                    <span>${f.paid ? '✅ Paid' : '❌ Not Paid'}</span>
                </div>
            `;
        }
    }
    if (!currentYearHTML) currentYearHTML = '<p>No fees recorded for current year</p>';
    
    studentList.innerHTML = `
        <div class="full-student-page">
            <div class="page-header" style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 10px; flex-wrap: wrap;">
                <button class="button button-secondary" onclick="goBack()"><i class="fas fa-arrow-left"></i> Back</button>
                <button class="button button-warning" onclick="editStudent('${student.id}')"><i class="fas fa-edit"></i> Edit</button>
                <button class="button button-danger" onclick="deleteStudent('${student.id}', '${student.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i> Delete</button>
                <button class="button button-primary" onclick="shareStudentAsPDF(${JSON.stringify(student).replace(/</g, '\\u003c')})"><i class="fas fa-file-pdf"></i> Download PDF</button>
            </div>
            <div class="student-profile-card" style="background: var(--color-surface); border-radius: 12px; overflow: hidden;">
                <div class="student-header-full" style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-hover)); color: white; padding: 24px; text-align: center;">
                    <img src="${photoUrl}" alt="${student.name}" onerror="handleImageError(this, '${student.name.replace(/'/g, "\\'")}')" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; border: 4px solid white; margin-bottom: 16px;">
                    <h2 style="color: white;">${student.name}</h2>
                    <p><strong>Class:</strong> ${student.className} | <strong>Roll:</strong> ${student.roll}</p>
                </div>
                <div style="padding: 24px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
                        <div class="info-item"><strong>Father's Name:</strong> ${student.fatherName || "Not specified"}</div>
                        <div class="info-item"><strong>Mobile:</strong> ${student.mobile || "Not specified"}</div>
                        <div class="info-item"><strong>Age:</strong> ${student.age || "Not specified"}</div>
                        <div class="info-item"><strong>Address:</strong> ${student.address || "Not specified"}</div>
                    </div>
                    <div class="fee-summary-full" style="background: var(--color-secondary); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                        <h3 style="margin-bottom: 16px;"><i class="fas fa-rupee-sign"></i> Fee Summary</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px;">
                            <div style="background: var(--color-surface); padding: 16px; border-radius: 8px; text-align: center;">
                                <span style="display: block; color: var(--color-text-secondary); font-size: 14px;">Total Paid</span>
                                <span style="font-size: 24px; font-weight: bold; color: #10b981;">₹${totalPaid}</span>
                            </div>
                            <div style="background: var(--color-surface); padding: 16px; border-radius: 8px; text-align: center;">
                                <span style="display: block; color: var(--color-text-secondary); font-size: 14px;">Total Fee</span>
                                <span style="font-size: 24px; font-weight: bold;">₹${totalFee}</span>
                            </div>
                            <div style="background: var(--color-surface); padding: 16px; border-radius: 8px; text-align: center;">
                                <span style="display: block; color: var(--color-text-secondary); font-size: 14px;">Balance</span>
                                <span style="font-size: 24px; font-weight: bold; ${balance > 0 ? 'color: #ef4444;' : 'color: #10b981;'}">₹${balance}</span>
                            </div>
                        </div>
                    </div>
                    ${previousYearBill > 0 ? `
                        <div style="background: var(--color-secondary); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                            <h3><i class="fas fa-history"></i> Previous Year Bill</h3>
                            <div class="fee-item" style="display: flex; justify-content: space-between; padding: 12px 0;">
                                <span>Previous Year Outstanding Bill:</span>
                                <span style="font-weight: bold;">₹${previousYearBill}</span>
                            </div>
                        </div>
                    ` : ''}
                    ${previousDues > 0 ? `
                        <div style="background: var(--color-secondary); padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                            <h3><i class="fas fa-calendar-alt"></i> Additional Dues</h3>
                            <div class="fee-item" style="display: flex; justify-content: space-between; padding: 12px 0;">
                                <span>Previous Dues:</span>
                                <span style="font-weight: bold;">₹${previousDues}</span>
                            </div>
                        </div>
                    ` : ''}
                    <div style="background: var(--color-secondary); padding: 20px; border-radius: 12px;">
                        <h3><i class="fas fa-calendar-check"></i> Current Year Fees (${CURRENT_YEAR}-${NEXT_YEAR})</h3>
                        <div style="margin-top: 16px;">${currentYearHTML}</div>
                        <div style="margin-top: 16px; text-align: right;"><strong>Total Fee: ₹${totalFee}</strong></div>
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

function showErrorPage(message) {
    classButtons.style.display = 'none';
    studentList.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="button button-primary" onclick="goBack()">Go Back</button>
        </div>
    `;
    studentDetail.innerHTML = '';
    showMainApp();
}

// ======================
// AUTHENTICATION STATE MANAGEMENT
// ======================

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("✅ User authenticated:", user.email);
        isAdminAuthenticated = true;
        const hasSharedView = loadStudentFromURL();
        if (!hasSharedView) {
            showMainApp();
            renderClasses();
        }
        hideLoadingScreen();
    } else {
        currentUser = null;
        isAdminAuthenticated = false;
        const hasSharedView = loadStudentFromURL();
        if (!hasSharedView) {
            showAuthSection();
        }
        hideLoadingScreen();
    }
});

function hideLoadingScreen() {
    loadingScreen.style.display = 'none';
}

function showLoadingScreen() {
    loadingScreen.style.display = 'flex';
    authSection.style.display = 'none';
    mainApp.style.display = 'none';
    nonAdminMessage.style.display = 'none';
}

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

// Login Functions
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (!email || !password) {
        showLoginError('Please enter both email and password');
        return;
    }
    showLoginLoading(true);
    hideLoginError();
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login error:", error.code);
        showLoginError(getAuthErrorMessage(error.code));
        showLoginLoading(false);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("User signed out successfully");
        goBack();
    } catch (error) {
        console.error("Logout error:", error);
        alert("Error signing out: " + error.message);
    }
});

window.signOut = async () => {
    try {
        await signOut(auth);
        goBack();
    } catch (error) {
        console.error("Sign out error:", error);
    }
};

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

function showLoginError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
}

function hideLoginError() {
    loginError.style.display = 'none';
}

function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return 'Login failed. Please try again.';
    }
}

// ======================
// CORE APPLICATION FUNCTIONS
// ======================

function renderClasses() {
    console.log("Rendering classes...");
    studentList.innerHTML = '';
    studentDetail.innerHTML = '';
    hideAddStudentForm();
    classButtons.style.display = 'block';
    classButtons.innerHTML = `
        <div class="add-student-home-section">
            <h2><i class="fas fa-user-plus"></i> Add New Student</h2>
            <button class='button button-primary' onclick='showAddStudentForm()'>
                <i class="fas fa-plus"></i> Add Student
            </button>
        </div>
        <h2><i class="fas fa-school"></i> Select Class</h2>
        <div class="card-grid">
            ${CLASSES.map(className => `
                <div class="card" onclick="navigateToClass('${className.replace(/'/g, "\\'")}')">
                    <i class="fas fa-users"></i>
                    <h3>${className}</h3>
                    <p>View Students</p>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadStudents(className) {
    console.log("Loading students for class:", className);
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }
    editingClass = className;
    classButtons.style.display = 'none';
    try {
        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("className", "==", className));
        const snapshot = await getDocs(q);
        console.log(`Found ${snapshot.size} students in ${className}`);
        if (snapshot.empty) {
            studentList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>No Students Found</h3>
                    <p>No students found in ${className}</p>
                    <button class="button button-primary" onclick="showAddStudentForm()">
                        <i class="fas fa-plus"></i> Add First Student
                    </button>
                    <button class="button button-secondary" onclick="goBack()" style="margin-top: 10px;">
                        <i class="fas fa-arrow-left"></i> Back to Classes
                    </button>
                </div>
            `;
        } else {
            let studentsHTML = `
                <div class="class-header">
                    <h3><i class="fas fa-users"></i> Students in ${className}</h3>
                    <button class="button button-secondary" onclick="goBack()">
                        <i class="fas fa-arrow-left"></i> Back to Classes
                    </button>
                </div>
                <input type="text" id="searchInput" placeholder="Search students by name or roll number..." 
                       oninput="filterStudents()" class="search-input">
                <div id="studentNames">
            `;
            const students = [];
            snapshot.forEach(doc => {
                students.push({ id: doc.id, ...doc.data() });
            });
            students.sort((a, b) => a.roll - b.roll);
            students.forEach(student => {
                studentsHTML += `
                    <div class="student-name" data-name="${student.name.toLowerCase()}" data-roll="${student.roll}" onclick="navigateToStudent('${student.id}')">
                        <div class="student-info-brief">
                            <span class="student-name-text">${escapeHtml(student.name)}</span>
                            <span class="student-roll">Roll: ${student.roll}</span>
                        </div>
                        <i class="fas fa-chevron-right"></i>
                    </div>
                `;
            });
            studentsHTML += `
                </div>
                <button class="button button-primary" onclick="showAddStudentForm()" style="margin-top: 20px; width: 100%;">
                    <i class="fas fa-plus"></i> Add New Student to ${className}
                </button>
            `;
            studentList.innerHTML = studentsHTML;
        }
        studentDetail.innerHTML = '';
        hideAddStudentForm();
    } catch (error) {
        console.error("Error loading students:", error);
        studentList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Students</h3>
                <p>${error.message}</p>
                <button class="button button-primary" onclick="loadStudents('${className}')">
                    <i class="fas fa-refresh"></i> Try Again
                </button>
                <button class="button button-secondary" onclick="goBack()" style="margin-top: 10px;">
                    <i class="fas fa-arrow-left"></i> Back to Classes
                </button>
            </div>
        `;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.filterStudents = function() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const studentNames = document.querySelectorAll('#studentNames .student-name');
    studentNames.forEach(studentElement => {
        const name = studentElement.dataset.name;
        const roll = studentElement.dataset.roll;
        if (name.includes(searchTerm) || roll.includes(searchTerm)) {
            studentElement.style.display = 'flex';
        } else {
            studentElement.style.display = 'none';
        }
    });
};

// ======================
// STUDENT MANAGEMENT FUNCTIONS
// ======================

window.showAddStudentForm = function(isEditMode = false) {
    console.log("Showing add student form. Edit mode:", isEditMode);
    addStudentForm.innerHTML = '';
    const classOptions = CLASSES.map(cls => {
        const selected = cls === editingClass ? 'selected' : '';
        return `<option value="${cls}" ${selected}>${cls}</option>`;
    }).join('');
    
    let monthlyFields = '';
    for (let i = 0; i < MONTHS.length; i++) {
        monthlyFields += `
            <div class="fee-input-group" style="margin-bottom: 12px; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px;">
                <label><strong>${MONTH_NAMES[i]}</strong></label>
                <div style="display: flex; gap: 10px; align-items: center; margin-top: 8px;">
                    <input type="number" id="${MONTHS[i]}Amount" placeholder="Amount (₹)" min="0" value="0" style="flex: 2;">
                    <label style="display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" id="${MONTHS[i]}Paid"> Paid
                    </label>
                </div>
            </div>
        `;
    }
    
    addStudentForm.innerHTML = `
        <div class="form-container-inner">
            <h2><i class="fas fa-${isEditMode ? 'user-edit' : 'user-plus'}"></i> ${isEditMode ? 'Edit Student' : 'Add New Student'}</h2>
            <form id="studentForm">
                <div class="form-field">
                    <label for="className">Class*</label>
                    <select id="className" required class="form-control">
                        <option value="">-- Select Class --</option>
                        ${classOptions}
                    </select>
                </div>
                <div class="form-field">
                    <label for="studentName">Student Name *</label>
                    <input type="text" id="studentName" placeholder="Enter student name" required>
                </div>
                <div class="form-field">
                    <label for="fatherName">Father's Name</label>
                    <input type="text" id="fatherName" placeholder="Enter father's name">
                </div>
                <div class="form-field">
                    <label for="mobile">Mobile Number</label>
                    <input type="tel" id="mobile" placeholder="Enter mobile number">
                </div>
                <div class="form-field">
                    <label for="roll">Roll Number *</label>
                    <input type="number" id="roll" placeholder="Enter roll number" required min="1">
                </div>
                <div class="form-field">
                    <label for="age">Age</label>
                    <input type="number" id="age" placeholder="Enter age">
                </div>
                <div class="form-field">
                    <label for="address">Address</label>
                    <textarea id="address" placeholder="Enter address" rows="3"></textarea>
                </div>
                <div class="form-field">
                    <label for="photo">Photo URL (Google Drive link supported)</label>
                    <input type="url" id="photo" placeholder="https://drive.google.com/file/d/...">
                    <small class="form-help">Tip: Paste Google Drive share link</small>
                </div>
                <div class="fee-form-section">
                    <h3><i class="fas fa-history"></i> Previous Year Bill</h3>
                    <div class="form-field">
                        <label for="previousYearBill">Previous Year's Month Bill (₹)</label>
                        <input type="number" id="previousYearBill" placeholder="Enter previous year's bill amount" min="0" value="0">
                    </div>
                </div>
                <div class="fee-form-section">
                    <h3><i class="fas fa-calendar-alt"></i> Monthly Fees (Current Year)</h3>
                    ${monthlyFields}
                </div>
                <div class="fee-form-section">
                    <h3><i class="fas fa-rupee-sign"></i> Additional Dues</h3>
                    <div class="form-field">
                        <label for="previousDues">Previous Dues (₹)</label>
                        <input type="number" id="previousDues" placeholder="Enter any additional dues" min="0" value="0">
                    </div>
                </div>
                <div class="action-buttons">
                    <button type="submit" class="button button-primary">
                        <i class="fas fa-save"></i>
                        <span id="saveButtonText">${isEditMode ? 'Update Student' : 'Add Student'}</span>
                    </button>
                    <button type="button" class="button button-warning" onclick="hideAddStudentForm()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    currentForm = isEditMode ? 'edit' : 'add';
    const studentFormElement = document.getElementById('studentForm');
    if (studentFormElement) {
        studentFormElement.removeEventListener('submit', handleFormSubmit);
        studentFormElement.addEventListener('submit', handleFormSubmit);
    }
    addStudentForm.style.display = 'block';
    addStudentForm.scrollIntoView({ behavior: 'smooth' });
};

window.hideAddStudentForm = function() {
    addStudentForm.style.display = 'none';
    addStudentForm.innerHTML = '';
    editingStudentId = null;
    currentForm = null;
};

window.editStudent = async function(studentId) {
    console.log("Editing student:", studentId);
    editingStudentId = studentId;
    try {
        const studentRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            editingClass = student.className;
            showAddStudentForm(true);
            setTimeout(() => populateEditForm(student), 100);
        }
    } catch (error) {
        console.error("Error loading student for editing:", error);
        alert("Error loading student: " + error.message);
    }
};

function populateEditForm(student) {
    try {
        document.getElementById('className').value = student.className || '';
        document.getElementById('studentName').value = student.name || '';
        document.getElementById('fatherName').value = student.fatherName || '';
        document.getElementById('mobile').value = student.mobile || '';
        document.getElementById('roll').value = student.roll || '';
        document.getElementById('age').value = student.age || '';
        document.getElementById('address').value = student.address || '';
        document.getElementById('photo').value = student.photo || '';
        document.getElementById('previousYearBill').value = student.previousYearBill || 0;
        document.getElementById('previousDues').value = student.previousDues || 0;
        
        const monthlyFees = normalizeMonthlyFees(student.monthlyFees);
        for (const month of MONTHS) {
            const amountInput = document.getElementById(month + 'Amount');
            const paidCheckbox = document.getElementById(month + 'Paid');
            if (amountInput) amountInput.value = monthlyFees[month]?.amount || 0;
            if (paidCheckbox) paidCheckbox.checked = monthlyFees[month]?.paid === true;
        }
        console.log("Edit form populated successfully");
    } catch (error) {
        console.error("Error populating edit form:", error);
        alert("Error loading form data. Please try again.");
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }
