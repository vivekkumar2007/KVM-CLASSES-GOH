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
let currentForm = null; // Track current form

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

// Updated class list with all requirements
const CLASSES = [
    "Class 3 and 4",
    "Class 5", 
    "Class 6", 
    "Class 7", 
    "Class 8",
    "Class 9",
    "Class 10"
];

// ======================
// IMAGE ERROR HANDLER - FIXED
// ======================

function handleImageError(imgElement, studentName) {
    console.log("Image failed to load, using default avatar for:", studentName);
    imgElement.src = getDefaultAvatar(studentName);
    imgElement.onerror = null; // Prevent infinite loop
    imgElement.style.objectFit = 'cover';
    imgElement.style.borderRadius = '50%';
}

// ======================
// PHOTO URL HANDLING - FIXED
// ======================

function optimizeDrivePhotoUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return '';
    }
    
    let cleanUrl = url.trim();
    
    // Extract file ID from various Google Drive patterns
    let fileId = null;
    
    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view
    const pattern1 = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    // Pattern 2: https://drive.google.com/open?id=FILE_ID
    const pattern2 = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    // Pattern 3: Just the file ID
    const pattern3 = /^([a-zA-Z0-9_-]{25,})$/;
    
    if (pattern1.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern1)[1];
    } else if (pattern2.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern2)[1];
    } else if (pattern3.test(cleanUrl)) {
        fileId = cleanUrl.match(pattern3)[1];
    }
    
    if (fileId) {
        // Method 1: Try direct embedding (works for some files)
        // return https://drive.google.com/uc?export=view&id=${fileId};
        
        // Method 2: Use embed link (more reliable for images)
        // return `https://drive.google.com/file/d/${fileId}/preview`;
        
        // Method 3: Use thumbnail link (small but reliable)
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    // If not Google Drive, return as-is
    return cleanUrl;
}

