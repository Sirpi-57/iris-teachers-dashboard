// IRIS - Teacher Portal Firebase Authentication Module

// Firebase configuration object - same as student portal
const firebaseConfig = {
  apiKey: "AIzaSyBw3b7RrcIzL7Otog58Bu52eUH5e3zab8I",
  authDomain: "iris-ai-prod.firebaseapp.com",
  projectId: "iris-ai-prod",
  storageBucket: "iris-ai-prod.firebasestorage.app",
  messagingSenderId: "223585438",
  appId: "1:223585438:web:7ceeb88553e550e1a0c78f",
  measurementId: "G-JF7KVLNXRL"
};

// Global auth state
const authState = {
  user: null,
  userProfile: null,
  initialized: false,
  students: [],
  sessions: [],
  interviews: []
};

let studentsListener = null;

// Initialize Firebase
document.addEventListener('DOMContentLoaded', () => {
  initializeFirebase();
});

function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded!');
    showErrorMessage('Firebase initialization failed. Please check your internet connection and try again.');
    return;
  }

  try {
    // Initialize Firebase if not already initialized
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // Set up authentication state observer
    firebase.auth().onAuthStateChanged(handleAuthStateChanged);
    
    console.log('Firebase initialized successfully');
    authState.initialized = true;
    
    // Attach event listeners to auth-related buttons
    attachAuthEventListeners();
    
  } catch (error) {
    console.error('Firebase initialization error:', error);
    showErrorMessage('Firebase initialization failed: ' + error.message);
  }
}

function handleAuthStateChanged(user) {
  console.log('Auth state changed:', user ? `User ${user.email} signed in` : 'User signed out');
  authState.user = user;

  if (user) {
    // User is signed in - Load profile
    loadUserProfile(user)
      .then(() => {
        // Check if role is teacher, if not set it
        if (authState.userProfile && authState.userProfile.role !== 'teacher') {
          return updateUserRole(user.uid, 'teacher');
        }
      })
      .then(() => {
        // Redirect to dashboard if on login page
        if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
          window.location.href = 'dashboard.html';
        } else {
          // Update UI with user info
          updateUserProfileUI(user);
          
          // Load dashboard data if on dashboard page
          if (window.location.pathname === '/dashboard.html') {
            initializeDashboard();
          }
        }
      })
      .catch(error => {
        console.error('Error during profile loading/update:', error);
        showErrorMessage('Error loading profile: ' + error.message);
      });
  } else {
    // User is signed out - Redirect to login page if on dashboard
    if (window.location.pathname === '/dashboard.html') {
      window.location.href = 'index.html';
    }
  }
}

function loadUserProfile(user) {
  // Only load if we have a valid user and Firestore is available
  if (!user || typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn("Cannot load profile: User null or Firebase/Firestore not available.");
    authState.userProfile = null; // Ensure profile is null
    return Promise.resolve(); // Return resolved promise
  }

  const db = firebase.firestore();
  console.log(`Attempting to load profile for user: ${user.uid}`);

  // Return the promise chain
  return db.collection('users').doc(user.uid).get()
    .then(doc => {
      if (doc.exists) {
        authState.userProfile = doc.data();
        console.log('User profile loaded successfully:', authState.userProfile);
        return authState.userProfile;
      } else {
        console.log('No user profile found in Firestore, creating one');
        const newProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || null,
          createdAt: new Date().toISOString(),
          role: 'teacher', // Set role as teacher
          collegeId: null,
          deptId: null,
          sectionId: null
        };
        
        return db.collection('users').doc(user.uid).set(newProfile)
          .then(() => {
            authState.userProfile = newProfile;
            console.log("New teacher profile created successfully:", authState.userProfile);
            return authState.userProfile;
          });
      }
    })
    .catch(error => {
      console.error('Error loading user profile:', error);
      authState.userProfile = null; // Ensure profile is null on error
      throw error;
    });
}

function updateUserRole(userId, role) {
  if (!firebase.firestore || !userId) {
    return Promise.reject(new Error('Firestore or user ID not available'));
  }
  
  const db = firebase.firestore();
  return db.collection('users').doc(userId).update({
    role: role,
    updatedAt: new Date().toISOString()
  })
  .then(() => {
    console.log(`Updated user ${userId} role to ${role}`);
    if (authState.userProfile) {
      authState.userProfile.role = role;
    }
    return true;
  })
  .catch(error => {
    console.error(`Error updating user role:`, error);
    return Promise.reject(error);
  });
}

function updateUserProfile(updates) {
  const user = firebase.auth().currentUser;
  if (!user || !firebase.firestore) {
    return Promise.reject(new Error('User not logged in or Firestore not available'));
  }
  
  const db = firebase.firestore();
  
  // Add timestamp to updates
  updates.updatedAt = new Date().toISOString();
  
  return db.collection('users').doc(user.uid).update(updates)
    .then(() => {
      console.log('User profile updated successfully');
      // Update local state
      Object.assign(authState.userProfile, updates);
      return true;
    })
    .catch(error => {
      console.error('Error updating user profile:', error);
      return Promise.reject(error);
    });
}

// Authentication functions
function signInWithEmailPassword(email, password) {
  if (!firebase.auth) {
    showErrorMessage('Authentication service not available');
    return Promise.reject(new Error('Authentication service not available'));
  }
  
  return firebase.auth().signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      console.log('User signed in successfully');
      return userCredential.user;
    })
    .catch(error => {
      console.error('Sign in error:', error);
      showErrorMessage(`Sign in failed: ${error.message}`);
      throw error;
    });
}

