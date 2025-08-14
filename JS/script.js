// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

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
const studentForm = document.getElementById("studentForm");

// Authentication State Management
onAuthStateChanged(auth, async (user) => {
    showLoadingScreen();
    
    if (user) {
        currentUser = user;
        
        // Check if user has admin privileges
        try {
            const idTokenResult = await user.getIdTokenResult();
            
            if (idTokenResult.claims.admin === true) {
                isAdminAuthenticated = true;
                showMainApp();
                renderClasses();
                console.log("Admin user authenticated successfully");
            } else {
                // User is authenticated but not an admin
                showNonAdminMessage();
                console.log("User authenticated but lacks admin privileges");
            }
        } catch (error) {
            console.error("Error checking admin claims:", error);
            // If custom claims aren't set up, allow access for now
            // Remove this in production after setting up admin claims
            isAdminAuthenticated = true;
            showMainApp();
            renderClasses();
        }
    } else {
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
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    showLoginLoading(true);
    hideLoginError();
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Success will be handled by onAuthStateChanged
    } catch (error) {
        console.error("Login error:", error);
        showLoginError(getAuthErrorMessage(error.code));
        showLoginLoading(false);
    }
});

logoutButton.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log("User signed out successfully");
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
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please try again.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact your administrator.';
        default:
            return 'Authentication failed. Please try again.';
    }
}

// Core Application Functions
function renderClasses() {
    const classes = ["Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8"];
    classButtons.innerHTML = `
        <h2><i class="fas fa-school"></i> Select Class</h2>
        <div class="card-grid">
            ${classes.map(className => `
                <div class="card" onclick="loadStudents('${className}')">
                    <i class="fas fa-users"></i>
                    <h3>${className}</h3>
                    <p>View Students</p>
                </div>
            `).join('')}
        </div>
    `;
    studentList.innerHTML = '';
    studentDetail.innerHTML = '';
    hideAddStudentForm();
}

async function loadStudents(className) {
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }

    editingClass = className;
    
    try {
        const studentsRef = collection(db, "students", className, "students");
        const snapshot = await getDocs(studentsRef);
        
        if (snapshot.empty) {
            studentList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-slash"></i>
                    <h3>No Students Found</h3>
                    <p>No students found in ${className}</p>
                    <button class="button button-primary" onclick="showAddStudentForm()">
                        <i class="fas fa-plus"></i> Add First Student
                    </button>
                </div>
            `;
        } else {
            let studentsHTML = `
                <h3><i class="fas fa-list"></i> Students in ${className}</h3>
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
                    <i class="fas fa-plus"></i> Add New Student
                </button>
            `;
            
            studentList.innerHTML = studentsHTML;
        }
        
        studentDetail.innerHTML = '';
        hideAddStudentForm();
        
    } catch (error) {
        handleFirestoreError(error, "loading students");
        studentList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Students</h3>
                <p>${error.message}</p>
                <button class="button button-primary" onclick="loadStudents('${className}')">
                    <i class="fas fa-refresh"></i> Try Again
                </button>
            </div>
        `;
    }
}

