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

// Previous Years for previous year fees
const PREVIOUS_YEARS = ['2022-2023', '2023-2024', '2024-2025'];

// ======================
// SHARE FUNCTIONALITY
// ======================

function shareStudent(studentId, studentName) {
    // Create shareable URL
    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?student=${studentId}`;
    
    // Check if Web Share API is available (mobile)
    if (navigator.share) {
        navigator.share({
            title: `${studentName} - Student Profile`,
            text: `View ${studentName}'s profile and fee details`,
            url: shareUrl
        }).catch(err => {
            console.log('Share cancelled or failed:', err);
            // Fallback: copy to clipboard
            copyToClipboard(shareUrl, studentName);
        });
    } else {
        // Desktop fallback: copy to clipboard
        copyToClipboard(shareUrl, studentName);
    }
}

function copyToClipboard(text, studentName) {
    navigator.clipboard.writeText(text).then(() => {
        alert(`Shareable link for ${studentName} copied to clipboard!\n\nShare this link to allow others to view the profile.`);
    }).catch(() => {
        prompt(`Copy this link to share ${studentName}'s profile:`, text);
    });
}

// Function to load student from URL parameter
function loadStudentFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('student');
    const className = urlParams.get('class');
    
    if (studentId) {
        // Load single student view
        loadSingleStudentPage(studentId);
        return true;
    } else if (className) {
        // Load class view
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
            editingClass = student.className;
            
            // Hide class buttons and show back button
            classButtons.style.display = 'none';
            
            // Display student detail in full page mode
            displayFullStudentPage(student);
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
    
    // Calculate totals
    const { totalPaid, totalFee, previousYearBreakdown, currentYearBreakdown } = calculateFeeDetails(student);
    
    studentList.innerHTML = `
        <div class="full-student-page">
            <div class="page-header">
                <button class="button button-secondary" onclick="goBack()">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <button class="button button-primary" onclick="shareStudent('${student.id}', '${student.name}')">
                    <i class="fas fa-share-alt"></i> Share Profile
                </button>
            </div>
            
            <div class="student-profile-card">
                <div class="student-header-full">
                    <img src="${photoUrl}" alt="${student.name}" 
                         onerror="handleImageError(this, '${student.name.replace(/'/g, "\\'")}')">
                    <div class="student-info-full">
                        <h2>${student.name}</h2>
                        <p><strong>Class:</strong> ${student.className}</p>
                        <p><strong>Roll Number:</strong> ${student.roll}</p>
                        <p><strong>Father's Name:</strong> ${student.fatherName || "Not specified"}</p>
                        <p><strong>Mobile:</strong> ${student.mobile || "Not specified"}</p>
                        <p><strong>Address:</strong> ${student.address || "Not specified"}</p>
                    </div>
                </div>
                
                <div class="fee-summary-full">
                    <h3><i class="fas fa-rupee-sign"></i> Fee Summary</h3>
                    <div class="summary-stats">
                        <div class="stat-card">
                            <span class="stat-label">Total Paid</span>
                            <span class="stat-value paid">₹${totalPaid}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Total Fee</span>
                            <span class="stat-value">₹${totalFee}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Balance</span>
                            <span class="stat-value ${totalFee - totalPaid > 0 ? 'due' : 'paid'}">₹${totalFee - totalPaid}</span>
                        </div>
                    </div>
                </div>
                
                ${previousYearBreakdown.length > 0 ? `
                    <div class="fee-section-full">
                        <h3><i class="fas fa-calendar-alt"></i> Previous Year Fees</h3>
                        ${previousYearBreakdown.map(item => `
                            <div class="year-fee-group">
                                <h4>${item.year}</h4>
                                ${item.months.map(m => `
                                    <div class="fee-item">
                                        <span>${m.month}</span>
                                        <span>₹${m.amount}</span>
                                    </div>
                                `).join('')}
                                <div class="year-total">Total: ₹${item.total}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="fee-section-full">
                    <h3><i class="fas fa-calendar-check"></i> Current Year Fees (${new Date().getFullYear()}-${new Date().getFullYear() + 1})</h3>
                    <div class="monthly-fees-full">
                        ${currentYearBreakdown.map(item => `
                            <div class="fee-item">
                                <span>${item.month}</span>
                                <span>₹${item.amount}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="year-total">Total: ₹${currentYearBreakdown.reduce((sum, m) => sum + m.amount, 0)}</div>
                </div>
            </div>
        </div>
    `;
    
    studentDetail.innerHTML = '';
    hideAddStudentForm();
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
}

async function loadClassPage(className) {
    showLoadingScreen();
    editingClass = className;
    classButtons.style.display = 'none';
    await loadStudents(className);
}

function goBack() {
    // Clear URL parameters
    window.history.pushState({}, document.title, window.location.pathname);
    // Reset to home view
    classButtons.style.display = 'block';
    renderClasses();
}

// ======================
// FEE CALCULATION FUNCTIONS
// ======================

function calculateFeeDetails(student) {
    const monthlyFees = student.monthlyFees || {};
    const previousYearFees = student.previousYearFees || {}; // New structure for previous year month-wise fees
    const previousDues = student.previousDues || 0;
    
    let totalPaid = 0;
    let totalFee = 0;
    let previousYearBreakdown = [];
    let currentYearBreakdown = [];
    
    // Calculate current year fees (total fee for the year)
    MONTHS.forEach(month => {
        const amount = monthlyFees[month] || 0;
        if (amount > 0) {
            currentYearBreakdown.push({
                month: MONTH_NAMES[MONTHS.indexOf(month)],
                amount: amount
            });
            totalFee += amount;
        }
    });
    
    // Calculate previous year fees
    if (previousYearFees && Object.keys(previousYearFees).length > 0) {
        for (const [year, months] of Object.entries(previousYearFees)) {
            const yearMonths = [];
            let yearTotal = 0;
            for (const [month, amount] of Object.entries(months)) {
                if (amount > 0) {
                    yearMonths.push({
                        month: month,
                        amount: amount
                    });
                    yearTotal += amount;
                    totalPaid += amount;
                }
            }
            if (yearMonths.length > 0) {
                previousYearBreakdown.push({
                    year: year,
                    months: yearMonths,
                    total: yearTotal
                });
            }
        }
    }
    
    // Add previous dues to paid amount (if they were paid)
    totalPaid += previousDues;
    
    return { totalPaid, totalFee, previousYearBreakdown, currentYearBreakdown };
}

// ======================
// IMAGE HANDLING FUNCTIONS
// ======================

function handleImageError(imgElement, studentName) {
    console.log("Image failed to load, using default avatar for:", studentName);
    imgElement.src = getDefaultAvatar(studentName);
    imgElement.onerror = null;
}

function optimizeDrivePhotoUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return '';
    }
    
    let cleanUrl = url.trim();
    let fileId = null;
    
    const pattern1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const pattern2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const pattern3 = /^([a-zA-Z0-9_-]{25,})$/;
    
    if (pattern1.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern1)[1];
    } else if (pattern2.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern2)[1];
    } else if (pattern3.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern3)[1];
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
// AUTHENTICATION STATE MANAGEMENT
// ======================

onAuthStateChanged(auth, async (user) => {
    showLoadingScreen();
    
    if (user) {
        currentUser = user;
        console.log("✅ User authenticated:", user.email);
        isAdminAuthenticated = true;
        
        // Check if loading a shared student profile
        const hasSharedView = loadStudentFromURL();
        
        if (!hasSharedView) {
            showMainApp();
            renderClasses();
        }
    } else {
        console.log("❌ No user signed in");
        currentUser = null;
        isAdminAuthenticated = false;
        
        // Check if loading a shared student profile (public view)
        const hasSharedView = loadStudentFromURL();
        
        if (!hasSharedView) {
            showAuthSection();
        }
    }
});

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

function showNonAdminMessage() {
    nonAdminMessage.style.display = 'flex';
    loadingScreen.style.display = 'none';
    authSection.style.display = 'none';
    mainApp.style.display = 'none';
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
        console.error("❌ Login error:", error.code);
        showLoginError(getAuthErrorMessage(error.code));
        showLoginLoading(false);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("✅ User signed out successfully");
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
    
    studentList.innerHTML = `<div class="empty-state"></div>`;
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
                <div class="card" onclick="navigateToClass('${className}')">
                    <i class="fas fa-users"></i>
                    <h3>${className}</h3>
                    <p>View Students</p>
                </div>
            `).join('')}
        </div>
    `;
}

function navigateToClass(className) {
    // Navigate to class page with URL parameter
    window.location.href = `?class=${encodeURIComponent(className)}`;
}

function navigateToStudent(studentId) {
    // Navigate to student page with URL parameter
    window.location.href = `?student=${studentId}`;
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
                            <span class="student-name-text">${student.name}</span>
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

async function loadStudentDetail(studentId) {
    // Navigate to student page
    navigateToStudent(studentId);
}

// ======================
// STUDENT MANAGEMENT FUNCTIONS
// ======================

function showAddStudentForm(isEditMode = false) {
    console.log("Showing add student form. Edit mode:", isEditMode);
    
    addStudentForm.innerHTML = '';
    
    const classOptions = CLASSES.map(cls => {
        const selected = cls === editingClass ? 'selected' : '';
        return `<option value="${cls}" ${selected}>${cls}</option>`;
    }).join('');
    
    // Generate previous year fee fields
    const previousYearFields = PREVIOUS_YEARS.map(year => `
        <div class="previous-year-group">
            <h4>${year}</h4>
            <div class="monthly-fee-grid">
                ${MONTH_NAMES.map(month => `
                    <div class="fee-input-group">
                        <label for="${year}_${month}">${month}</label>
                        <input type="number" id="${year}_${month}" placeholder="₹0" min="0" value="0">
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
    
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
                    <input type="tel" id="mobile" placeholder="Enter mobile number" pattern="[0-9]{10}">
                </div>
                
                <div class="form-field">
                    <label for="roll">Roll Number *</label>
                    <input type="number" id="roll" placeholder="Enter roll number" required min="1">
                </div>
                
                <div class="form-field">
                    <label for="age">Age</label>
                    <input type="number" id="age" placeholder="Enter age" max="20">
                </div>
                
                <div class="form-field">
                    <label for="address">Address</label>
                    <textarea id="address" placeholder="Enter address" rows="3"></textarea>
                </div>
                
                <div class="form-field">
                    <label for="photo">Photo URL (Google Drive link supported)</label>
                    <input type="url" id="photo" placeholder="https://drive.google.com/file/d/...">
                    <small class="form-help">
                        Tip: Use Google Drive links like: https://drive.google.com/file/d/1pk253VPRHyFetwwh0hPFEuPRlSSOGAQN/view
                    </small>
                </div>

                <!-- Previous Year Monthly Fees Section -->
                <div class="fee-form-section">
                    <h3><i class="fas fa-history"></i> Previous Year Monthly Fees</h3>
                    ${previousYearFields}
                </div>

                <!-- Current Year Monthly Fees Section -->
                <div class="fee-form-section">
                    <h3><i class="fas fa-calendar-alt"></i> Current Year Monthly Fees</h3>
                    <div class="monthly-fee-grid">
                        ${MONTH_NAMES.map((month, index) => `
                            <div class="fee-input-group">
                                <label for="${MONTHS[index]}Fee">${month}</label>
                                <input type="number" id="${MONTHS[index]}Fee" placeholder="₹0" min="0" value="0">
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button type="submit" class="button button-primary" id="submitButton">
                        <i class="fas fa-save"></i>
                        <span id="saveButtonText">${isEditMode ? 'Update Student' : 'Add Student'}</span>
                    </button>
                    <button type="button" class="button button-warning" onclick="hideAddStudentForm()">
                        <i class="fas fa-times"></i>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    currentForm = isEditMode ? 'edit' : 'add';
    
    const studentForm = document.getElementById('studentForm');
    studentForm.removeEventListener('submit', handleFormSubmit);
    studentForm.addEventListener('submit', handleFormSubmit);
    
    addStudentForm.style.display = 'block';
    addStudentForm.scrollIntoView({ behavior: 'smooth' });
}

function hideAddStudentForm() {
    addStudentForm.style.display = 'none';
    addStudentForm.innerHTML = '';
    editingStudentId = null;
    currentForm = null;
}

window.showAddStudentForm = showAddStudentForm;
window.hideAddStudentForm = hideAddStudentForm;

async function editStudent(studentId) {
    console.log("Editing student:", studentId);
    editingStudentId = studentId;
    
    try {
        const studentRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            editingClass = student.className;
            
            showAddStudentForm(true);
            
            setTimeout(() => {
                populateEditForm(student);
            }, 100);
        }
    } catch (error) {
        console.error("Error loading student for editing:", error);
        alert("Error loading student: " + error.message);
    }
}

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
        
        // Populate current year monthly fees
        const monthlyFees = student.monthlyFees || {};
        MONTHS.forEach(month => {
            const input = document.getElementById(month + 'Fee');
            if (input) {
                input.value = monthlyFees[month] || 0;
            }
        });
        
        // Populate previous year fees
        const previousYearFees = student.previousYearFees || {};
        for (const [year, months] of Object.entries(previousYearFees)) {
            for (const [month, amount] of Object.entries(months)) {
                const inputId = `${year}_${month}`;
                const input = document.getElementById(inputId);
                if (input) {
                    input.value = amount || 0;
                }
            }
        }
        
        console.log("✅ Edit form populated successfully");
        
    } catch (error) {
        console.error("Error populating edit form:", error);
        alert("Error loading form data. Please try again.");
    }
}