function signUpWithEmailPassword(email, password, displayName, collegeId, deptId, sectionId) {
  if (!firebase.auth) {
    showErrorMessage('Authentication service not available');
    return Promise.reject(new Error('Authentication service not available'));
  }
  
  return firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(userCredential => {
      console.log('User signed up successfully');
      
      // Set display name
      return userCredential.user.updateProfile({
        displayName: displayName
      }).then(() => {
        // Create user profile in Firestore
        if (firebase.firestore) {
          const db = firebase.firestore();
          return db.collection('users').doc(userCredential.user.uid).set({
            uid: userCredential.user.uid,
            email: email,
            displayName: displayName,
            role: 'teacher', // Set role as teacher
            collegeId: collegeId,
            deptId: deptId,
            sectionId: sectionId,
            createdAt: new Date().toISOString(),
            photoURL: null
          }, { merge: true }).then(() => {
            return userCredential.user;
          });
        } else {
          return userCredential.user;
        }
      });
    })
    .catch(error => {
      console.error('Sign up error:', error);
      showErrorMessage(`Sign up failed: ${error.message}`);
      throw error;
    });
}

function signInWithGoogle() {
  if (!firebase.auth) {
    showErrorMessage('Authentication service not available');
    return Promise.reject(new Error('Authentication service not available'));
  }
  
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider)
    .then(result => {
      console.log('Google sign in successful');
      return result.user;
    })
    .catch(error => {
      console.error('Google sign in error:', error);
      showErrorMessage(`Google sign in failed: ${error.message}`);
      throw error;
    });
}

function signOut() {
  if (!firebase.auth) {
      showErrorMessage('Authentication service not available');
      return Promise.reject(new Error('Authentication service not available'));
  }
  
  // Clean up listeners
  if (studentsListener) {
      studentsListener();
      studentsListener = null;
  }
  
  return firebase.auth().signOut()
      .then(() => {
          console.log('User signed out successfully');
          authState.userProfile = null;
          authState.students = [];
          authState.sessions = [];
          authState.interviews = [];
      })
      .catch(error => {
          console.error('Sign out error:', error);
          showErrorMessage(`Sign out failed: ${error.message}`);
          throw error;
      });
}

function resetPassword(email) {
  if (!firebase.auth) {
    showErrorMessage('Authentication service not available');
    return Promise.reject(new Error('Authentication service not available'));
  }
  
  return firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      console.log('Password reset email sent');
      return true;
    })
    .catch(error => {
      console.error('Password reset error:', error);
      showErrorMessage(`Password reset failed: ${error.message}`);
      throw error;
    });
}

function changePassword(currentPassword, newPassword) {
  const user = firebase.auth().currentUser;
  if (!user || !firebase.auth) {
    showErrorMessage('User not logged in or Auth not available');
    return Promise.reject(new Error('User not logged in or Auth not available'));
  }
  
  // Re-authenticate user before changing password
  const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
  return user.reauthenticateWithCredential(credential)
    .then(() => {
      return user.updatePassword(newPassword);
    })
    .then(() => {
      console.log('Password updated successfully');
      return true;
    })
    .catch(error => {
      console.error('Change password error:', error);
      showErrorMessage(`Change password failed: ${error.message}`);
      throw error;
    });
}

// Firestore Data Access Functions
function fetchStudents() {
  const user = firebase.auth().currentUser;
  if (!user || !firebase.firestore || !authState.userProfile) {
      return Promise.reject(new Error('User not logged in or Firestore not available'));
  }
  
  // Get teacher's IDs for matching
  const collegeId = authState.userProfile.collegeId;
  const deptId = authState.userProfile.deptId;
  const sectionId = authState.userProfile.sectionId;
  
  if (!collegeId && !deptId && !sectionId) {
      return Promise.resolve([]);  // No IDs to match with
  }
  
  const db = firebase.firestore();
  const usersRef = db.collection('users');
  
  // Build query based on available IDs
  let query = usersRef.where('role', '==', 'student');
  
  return query.get()
      .then(snapshot => {
          // Clear the existing students array to prevent stale data
          authState.students = [];
          
          const students = [];
          snapshot.forEach(doc => {
              const student = doc.data();
              
              // Match student IDs with teacher IDs
              // If teacher has an ID and it matches the student's ID, include the student
              const collegeMatch = !collegeId || (student.collegeId && student.collegeId === collegeId);
              const deptMatch = !deptId || (student.deptId && student.deptId === deptId);
              const sectionMatch = !sectionId || (student.sectionId && student.sectionId === sectionId);
              
              // If any ID matches, include this student
              if (collegeMatch || deptMatch || sectionMatch) {
                  students.push(student);
              }
          });
          
          console.log(`Found ${students.length} students matching teacher's IDs`);
          authState.students = students;
          return students;
      })
      .catch(error => {
          console.error('Error fetching students:', error);
          throw error;
      });
}

function setupStudentsListener() {
  const user = firebase.auth().currentUser;
  if (!user || !firebase.firestore || !authState.userProfile) {
      console.warn('Cannot setup listener: User not logged in or Firestore not available');
      return null;
  }
  
  // Get teacher's IDs for matching
  const collegeId = authState.userProfile.collegeId;
  const deptId = authState.userProfile.deptId;
  const sectionId = authState.userProfile.sectionId;
  
  if (!collegeId && !deptId && !sectionId) {
      console.warn('Cannot setup listener: No matching IDs available');
      return null;
  }
  
  const db = firebase.firestore();
  const usersRef = db.collection('users');
  let query = usersRef.where('role', '==', 'student');
  
  // Set up the listener
  return query.onSnapshot((snapshot) => {
      // Clear existing students
      authState.students = [];
      const students = [];
      
      // Process changes
      snapshot.forEach(doc => {
          const student = doc.data();
          
          // Match student IDs with teacher IDs
          const collegeMatch = !collegeId || (student.collegeId && student.collegeId === collegeId);
          const deptMatch = !deptId || (student.deptId && student.deptId === deptId);
          const sectionMatch = !sectionId || (student.sectionId && student.sectionId === sectionId);
          
          // If any ID matches, include this student
          if (collegeMatch || deptMatch || sectionMatch) {
              students.push(student);
          }
      });
      
      console.log(`Listener updated: Found ${students.length} students matching teacher's IDs`);
      authState.students = students;
      
      // Update the UI
      displayStudents(students);
      
      // Optionally fetch sessions and interviews for the updated student list
      const studentIds = students.map(student => student.uid);
      Promise.all([
          fetchSessionsForStudents(studentIds),
          fetchInterviewsForStudents(studentIds)
      ]).then(([sessions, interviews]) => {
          displaySessions(sessions);
          displayInterviews(interviews);
          updateStatsDisplay();
      });
  }, (error) => {
      console.error('Error in students listener:', error);
      showErrorMessage(`Error monitoring student changes: ${error.message}`);
  });
}