async function loadStudentDetail(studentId) {
    if (!isAdminAuthenticated) {
        alert("Please authenticate first.");
        return;
    }

    try {
        const studentRef = doc(db, "students", editingClass, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            student.firstname = student.name.split(' ')[0] || '';
            student.lastname = student.name.split(' ')[1] || '';
            const defaultPhoto = "https://placehold.co/160x160/4361ee/ffffff?text=" + student.firstname.charAt(0).toUpperCase()+ student.lastname.charAt(0).toUpperCase();
            
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
                        <img src="${student.photo || defaultPhoto}" alt="${student.name}" 
                             onerror="this.src='${defaultPhoto}'; this.onerror=null;">
                        <div class="student-basic-info">
                            <h2>${student.name}</h2>
                            <p><strong>Class:</strong> ${editingClass}</p>
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
                        <button class="button button-primary" onclick="renderClasses()">
                            <i class="fas fa-arrow-left"></i>
                            Back to Classes
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
        handleFirestoreError(error, "loading student details");
        studentDetail.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error Loading Student</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Student Management Functions
function showAddStudentForm() {
    editingStudentId = null;
    document.getElementById('saveButtonText').textContent = 'Add Student';
    studentForm.reset();
    addStudentForm.style.display = 'block';
    addStudentForm.scrollIntoView({ behavior: 'smooth' });
}

function hideAddStudentForm() {
    addStudentForm.style.display = 'none';
    editingStudentId = null;
}

window.showAddStudentForm = showAddStudentForm;
window.hideAddStudentForm = hideAddStudentForm;

async function editStudent(studentId) {
    try {
        const studentRef = doc(db, "students", editingClass, "students", studentId);
        const studentSnap = await getDoc(studentRef);
        
        if (studentSnap.exists()) {
            const student = studentSnap.data();
            editingStudentId = studentId;
            
            // Populate form fields
            document.getElementById('studentName').value = student.name || '';
            document.getElementById('fatherName').value = student.fatherName || '';
            document.getElementById('mobile').value = student.mobile || '';
            document.getElementById('roll').value = student.roll || '';
            document.getElementById('age').value = student.age || '';
            document.getElementById('address').value = student.address || '';
            document.getElementById('photo').value = student.photo || '';
            document.getElementById('previousDues').value = student.previousDues || 0;
            
            // Populate monthly fees
            const monthlyFees = student.monthlyFees || {};
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            months.forEach(month => {
                const input = document.getElementById(month + 'Fee');
                if (input) {
                    input.value = monthlyFees[month] || 0;
                }
            });
            
            document.getElementById('saveButtonText').textContent = 'Update Student';
            addStudentForm.style.display = 'block';
            addStudentForm.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        handleFirestoreError(error, "loading student for editing");
    }
}

window.editStudent = editStudent;

studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isAdminAuthenticated) {
        alert("Authentication required to save student data.");
        return;
    }

    const name = document.getElementById('studentName').value.trim();
    const fatherName = document.getElementById('fatherName').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const roll = parseInt(document.getElementById('roll').value);
    const age = parseInt(document.getElementById('age').value);
    const address = document.getElementById('address').value.trim();
    const photo = document.getElementById('photo').value.trim();
    const previousDues = parseInt(document.getElementById('previousDues').value) || 0;

    if (!name || !roll || !age) {
        alert("Please fill in all required fields (Name, Roll, Age).");
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
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
    };

    try {
        if (editingStudentId) {
            // Update existing student
            const studentRef = doc(db, "students", editingClass, "students", editingStudentId);
            await updateDoc(studentRef, studentData);
            alert("Student updated successfully!");
        } else {
            // Add new student
            studentData.createdAt = serverTimestamp();
            studentData.createdBy = currentUser.uid;
            
            const studentsRef = collection(db, "students", editingClass, "students");
            await addDoc(studentsRef, studentData);
            alert("Student added successfully!");
        }

        hideAddStudentForm();
        loadStudents(editingClass);
        
    } catch (error) {
        handleFirestoreError(error, editingStudentId ? "updating student" : "adding student");
    }
});

async function deleteStudent(studentId, studentName) {
    if (!confirm(`Are you sure you want to delete ${studentName}? This action cannot be undone.`)) {
        return;
    }

    try {
        const studentRef = doc(db, "students", editingClass, "students", studentId);
        await deleteDoc(studentRef);
        
        alert(`${studentName} has been deleted successfully.`);
        loadStudents(editingClass);
        
    } catch (error) {
        handleFirestoreError(error, "deleting student");
    }
}

window.deleteStudent = deleteStudent;

// Search and Filter Functions
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

// Global function exports
window.renderClasses = renderClasses;
window.loadStudents = loadStudents;
window.loadStudentDetail = loadStudentDetail;

// Error Handling
function handleFirestoreError(error, operation) {
    console.error(`Error during ${operation}:`, error);
    
    let message = `An error occurred during ${operation}.`;
    
    switch (error.code) {
        case 'permission-denied':
            message = 'Permission denied. Please check your authentication status.';
            if (confirm('Would you like to sign in again?')) {
                signOut();
            }
            break;
        case 'unavailable':
            message = 'Database is currently unavailable. Please try again later.';
            break;
        case 'not-found':
            message = 'The requested data was not found.';
            break;
        default:
            message += ` Error: ${error.message}`;
    }
    
    alert(message);
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("KVM Classes Student Management System initialized");
    showLoadingScreen();
});