window.editStudent = editStudent;

async function handleFormSubmit(e) {
    e.preventDefault();
    console.log("Handling form submit... Mode:", currentForm);
    
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const className = document.getElementById('className').value;
        const name = document.getElementById('studentName').value.trim();
        const fatherName = document.getElementById('fatherName').value.trim();
        const mobile = document.getElementById('mobile').value.trim();
        const roll = parseInt(document.getElementById('roll').value) || 0;
        const age = parseInt(document.getElementById('age').value) || 0;
        const address = document.getElementById('address').value.trim();
        const photo = document.getElementById('photo').value.trim();

        if (!className || !name || !roll) {
            alert("Please fill in all required fields (Class, Name, Roll).");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        if (roll <= 0) {
            alert("Please enter a valid roll number.");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Collect current year monthly fees
        const monthlyFees = {};
        MONTHS.forEach(month => {
            const input = document.getElementById(month + 'Fee');
            if (input) {
                monthlyFees[month] = parseInt(input.value) || 0;
            }
        });
        
        // Collect previous year fees
        const previousYearFees = {};
        PREVIOUS_YEARS.forEach(year => {
            const yearFees = {};
            MONTH_NAMES.forEach(month => {
                const input = document.getElementById(`${year}_${month}`);
                if (input) {
                    const amount = parseInt(input.value) || 0;
                    if (amount > 0) {
                        yearFees[month] = amount;
                    }
                }
            });
            if (Object.keys(yearFees).length > 0) {
                previousYearFees[year] = yearFees;
            }
        });

        const studentData = {
            name,
            fatherName,
            mobile,
            roll,
            age,
            address,
            photo,
            monthlyFees,
            previousYearFees, // New field for previous year month-wise fees
            className: className,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };

        if (editingStudentId && currentForm === 'edit') {
            const studentRef = doc(db, "students", editingStudentId);
            await updateDoc(studentRef, studentData);
            alert("Student updated successfully!");
        } else {
            studentData.createdAt = serverTimestamp();
            studentData.createdBy = currentUser.uid;
            const studentsRef = collection(db, "students");
            await addDoc(studentsRef, studentData);
            alert("Student added successfully!");
        }

        hideAddStudentForm();
        
        if (editingClass && className === editingClass) {
            loadStudents(editingClass);
        } else if (className) {
            editingClass = className;
            loadStudents(className);
        } else {
            renderClasses();
        }
        
    } catch (error) {
        console.error("❌ Error saving student:", error);
        alert("Error saving student: " + error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

async function deleteStudent(studentId, studentName) {
    if (!confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
        return;
    }

    try {
        const studentRef = doc(db, "students", studentId);
        await deleteDoc(studentRef);
        alert(`${studentName} has been deleted successfully.`);
        
        if (editingClass) {
            loadStudents(editingClass);
        }
    } catch (error) {
        console.error("Error deleting student:", error);
        alert("Error deleting student: " + error.message);
    }
}

window.deleteStudent = deleteStudent;

// ======================
// SEARCH AND FILTER FUNCTIONS
// ======================

function filterStudents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
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
}

window.filterStudents = filterStudents;

// ======================
// GLOBAL FUNCTION EXPORTS
// ======================

window.renderClasses = renderClasses;
window.loadStudents = loadStudents;
window.loadStudentDetail = loadStudentDetail;
window.goBack = goBack;
window.handleImageError = handleImageError;
window.shareStudent = shareStudent;
window.navigateToClass = navigateToClass;
window.navigateToStudent = navigateToStudent;

// ======================
// INITIALIZE APP
// ======================

document.addEventListener('DOMContentLoaded', () => {
    console.log("KVM Classes Student Management System initialized");
    showLoadingScreen();
    
    // Handle popstate for back/forward navigation
    window.addEventListener('popstate', () => {
        if (window.location.search === '') {
            classButtons.style.display = 'block';
            renderClasses();
        } else {
            loadStudentFromURL();
        }
    });
});