function fetchSessionsForStudents(studentIds) {
  if (!firebase.firestore || !studentIds || studentIds.length === 0) {
    return Promise.resolve([]);
  }
  
  const db = firebase.firestore();
  
  // Firestore limitations: can only use 'in' operator on 10 values at a time
  // We'll chunk the student IDs into groups of 10
  const chunks = [];
  for (let i = 0; i < studentIds.length; i += 10) {
    chunks.push(studentIds.slice(i, i + 10));
  }
  
  // Create a promise for each chunk
  const promises = chunks.map(chunk => {
    return db.collection('sessions')
      .where('userId', 'in', chunk)
      .get()
      .then(snapshot => {
        const sessions = [];
        snapshot.forEach(doc => {
          sessions.push({
            id: doc.id,
            ...doc.data()
          });
        });
        return sessions;
      });
  });
  
  // Combine results from all chunks
  return Promise.all(promises)
    .then(results => {
      const sessions = results.flat();
      console.log(`Found ${sessions.length} resume analysis sessions`);
      authState.sessions = sessions;
      return sessions;
    })
    .catch(error => {
      console.error('Error fetching sessions:', error);
      throw error;
    });
}

function fetchInterviewsForStudents(studentIds) {
  if (!firebase.firestore || !studentIds || studentIds.length === 0) {
    return Promise.resolve([]);
  }
  
  const db = firebase.firestore();
  
  // Split into chunks like with sessions
  const chunks = [];
  for (let i = 0; i < studentIds.length; i += 10) {
    chunks.push(studentIds.slice(i, i + 10));
  }
  
  const promises = chunks.map(chunk => {
    return db.collection('interviews')
      .where('userId', 'in', chunk)
      .get()
      .then(snapshot => {
        const interviews = [];
        snapshot.forEach(doc => {
          interviews.push({
            id: doc.id,
            ...doc.data()
          });
        });
        return interviews;
      });
  });
  
  return Promise.all(promises)
    .then(results => {
      const interviews = results.flat();
      console.log(`Found ${interviews.length} mock interviews`);
      authState.interviews = interviews;
      return interviews;
    })
    .catch(error => {
      console.error('Error fetching interviews:', error);
      throw error;
    });
}

function fetchSessionDetails(sessionId) {
  if (!firebase.firestore || !sessionId) {
    return Promise.reject(new Error('Firestore not available or session ID missing'));
  }
  
  const db = firebase.firestore();
  return db.collection('sessions').doc(sessionId).get()
    .then(doc => {
      if (doc.exists) {
        return {
          id: doc.id,
          ...doc.data()
        };
      } else {
        throw new Error('Session not found');
      }
    })
    .catch(error => {
      console.error(`Error fetching session details for ${sessionId}:`, error);
      throw error;
    });
}

function fetchInterviewDetails(interviewId) {
  if (!firebase.firestore || !interviewId) {
    return Promise.reject(new Error('Firestore not available or interview ID missing'));
  }
  
  const db = firebase.firestore();
  return db.collection('interviews').doc(interviewId).get()
    .then(doc => {
      if (doc.exists) {
        return {
          id: doc.id,
          ...doc.data()
        };
      } else {
        throw new Error('Interview not found');
      }
    })
    .catch(error => {
      console.error(`Error fetching interview details for ${interviewId}:`, error);
      throw error;
    });
}

// UI Helpers
function updateUserProfileUI(user) {
  // Update UI elements showing user info (similar to student portal)
  const userDisplayElements = document.querySelectorAll('.user-display-name');
  const userEmailElements = document.querySelectorAll('.user-email');
  const userAvatarElements = document.querySelectorAll('.user-avatar');
  
  const displayName = user.displayName || authState.userProfile?.displayName || user.email.split('@')[0];
  const email = user.email;
  const photoURL = user.photoURL || 'https://i.stack.imgur.com/34AD2.jpg'; // Default avatar
  
  userDisplayElements.forEach(el => el.textContent = displayName);
  userEmailElements.forEach(el => el.textContent = email);
  userAvatarElements.forEach(el => {
    if (el.tagName === 'IMG') {
      el.src = photoURL;
      el.alt = displayName;
    }
  });
  
  // Update ID badges
  if (authState.userProfile) {
    const collegeIdBadge = document.getElementById('college-id-badge');
    const deptIdBadge = document.getElementById('dept-id-badge');
    const sectionIdBadge = document.getElementById('section-id-badge');
    
    if (collegeIdBadge) {
      collegeIdBadge.querySelector('span').textContent = authState.userProfile.collegeId || '-';
    }
    
    if (deptIdBadge) {
      deptIdBadge.querySelector('span').textContent = authState.userProfile.deptId || '-';
    }
    
    if (sectionIdBadge) {
      sectionIdBadge.querySelector('span').textContent = authState.userProfile.sectionId || '-';
    }
    
    // Update profile fields
    const profileCollegeId = document.getElementById('profile-college-id');
    const profileDeptId = document.getElementById('profile-dept-id');
    const profileSectionId = document.getElementById('profile-section-id');
    
    if (profileCollegeId) {
      profileCollegeId.textContent = authState.userProfile.collegeId || '-';
    }
    
    if (profileDeptId) {
      profileDeptId.textContent = authState.userProfile.deptId || '-';
    }
    
    if (profileSectionId) {
      profileSectionId.textContent = authState.userProfile.sectionId || '-';
    }
  }
}

