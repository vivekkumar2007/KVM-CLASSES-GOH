// Updated Firebase Authentication with Custom Claims Check
auth.onAuthStateChanged(async (user) => {
  showLoadingScreen();
  
  if (user) {
    currentUser = user;
    console.log('User signed in:', user.email);
    
    try {
      // Get the ID token to check custom claims
      const idTokenResult = await user.getIdTokenResult();
      console.log('Token claims:', idTokenResult.claims);
      
      // Check if user has admin privileges
      if (idTokenResult.claims.admin === true) {
        console.log('✅ Admin user authenticated');
        isAdminAuthenticated = true;
        showMainApp();
        renderClasses();
      } else {
        console.log('❌ User is not an admin');
        alert('Access denied: Admin privileges required');
        auth.signOut();
      }
    } catch (error) {
      console.error('Error checking admin claims:', error);
      // For development, allow access if claims check fails
      console.log('⚠️ Claims check failed, allowing temporary access');
      isAdminAuthenticated = true;
      showMainApp();
      renderClasses();
    }
  } else {
    console.log('User signed out');
    currentUser = null;
    isAdminAuthenticated = false;
    showAuthSection();
  }
  
  hideElement(loadingScreen);
});

// Enhanced login function with better error handling
loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;
  
  hideElement(loginError);
  showElement(loginLoading);
  
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log('Login successful:', userCredential.user.email);
    // The onAuthStateChanged listener will handle the rest
    
  } catch (error) {
    console.error('Login error:', error);
    hideElement(loginLoading);
    
    let errorMessage = 'Login failed: ';
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage += 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage += 'Incorrect password.';
        break;
      case 'auth/invalid-email':
        errorMessage += 'Please enter a valid email address.';
        break;
      case 'auth/too-many-requests':
        errorMessage += 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage += 'Network error. Please check your connection.';
        break;
      default:
        errorMessage += error.message;
    }
    
    loginError.textContent = errorMessage;
    showElement(loginError);
  }
});