function getDefaultAvatar(name) {
    if (!name) name = '';
    const firstname = name.split(' ')[0] || '';
    const lastname = name.split(' ')[1] || '';
    const initials = (firstname.charAt(0) + (lastname.charAt(0) || '')).toUpperCase();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=150&bold=true`;
}

function getStudentPhotoUrl(student) {
    if (!student) {
        return getDefaultAvatar('');
    }
    
    if (student.photo && student.photo.trim() !== '') {
        const optimizedUrl = optimizeDrivePhotoUrl(student.photo.trim());
        console.log("Photo URL optimization:", {
            original: student.photo,
            optimized: optimizedUrl,
            studentName: student.name
        });
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
        
        // For now, allow all authenticated users
        isAdminAuthenticated = true;
        showMainApp();
        renderClasses();
        
    } else {
        console.log("❌ No user signed in");
        currentUser = null;
        isAdminAuthenticated = false;
        showAuthSection();
    }
});

// UI State Management
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

// Authentication Functions
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
        console.log("Attempting login with:", email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login successful:", userCredential.user.email);
        
    } catch (error) {
        console.error("❌ Login error:", error.code, error.message);
        showLoginError(getAuthErrorMessage(error.code));
        showLoginLoading(false);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("✅ User signed out successfully");
    } catch (error) {
        console.error("Logout error:", error);
        alert("Error signing out: " + error.message);
    }
});

// Global sign out function
window.signOut = async () => {
    try {
        await signOut(auth);
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
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact your administrator.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        default:
            return 'Login failed: ' + errorCode;
    }
}

// ======================
// CORE APPLICATION FUNCTIONS
// ======================

function renderClasses() {
    console.log("Rendering classes...");
    
    studentList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-school"></i>
            <h3>Select a Class</h3>
            <p>Please select a class from below to view students</p>
        </div>
    `;
    
    studentDetail.innerHTML = '';
    hideAddStudentForm();
    
    classButtons.style.display = 'block';
    
    classButtons.innerHTML = `
        <h2><i class="fas fa-school"></i> Select Class</h2>
        <div class="card-grid">
            ${CLASSES.map(className => `
                <div class="card" onclick="loadStudents('${className}')">
                    <i class="fas fa-users"></i>
                    <h3>${className}</h3>
                    <p>View Students</p>
                </div>
            `).join('')}
        </div>
        
        <!-- Add Student Button at Home -->
        <div class="add-student-home-section">
            <h2><i class="fas fa-user-plus"></i> Add New Student</h2>
            <button class='button button-primary' onclick='showAddStudentForm()'>
                <i class="fas fa-plus"></i> Add Student
            </button>
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
    
    // Hide class buttons when viewing a specific class (Feature 4)
    classButtons.style.display = 'none';
    
    try {
        // Query students by class name
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
                    <button class="button button-secondary" onclick="showAllClasses()" style="margin-top: 10px;">
                        <i class="fas fa-arrow-left"></i> Back to Classes
                    </button>
                </div>
            `;
        } else {
            let studentsHTML = `
                <div class="class-header">
                    <h3><i class="fas fa-users"></i> Students in ${className}</h3>
                    <button class="button button-secondary" onclick="showAllClasses()">
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
            
            // Sort students by roll number
            students.sort((a, b) => a.roll - b.roll);
            
            students.forEach(student => {
                studentsHTML += `
                    <div class="student-name" data-name="${student.name.toLowerCase()}" data-roll="${student.roll}" onclick="loadStudentDetail('${student.id}')">
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
                <button class="button button-secondary" onclick="showAllClasses()" style="margin-top: 10px;">
                    <i class="fas fa-arrow-left"></i> Back to Classes
                </button>
            </div>
        `;
    }
}

function showAllClasses() {
    console.log("Showing all classes...");
    classButtons.style.display = 'block';
    renderClasses();
}

async function loadStudentDetail(studentId) {
    console.log("Loading student detail:", studentId);
    
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }

    try {
        const studentRef = doc(db, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            const photoUrl = getStudentPhotoUrl(student);
            
            // Calculate total fees and dues
            const monthlyFees = student.monthlyFees || {};
            const previousDues = student.previousDues || 0;
            
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            
            let monthlyFeesTotal = 0;
            let monthlyFeesHTML = '';
            
            months.forEach((month, index) => {
                const fee = monthlyFees[month] || 0;
                monthlyFeesTotal += fee;
                if (fee > 0) {
                    monthlyFeesHTML += `
                        <div class="fee-item">
                            <span>${monthNames[index]}</span>
                            <span>₹${fee}</span>
                        </div>
                    `;
                }
            });
            
            const totalDues = monthlyFeesTotal + previousDues;
            
            studentDetail.innerHTML = `
                <div id="studentDetailCard">
                    <div class="student-header">
                        <img src="${photoUrl}" alt="${student.name}" 
                             onerror="handleImageError(this, '${student.name.replace(/'/g, "\\'")}')" 
                             style="width: 150px; height: 150px; object-fit: cover; border-radius: 50%;">
                        <div class="student-basic-info">
                            <h2>${student.name}</h2>
                            <p><strong>Class:</strong> ${student.className || editingClass}</p>
                            <p><strong>Roll Number:</strong> ${student.roll}</p>
                        </div>
                    </div>
                    
                    <div class="student-info">
                        <h3><i class="fas fa-info-circle"></i> Personal Information</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <strong>Father's Name:</strong>
                                <span>${student.fatherName || "Not specified"}</span>
                            </div>
                            <div class="info-item">
                                <strong>Mobile:</strong>
                                <span>${student.mobile || "Not specified"}</span>
                            </div>
                            <div class="info-item">
                                <strong>Age:</strong>
                                <span>${student.age} years</span>
                            </div>
                            <div class="info-item">
                                <strong>Address:</strong>
                                <span>${student.address || "Not specified"}</span>
                            </div>
                        </div>
                    </div>

                    ${totalDues > 0 ? `
                        <div class="fee-section">
                            <h3><i class="fas fa-rupee-sign"></i> Fee Information</h3>
                            
                            <div class="fee-summary">
                                <div class="fee-total">
                                    <span>Total Outstanding Amount:</span>
                                    <span>₹${totalDues}</span>
                                </div>
                                ${previousDues > 0 ? `
                                    <div class="fee-item">
                                        <span>Previous Year's Dues:</span>
                                        <span>₹${previousDues}</span>
                                    </div>
                                ` : ''}
                                ${monthlyFeesTotal > 0 ? `
                                    <div class="fee-item">
                                        <span>Current Year Fees:</span>
                                        <span>₹${monthlyFeesTotal}</span>
                                    </div>
                                ` : ''}
                            </div>

                            ${monthlyFeesHTML ? `
                                <h4>Monthly Fee Breakdown</h4>
                                <div class="monthly-fees">
                                    ${monthlyFeesHTML}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <div class="action-buttons">
                        <button class="button button-warning" onclick="editStudent('${studentId}')">
                            <i class="fas fa-edit"></i>
                            Edit Student
                        </button>
                        <button class="button button-danger" onclick="deleteStudent('${studentId}', '${student.name}')">
                            <i class="fas fa-trash"></i>
                            Delete Student
                        </button>
                        <button class="button button-primary" onclick="loadStudents('${editingClass}')">
                            <i class="fas fa-arrow-left"></i>
                            Back to ${editingClass}
                        </button>
                    </div>
                </div>
            `;
        } else {
            studentDetail.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>Student Not Found</h3>
                    <p>The requested student could not be found.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading student details:", error);
        studentDetail.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Student</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// ======================
// STUDENT MANAGEMENT FUNCTIONS - FIXED EDIT ISSUES
// ======================

function showAddStudentForm(isEditMode = false) {
    console.log("Showing add student form. Edit mode:", isEditMode);
    
    // Clear any existing form
    addStudentForm.innerHTML = '';
    
    // Generate class selection dropdown
    const classOptions = CLASSES.map(cls => {
        const selected = cls === editingClass ? 'selected' : '';
        return `<option value="${cls}" ${selected}>${cls}</option>`;
    }).join('');
    
    addStudentForm.innerHTML = `
        <div class="form-container-inner">
            <h2><i class="fas fa-${isEditMode ? 'user-edit' : 'user-plus'}"></i> ${isEditMode ? 'Edit Student' : 'Add New Student'}</h2>
            
            <form id="studentForm">
                <!-- Feature 3: Class selection as first field -->
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
                    <label for="age">Age *</label>
                    <input type="number" id="age" placeholder="Enter age" required min="5" max="20">
                </div>
                
                <div class="form-field">
                    <label for="address">Address</label>
                    <textarea id="address" placeholder="Enter address" rows="3"></textarea>
                </div>
                
                <!-- Feature 1: Optimized Google Drive Photo URL -->
                <div class="form-field">
                    <label for="photo">Photo URL (Google Drive link supported)</label>
                    <input type="url" id="photo" placeholder="https://drive.google.com/file/d/...">
                    <small class="form-help">
                        Tip: Use Google Drive links like: https://drive.google.com/file/d/1pk253VPRHyFetwwh0hPFEuPRlSSOGAQN/view
                        <br>Direct link will be automatically converted for display.
                    </small>
                </div>

                <!-- Fee Section -->
                <div class="fee-form-section">
                    <h4>Monthly Fee Structure</h4>
                    <div class="monthly-fee-grid">
                        ${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map(month => `
                            <div class="fee-input-group">
                                <label for="${month}Fee">${month.charAt(0).toUpperCase() + month.slice(1)}</label>
                                <input type="number" id="${month}Fee" placeholder="₹0" min="0" value="0">
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="form-field">
                        <label for="previousDues">Previous Year's Dues</label>
                        <input type="number" id="previousDues" value="0" min="0">
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
    
    // Store the current mode
    currentForm = isEditMode ? 'edit' : 'add';
    
    // Set up form submit event
    const studentForm = document.getElementById('studentForm');
    studentForm.removeEventListener('submit', handleFormSubmit); // Remove old listener
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
            
            // Show the form in edit mode
            showAddStudentForm(true);
            
            // Wait for form to render, then populate data
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
        // Safely populate form fields
        const classNameSelect = document.getElementById('className');
        const studentNameInput = document.getElementById('studentName');
        const fatherNameInput = document.getElementById('fatherName');
        const mobileInput = document.getElementById('mobile');
        const rollInput = document.getElementById('roll');
        const ageInput = document.getElementById('age');
        const addressInput = document.getElementById('address');
        const photoInput = document.getElementById('photo');
        const previousDuesInput = document.getElementById('previousDues');
        
        if (classNameSelect) classNameSelect.value = student.className || '';
        if (studentNameInput) studentNameInput.value = student.name || '';
        if (fatherNameInput) fatherNameInput.value = student.fatherName || '';
        if (mobileInput) mobileInput.value = student.mobile || '';
        if (rollInput) rollInput.value = student.roll || '';
        if (ageInput) ageInput.value = student.age || '';
        if (addressInput) addressInput.value = student.address || '';
        if (photoInput) photoInput.value = student.photo || '';
        if (previousDuesInput) previousDuesInput.value = student.previousDues || 0;
        
        // Populate monthly fees
        const monthlyFees = student.monthlyFees || {};
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        months.forEach(month => {
            const input = document.getElementById(month + 'Fee');
            if (input) {
                input.value = monthlyFees[month] || 0;
            }
        });
        
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

    // Disable submit button to prevent double submission
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        // Get form values
        const className = document.getElementById('className').value;
        const name = document.getElementById('studentName').value.trim();
        const fatherName = document.getElementById('fatherName').value.trim();
        const mobile = document.getElementById('mobile').value.trim();
        const roll = parseInt(document.getElementById('roll').value) || 0;
        const age = parseInt(document.getElementById('age').value) || 0;
        const address = document.getElementById('address').value.trim();
        const photo = document.getElementById('photo').value.trim();
        const previousDues = parseInt(document.getElementById('previousDues').value) || 0;

        // Validation
        if (!className || !name || !roll || !age) {
            alert("Please fill in all required fields (Class, Name, Roll, Age).");
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

        if (age < 5 || age > 20) {
            alert("Please enter a valid age (5-20).");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Collect monthly fees
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthlyFees = {};
        months.forEach(month => {
            const input = document.getElementById(month + 'Fee');
            if (input) {
                monthlyFees[month] = parseInt(input.value) || 0;
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
            previousDues,
            className: className,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };

        console.log("Saving student data. Editing student ID:", editingStudentId);

        if (editingStudentId && currentForm === 'edit') {
            // Update existing student
            console.log("Updating existing student:", editingStudentId);
            const studentRef = doc(db, "students", editingStudentId);
            await updateDoc(studentRef, studentData);
            console.log("✅ Student updated successfully!");
            alert("Student updated successfully!");
        } else {
            // Add new student
            console.log("Adding new student");
            studentData.createdAt = serverTimestamp();
            studentData.createdBy = currentUser.uid;
            
            const studentsRef = collection(db, "students");
            await addDoc(studentsRef, studentData);
            console.log("✅ Student added successfully!");
            alert("Student added successfully!");
        }

        hideAddStudentForm();
        
        // Refresh the current view
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
window.showAllClasses = showAllClasses;
window.handleImageError = handleImageError;

// ======================
// INITIALIZE APP
// ======================

document.addEventListener('DOMContentLoaded', () => {
    console.log("KVM Classes Student Management System initialized");
    showLoadingScreen();
});