function showErrorMessage(message, duration = 5000) {
  const errorContainer = document.getElementById('error-messages');
  if (errorContainer) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    errorContainer.appendChild(errorDiv);
    
    // Auto-dismiss after duration
    setTimeout(() => {
      errorDiv.classList.remove('show');
      setTimeout(() => errorDiv.remove(), 500);
    }, duration);
  } else {
    // Fallback to alert if container doesn't exist
    console.error(message);
    alert(message);
  }
}

function showSuccessMessage(message, duration = 5000) {
  const errorContainer = document.getElementById('error-messages');
  if (errorContainer) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    errorContainer.appendChild(successDiv);
    
    // Auto-dismiss after duration
    setTimeout(() => {
      successDiv.classList.remove('show');
      setTimeout(() => successDiv.remove(), 500);
    }, duration);
  } else {
    // Fallback to alert if container doesn't exist
    console.log(message);
    alert(message);
  }
}

// Event listeners attachment
function attachAuthEventListeners() {
  // Handle login/registration page events
  if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    // Sign in form submission
    document.getElementById('signin-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;
      signInWithEmailPassword(email, password);
    });
    
    // Sign up form submission
    document.getElementById('signup-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      const name = document.getElementById('signup-name').value;
      const collegeId = document.getElementById('signup-college-id').value;
      const deptId = document.getElementById('signup-dept-id').value;
      const sectionId = document.getElementById('signup-section-id').value;
      
      signUpWithEmailPassword(email, password, name, collegeId, deptId, sectionId);
    });
    
    // Google sign in button
    document.getElementById('google-signin-button')?.addEventListener('click', function() {
      signInWithGoogle();
    });
    
    // Password reset link
    document.getElementById('forgot-password-link')?.addEventListener('click', function(e) {
      e.preventDefault();
      const resetModal = new bootstrap.Modal(document.getElementById('reset-password-modal'));
      resetModal.show();
    });
    
    // Password reset form
    document.getElementById('reset-password-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = document.getElementById('reset-email').value;
      
      resetPassword(email)
        .then(() => {
          showSuccessMessage(`Password reset email sent to ${email}. Check your inbox.`);
          bootstrap.Modal.getInstance(document.getElementById('reset-password-modal')).hide();
        })
        .catch(error => {
          showErrorMessage(`Error sending reset email: ${error.message}`);
        });
    });
    
    // Tab switching
  document.getElementById('signin-tab')?.addEventListener('click', function() {
      document.getElementById('signin-form').reset();
    });
    
    document.getElementById('signup-tab')?.addEventListener('click', function() {
      document.getElementById('signup-form').reset();
    });
  }
  
  // Handle dashboard page events
  if (window.location.pathname === '/dashboard.html') {
    // Sign out button
    document.querySelectorAll('.signout-button').forEach(button => {
      button.addEventListener('click', function() {
        signOut().then(() => {
          window.location.href = 'index.html';
        });
      });
    });
    
    // Tab navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', function() {
        const targetTab = this.getAttribute('data-tab');
        if (!targetTab) return;
        
        // Update active state
        document.querySelectorAll('.nav-item').forEach(navItem => {
          navItem.classList.remove('active');
        });
        this.classList.add('active');
        
        // Switch tabs
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
          tab.classList.remove('active');
        });
        document.getElementById(targetTab)?.classList.add('active');
      });
    });
    
    // Refresh buttons
    document.getElementById('refresh-students-btn')?.addEventListener('click', function() {
      refreshStudentData();
    });
    
    document.getElementById('refresh-sessions-btn')?.addEventListener('click', function() {
      refreshSessionData();
    });
    
    document.getElementById('refresh-interviews-btn')?.addEventListener('click', function() {
      refreshInterviewData();
    });
    
    // Profile editing
    document.getElementById('edit-profile-btn')?.addEventListener('click', function() {
      // Show edit mode, hide view mode
      document.getElementById('profile-view-mode').style.display = 'none';
      document.getElementById('profile-edit-form').style.display = 'block';
      
      // Populate form with current data
      const user = firebase.auth().currentUser;
      if (user && authState.userProfile) {
        document.getElementById('profile-name').value = user.displayName || authState.userProfile.displayName || '';
        document.getElementById('profile-email').value = user.email || '';
        document.getElementById('profile-college-id-input').value = authState.userProfile.collegeId || '';
        document.getElementById('profile-dept-id-input').value = authState.userProfile.deptId || '';
        document.getElementById('profile-section-id-input').value = authState.userProfile.sectionId || '';
      }
    });
    
    document.getElementById('cancel-edit-btn')?.addEventListener('click', function() {
      // Hide edit mode, show view mode
      document.getElementById('profile-view-mode').style.display = 'block';
      document.getElementById('profile-edit-form').style.display = 'none';
    });
    
    document.getElementById('profile-edit-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const name = document.getElementById('profile-name').value.trim();
      const collegeId = document.getElementById('profile-college-id-input').value.trim();
      const deptId = document.getElementById('profile-dept-id-input').value.trim();
      const sectionId = document.getElementById('profile-section-id-input').value.trim();
      
      const user = firebase.auth().currentUser;
      if (user) {
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        
        // Update Firebase Auth profile
        user.updateProfile({ displayName: name })
          .then(() => {
            // Update Firestore profile
            return updateUserProfile({
              displayName: name,
              collegeId: collegeId || null,
              deptId: deptId || null,
              sectionId: sectionId || null
            });
          })
          .then(() => {
            // Update UI elements
            document.getElementById('profile-view-mode').style.display = 'block';
            document.getElementById('profile-edit-form').style.display = 'none';
            
            // Update various UI elements with new values
            document.querySelectorAll('.user-display-name').forEach(el => { el.textContent = name; });
            document.getElementById('profile-college-id').textContent = collegeId || '-';
            document.getElementById('profile-dept-id').textContent = deptId || '-';
            document.getElementById('profile-section-id').textContent = sectionId || '-';
            
            // Update sidebar badges
            if (document.getElementById('college-id-badge')) {
              document.getElementById('college-id-badge').querySelector('span').textContent = collegeId || '-';
            }
            if (document.getElementById('dept-id-badge')) {
              document.getElementById('dept-id-badge').querySelector('span').textContent = deptId || '-';
            }
            if (document.getElementById('section-id-badge')) {
              document.getElementById('section-id-badge').querySelector('span').textContent = sectionId || '-';
            }
            
            showSuccessMessage('Profile updated successfully!');
            
            // If IDs were changed, refresh student data
            if (collegeId !== authState.userProfile.collegeId || 
                deptId !== authState.userProfile.deptId || 
                sectionId !== authState.userProfile.sectionId) {
              refreshStudentData();
            }
          })
          .catch(error => {
            console.error('Error updating profile:', error);
            showErrorMessage(`Error updating profile: ${error.message}`);
          })
          .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
          });
      }
    });
    
    // Change password
    document.getElementById('change-password-btn')?.addEventListener('click', function() {
      const modal = new bootstrap.Modal(document.getElementById('change-password-modal'));
      modal.show();
    });
    
    document.getElementById('change-password-form')?.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const currentPassword = document.getElementById('current-password').value;
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-new-password').value;
      
      if (newPassword !== confirmPassword) {
        showErrorMessage('New passwords do not match');
        return;
      }
      
      if (newPassword.length < 6) {
        showErrorMessage('New password must be at least 6 characters');
        return;
      }
      
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Updating...';
      
      changePassword(currentPassword, newPassword)
        .then(() => {
          bootstrap.Modal.getInstance(document.getElementById('change-password-modal')).hide();
          showSuccessMessage('Password updated successfully!');
          document.getElementById('change-password-form').reset();
        })
        .catch(error => {
          if (error.code === 'auth/wrong-password') {
            showErrorMessage('Current password is incorrect');
          } else {
            showErrorMessage(`Error updating password: ${error.message}`);
          }
        })
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        });
    });
    
    // Handle session detail view
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('view-session-btn') || e.target.closest('.view-session-btn')) {
        const btn = e.target.classList.contains('view-session-btn') ? e.target : e.target.closest('.view-session-btn');
        const sessionId = btn.getAttribute('data-id');
        
        if (sessionId) {
          showSessionDetails(sessionId);
        }
      }
    });
    
    // Handle interview detail view
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('view-interview-btn') || e.target.closest('.view-interview-btn')) {
        const btn = e.target.classList.contains('view-interview-btn') ? e.target : e.target.closest('.view-interview-btn');
        const interviewId = btn.getAttribute('data-id');
        
        if (interviewId) {
          showInterviewDetails(interviewId);
        }
      }
    });
    
    // Student search
    document.getElementById('student-search')?.addEventListener('input', function() {
      filterStudents(this.value);
    });
    
    // Session search
    document.getElementById('session-search')?.addEventListener('input', function() {
      filterSessions(this.value);
    });
    
    // Interview search
    document.getElementById('interview-search')?.addEventListener('input', function() {
      filterInterviews(this.value);
    });
  }
}

// Dashboard initialization function
function initializeDashboard() {
  console.log('Initializing teacher dashboard...');
  
  // Load students data first, then sessions and interviews
  refreshStudentData()
      .then(() => {
          // Update stats display
          updateStatsDisplay();
          
          // Set up real-time listener for student changes
          if (!studentsListener) {
              studentsListener = setupStudentsListener();
          }
      })
      .catch(error => {
          console.error('Error initializing dashboard:', error);
          showErrorMessage(`Error loading dashboard data: ${error.message}`);
      });
}

function refreshStudentData() {
  const loadingRow = `<tr><td colspan="8" class="text-center"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading students...</td></tr>`;
  document.getElementById('students-table-body').innerHTML = loadingRow;
  
  return fetchStudents()
    .then(students => {
      displayStudents(students);
      
      // Now fetch sessions and interviews
      if (students.length > 0) {
        const studentIds = students.map(student => student.uid);
        return Promise.all([
          fetchSessionsForStudents(studentIds),
          fetchInterviewsForStudents(studentIds)
        ]);
      } else {
        return [[], []];
      }
    })
    .then(([sessions, interviews]) => {
      displaySessions(sessions);
      displayInterviews(interviews);
      updateStatsDisplay();
      return { students: authState.students, sessions, interviews };
    })
    .catch(error => {
      console.error('Error refreshing student data:', error);
      showErrorMessage(`Error loading student data: ${error.message}`);
      
      // Show error message in tables
      const errorRow = `<tr><td colspan="8" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
      document.getElementById('students-table-body').innerHTML = errorRow;
      document.getElementById('sessions-table-body').innerHTML = errorRow.replace('colspan="8"', 'colspan="6"');
      document.getElementById('interviews-table-body').innerHTML = errorRow.replace('colspan="8"', 'colspan="7"');
      
      throw error;
    });
}

function refreshSessionData() {
  if (!authState.students || authState.students.length === 0) {
    return Promise.resolve([]);
  }
  
  const loadingRow = `<tr><td colspan="6" class="text-center"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading sessions...</td></tr>`;
  document.getElementById('sessions-table-body').innerHTML = loadingRow;
  
  const studentIds = authState.students.map(student => student.uid);
  return fetchSessionsForStudents(studentIds)
    .then(sessions => {
      displaySessions(sessions);
      updateStatsDisplay();
      return sessions;
    })
    .catch(error => {
      console.error('Error refreshing session data:', error);
      const errorRow = `<tr><td colspan="6" class="text-center text-danger">Error loading sessions: ${error.message}</td></tr>`;
      document.getElementById('sessions-table-body').innerHTML = errorRow;
      showErrorMessage(`Error loading session data: ${error.message}`);
      throw error;
    });
}

function refreshInterviewData() {
  if (!authState.students || authState.students.length === 0) {
    return Promise.resolve([]);
  }
  
  const loadingRow = `<tr><td colspan="7" class="text-center"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading interviews...</td></tr>`;
  document.getElementById('interviews-table-body').innerHTML = loadingRow;
  
  const studentIds = authState.students.map(student => student.uid);
  return fetchInterviewsForStudents(studentIds)
    .then(interviews => {
      displayInterviews(interviews);
      updateStatsDisplay();
      return interviews;
    })
    .catch(error => {
      console.error('Error refreshing interview data:', error);
      const errorRow = `<tr><td colspan="7" class="text-center text-danger">Error loading interviews: ${error.message}</td></tr>`;
      document.getElementById('interviews-table-body').innerHTML = errorRow;
      showErrorMessage(`Error loading interview data: ${error.message}`);
      throw error;
    });
}

// Display functions
function displayStudents(students) {
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;
  
  if (!students || students.length === 0) {
      tableBody.innerHTML = `
          <tr>
              <td colspan="8" class="text-center py-4">
                  <div class="alert alert-info mb-0">
                      <i class="fas fa-info-circle me-2"></i>
                      No students found matching your criteria.
                      <br><small class="mt-2 d-block">Students will appear here when they register with matching College ID, Department ID, or Section ID.</small>
                  </div>
              </td>
          </tr>`;
      return;
  }
  
  let html = '';
  students.forEach(student => {
    const studentSessions = authState.sessions.filter(session => session.userId === student.uid);
    const studentInterviews = authState.interviews.filter(interview => interview.userId === student.uid);
    
    html += `
      <tr>
        <td>${student.displayName || 'N/A'}</td>
        <td>${student.email || 'N/A'}</td>
        <td>${student.collegeId || '-'}</td>
        <td>${student.deptId || '-'}</td>
        <td>${student.sectionId || '-'}</td>
        <td>${studentSessions.length}</td>
        <td>${studentInterviews.length}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-student-btn" data-id="${student.uid}" title="View Student Details">
            <i class="fas fa-user"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = html;
}

function displaySessions(sessions) {
  const tableBody = document.getElementById('sessions-table-body');
  if (!tableBody) return;
  
  if (!sessions || sessions.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No resume analysis sessions found.</td></tr>`;
    return;
  }
  
  // Sort sessions by date (newest first)
  sessions.sort((a, b) => {
    const dateA = a.start_time ? new Date(a.start_time) : new Date(0);
    const dateB = b.start_time ? new Date(b.start_time) : new Date(0);
    return dateB - dateA;
  });
  
  let html = '';
  sessions.forEach(session => {
    const student = authState.students.find(s => s.uid === session.userId);
    const studentName = student ? student.displayName : 'Unknown Student';
    const sessionDate = session.start_time ? new Date(session.start_time).toLocaleString() : 'N/A';
    
    // Determine status badge class
    let statusBadgeClass = '';
    switch(session.status) {
      case 'completed': statusBadgeClass = 'status-completed'; break;
      case 'processing': statusBadgeClass = 'status-processing'; break;
      case 'failed': statusBadgeClass = 'status-failed'; break;
      default: statusBadgeClass = 'status-processing';
    }
    
    // Get match score if available
    const matchScore = session.results?.match_results?.matchScore || '-';
    let scoreClass = '';
    if (matchScore !== '-') {
      if (matchScore >= 70) scoreClass = 'score-high';
      else if (matchScore >= 40) scoreClass = 'score-medium';
      else scoreClass = 'score-low';
    }
    
    html += `
      <tr>
        <td>${studentName}</td>
        <td>${session.id}</td>
        <td>${sessionDate}</td>
        <td><span class="status-badge ${statusBadgeClass}">${session.status || 'N/A'}</span></td>
        <td>
          ${matchScore !== '-' ? 
            `<div class="score-indicator ${scoreClass}">${matchScore}</div>` : 
            '-'}
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-session-btn" data-id="${session.id}" title="View Session Details">
            <i class="fas fa-search"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = html;
}

function displayInterviews(interviews) {
  const tableBody = document.getElementById('interviews-table-body');
  if (!tableBody) return;
  
  if (!interviews || interviews.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center">No mock interviews found.</td></tr>`;
    return;
  }
  
  // Sort interviews by date (newest first)
  interviews.sort((a, b) => {
    const dateA = a.start_time ? new Date(a.start_time) : new Date(0);
    const dateB = b.start_time ? new Date(b.start_time) : new Date(0);
    return dateB - dateA;
  });
  
  let html = '';
  interviews.forEach(interview => {
    const student = authState.students.find(s => s.uid === interview.userId);
    const studentName = student ? student.displayName : 'Unknown Student';
    const interviewDate = interview.start_time ? new Date(interview.start_time).toLocaleString() : 'N/A';
    
    // Determine status badge class
    let statusBadgeClass = '';
    switch(interview.status) {
      case 'completed': statusBadgeClass = 'status-completed'; break;
      case 'active': statusBadgeClass = 'status-active'; break;
      case 'failed': statusBadgeClass = 'status-failed'; break;
      default: statusBadgeClass = 'status-processing';
    }
    
    // Get overall score if available
    const overallScore = interview.analysis?.overallScore || '-';
    let scoreClass = '';
    if (overallScore !== '-') {
      if (overallScore >= 70) scoreClass = 'score-high';
      else if (overallScore >= 40) scoreClass = 'score-medium';
      else scoreClass = 'score-low';
    }
    
    html += `
      <tr>
        <td>${studentName}</td>
        <td>${interview.id}</td>
        <td>${interviewDate}</td>
        <td>${interview.interviewType || 'General'}</td>
        <td><span class="status-badge ${statusBadgeClass}">${interview.status || 'N/A'}</span></td>
        <td>
          ${overallScore !== '-' ? 
            `<div class="score-indicator ${scoreClass}">${overallScore}</div>` : 
            '-'}
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-interview-btn" data-id="${interview.id}" title="View Interview Details">
            <i class="fas fa-search"></i>
          </button>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = html;
}

// Detail view functions
function showSessionDetails(sessionId) {
  // Show modal with loading state
  const modal = new bootstrap.Modal(document.getElementById('session-details-modal'));
  modal.show();
  
  const contentContainer = document.getElementById('session-details-content');
  contentContainer.innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading session details...</p>
    </div>
  `;
  
  fetchSessionDetails(sessionId)
    .then(session => {
      const student = authState.students.find(s => s.uid === session.userId);
      const studentName = student ? student.displayName : 'Unknown Student';
      
      // Format dates
      const startTime = session.start_time ? new Date(session.start_time).toLocaleString() : 'N/A';
      const endTime = session.end_time ? new Date(session.end_time).toLocaleString() : 'N/A';
      
      // Calculate duration if both times exist
      let duration = 'N/A';
      if (session.start_time && session.end_time) {
        const start = new Date(session.start_time);
        const end = new Date(session.end_time);
        const durationMs = end - start;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        duration = `${minutes}m ${seconds}s`;
      }
      
      // Extract results data
      const matchResults = session.results?.match_results || {};
      const matchScore = matchResults.matchScore || 'N/A';
      const matchAnalysis = matchResults.matchAnalysis || 'No analysis available.';
      
      // Format skills data
      let strengthsHtml = '<p>No strengths identified.</p>';
      if (matchResults.keyStrengths && matchResults.keyStrengths.length > 0) {
        strengthsHtml = '<ul>';
        matchResults.keyStrengths.forEach(strength => {
          strengthsHtml += `<li><strong>${strength.strength || 'N/A'}</strong>: ${strength.relevance || 'N/A'}</li>`;
        });
        strengthsHtml += '</ul>';
      }
      
      let gapsHtml = '<p>No skill gaps identified.</p>';
      if (matchResults.skillGaps && matchResults.skillGaps.length > 0) {
        gapsHtml = '<ul>';
        matchResults.skillGaps.forEach(gap => {
          gapsHtml += `<li><strong>${gap.missingSkill || 'N/A'}</strong> (${gap.importance || 'low'}): ${gap.suggestion || 'N/A'}</li>`;
        });
        gapsHtml += '</ul>';
      }
      
      // Build HTML content
      let html = `
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Session Information</h5>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Session ID:</strong> ${session.id}</p>
              <p><strong>Status:</strong> <span class="badge ${session.status === 'completed' ? 'bg-success' : session.status === 'failed' ? 'bg-danger' : 'bg-warning'}">${session.status || 'N/A'}</span></p>
              <p><strong>Start Time:</strong> ${startTime}</p>
              <p><strong>End Time:</strong> ${endTime}</p>
              <p><strong>Duration:</strong> ${duration}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Resume Match Results</h5>
              <div class="text-center mb-3">
                <div class="score-indicator ${matchScore >= 70 ? 'score-high' : matchScore >= 40 ? 'score-medium' : 'score-low'}" style="width: 80px; height: 80px; font-size: 1.5rem; margin: 0 auto;">
                  ${matchScore}
                </div>
                <p class="mt-2"><strong>Match Score</strong></p>
              </div>
              <p><strong>Analysis:</strong> ${matchAnalysis}</p>
            </div>
          </div>
        </div>
        
        <div class="row">
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Key Strengths</h5>
              ${strengthsHtml}
            </div>
          </div>
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Skill Gaps</h5>
              ${gapsHtml}
            </div>
          </div>
        </div>
      `;
      
      contentContainer.innerHTML = html;
    })
    .catch(error => {
      console.error('Error loading session details:', error);
      contentContainer.innerHTML = `
        <div class="alert alert-danger">
          <strong>Error loading session details:</strong> ${error.message}
        </div>
      `;
    });
}

function showInterviewDetails(interviewId) {
  // Show modal with loading state
  const modal = new bootstrap.Modal(document.getElementById('interview-details-modal'));
  modal.show();
  
  const contentContainer = document.getElementById('interview-details-content');
  contentContainer.innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p>Loading interview details...</p>
    </div>
  `;
  
  fetchInterviewDetails(interviewId)
    .then(interview => {
      const student = authState.students.find(s => s.uid === interview.userId);
      const studentName = student ? student.displayName : 'Unknown Student';
      
      // Format dates
      const startTime = interview.start_time ? new Date(interview.start_time).toLocaleString() : 'N/A';
      const endTime = interview.end_time ? new Date(interview.end_time).toLocaleString() : 'N/A';
      
      // Calculate duration if both times exist
      let duration = 'N/A';
      if (interview.start_time && interview.end_time) {
        const start = new Date(interview.start_time);
        const end = new Date(interview.end_time);
        const durationMs = end - start;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        duration = `${minutes}m ${seconds}s`;
      }
      
      // Extract analysis data
      const analysis = interview.analysis || {};
      const overallScore = analysis.overallScore || 'N/A';
      const overallAssessment = analysis.overallAssessment || 'No assessment available.';
      
      // Extract scores
      const technicalScore = analysis.technicalAssessment?.score || 'N/A';
      const communicationScore = analysis.communicationAssessment?.score || 'N/A';
      const behavioralScore = analysis.behavioralAssessment?.score || 'N/A';
      
      // Format conversation
      let conversationHtml = '<p>No conversation recorded.</p>';
      if (interview.conversation && interview.conversation.length > 0) {
        conversationHtml = '<div class="conversation-transcript">';
        interview.conversation.forEach((msg, index) => {
          const speaker = msg.role === 'assistant' ? 'Interviewer' : 'Student';
          const speakerClass = msg.role === 'assistant' ? 'interviewer' : 'student';
          
          conversationHtml += `
            <div class="message ${speakerClass}">
              <div class="speaker">${speaker}</div>
              <div class="content">${msg.content}</div>
            </div>
          `;
        });
        conversationHtml += '</div>';
      }
      
      // Build HTML content
      let html = `
        <div class="row mb-4">
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Interview Information</h5>
              <p><strong>Student:</strong> ${studentName}</p>
              <p><strong>Interview ID:</strong> ${interview.id}</p>
              <p><strong>Type:</strong> ${interview.interviewType || 'General'}</p>
              <p><strong>Status:</strong> <span class="badge ${interview.status === 'completed' ? 'bg-success' : interview.status === 'failed' ? 'bg-danger' : interview.status === 'active' ? 'bg-info' : 'bg-warning'}">${interview.status || 'N/A'}</span></p>
              <p><strong>Start Time:</strong> ${startTime}</p>
              <p><strong>End Time:</strong> ${endTime}</p>
              <p><strong>Duration:</strong> ${duration}</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="detail-section">
              <h5>Performance Scores</h5>
              <div class="text-center mb-3">
                <div class="score-indicator ${overallScore >= 70 ? 'score-high' : overallScore >= 40 ? 'score-medium' : 'score-low'}" style="width: 80px; height: 80px; font-size: 1.5rem; margin: 0 auto;">
                  ${overallScore}
                </div>
                <p class="mt-2"><strong>Overall Score</strong></p>
              </div>
              
              <div class="row text-center">
                <div class="col-md-4">
                  <div class="score-indicator ${technicalScore >= 70 ? 'score-high' : technicalScore >= 40 ? 'score-medium' : 'score-low'}" style="width: 50px; height: 50px; margin: 0 auto;">
                    ${technicalScore}
                  </div>
                  <p class="mt-1"><small>Technical</small></p>
                </div>
                <div class="col-md-4">
                  <div class="score-indicator ${communicationScore >= 70 ? 'score-high' : communicationScore >= 40 ? 'score-medium' : 'score-low'}" style="width: 50px; height: 50px; margin: 0 auto;">
                    ${communicationScore}
                  </div>
                  <p class="mt-1"><small>Communication</small></p>
                </div>
                <div class="col-md-4">
                <div class="score-indicator ${behavioralScore >= 70 ? 'score-high' : behavioralScore >= 40 ? 'score-medium' : 'score-low'}" style="width: 50px; height: 50px; margin: 0 auto;">
                  ${behavioralScore}
                </div>
                <p class="mt-1"><small>Behavioral</small></p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row mb-4">
        <div class="col-12">
          <div class="detail-section">
            <h5>Overall Assessment</h5>
            <p>${overallAssessment}</p>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col-12">
          <div class="detail-section">
            <h5>Interview Transcript</h5>
            ${conversationHtml}
          </div>
        </div>
      </div>
    `;
    
    contentContainer.innerHTML = html;
    
    // Add custom styling for conversation transcript
    const style = document.createElement('style');
    style.textContent = `
      .conversation-transcript {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #ddd;
        padding: 10px;
        border-radius: 5px;
      }
      
      .conversation-transcript .message {
        margin-bottom: 10px;
        padding: 5px;
      }
      
      .conversation-transcript .speaker {
        font-weight: bold;
        margin-bottom: 3px;
      }
      
      .conversation-transcript .interviewer .speaker {
        color: #0d6efd;
      }
      
      .conversation-transcript .student .speaker {
        color: #198754;
      }
      
      .conversation-transcript .content {
        padding: 5px 0;
      }
    `;
    document.head.appendChild(style);
  })
  .catch(error => {
    console.error('Error loading interview details:', error);
    contentContainer.innerHTML = `
      <div class="alert alert-danger">
        <strong>Error loading interview details:</strong> ${error.message}
      </div>
    `;
  });
}

// Search/filter functions
function filterStudents(searchText) {
if (!authState.students || authState.students.length === 0) return;

searchText = searchText.toLowerCase().trim();

// If search text is empty, display all students
if (!searchText) {
  displayStudents(authState.students);
  return;
}

// Filter students based on search text
const filteredStudents = authState.students.filter(student => {
  return (
    (student.displayName && student.displayName.toLowerCase().includes(searchText)) ||
    (student.email && student.email.toLowerCase().includes(searchText)) ||
    (student.collegeId && student.collegeId.toLowerCase().includes(searchText)) ||
    (student.deptId && student.deptId.toLowerCase().includes(searchText)) ||
    (student.sectionId && student.sectionId.toLowerCase().includes(searchText))
  );
});

displayStudents(filteredStudents);
}

function filterSessions(searchText) {
if (!authState.sessions || authState.sessions.length === 0) return;

searchText = searchText.toLowerCase().trim();

// If search text is empty, display all sessions
if (!searchText) {
  displaySessions(authState.sessions);
  return;
}

// Filter sessions based on search text
const filteredSessions = authState.sessions.filter(session => {
  const student = authState.students.find(s => s.uid === session.userId);
  const studentName = student ? student.displayName : '';
  
  return (
    (studentName && studentName.toLowerCase().includes(searchText)) ||
    (session.id && session.id.toLowerCase().includes(searchText)) ||
    (session.status && session.status.toLowerCase().includes(searchText))
  );
});

displaySessions(filteredSessions);
}

function filterInterviews(searchText) {
if (!authState.interviews || authState.interviews.length === 0) return;

searchText = searchText.toLowerCase().trim();

// If search text is empty, display all interviews
if (!searchText) {
  displayInterviews(authState.interviews);
  return;
}

// Filter interviews based on search text
const filteredInterviews = authState.interviews.filter(interview => {
  const student = authState.students.find(s => s.uid === interview.userId);
  const studentName = student ? student.displayName : '';
  
  return (
    (studentName && studentName.toLowerCase().includes(searchText)) ||
    (interview.id && interview.id.toLowerCase().includes(searchText)) ||
    (interview.status && interview.status.toLowerCase().includes(searchText)) ||
    (interview.interviewType && interview.interviewType.toLowerCase().includes(searchText))
  );
});

displayInterviews(filteredInterviews);
}

// Update stats display
function updateStatsDisplay() {
document.getElementById('total-students-count').textContent = authState.students.length;
document.getElementById('total-sessions-count').textContent = authState.sessions.length;
document.getElementById('total-interviews-count').textContent = authState.interviews.length;
}

// Export teacher portal functions
window.irisTeacher = {
signIn: signInWithEmailPassword,
signUp: signUpWithEmailPassword,
signInWithGoogle,
signOut,
getCurrentUser: () => authState.user,
getUserProfile: () => authState.userProfile,
refreshStudentData,
refreshSessionData,
refreshInterviewData,
filterStudents,
filterSessions,
filterInterviews
};