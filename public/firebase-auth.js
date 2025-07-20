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

// Helper function to format dates to IST
function formatToIST(dateString) {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Convert to IST (UTC+5:30)
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    console.error('Error formatting date to IST:', e);
    return dateString;
  }
}

// Helper function to calculate duration between two dates
function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 'N/A';
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  } catch (e) {
    console.error('Error calculating duration:', e);
    return 'N/A';
  }
}

// Helper function to extract company name from job description
function extractCompanyName(jobDescription) {
  if (!jobDescription) return 'Unknown Company';
  
  // Clean up the job description
  const cleanText = jobDescription.trim();
  const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Try multiple extraction patterns
  const companyPatterns = [
    // Direct company mentions
    /(?:Company|Organization|Employer):\s*(.+)/i,
    /(?:About|At)\s+([A-Z][a-zA-Z\s&.,'-]+?)(?:\s*[-–—]|\s*\n|\s*is\s|\s*we\s)/i,
    
    // Job title patterns
    /(.+?)\s+(?:is\s+)?(?:hiring|seeking|looking\s+for|inviting\s+applications)/i,
    /(?:Join|Work\s+(?:at|with)|Career\s+at)\s+([A-Z][a-zA-Z\s&.,'-]+?)(?:\s*[-–—]|\s*\n|$)/i,
    
    // Position patterns
    /([A-Z][a-zA-Z\s&.,'-]+?)\s+(?:Job|Position|Role|Opening|Opportunity)/i,
    /([A-Z][a-zA-Z\s&.,'-]+?)\s+is\s+seeking/i,
    
    // Generic patterns
    /^([A-Z][a-zA-Z\s&.,'-]{2,50}?)(?:\s*[-–—]|\s*\n|\s*is\s|\s*seeks)/,
    /We\s+are\s+([A-Z][a-zA-Z\s&.,'-]+?)(?:\s*[-–—]|\s*\n|\s*,)/i,
    
    // Technology company patterns
    /((?:[A-Z][a-z]*\s*){1,3}(?:Tech|Technologies|Software|Solutions|Systems|Corp|Corporation|Inc|Ltd|LLC))/i,
    
    // Startup/modern company patterns
    /([A-Z][a-z]+(?:[A-Z][a-z]*)*)\s+(?:startup|company)/i
  ];
  
  // Try each pattern
  for (const pattern of companyPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      let companyName = match[1].trim();
      
      // Clean up the extracted name
      companyName = companyName
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .replace(/[.,:;!?]+$/, '') // Remove trailing punctuation
        .replace(/^(a|an|the)\s+/i, '') // Remove leading articles
        .trim();
      
      // Validate the extracted name
      if (companyName.length >= 2 && 
          companyName.length <= 60 && 
          /[a-zA-Z]/.test(companyName) && 
          !companyName.match(/^(we|our|the|this|that|job|position|role|candidate|applicant)$/i)) {
        
        // Capitalize properly
        companyName = companyName.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        return companyName;
      }
    }
  }
  
  // Fallback: try to extract from first meaningful line
  if (lines.length > 0) {
    const firstLine = lines[0];
    
    // If first line looks like a company name (starts with capital, reasonable length)
    if (firstLine.length > 2 && 
        firstLine.length < 80 && 
        /^[A-Z]/.test(firstLine) && 
        !firstLine.match(/^(job|position|role|we|hiring|seeking|looking)/i)) {
      
      // Clean and return first line
      let companyName = firstLine
        .replace(/[.,:;!?]+$/, '')
        .replace(/\s*[-–—].*$/, '') // Remove everything after dash
        .trim();
      
      if (companyName.length >= 2 && companyName.length <= 60) {
        return companyName;
      }
    }
  }
  
  // If all else fails, look for any capitalized words
  const words = cleanText.match(/\b[A-Z][a-zA-Z]{1,20}\b/g);
  if (words && words.length > 0) {
    // Take first 1-3 meaningful words
    const meaningfulWords = words
      .filter(word => !word.match(/^(Job|Position|Role|Hiring|We|Our|The|This|That|Company|And|For|With|At|Is|Are|Will|Can|May|Must|Should|Would|Could)$/i))
      .slice(0, 3);
    
    if (meaningfulWords.length > 0) {
      return meaningfulWords.join(' ');
    }
  }
  
  return 'Unknown Company';
}

// Enhanced function to display students with consolidated performance
function displayStudents(students) {
  const tableBody = document.getElementById('students-table-body');
  if (!tableBody) return;
  
  if (!students || students.length === 0) {
      tableBody.innerHTML = `
          <tr>
              <td colspan="6" class="text-center py-4">
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
    
    // Calculate average performance
    let avgPerformance = 'N/A';
    let performanceClass = 'performance-average';
    
    const completedSessions = studentSessions.filter(s => s.status === 'completed');
    const completedInterviews = studentInterviews.filter(i => i.status === 'completed');
    
    if (completedSessions.length > 0 || completedInterviews.length > 0) {
      let totalScore = 0;
      let scoreCount = 0;
      
      // Add session scores
      completedSessions.forEach(session => {
        const score = session.results?.match_results?.matchScore;
        if (score && typeof score === 'number') {
          totalScore += score;
          scoreCount++;
        }
      });
      
      // Add interview scores
      completedInterviews.forEach(interview => {
        const score = interview.analysis?.overallScore;
        if (score && typeof score === 'number') {
          totalScore += score;
          scoreCount++;
        }
      });
      
      if (scoreCount > 0) {
        avgPerformance = Math.round(totalScore / scoreCount);
        
        if (avgPerformance >= 80) performanceClass = 'performance-excellent';
        else if (avgPerformance >= 65) performanceClass = 'performance-good';
        else if (avgPerformance >= 45) performanceClass = 'performance-average';
        else performanceClass = 'performance-poor';
      }
    }
    
    html += `
      <tr>
        <td>${student.displayName || 'N/A'}</td>
        <td>${student.email || 'N/A'}</td>
        <td>${studentSessions.length}</td>
        <td>${studentInterviews.length}</td>
        <td>
          <span class="performance-indicator ${performanceClass}">
            ${avgPerformance !== 'N/A' ? avgPerformance + '%' : 'N/A'}
          </span>
        </td>
        <td>
          <div class="btn-group-vertical" role="group">
            <button class="btn btn-sm btn-success download-report-btn mb-1" 
                    data-id="${student.uid}" 
                    data-name="${student.displayName || 'Student'}"
                    title="Download Consolidated Report">
              <i class="fas fa-download"></i> Report
            </button>
            <button class="btn btn-sm btn-outline-primary edit-student-btn mb-1" 
                    data-id="${student.uid}" 
                    data-name="${student.displayName || ''}" 
                    data-email="${student.email || ''}"
                    data-college="${student.collegeId || ''}"
                    data-dept="${student.deptId || ''}"
                    data-section="${student.sectionId || ''}"
                    title="Edit Student">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-sm btn-outline-danger delete-student-btn" 
                    data-id="${student.uid}" 
                    data-name="${student.displayName || 'this student'}"
                    title="Delete Student">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  
  tableBody.innerHTML = html;
}

// Enhanced function to display sessions grouped by student (without company grouping)
function displaySessions(sessions) {
  const container = document.getElementById('sessions-grouped-container');
  if (!container) return;
  
  if (!sessions || sessions.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          No resume analysis sessions found.
        </div>
      </div>
    `;
    return;
  }
  
  // Group sessions by student
  const sessionsByStudent = {};
  sessions.forEach(session => {
    const student = authState.students.find(s => s.uid === session.userId);
    const studentName = student ? student.displayName : 'Unknown Student';
    const studentId = session.userId;
    
    if (!sessionsByStudent[studentId]) {
      sessionsByStudent[studentId] = {
        name: studentName,
        email: student ? student.email : 'Unknown',
        student: student,
        sessions: []
      };
    }
    sessionsByStudent[studentId].sessions.push(session);
  });
  
  let html = '';
  Object.keys(sessionsByStudent).forEach((studentId, index) => {
    const studentData = sessionsByStudent[studentId];
    
    // Calculate session statistics
    const completedSessions = studentData.sessions.filter(s => s.status === 'completed');
    const avgScore = completedSessions.length > 0 ? 
      Math.round(completedSessions.reduce((sum, session) => {
        const score = session.results?.match_results?.matchScore || 0;
        return sum + score;
      }, 0) / completedSessions.length) : 'N/A';
    
    // Performance classification
    let performanceClass = 'performance-average';
    if (avgScore !== 'N/A') {
      if (avgScore >= 80) performanceClass = 'performance-excellent';
      else if (avgScore >= 65) performanceClass = 'performance-good';
      else if (avgScore >= 45) performanceClass = 'performance-average';
      else performanceClass = 'performance-poor';
    }
    
    const collapseId = `sessionCollapse${index}`;
    
    html += `
      <div class="student-group-card card mb-4">
        <div class="student-group-header" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
          <div class="row align-items-center">
            <div class="col-md-4">
              <h5 class="mb-1">
                <i class="fas fa-chevron-right collapse-icon me-2"></i>
                ${studentData.name}
              </h5>
              <small class="text-light">${studentData.email}</small>
              ${studentData.student ? `
                <div class="mt-2">
                  <small class="badge bg-dark bg-opacity-75 text-white me-1">College: ${studentData.student.collegeId || 'N/A'}</small>
                  <small class="badge bg-dark bg-opacity-75 text-white me-1">Dept: ${studentData.student.deptId || 'N/A'}</small>
                  <small class="badge bg-dark bg-opacity-75 text-white">Section: ${studentData.student.sectionId || 'N/A'}</small>
                </div>
              ` : ''}
            </div>
            <div class="col-md-4 text-center">
              <div class="row">
                <div class="col-6">
                  <div class="stat-item">
                    <div class="stat-number">${studentData.sessions.length}</div>
                    <div class="stat-label">Total Sessions</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item">
                    <div class="stat-number">${completedSessions.length}</div>
                    <div class="stat-label">Completed</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-4 text-end">
              <div class="performance-summary">
                <div class="performance-indicator-large ${performanceClass} mb-2" style="margin: 0 auto;">
                  ${avgScore !== 'N/A' ? avgScore + '%' : 'N/A'}
                </div>
                <small class="performance-label">Average Match Score</small>
              </div>
            </div>
          </div>
        </div>
        <div class="collapse" id="${collapseId}">
          <div class="card-body p-0">
    `;
    
    // Sort sessions by date (newest first) and display directly
    const sortedSessions = [...studentData.sessions].sort((a, b) => 
      new Date(b.start_time || 0) - new Date(a.start_time || 0)
    );
    
    sortedSessions.forEach((session, sessionIndex) => {
      const sessionDate = formatToIST(session.start_time);
      const duration = calculateDuration(session.start_time, session.end_time);
      const status = session.status || 'unknown';
      
      // Extract basic session data
      const results = session.results || {};
      const matchResults = results.match_results || {};
      const matchScore = matchResults.matchScore || null;
      const jobRequirements = matchResults.jobRequirements || {};
      
      // Extract company name for display
      const companyName = extractCompanyName(session.jobDescription);
      
      // Status styling
      let statusClass = '';
      let statusIcon = '';
      switch(status) {
        case 'completed': 
          statusClass = 'status-completed'; 
          statusIcon = 'fas fa-check-circle';
          break;
        case 'processing': 
          statusClass = 'status-processing'; 
          statusIcon = 'fas fa-clock';
          break;
        case 'failed': 
          statusClass = 'status-failed'; 
          statusIcon = 'fas fa-times-circle';
          break;
        default: 
          statusClass = 'status-processing';
          statusIcon = 'fas fa-clock';
      }
      
      const getScoreClass = (score) => {
        if (score === null) return 'score-neutral';
        if (score >= 80) return 'score-excellent';
        if (score >= 65) return 'score-good';
        if (score >= 45) return 'score-average';
        return 'score-poor';
      };
      
      html += `
        <div class="session-detail-card-clean ${sessionIndex === 0 ? 'border-top' : ''}">
          <div class="session-header-clean">
            <div class="row align-items-center">
              <div class="col-md-6">
                <div class="session-basic-info">
                  <h6 class="session-title">
                    <i class="fas fa-file-alt me-2"></i>
                    Session #${sessionIndex + 1}
                    <span class="status-badge ${statusClass} ms-2">
                      <i class="${statusIcon} me-1"></i>${status.toUpperCase()}
                    </span>
                  </h6>
                  <div class="session-metadata">
                    <span class="metadata-item">
                      <i class="fas fa-building me-1"></i>${companyName}
                    </span>
                    <span class="metadata-item">
                      <i class="fas fa-calendar me-1"></i>${sessionDate}
                    </span>
                    <span class="metadata-item">
                      <i class="fas fa-clock me-1"></i>${duration}
                    </span>
                  </div>
                </div>
              </div>
              <div class="col-md-3 text-center">
                <div class="score-display ${getScoreClass(matchScore)}">
                  <div class="score-circle-small">
                    <span class="score-value">${matchScore !== null ? matchScore : 'N/A'}</span>
                    <span class="score-suffix">${matchScore !== null ? '%' : ''}</span>
                  </div>
                  <div class="score-label">Match Score</div>
                </div>
              </div>
              <div class="col-md-3 text-end">
                <div class="session-actions">
                  <button class="btn btn-sm btn-outline-primary view-session-btn" 
                          data-id="${session.id}" 
                          title="View Full Session Details">
                    <i class="fas fa-eye me-1"></i>Details
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          ${status === 'completed' && jobRequirements && Object.keys(jobRequirements).length > 0 ? `
            <div class="job-requirements-summary">
              <div class="row">
                <div class="col-md-3">
                  <div class="requirement-item">
                    <strong>Position:</strong> ${jobRequirements.jobTitle || 'Not specified'}
                  </div>
                </div>
                <div class="col-md-3">
                  <div class="requirement-item">
                    <strong>Experience:</strong> ${jobRequirements.experienceLevel || 'Not specified'}
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="requirement-item">
                    <strong>Education:</strong> ${jobRequirements.educationNeeded || 'Not specified'}
                  </div>
                </div>
              </div>
              ${jobRequirements.requiredSkills && jobRequirements.requiredSkills.length > 0 ? `
                <div class="required-skills mt-2">
                  <strong>Required Skills:</strong>
                  <div class="skills-tags-clean mt-1">
                    ${jobRequirements.requiredSkills.slice(0, 8).map(skill => 
                      `<span class="skill-tag-clean">${skill}</span>`
                    ).join('')}
                    ${jobRequirements.requiredSkills.length > 8 ? 
                      `<span class="more-skills">+${jobRequirements.requiredSkills.length - 8} more</span>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += `
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Enhanced collapse functionality
  document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
    button.addEventListener('click', function() {
      const icon = this.querySelector('.collapse-icon');
      const target = this.getAttribute('data-bs-target');
      const collapseElement = document.querySelector(target);
      
      if (collapseElement && icon) {
        collapseElement.addEventListener('shown.bs.collapse', function() {
          icon.style.transform = 'rotate(90deg)';
        });
        
        collapseElement.addEventListener('hidden.bs.collapse', function() {
          icon.style.transform = 'rotate(0deg)';
        });
      }
    });
  });
}

// Enhanced function to display interviews grouped by student
function displayInterviews(interviews) {
  const container = document.getElementById('interviews-grouped-container');
  if (!container) return;
  
  if (!interviews || interviews.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          No mock interviews found.
        </div>
      </div>
    `;
    return;
  }
  
  // Group interviews by student
  const interviewsByStudent = {};
  interviews.forEach(interview => {
    const student = authState.students.find(s => s.uid === interview.userId);
    const studentName = student ? student.displayName : 'Unknown Student';
    const studentId = interview.userId;
    
    if (!interviewsByStudent[studentId]) {
      interviewsByStudent[studentId] = {
        name: studentName,
        email: student ? student.email : 'Unknown',
        student: student,
        interviews: []
      };
    }
    interviewsByStudent[studentId].interviews.push(interview);
  });
  
  let html = '';
  Object.keys(interviewsByStudent).forEach((studentId, index) => {
    const studentData = interviewsByStudent[studentId];
    
    // Calculate comprehensive student stats
    const completedInterviews = studentData.interviews.filter(i => i.status === 'completed');
    const totalQuestions = studentData.interviews.reduce((total, interview) => {
      return total + (interview.conversation ? interview.conversation.filter(msg => msg.role === 'assistant').length : 0);
    }, 0);
    
    // Calculate average overall score only
    let avgOverallScore = 'N/A';
    
    if (completedInterviews.length > 0) {
      const overallScores = completedInterviews
        .map(i => i.analysis?.overallScore)
        .filter(score => score && typeof score === 'number');
      
      if (overallScores.length > 0) {
        avgOverallScore = Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length);
      }
    }
    
    // Performance classification
    let performanceClass = 'performance-average';
    if (avgOverallScore !== 'N/A') {
      if (avgOverallScore >= 80) performanceClass = 'performance-excellent';
      else if (avgOverallScore >= 65) performanceClass = 'performance-good';
      else if (avgOverallScore >= 45) performanceClass = 'performance-average';
      else performanceClass = 'performance-poor';
    }
    
    // Create unique collapse ID for each student
    const collapseId = `interviewCollapse${index}`;
    
    html += `
      <div class="student-group-card card mb-4">
        <div class="student-group-header" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
          <div class="row align-items-center">
            <div class="col-md-4">
              <h5 class="mb-1">
                <i class="fas fa-chevron-right collapse-icon me-2"></i>
                ${studentData.name}
              </h5>
              <small class="text-light">${studentData.email}</small>
              ${studentData.student ? `
                <div class="mt-2">
                  <small class="badge bg-dark bg-opacity-75 text-white me-1">College: ${studentData.student.collegeId || 'N/A'}</small>
                  <small class="badge bg-dark bg-opacity-75 text-white me-1">Dept: ${studentData.student.deptId || 'N/A'}</small>
                  <small class="badge bg-dark bg-opacity-75 text-white">Section: ${studentData.student.sectionId || 'N/A'}</small>
                </div>
              ` : ''}
            </div>
            <div class="col-md-4 text-center">
              <div class="row">
                <div class="col-6">
                  <div class="stat-item">
                    <div class="stat-number">${studentData.interviews.length}</div>
                    <div class="stat-label">Total Interviews</div>
                  </div>
                </div>
                <div class="col-6">
                  <div class="stat-item">
                    <div class="stat-number">${totalQuestions}</div>
                    <div class="stat-label">Questions Answered</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-4 text-end">
              <div class="performance-summary">
                <div class="performance-indicator-large ${performanceClass} mb-2" style="margin: 0 auto;">
                  ${avgOverallScore !== 'N/A' ? avgOverallScore + '%' : 'N/A'}
                </div>
                <small class="performance-label">Average Score</small>
              </div>
            </div>
          </div>
        </div>
        <div class="collapse" id="${collapseId}">
          <div class="card-body p-0">
    `;
    
    // Sort interviews by date (newest first)
    const sortedInterviews = [...studentData.interviews].sort((a, b) => {
      const dateA = new Date(a.start_time || 0);
      const dateB = new Date(b.start_time || 0);
      return dateB - dateA;
    });
    
    sortedInterviews.forEach((interview, interviewIndex) => {
      const interviewDate = formatToIST(interview.start_time);
      const duration = calculateDuration(interview.start_time, interview.end_time);
      const status = interview.status || 'unknown';
      const questionCount = interview.conversation ? interview.conversation.filter(msg => msg.role === 'assistant').length : 0;
      
      // Extract analysis data - only basic scores
      const analysis = interview.analysis || {};
      const overallScore = analysis.overallScore || null;
      const technicalScore = analysis.technicalAssessment?.score || null;
      const communicationScore = analysis.communicationAssessment?.score || null;
      const behavioralScore = analysis.behavioralAssessment?.score || null;
      
      // Status styling
      let statusClass = '';
      let statusIcon = '';
      switch(status) {
        case 'completed': 
          statusClass = 'status-completed'; 
          statusIcon = 'fas fa-check-circle';
          break;
        case 'active': 
          statusClass = 'status-active'; 
          statusIcon = 'fas fa-play-circle';
          break;
        case 'failed': 
          statusClass = 'status-failed'; 
          statusIcon = 'fas fa-times-circle';
          break;
        default: 
          statusClass = 'status-processing';
          statusIcon = 'fas fa-clock';
      }
      
      // Score styling function
      const getScoreClass = (score) => {
        if (score === null) return 'score-neutral';
        if (score >= 80) return 'score-excellent';
        if (score >= 65) return 'score-good';
        if (score >= 45) return 'score-average';
        return 'score-poor';
      };
      
      html += `
        <div class="interview-detail-card-clean ${interviewIndex === 0 ? 'border-top' : ''}">
          <div class="interview-header-clean">
            <div class="row align-items-center">
              <div class="col-md-5">
                <div class="interview-basic-info">
                  <h6 class="interview-title">
                    <i class="fas fa-video me-2"></i>
                    Interview #${interviewIndex + 1}
                    <span class="status-badge ${statusClass} ms-2">
                      <i class="${statusIcon} me-1"></i>${status.toUpperCase()}
                    </span>
                  </h6>
                  <div class="interview-metadata">
                    <span class="metadata-item">
                      <i class="fas fa-calendar me-1"></i>${interviewDate}
                    </span>
                    <span class="metadata-item">
                      <i class="fas fa-clock me-1"></i>${duration}
                    </span>
                    <span class="metadata-item">
                      <i class="fas fa-question-circle me-1"></i>${questionCount} questions
                    </span>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                ${status === 'completed' && analysis ? `
                  <div class="scores-summary-clean">
                    <div class="row text-center">
                      <div class="col-3">
                        ${overallScore !== null ? 
                          `<div class="score-badge-clean ${getScoreClass(overallScore)}">${overallScore}%</div>
                           <small class="score-label-clean">Overall</small>` : 
                          '<small class="text-muted">Overall<br>N/A</small>'}
                      </div>
                      <div class="col-3">
                        <div class="score-badge-clean score-technical">
                          ${technicalScore !== null ? technicalScore + '%' : '-'}
                        </div>
                        <small class="score-label-clean">Tech</small>
                      </div>
                      <div class="col-3">
                        <div class="score-badge-clean score-communication">
                          ${communicationScore !== null ? communicationScore + '%' : '-'}
                        </div>
                        <small class="score-label-clean">Comm</small>
                      </div>
                      <div class="col-3">
                        <div class="score-badge-clean score-behavioral">
                          ${behavioralScore !== null ? behavioralScore + '%' : '-'}
                        </div>
                        <small class="score-label-clean">Behav</small>
                      </div>
                    </div>
                  </div>
                ` : `
                  <div class="no-scores-message">
                    <small class="text-muted">Analysis not available</small>
                  </div>
                `}
              </div>
              <div class="col-md-3 text-end">
                <div class="interview-actions">
                  <button class="btn btn-sm btn-outline-primary me-2 view-interview-btn" 
                          data-id="${interview.id}" 
                          title="View Full Interview Details">
                    <i class="fas fa-eye me-1"></i>Details
                  </button>
                  <button class="btn btn-sm btn-outline-info download-transcript-btn" 
                          data-id="${interview.id}" 
                          data-student="${studentData.name}" 
                          title="Download Interview Transcript">
                    <i class="fas fa-download me-1"></i>Transcript
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += `
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // Enhanced collapse functionality with improved animations
  document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
    button.addEventListener('click', function() {
      const icon = this.querySelector('.collapse-icon');
      const target = this.getAttribute('data-bs-target');
      const collapseElement = document.querySelector(target);
      
      if (collapseElement && icon) {
        collapseElement.addEventListener('shown.bs.collapse', function() {
          icon.style.transform = 'rotate(90deg)';
        });
        
        collapseElement.addEventListener('hidden.bs.collapse', function() {
          icon.style.transform = 'rotate(0deg)';
        });
      }
    });
  });
}

// Function to generate and download consolidated student report
function downloadStudentReport(studentId, studentName) {
  if (!studentId) {
    showErrorMessage('Unable to generate report: Student ID missing');
    return;
  }
  
  const studentSessions = authState.sessions.filter(session => session.userId === studentId);
  const studentInterviews = authState.interviews.filter(interview => interview.userId === studentId);
  const student = authState.students.find(s => s.uid === studentId);
  
  // Import jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // Set up fonts and colors
  const primaryColor = [74, 111, 220]; // #4a6fdc
  const secondaryColor = [108, 117, 125]; // #6c757d
  const successColor = [40, 167, 69]; // #28a745
  const warningColor = [255, 193, 7]; // #ffc107
  const dangerColor = [220, 53, 69]; // #dc3545
  
  let yPosition = 20;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  // Helper function to add new page if needed
  function checkNewPage(requiredHeight = 20) {
    if (yPosition + requiredHeight > doc.internal.pageSize.height - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  }
  
  // Helper function to wrap text
  function addWrappedText(text, x, y, maxWidth, fontSize = 10) {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return lines.length * (fontSize * 0.35);
  }
  
  // Title
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.text('IRIS STUDENT PERFORMANCE REPORT', margin, yPosition);
  yPosition += 15;
  
  // Subtitle line
  doc.setLineWidth(2);
  doc.setDrawColor(...primaryColor);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;
  
  // Student Information Section
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Student Information', margin, yPosition);
  yPosition += 10;
  
  doc.setFontSize(12);
  doc.text(`Name: ${studentName}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Email: ${student ? student.email : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`College ID: ${student ? student.collegeId || 'N/A' : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Department ID: ${student ? student.deptId || 'N/A' : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Section ID: ${student ? student.sectionId || 'N/A' : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Report Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, margin, yPosition);
  yPosition += 15;
  
  // Performance Summary Section
  checkNewPage(50);
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.text('Performance Summary', margin, yPosition);
  yPosition += 10;
  
  // Calculate statistics
  const completedSessions = studentSessions.filter(s => s.status === 'completed');
  const completedInterviews = studentInterviews.filter(i => i.status === 'completed');
  
  let avgResumeScore = 'N/A';
  let avgInterviewScore = 'N/A';
  let overallAverage = 'N/A';
  
  if (completedSessions.length > 0) {
    const resumeScores = completedSessions
      .map(s => s.results?.match_results?.matchScore)
      .filter(score => score && typeof score === 'number');
    
    if (resumeScores.length > 0) {
      avgResumeScore = Math.round(resumeScores.reduce((a, b) => a + b, 0) / resumeScores.length);
    }
  }
  
  if (completedInterviews.length > 0) {
    const interviewScores = completedInterviews
      .map(i => i.analysis?.overallScore)
      .filter(score => score && typeof score === 'number');
    
    if (interviewScores.length > 0) {
      avgInterviewScore = Math.round(interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length);
    }
  }
  
  // Calculate overall average
  const allScores = [];
  if (avgResumeScore !== 'N/A') allScores.push(avgResumeScore);
  if (avgInterviewScore !== 'N/A') allScores.push(avgInterviewScore);
  
  if (allScores.length > 0) {
    overallAverage = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  }
  
  // Summary statistics
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total Resume Analyses: ${studentSessions.length}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Total Mock Interviews: ${studentInterviews.length}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Average Resume Match Score: ${avgResumeScore !== 'N/A' ? avgResumeScore + '%' : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  doc.text(`Average Interview Score: ${avgInterviewScore !== 'N/A' ? avgInterviewScore + '%' : 'N/A'}`, margin, yPosition);
  yPosition += 7;
  
  // Overall performance with color coding
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  if (overallAverage !== 'N/A') {
    if (overallAverage >= 80) doc.setTextColor(...successColor);
    else if (overallAverage >= 65) doc.setTextColor(23, 162, 184); // info color
    else if (overallAverage >= 45) doc.setTextColor(...warningColor);
    else doc.setTextColor(...dangerColor);
  }
  doc.text(`Overall Average Performance: ${overallAverage !== 'N/A' ? overallAverage + '%' : 'N/A'}`, margin, yPosition);
  yPosition += 20;
  
  // Resume Analysis Sessions
  if (studentSessions.length > 0) {
    checkNewPage(30);
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('Resume Analysis Sessions', margin, yPosition);
    yPosition += 15;
    
    studentSessions.forEach((session, index) => {
      checkNewPage(40);
      
      const companyName = extractCompanyName(session.jobDescription);
      const sessionDate = formatToIST(session.start_time);
      const matchScore = session.results?.match_results?.matchScore || 'N/A';
      const status = session.status || 'Unknown';
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${companyName}`, margin, yPosition);
      yPosition += 8;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Date: ${sessionDate}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Status: ${status}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Match Score: ${matchScore !== 'N/A' ? matchScore + '%' : 'N/A'}`, margin + 10, yPosition);
      yPosition += 10;
      
      // Add key strengths if available
      if (session.results?.match_results?.keyStrengths && session.results.match_results.keyStrengths.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('Key Strengths:', margin + 10, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        
        session.results.match_results.keyStrengths.slice(0, 3).forEach(strength => {
          const strengthText = `• ${strength.strength || 'N/A'}`;
          yPosition += addWrappedText(strengthText, margin + 15, yPosition, contentWidth - 25, 10);
          yPosition += 2;
        });
        yPosition += 5;
      }
      
      // Add skill gaps/weaknesses if available
      if (session.results?.match_results?.skillGaps && session.results.match_results.skillGaps.length > 0) {
        checkNewPage(20);
        doc.setFont(undefined, 'bold');
        doc.text('Skill Gaps:', margin + 10, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        
        session.results.match_results.skillGaps.slice(0, 3).forEach(gap => {
          const gapText = `• ${gap.missingSkill || 'N/A'} (${gap.importance || 'medium'} priority)`;
          yPosition += addWrappedText(gapText, margin + 15, yPosition, contentWidth - 25, 10);
          if (gap.suggestion) {
            yPosition += addWrappedText(`  Suggestion: ${gap.suggestion}`, margin + 20, yPosition, contentWidth - 30, 9);
          }
          yPosition += 3;
        });
        yPosition += 5;
      }
      
      yPosition += 5;
    });
  }
  
  // Mock Interview Sessions
  if (studentInterviews.length > 0) {
    checkNewPage(30);
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont(undefined, 'bold');
    doc.text('Mock Interview Sessions', margin, yPosition);
    yPosition += 15;
    
    studentInterviews.forEach((interview, index) => {
      checkNewPage(50);
      
      const companyName = extractCompanyName(interview.jobDescription) || interview.interviewType || 'General';
      const interviewDate = formatToIST(interview.start_time);
      const duration = calculateDuration(interview.start_time, interview.end_time);
      const overallScore = interview.analysis?.overallScore || 'N/A';
      const technicalScore = interview.analysis?.technicalAssessment?.score || 'N/A';
      const communicationScore = interview.analysis?.communicationAssessment?.score || 'N/A';
      const behavioralScore = interview.analysis?.behavioralAssessment?.score || 'N/A';
      const status = interview.status || 'Unknown';
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(`${index + 1}. ${companyName}`, margin, yPosition);
      yPosition += 8;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Date: ${interviewDate}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Duration: ${duration}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Status: ${status}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Overall Score: ${overallScore !== 'N/A' ? overallScore + '%' : 'N/A'}`, margin + 10, yPosition);
      yPosition += 6;
      doc.text(`Technical: ${technicalScore !== 'N/A' ? technicalScore + '%' : 'N/A'} | Communication: ${communicationScore !== 'N/A' ? communicationScore + '%' : 'N/A'} | Behavioral: ${behavioralScore !== 'N/A' ? behavioralScore + '%' : 'N/A'}`, margin + 10, yPosition);
      yPosition += 10;
      
      // Add overall assessment if available
      if (interview.analysis?.overallAssessment) {
        checkNewPage(30);
        doc.setFont(undefined, 'bold');
        doc.text('Assessment:', margin + 10, yPosition);
        yPosition += 6;
        doc.setFont(undefined, 'normal');
        // Show complete assessment without truncation
        yPosition += addWrappedText(interview.analysis.overallAssessment, margin + 15, yPosition, contentWidth - 25, 10);
        yPosition += 8;
      }
      
      // Add detailed feedback if available
      const assessments = ['technicalAssessment', 'communicationAssessment', 'behavioralAssessment'];
      const assessmentLabels = ['Technical', 'Communication', 'Behavioral'];
      
      assessments.forEach((assessmentKey, idx) => {
        const assessment = interview.analysis?.[assessmentKey];
        if (assessment?.feedback) {
          checkNewPage(25);
          doc.setFont(undefined, 'bold');
          doc.text(`${assessmentLabels[idx]} Feedback:`, margin + 10, yPosition);
          yPosition += 6;
          doc.setFont(undefined, 'normal');
          yPosition += addWrappedText(assessment.feedback, margin + 15, yPosition, contentWidth - 25, 10);
          yPosition += 8;
        }
      });
      
      yPosition += 5;
    });
  }
  
  // Recommendations
  checkNewPage(30);
  doc.setFontSize(16);
  doc.setTextColor(...primaryColor);
  doc.setFont(undefined, 'bold');
  doc.text('Recommendations', margin, yPosition);
  yPosition += 15;
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  if (overallAverage !== 'N/A') {
    let recommendation = '';
    if (overallAverage >= 80) {
      recommendation = 'Excellent performance! Continue maintaining this high standard and consider mentoring other students.';
    } else if (overallAverage >= 65) {
      recommendation = 'Good performance with room for improvement. Focus on identified skill gaps and practice regularly.';
    } else if (overallAverage >= 45) {
      recommendation = 'Average performance. Significant improvement needed in weak areas. Consider additional preparation and practice.';
    } else {
      recommendation = 'Performance needs substantial improvement. Consider intensive preparation, additional resources, and regular practice sessions.';
    }
    
    yPosition += addWrappedText(recommendation, margin, yPosition, contentWidth, 12);
    yPosition += 10;
  }
  
  const generalRecommendations = [
    'Practice mock interviews regularly to build confidence',
    'Work on identified skill gaps from resume analysis',
    'Improve communication and presentation skills',
    'Stay updated with industry trends and requirements',
    'Seek feedback and act on improvement suggestions'
  ];
  
  doc.setFont(undefined, 'bold');
  doc.text('General Recommendations:', margin, yPosition);
  yPosition += 8;
  doc.setFont(undefined, 'normal');
  
  generalRecommendations.forEach(rec => {
    yPosition += addWrappedText(`• ${rec}`, margin, yPosition, contentWidth, 11);
    yPosition += 3;
  });
  
  // Footer
  checkNewPage(30);
  yPosition = doc.internal.pageSize.height - 30;
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text('Generated by IRIS Teacher Dashboard', margin, yPosition);
  doc.text(`© ${new Date().getFullYear()} IRIS - Interview Readiness & Improvement System`, margin, yPosition + 7);
  
  // Save the PDF
  const fileName = `IRIS_Student_Report_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
  
  showSuccessMessage('Student report PDF downloaded successfully!');
}


// Function to download interview transcript
function downloadInterviewTranscript(interviewId, studentName) {
  if (!interviewId) {
    showErrorMessage('Unable to download transcript: Interview ID missing');
    return;
  }
  
  const db = firebase.firestore();
  db.collection('interviews').doc(interviewId).get()
    .then(doc => {
      if (!doc.exists) {
        showErrorMessage('Interview not found');
        return;
      }
      
      const interview = doc.data();
      const conversation = interview.conversation || [];
      
      // Import jsPDF
      const { jsPDF } = window.jspdf;
      const pdfDoc = new jsPDF();
      
      const primaryColor = [74, 111, 220];
      const secondaryColor = [108, 117, 125];
      const interviewerColor = [0, 123, 255];
      const studentColor = [40, 167, 69];
      
      let yPos = 20;
      const pageWidth = pdfDoc.internal.pageSize.width;
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;
      
      // Helper function to add new page if needed
      function checkNewPage(requiredHeight = 20) {
        if (yPos + requiredHeight > pdfDoc.internal.pageSize.height - 20) {
          pdfDoc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      }
      
      // Helper function to wrap text
      function addWrappedText(text, x, y, maxWidth, fontSize = 10) {
        pdfDoc.setFontSize(fontSize);
        const lines = pdfDoc.splitTextToSize(text, maxWidth);
        pdfDoc.text(lines, x, y);
        return lines.length * (fontSize * 0.35);
      }
      
      // Title
      pdfDoc.setFontSize(20);
      pdfDoc.setTextColor(...primaryColor);
      pdfDoc.text('IRIS Mock Interview Transcript', margin, yPos);
      yPos += 15;
      
      // Subtitle line
      pdfDoc.setLineWidth(1);
      pdfDoc.setDrawColor(...primaryColor);
      pdfDoc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;
      
      // Interview Information
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.text(`Student: ${studentName}`, margin, yPos);
      yPos += 7;
      pdfDoc.text(`Date: ${interview.start_time ? formatToIST(interview.start_time) : 'N/A'}`, margin, yPos);
      yPos += 7;
      pdfDoc.text(`Duration: ${calculateDuration(interview.start_time, interview.end_time)}`, margin, yPos);
      yPos += 7;
      pdfDoc.text(`Overall Score: ${interview.analysis?.overallScore || 'N/A'}%`, margin, yPos);
      yPos += 15;
      
      // Performance Summary
      if (interview.analysis) {
        pdfDoc.setFontSize(14);
        pdfDoc.setTextColor(...primaryColor);
        pdfDoc.setFont(undefined, 'bold');
        pdfDoc.text('Performance Summary', margin, yPos);
        yPos += 10;
        
        pdfDoc.setFontSize(11);
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFont(undefined, 'normal');
        pdfDoc.text(`Technical Score: ${interview.analysis.technicalAssessment?.score || 'N/A'}%`, margin, yPos);
        yPos += 6;
        pdfDoc.text(`Communication Score: ${interview.analysis.communicationAssessment?.score || 'N/A'}%`, margin, yPos);
        yPos += 6;
        pdfDoc.text(`Behavioral Score: ${interview.analysis.behavioralAssessment?.score || 'N/A'}%`, margin, yPos);
        yPos += 6;
        
        if (interview.analysis.overallAssessment) {
          yPos += 5;
          pdfDoc.setFont(undefined, 'bold');
          pdfDoc.text('Overall Assessment:', margin, yPos);
          yPos += 6;
          pdfDoc.setFont(undefined, 'normal');
          // Show complete assessment without truncation
          yPos += addWrappedText(interview.analysis.overallAssessment, margin, yPos, contentWidth, 10);
          yPos += 10;
        }
        
        // Add detailed feedback for each assessment area
        const assessments = [
          { key: 'technicalAssessment', label: 'Technical Feedback' },
          { key: 'communicationAssessment', label: 'Communication Feedback' },
          { key: 'behavioralAssessment', label: 'Behavioral Feedback' }
        ];
        
        assessments.forEach(({ key, label }) => {
          const assessment = interview.analysis[key];
          if (assessment?.feedback) {
            checkNewPage(20);
            pdfDoc.setFont(undefined, 'bold');
            pdfDoc.text(`${label}:`, margin, yPos);
            yPos += 6;
            pdfDoc.setFont(undefined, 'normal');
            yPos += addWrappedText(assessment.feedback, margin, yPos, contentWidth, 10);
            yPos += 8;
          }
        });
        yPos += 15;
      }
      
      // Conversation Transcript
      checkNewPage(30);
      pdfDoc.setFontSize(14);
      pdfDoc.setTextColor(...primaryColor);
      pdfDoc.setFont(undefined, 'bold');
      pdfDoc.text('Interview Conversation', margin, yPos);
      yPos += 15;
      
      conversation.forEach((msg, index) => {
        checkNewPage(25);
        
        const speaker = msg.role === 'assistant' ? 'INTERVIEWER' : 'STUDENT';
        const isInterviewer = msg.role === 'assistant';
        
        // Speaker label with color
        pdfDoc.setFontSize(11);
        pdfDoc.setFont(undefined, 'bold');
        pdfDoc.setTextColor(...(isInterviewer ? interviewerColor : studentColor));
        pdfDoc.text(`${speaker}:`, margin, yPos);
        yPos += 8;
        
        // Message content
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFont(undefined, 'normal');
        yPos += addWrappedText(msg.content || 'No content', margin + 5, yPos, contentWidth - 5, 10);
        yPos += 8;
      });
      
      // Footer
      checkNewPage(20);
      yPos = pdfDoc.internal.pageSize.height - 25;
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(...secondaryColor);
      pdfDoc.text('Generated by IRIS Teacher Dashboard', margin, yPos);
      pdfDoc.text(`© ${new Date().getFullYear()} IRIS - Interview Readiness & Improvement System`, margin, yPos + 6);
      
      // Save the PDF
      const fileName = `Interview_Transcript_${studentName}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdfDoc.save(fileName);
      
      showSuccessMessage('Interview transcript PDF downloaded successfully!');
    })
    .catch(error => {
      console.error('Error downloading transcript:', error);
      showErrorMessage(`Error downloading transcript: ${error.message}`);
    });
}



// Load jsPDF library if not already loaded
function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      console.log('jsPDF loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('Failed to load jsPDF');
      reject(new Error('Failed to load jsPDF library'));
    };
    document.head.appendChild(script);
  });
}


// Student edit function
function editStudent(studentId, currentData) {
  // Create edit modal HTML
  const modalHtml = `
    <div class="modal fade" id="editStudentModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Student Profile</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <form id="editStudentForm">
              <div class="mb-3">
                <label for="editStudentName" class="form-label">Student Name</label>
                <input type="text" class="form-control" id="editStudentName" value="${currentData.name}" required>
              </div>
              <div class="mb-3">
                <label for="editStudentEmail" class="form-label">Email (readonly)</label>
                <input type="email" class="form-control" id="editStudentEmail" value="${currentData.email}" readonly>
              </div>
              <div class="mb-3">
                <label for="editStudentCollege" class="form-label">College ID</label>
                <input type="text" class="form-control" id="editStudentCollege" value="${currentData.college}">
              </div>
              <div class="mb-3">
                <label for="editStudentDept" class="form-label">Department ID</label>
                <input type="text" class="form-control" id="editStudentDept" value="${currentData.dept}">
              </div>
              <div class="mb-3">
                <label for="editStudentSection" class="form-label">Section ID</label>
                <input type="text" class="form-control" id="editStudentSection" value="${currentData.section}">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="saveStudentChanges" data-student-id="${studentId}">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('editStudentModal');
  if (existingModal) existingModal.remove();
  
  // Add modal to DOM
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('editStudentModal'));
  modal.show();
  
  // Handle save button
  document.getElementById('saveStudentChanges').addEventListener('click', function() {
    const newData = {
      displayName: document.getElementById('editStudentName').value.trim(),
      collegeId: document.getElementById('editStudentCollege').value.trim() || null,
      deptId: document.getElementById('editStudentDept').value.trim() || null,
      sectionId: document.getElementById('editStudentSection').value.trim() || null,
      updatedAt: new Date().toISOString()
    };
    
    saveStudentChanges(studentId, newData, modal);
  });
}

// Save student changes function
function saveStudentChanges(studentId, newData, modal) {
  if (!firebase.firestore || !studentId) {
    showErrorMessage('Unable to save changes: Database not available');
    return;
  }
  
  const saveBtn = document.getElementById('saveStudentChanges');
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
  
  const db = firebase.firestore();
  db.collection('users').doc(studentId).update(newData)
    .then(() => {
      // Update local state
      const studentIndex = authState.students.findIndex(s => s.uid === studentId);
      if (studentIndex !== -1) {
        Object.assign(authState.students[studentIndex], newData);
        displayStudents(authState.students);
      }
      
      showSuccessMessage('Student profile updated successfully!');
      modal.hide();
    })
    .catch(error => {
      console.error('Error updating student:', error);
      showErrorMessage(`Error updating student: ${error.message}`);
    })
    .finally(() => {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    });
}

// Delete student function
function deleteStudent(studentId, studentName) {
  if (!firebase.firestore || !studentId) {
    showErrorMessage('Unable to delete student: Database not available');
    return;
  }
  
  // Show confirmation dialog
  if (!confirm(`Are you sure you want to delete ${studentName}'s profile? This action cannot be undone and will delete all their data including resume sessions and interview records.`)) {
    return;
  }
  
  const db = firebase.firestore();
  
  // Show loading state
  showMessage('Deleting student profile...', 'info');
  
  // Delete user profile
  db.collection('users').doc(studentId).delete()
    .then(() => {
      // Remove from local state
      authState.students = authState.students.filter(s => s.uid !== studentId);
      authState.sessions = authState.sessions.filter(s => s.userId !== studentId);
      authState.interviews = authState.interviews.filter(i => i.userId !== studentId);
      
      // Refresh displays
      displayStudents(authState.students);
      displaySessions(authState.sessions);
      displayInterviews(authState.interviews);
      updateStatsDisplay();
      
      showSuccessMessage(`${studentName}'s profile has been deleted successfully.`);
    })
    .catch(error => {
      console.error('Error deleting student:', error);
      showErrorMessage(`Error deleting student: ${error.message}`);
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

function showMessage(message, type = 'info', duration = 5000) {
  const errorContainer = document.getElementById('error-messages');
  if (errorContainer) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} alert-dismissible fade show`;
    messageDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    errorContainer.appendChild(messageDiv);
    
    // Auto-dismiss after duration
    setTimeout(() => {
      messageDiv.classList.remove('show');
      setTimeout(() => messageDiv.remove(), 500);
    }, duration);
  }
}

// Session and Interview detail functions (keep existing ones)
function showSessionDetails(sessionId) {
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
      
      const startTime = session.start_time ? formatToIST(session.start_time) : 'N/A';
      const endTime = session.end_time ? formatToIST(session.end_time) : 'N/A';
      const duration = calculateDuration(session.start_time, session.end_time);
      
      const results = session.results || {};
      const matchResults = results.match_results || {};
      const matchScore = matchResults.matchScore || 'N/A';
      const matchAnalysis = matchResults.matchAnalysis || 'No analysis available.';
      const jobRequirements = matchResults.jobRequirements || {};
      const parsedResume = matchResults.parsedResume || {};
      const keyStrengths = matchResults.keyStrengths || [];
      const skillGaps = matchResults.skillGaps || [];
      const resumeImprovements = matchResults.resumeImprovements || [];
      const prepPlan = matchResults.prep_plan || {};
      
      const companyName = extractCompanyName(session.jobDescription);
      
      let html = `
        <div class="session-details-header mb-4">
          <div class="row">
            <div class="col-md-8">
              <h4>${studentName} - Resume Analysis</h4>
              <p class="text-muted mb-2">${companyName}</p>
              <div class="session-meta">
                <span class="badge bg-primary me-2">Session ID: ${session.id}</span>
                <span class="badge ${session.status === 'completed' ? 'bg-success' : session.status === 'failed' ? 'bg-danger' : 'bg-warning'}">${session.status || 'N/A'}</span>
              </div>
            </div>
            <div class="col-md-4 text-end">
              <div class="score-display-large">
                <div class="score-circle-large ${matchScore >= 70 ? 'score-high' : matchScore >= 40 ? 'score-medium' : 'score-low'}">
                  <span class="score-value-large">${matchScore}</span>
                  <span class="score-suffix-large">%</span>
                </div>
                <div class="score-label-large">Match Score</div>
              </div>
            </div>
          </div>
          <div class="row mt-3">
            <div class="col-md-4">
              <strong>Start Time:</strong> ${startTime}
            </div>
            <div class="col-md-4">
              <strong>End Time:</strong> ${endTime}
            </div>
            <div class="col-md-4">
              <strong>Duration:</strong> ${duration}
            </div>
          </div>
        </div>
        
        <!-- Job Description and Requirements -->
        <div class="section-container mb-4">
          <h5><i class="fas fa-briefcase me-2"></i>Job Description & Requirements</h5>
          <div class="job-description-container">
            <div class="job-description-text">
              ${session.jobDescription ? session.jobDescription.substring(0, 500) + (session.jobDescription.length > 500 ? '...' : '') : 'No job description available'}
            </div>
            ${session.jobDescription && session.jobDescription.length > 500 ? `
              <button class="btn btn-sm btn-outline-secondary mt-2" onclick="this.previousElementSibling.textContent='${session.jobDescription.replace(/'/g, "\\'")}'; this.style.display='none';">
                Show Full Description
              </button>
            ` : ''}
          </div>
          
          ${Object.keys(jobRequirements).length > 0 ? `
            <div class="job-requirements mt-3">
              <h6>Extracted Requirements:</h6>
              <div class="row">
                ${jobRequirements.jobTitle ? `
                  <div class="col-md-6 mb-2">
                    <strong>Position:</strong> ${jobRequirements.jobTitle}
                  </div>
                ` : ''}
                ${jobRequirements.experienceLevel ? `
                  <div class="col-md-6 mb-2">
                    <strong>Experience:</strong> ${jobRequirements.experienceLevel}
                  </div>
                ` : ''}
                ${jobRequirements.educationNeeded ? `
                  <div class="col-md-12 mb-2">
                    <strong>Education:</strong> ${jobRequirements.educationNeeded}
                  </div>
                ` : ''}
              </div>
              ${jobRequirements.requiredSkills && jobRequirements.requiredSkills.length > 0 ? `
                <div class="required-skills-section mt-2">
                  <strong>Required Skills:</strong>
                  <div class="skills-container mt-1">
                    ${jobRequirements.requiredSkills.map(skill => 
                      `<span class="skill-tag-detailed">${skill}</span>`
                    ).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        
        <!-- Parsed Resume Information -->
        ${Object.keys(parsedResume).length > 0 ? `
          <div class="section-container mb-4">
            <h5><i class="fas fa-user me-2"></i>Candidate Profile</h5>
            <div class="row">
              ${parsedResume.name ? `
                <div class="col-md-6 mb-2">
                  <strong>Name:</strong> ${parsedResume.name}
                </div>
              ` : ''}
              ${parsedResume.email ? `
                <div class="col-md-6 mb-2">
                  <strong>Email:</strong> ${parsedResume.email}
                </div>
              ` : ''}
              ${parsedResume.phoneNumber ? `
                <div class="col-md-6 mb-2">
                  <strong>Phone:</strong> ${parsedResume.phoneNumber}
                </div>
              ` : ''}
              ${parsedResume.location ? `
                <div class="col-md-6 mb-2">
                  <strong>Location:</strong> ${parsedResume.location}
                </div>
              ` : ''}
              ${parsedResume.yearsOfExperience ? `
                <div class="col-md-6 mb-2">
                  <strong>Experience:</strong> ${parsedResume.yearsOfExperience}
                </div>
              ` : ''}
              ${parsedResume.currentPosition ? `
                <div class="col-md-6 mb-2">
                  <strong>Current Position:</strong> ${parsedResume.currentPosition}
                </div>
              ` : ''}
            </div>
            
            ${parsedResume.education && parsedResume.education.length > 0 ? `
              <div class="education-section mt-3">
                <strong>Education:</strong>
                <ul class="list-unstyled mt-1">
                  ${parsedResume.education.map(edu => `<li>• ${edu}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${parsedResume.technicalSkills && parsedResume.technicalSkills.length > 0 ? `
              <div class="technical-skills-section mt-3">
                <strong>Technical Skills:</strong>
                <div class="skills-container mt-1">
                  ${parsedResume.technicalSkills.map(skill => 
                    `<span class="skill-tag-detailed">${skill}</span>`
                  ).join('')}
                </div>
              </div>
            ` : ''}
            
            ${parsedResume.companiesWorkedAt && parsedResume.companiesWorkedAt.length > 0 ? `
              <div class="companies-section mt-3">
                <strong>Companies Worked At:</strong>
                <ul class="list-unstyled mt-1">
                  ${parsedResume.companiesWorkedAt.map(company => `<li>• ${company}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${parsedResume.projects && parsedResume.projects.length > 0 ? `
              <div class="projects-section mt-3">
                <strong>Projects:</strong>
                <ul class="list-unstyled mt-1">
                  ${parsedResume.projects.map(project => `<li>• ${project}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        ` : ''}
        
        <!-- Match Analysis -->
        ${matchAnalysis ? `
          <div class="section-container mb-4">
            <h5><i class="fas fa-chart-line me-2"></i>Match Analysis</h5>
            <div class="analysis-content-detailed">
              ${matchAnalysis}
            </div>
          </div>
        ` : ''}
        
        <!-- Detailed Strengths and Gaps -->
        <div class="row mb-4">
          <div class="col-lg-6">
            <div class="section-container">
              <h5 class="text-success"><i class="fas fa-check-circle me-2"></i>Key Strengths</h5>
              ${keyStrengths.length > 0 ? `
                <div class="strengths-detailed">
                  ${keyStrengths.map(strength => `
                    <div class="strength-item-detailed">
                      <h6 class="strength-title">${strength.strength || 'Strength not specified'}</h6>
                      <p class="strength-relevance">${strength.relevance || 'No relevance provided'}</p>
                      ${strength.howToEmphasize ? `
                        <div class="strength-emphasis-detailed">
                          <strong>How to emphasize:</strong> ${strength.howToEmphasize}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p class="text-muted">No key strengths identified in this analysis.</p>
              `}
            </div>
          </div>
          
          <div class="col-lg-6">
            <div class="section-container">
              <h5 class="text-warning"><i class="fas fa-exclamation-triangle me-2"></i>Skill Gaps</h5>
              ${skillGaps.length > 0 ? `
                <div class="skill-gaps-detailed">
                  ${skillGaps.map(gap => `
                    <div class="skill-gap-item-detailed">
                      <div class="gap-header-detailed">
                        <h6 class="gap-skill">${gap.missingSkill || 'Skill not specified'}</h6>
                        <span class="importance-badge-detailed importance-${gap.importance || 'medium'}">
                          ${(gap.importance || 'medium').toUpperCase()} PRIORITY
                        </span>
                      </div>
                      <p class="gap-suggestion">${gap.suggestion || 'No suggestion provided'}</p>
                      ${gap.alternateSkillToHighlight ? `
                        <div class="alternate-skill-detailed">
                          <strong>Alternative skill to highlight:</strong> ${gap.alternateSkillToHighlight}
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p class="text-muted">No significant skill gaps identified.</p>
              `}
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
      
      const startTime = interview.start_time ? formatToIST(interview.start_time) : 'N/A';
      const endTime = interview.end_time ? formatToIST(interview.end_time) : 'N/A';
      const duration = calculateDuration(interview.start_time, interview.end_time);
      
      const analysis = interview.analysis || {};
      const overallScore = analysis.overallScore || null;
      const overallAssessment = analysis.overallAssessment || '';
      
      const technicalAssessment = analysis.technicalAssessment || {};
      const communicationAssessment = analysis.communicationAssessment || {};
      const behavioralAssessment = analysis.behavioralAssessment || {};
      const keyImprovementAreas = analysis.keyImprovementAreas || [];
      
      const conversation = interview.conversation || [];
      const questionCount = conversation.filter(msg => msg.role === 'assistant').length;
      
      const getScoreClass = (score) => {
        if (score === null) return 'score-neutral';
        if (score >= 80) return 'score-excellent';
        if (score >= 65) return 'score-good';
        if (score >= 45) return 'score-average';
        return 'score-poor';
      };
      
      let html = `
        <div class="interview-details-header mb-4">
          <div class="row">
            <div class="col-md-8">
              <h4>${studentName} - Mock Interview</h4>
              <p class="text-muted mb-2">Interview Type: ${interview.interviewType || 'General'}</p>
              <div class="interview-meta">
                <span class="badge bg-primary me-2">Interview ID: ${interview.id}</span>
                <span class="badge ${interview.status === 'completed' ? 'bg-success' : interview.status === 'failed' ? 'bg-danger' : interview.status === 'active' ? 'bg-info' : 'bg-warning'}">${interview.status || 'N/A'}</span>
              </div>
            </div>
            <div class="col-md-4 text-end">
              <div class="score-display-large">
                <div class="score-circle-large ${getScoreClass(overallScore)}">
                  <span class="score-value-large">${overallScore !== null ? overallScore : 'N/A'}</span>
                  <span class="score-suffix-large">${overallScore !== null ? '%' : ''}</span>
                </div>
                <div class="score-label-large">Overall Score</div>
              </div>
            </div>
          </div>
          <div class="row mt-3">
            <div class="col-md-3">
              <strong>Start Time:</strong> ${startTime}
            </div>
            <div class="col-md-3">
              <strong>End Time:</strong> ${endTime}
            </div>
            <div class="col-md-3">
              <strong>Duration:</strong> ${duration}
            </div>
            <div class="col-md-3">
              <strong>Questions:</strong> ${questionCount}
            </div>
          </div>
        </div>
        
        ${interview.status === 'completed' && analysis ? `
          <!-- Overall Assessment -->
          ${overallAssessment ? `
            <div class="section-container mb-4">
              <h5><i class="fas fa-clipboard-check me-2"></i>Overall Assessment</h5>
              <div class="assessment-content-detailed">
                ${overallAssessment}
              </div>
            </div>
          ` : ''}
          
          <!-- Detailed Performance Analysis -->
          <div class="performance-analysis-detailed mb-4">
            <h5><i class="fas fa-chart-bar me-2"></i>Performance Analysis</h5>
            <div class="row">
              <!-- Technical Assessment -->
              <div class="col-lg-4 mb-4">
                <div class="assessment-card-detailed technical-card">
                  <div class="assessment-header-detailed">
                    <div class="d-flex justify-content-between align-items-center">
                      <h6><i class="fas fa-code me-2"></i>Technical Assessment</h6>
                      <div class="score-badge-large ${getScoreClass(technicalAssessment.score)}">
                        ${technicalAssessment.score !== null && technicalAssessment.score !== undefined ? technicalAssessment.score + '%' : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div class="assessment-content-detailed">
                    ${technicalAssessment.feedback ? `
                      <div class="feedback-section-detailed mb-3">
                        <h6>Feedback</h6>
                        <p>${technicalAssessment.feedback}</p>
                      </div>
                    ` : ''}
                    
                    ${technicalAssessment.strengths && technicalAssessment.strengths.length > 0 ? `
                      <div class="strengths-section-detailed mb-3">
                        <h6 class="text-success"><i class="fas fa-plus-circle me-1"></i>Strengths</h6>
                        <ul class="strength-list-detailed">
                          ${technicalAssessment.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    
                    ${technicalAssessment.weaknesses && technicalAssessment.weaknesses.length > 0 ? `
                      <div class="weaknesses-section-detailed">
                        <h6 class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Areas for Improvement</h6>
                        <ul class="weakness-list-detailed">
                          ${technicalAssessment.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              
              <!-- Communication Assessment -->
              <div class="col-lg-4 mb-4">
                <div class="assessment-card-detailed communication-card">
                  <div class="assessment-header-detailed">
                    <div class="d-flex justify-content-between align-items-center">
                      <h6><i class="fas fa-comments me-2"></i>Communication Assessment</h6>
                      <div class="score-badge-large ${getScoreClass(communicationAssessment.score)}">
                        ${communicationAssessment.score !== null && communicationAssessment.score !== undefined ? communicationAssessment.score + '%' : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div class="assessment-content-detailed">
                    ${communicationAssessment.feedback ? `
                      <div class="feedback-section-detailed mb-3">
                        <h6>Feedback</h6>
                        <p>${communicationAssessment.feedback}</p>
                      </div>
                    ` : ''}
                    
                    ${communicationAssessment.strengths && communicationAssessment.strengths.length > 0 ? `
                      <div class="strengths-section-detailed mb-3">
                        <h6 class="text-success"><i class="fas fa-plus-circle me-1"></i>Strengths</h6>
                        <ul class="strength-list-detailed">
                          ${communicationAssessment.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    
                    ${communicationAssessment.weaknesses && communicationAssessment.weaknesses.length > 0 ? `
                      <div class="weaknesses-section-detailed">
                        <h6 class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Areas for Improvement</h6>
                        <ul class="weakness-list-detailed">
                          ${communicationAssessment.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
              
              <!-- Behavioral Assessment -->
              <div class="col-lg-4 mb-4">
                <div class="assessment-card-detailed behavioral-card">
                  <div class="assessment-header-detailed">
                    <div class="d-flex justify-content-between align-items-center">
                      <h6><i class="fas fa-user-friends me-2"></i>Behavioral Assessment</h6>
                      <div class="score-badge-large ${getScoreClass(behavioralAssessment.score)}">
                        ${behavioralAssessment.score !== null && behavioralAssessment.score !== undefined ? behavioralAssessment.score + '%' : 'N/A'}
                      </div>
                    </div>
                  </div>
                  <div class="assessment-content-detailed">
                    ${behavioralAssessment.feedback ? `
                      <div class="feedback-section-detailed mb-3">
                        <h6>Feedback</h6>
                        <p>${behavioralAssessment.feedback}</p>
                      </div>
                    ` : ''}
                    
                    ${behavioralAssessment.strengths && behavioralAssessment.strengths.length > 0 ? `
                      <div class="strengths-section-detailed mb-3">
                        <h6 class="text-success"><i class="fas fa-plus-circle me-1"></i>Strengths</h6>
                        <ul class="strength-list-detailed">
                          ${behavioralAssessment.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    
                    ${behavioralAssessment.weaknesses && behavioralAssessment.weaknesses.length > 0 ? `
                      <div class="weaknesses-section-detailed">
                        <h6 class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Areas for Improvement</h6>
                        <ul class="weakness-list-detailed">
                          ${behavioralAssessment.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Key Improvement Areas -->
          ${keyImprovementAreas.length > 0 ? `
            <div class="improvement-areas-detailed mb-4">
              <h5><i class="fas fa-lightbulb me-2"></i>Key Improvement Areas</h5>
              <div class="row">
                ${keyImprovementAreas.map((area, index) => `
                  <div class="col-lg-6 mb-3">
                    <div class="improvement-card-detailed">
                      <div class="improvement-header-detailed">
                        <div class="improvement-number-detailed">${index + 1}</div>
                        <h6 class="improvement-title-detailed">${area.area || 'Area not specified'}</h6>
                      </div>
                      <div class="improvement-content-detailed">
                        ${area.recommendation ? `
                          <div class="improvement-recommendation-detailed mb-2">
                            <strong>Recommendation:</strong>
                            <p>${area.recommendation}</p>
                          </div>
                        ` : ''}
                        ${area.practiceExercise ? `
                          <div class="improvement-exercise-detailed">
                            <strong>Practice Exercise:</strong>
                            <p>${area.practiceExercise}</p>
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <!-- Interview Conversation -->
          ${conversation.length > 0 ? `
            <div class="conversation-section mb-4">
              <h5><i class="fas fa-comments me-2"></i>Interview Conversation</h5>
              <div class="conversation-container-detailed">
                ${conversation.map((message, index) => {
                  const isInterviewer = message.role === 'assistant';
                  return `
                    <div class="conversation-message ${isInterviewer ? 'interviewer-message' : 'student-message'}">
                      <div class="message-header">
                        <div class="message-speaker">
                          <i class="${isInterviewer ? 'fas fa-robot' : 'fas fa-user'} me-2"></i>
                          ${isInterviewer ? 'Interviewer' : studentName}
                        </div>
                        <div class="message-number">#${index + 1}</div>
                      </div>
                      <div class="message-content">
                        ${message.content || 'No content'}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
        ` : `
          <div class="interview-status-message-detailed">
            <div class="alert alert-info">
              <i class="fas fa-info-circle me-2"></i>
              ${interview.status === 'active' ? 'Interview is currently in progress.' : 
                interview.status === 'failed' ? 'Interview failed to complete.' : 
                'Interview analysis not yet available.'}
            </div>
          </div>
        `}
      `;
      
      contentContainer.innerHTML = html;
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
    const companyName = extractCompanyName(session.jobDescription);
    
    return (
      (studentName && studentName.toLowerCase().includes(searchText)) ||
      (session.id && session.id.toLowerCase().includes(searchText)) ||
      (session.status && session.status.toLowerCase().includes(searchText)) ||
      (companyName && companyName.toLowerCase().includes(searchText))
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
    const companyName = extractCompanyName(interview.jobDescription) || interview.interviewType || '';
    
    return (
      (studentName && studentName.toLowerCase().includes(searchText)) ||
      (interview.id && interview.id.toLowerCase().includes(searchText)) ||
      (interview.status && interview.status.toLowerCase().includes(searchText)) ||
      (interview.interviewType && interview.interviewType.toLowerCase().includes(searchText)) ||
      (companyName && companyName.toLowerCase().includes(searchText))
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
  const loadingMessage = `
    <tr><td colspan="6" class="text-center">
      <div class="spinner-border spinner-border-sm text-primary" role="status"></div> Loading students...
    </td></tr>
  `;
  document.getElementById('students-table-body').innerHTML = loadingMessage;
  
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
      const errorRow = `<tr><td colspan="6" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
      document.getElementById('students-table-body').innerHTML = errorRow;
      
      throw error;
    });
}

function refreshSessionData() {
  if (!authState.students || authState.students.length === 0) {
    return Promise.resolve([]);
  }
  
  const container = document.getElementById('sessions-grouped-container');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2">Loading sessions...</p>
      </div>
    `;
  }
  
  const studentIds = authState.students.map(student => student.uid);
  return fetchSessionsForStudents(studentIds)
    .then(sessions => {
      displaySessions(sessions);
      updateStatsDisplay();
      return sessions;
    })
    .catch(error => {
      console.error('Error refreshing session data:', error);
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger">
            Error loading sessions: ${error.message}
          </div>
        `;
      }
      showErrorMessage(`Error loading session data: ${error.message}`);
      throw error;
    });
}

function refreshInterviewData() {
  if (!authState.students || authState.students.length === 0) {
    return Promise.resolve([]);
  }
  
  const container = document.getElementById('interviews-grouped-container');
  if (container) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2">Loading interviews...</p>
      </div>
    `;
  }
  
  const studentIds = authState.students.map(student => student.uid);
  return fetchInterviewsForStudents(studentIds)
    .then(interviews => {
      displayInterviews(interviews);
      updateStatsDisplay();
      return interviews;
    })
    .catch(error => {
      console.error('Error refreshing interview data:', error);
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger">
            Error loading interviews: ${error.message}
          </div>
        `;
      }
      showErrorMessage(`Error loading interview data: ${error.message}`);
      throw error;
    });
}

function fetchJobAnalytics() {
  if (!authState.sessions || !authState.interviews || !authState.students) {
    return { resumeAnalytics: {}, interviewAnalytics: {} };
  }
  
  const resumeAnalytics = {};
  const interviewAnalytics = {};
  
  // Process Resume Sessions
  authState.sessions.forEach(session => {
    if (!session.jobDescription || session.status !== 'completed') return;
    
    const jobDesc = session.jobDescription.trim();
    const student = authState.students.find(s => s.uid === session.userId);
    const matchScore = session.results?.match_results?.matchScore;
    
    if (!student || !matchScore) return;
    
    if (!resumeAnalytics[jobDesc]) {
      resumeAnalytics[jobDesc] = {
        jobDescription: jobDesc,
        students: [],
        totalSessions: 0,
        avgScore: 0
      };
    }
    
    let studentEntry = resumeAnalytics[jobDesc].students.find(s => s.userId === student.uid);
    if (!studentEntry) {
      studentEntry = {
        userId: student.uid,
        name: student.displayName || 'Unknown',
        email: student.email || 'N/A',
        collegeId: student.collegeId || 'N/A',
        deptId: student.deptId || 'N/A',
        sectionId: student.sectionId || 'N/A',
        scores: [],
        avgScore: 0,
        sessionCount: 0
      };
      resumeAnalytics[jobDesc].students.push(studentEntry);
    }
    
    studentEntry.scores.push(matchScore);
    studentEntry.sessionCount++;
    studentEntry.avgScore = Math.round(studentEntry.scores.reduce((a, b) => a + b, 0) / studentEntry.scores.length);
    
    resumeAnalytics[jobDesc].totalSessions++;
  });
  
  // Process Mock Interviews
  authState.interviews.forEach(interview => {
    if (!interview.jobDescription || interview.status !== 'completed') return;
    
    const jobDesc = interview.jobDescription.trim();
    const student = authState.students.find(s => s.uid === interview.userId);
    const overallScore = interview.analysis?.overallScore;
    
    if (!student || !overallScore) return;
    
    if (!interviewAnalytics[jobDesc]) {
      interviewAnalytics[jobDesc] = {
        jobDescription: jobDesc,
        students: [],
        totalInterviews: 0,
        avgScore: 0
      };
    }
    
    let studentEntry = interviewAnalytics[jobDesc].students.find(s => s.userId === student.uid);
    if (!studentEntry) {
      studentEntry = {
        userId: student.uid,
        name: student.displayName || 'Unknown',
        email: student.email || 'N/A',
        collegeId: student.collegeId || 'N/A',
        deptId: student.deptId || 'N/A',
        sectionId: student.sectionId || 'N/A',
        scores: [],
        avgScore: 0,
        interviewCount: 0,
        technicalScores: [],
        communicationScores: [],
        behavioralScores: []
      };
      interviewAnalytics[jobDesc].students.push(studentEntry);
    }
    
    studentEntry.scores.push(overallScore);
    studentEntry.interviewCount++;
    studentEntry.avgScore = Math.round(studentEntry.scores.reduce((a, b) => a + b, 0) / studentEntry.scores.length);
    
    const techScore = interview.analysis?.technicalAssessment?.score;
    const commScore = interview.analysis?.communicationAssessment?.score;
    const behavScore = interview.analysis?.behavioralAssessment?.score;
    
    if (techScore) studentEntry.technicalScores.push(techScore);
    if (commScore) studentEntry.communicationScores.push(commScore);
    if (behavScore) studentEntry.behavioralScores.push(behavScore);
    
    interviewAnalytics[jobDesc].totalInterviews++;
  });
  
  // Calculate averages and sort
  Object.values(resumeAnalytics).forEach(job => {
    if (job.students.length > 0) {
      job.avgScore = Math.round(job.students.reduce((sum, student) => sum + student.avgScore, 0) / job.students.length);
      job.students.sort((a, b) => b.avgScore - a.avgScore);
    }
  });
  
  Object.values(interviewAnalytics).forEach(job => {
    if (job.students.length > 0) {
      job.avgScore = Math.round(job.students.reduce((sum, student) => sum + student.avgScore, 0) / job.students.length);
      job.students.sort((a, b) => b.avgScore - a.avgScore);
    }
  });
  
  return { resumeAnalytics, interviewAnalytics };
}

function displayJobAnalytics() {
  const container = document.getElementById('job-analytics-container');
  if (!container) return;
  
  const { resumeAnalytics, interviewAnalytics } = fetchJobAnalytics();
  
  if (Object.keys(resumeAnalytics).length === 0 && Object.keys(interviewAnalytics).length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <div class="alert alert-info">
          <i class="fas fa-info-circle me-2"></i>
          No job analytics data available. Data will appear once students complete sessions and interviews.
        </div>
      </div>
    `;
    return;
  }
  
  let html = `
    <div class="row">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1>Job Performance Analytics</h1>
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-outline-primary active" id="show-resume-analytics">
              <i class="fas fa-file-alt me-2"></i>Resume Analytics
            </button>
            <button type="button" class="btn btn-outline-primary" id="show-interview-analytics">
              <i class="fas fa-video me-2"></i>Interview Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Resume Analytics Section
  html += `<div id="resume-analytics-section" class="analytics-section">
    <h3 class="mb-4"><i class="fas fa-file-alt me-2"></i>Resume Analysis Performance by Job Description</h3>`;
  
  if (Object.keys(resumeAnalytics).length === 0) {
    html += `<div class="alert alert-info">No resume analytics data available.</div>`;
  } else {
    const sortedResumeJobs = Object.values(resumeAnalytics).sort((a, b) => b.avgScore - a.avgScore);
    
    sortedResumeJobs.forEach((job, index) => {
      const jobId = `resume-job-${index}`;
      
      html += `
        <div class="job-analytics-card card mb-4">
          <div class="job-analytics-header" data-bs-toggle="collapse" data-bs-target="#${jobId}" aria-expanded="false">
            <div class="row align-items-center">
              <div class="col-md-8">
                <h5 class="mb-1">
                  <i class="fas fa-chevron-right collapse-icon me-2"></i>
                  Job Description #${index + 1}
                </h5>
                <div class="job-description-preview">
                  ${job.jobDescription.length > 100 ? job.jobDescription.substring(0, 100) + '...' : job.jobDescription}
                </div>
              </div>
              <div class="col-md-2 text-center">
                <div class="stat-item">
                  <div class="stat-number">${job.students.length}</div>
                  <div class="stat-label">Students</div>
                </div>
              </div>
              <div class="col-md-2 text-center">
                <div class="performance-indicator-large ${getPerformanceClass(job.avgScore)}">
                  ${job.avgScore}%
                </div>
                <small class="performance-label">Avg Score</small>
              </div>
            </div>
          </div>
          <div class="collapse" id="${jobId}">
            <div class="card-body">
              <div class="row mb-3">
                <div class="col-12">
                  <h6><i class="fas fa-file-text me-2"></i>Complete Job Description</h6>
                  <div class="job-description-full">${job.jobDescription}</div>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <h6><i class="fas fa-trophy me-2"></i>Student Performance Rankings</h6>
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Student</th>
                          <th>Email</th>
                          <th>College</th>
                          <th>Dept</th>
                          <th>Section</th>
                          <th>Sessions</th>
                          <th>Avg Score</th>
                        </tr>
                      </thead>
                      <tbody>`;
      
      job.students.forEach((student, rank) => {
        html += `
          <tr class="${rank < 3 ? 'table-success' : ''}">
            <td>
              <span class="rank-badge rank-${rank + 1}">
                ${rank + 1}
                ${rank === 0 ? '<i class="fas fa-crown ms-1"></i>' : ''}
              </span>
            </td>
            <td>${student.name}</td>
            <td>${student.email}</td>
            <td>${student.collegeId}</td>
            <td>${student.deptId}</td>
            <td>${student.sectionId}</td>
            <td>${student.sessionCount}</td>
            <td>
              <span class="score-badge ${getScoreClass(student.avgScore)}">
                ${student.avgScore}%
              </span>
            </td>
          </tr>`;
      });
      
      html += `</tbody></table></div></div></div></div></div>`;
    });
  }
  
  html += `</div>`;
  
  // Interview Analytics Section
  html += `<div id="interview-analytics-section" class="analytics-section" style="display: none;">
    <h3 class="mb-4"><i class="fas fa-video me-2"></i>Interview Performance by Job Description</h3>`;
  
  if (Object.keys(interviewAnalytics).length === 0) {
    html += `<div class="alert alert-info">No interview analytics data available.</div>`;
  } else {
    const sortedInterviewJobs = Object.values(interviewAnalytics).sort((a, b) => b.avgScore - a.avgScore);
    
    sortedInterviewJobs.forEach((job, index) => {
      const jobId = `interview-job-${index}`;
      
      html += `
        <div class="job-analytics-card card mb-4">
          <div class="job-analytics-header" data-bs-toggle="collapse" data-bs-target="#${jobId}" aria-expanded="false">
            <div class="row align-items-center">
              <div class="col-md-8">
                <h5 class="mb-1">
                  <i class="fas fa-chevron-right collapse-icon me-2"></i>
                  Job Description #${index + 1}
                </h5>
                <div class="job-description-preview">
                  ${job.jobDescription.length > 100 ? job.jobDescription.substring(0, 100) + '...' : job.jobDescription}
                </div>
              </div>
              <div class="col-md-2 text-center">
                <div class="stat-item">
                  <div class="stat-number">${job.students.length}</div>
                  <div class="stat-label">Students</div>
                </div>
              </div>
              <div class="col-md-2 text-center">
                <div class="performance-indicator-large ${getPerformanceClass(job.avgScore)}">
                  ${job.avgScore}%
                </div>
                <small class="performance-label">Avg Score</small>
              </div>
            </div>
          </div>
          <div class="collapse" id="${jobId}">
            <div class="card-body">
              <div class="row mb-3">
                <div class="col-12">
                  <h6><i class="fas fa-file-text me-2"></i>Complete Job Description</h6>
                  <div class="job-description-full">${job.jobDescription}</div>
                </div>
              </div>
              <div class="row">
                <div class="col-12">
                  <h6><i class="fas fa-trophy me-2"></i>Student Performance Rankings</h6>
                  <div class="table-responsive">
                    <table class="table table-hover">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Student</th>
                          <th>Email</th>
                          <th>College</th>
                          <th>Dept</th>
                          <th>Section</th>
                          <th>Interviews</th>
                          <th>Overall</th>
                          <th>Technical</th>
                          <th>Communication</th>
                          <th>Behavioral</th>
                        </tr>
                      </thead>
                      <tbody>`;
      
      job.students.forEach((student, rank) => {
        const avgTech = student.technicalScores.length > 0 ? 
          Math.round(student.technicalScores.reduce((a, b) => a + b, 0) / student.technicalScores.length) : 'N/A';
        const avgComm = student.communicationScores.length > 0 ? 
          Math.round(student.communicationScores.reduce((a, b) => a + b, 0) / student.communicationScores.length) : 'N/A';
        const avgBehav = student.behavioralScores.length > 0 ? 
          Math.round(student.behavioralScores.reduce((a, b) => a + b, 0) / student.behavioralScores.length) : 'N/A';
        
        html += `
          <tr class="${rank < 3 ? 'table-success' : ''}">
            <td>
              <span class="rank-badge rank-${rank + 1}">
                ${rank + 1}
                ${rank === 0 ? '<i class="fas fa-crown ms-1"></i>' : ''}
              </span>
            </td>
            <td>${student.name}</td>
            <td>${student.email}</td>
            <td>${student.collegeId}</td>
            <td>${student.deptId}</td>
            <td>${student.sectionId}</td>
            <td>${student.interviewCount}</td>
            <td>
              <span class="score-badge ${getScoreClass(student.avgScore)}">
                ${student.avgScore}%
              </span>
            </td>
            <td>
              <span class="score-badge-sm ${avgTech !== 'N/A' ? getScoreClass(avgTech) : 'score-neutral'}">
                ${avgTech !== 'N/A' ? avgTech + '%' : 'N/A'}
              </span>
            </td>
            <td>
              <span class="score-badge-sm ${avgComm !== 'N/A' ? getScoreClass(avgComm) : 'score-neutral'}">
                ${avgComm !== 'N/A' ? avgComm + '%' : 'N/A'}
              </span>
            </td>
            <td>
              <span class="score-badge-sm ${avgBehav !== 'N/A' ? getScoreClass(avgBehav) : 'score-neutral'}">
                ${avgBehav !== 'N/A' ? avgBehav + '%' : 'N/A'}
              </span>
            </td>
          </tr>`;
      });
      
      html += `</tbody></table></div></div></div></div></div>`;
    });
  }
  
  html += `</div>`;
  
  container.innerHTML = html;
  addJobAnalyticsEventListeners();
}

function getPerformanceClass(score) {
  if (score >= 80) return 'performance-excellent';
  if (score >= 65) return 'performance-good';
  if (score >= 45) return 'performance-average';
  return 'performance-poor';
}

function getScoreClass(score) {
  if (score >= 80) return 'score-excellent';
  if (score >= 65) return 'score-good';
  if (score >= 45) return 'score-average';
  return 'score-poor';
}

function addJobAnalyticsEventListeners() {
  document.getElementById('show-resume-analytics')?.addEventListener('click', function() {
    document.getElementById('resume-analytics-section').style.display = 'block';
    document.getElementById('interview-analytics-section').style.display = 'none';
    
    this.classList.add('active');
    document.getElementById('show-interview-analytics').classList.remove('active');
  });
  
  document.getElementById('show-interview-analytics')?.addEventListener('click', function() {
    document.getElementById('resume-analytics-section').style.display = 'none';
    document.getElementById('interview-analytics-section').style.display = 'block';
    
    this.classList.add('active');
    document.getElementById('show-resume-analytics').classList.remove('active');
  });
  
  document.querySelectorAll('[data-bs-toggle="collapse"]').forEach(button => {
    button.addEventListener('click', function() {
      const icon = this.querySelector('.collapse-icon');
      const target = this.getAttribute('data-bs-target');
      const collapseElement = document.querySelector(target);
      
      if (collapseElement && icon) {
        collapseElement.addEventListener('shown.bs.collapse', function() {
          icon.style.transform = 'rotate(90deg)';
        });
        
        collapseElement.addEventListener('hidden.bs.collapse', function() {
          icon.style.transform = 'rotate(0deg)';
        });
      }
    });
  });
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
        
        // ADD THIS SECTION: Handle special tab loading
        if (targetTab === 'job-analytics-tab') {
          displayJobAnalytics();
        }
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
    
    // Enhanced Student Action Event Listeners
    document.addEventListener('click', function(e) {
      // Download student report button
      if (e.target.classList.contains('download-report-btn') || e.target.closest('.download-report-btn')) {
        const btn = e.target.classList.contains('download-report-btn') ? e.target : e.target.closest('.download-report-btn');
        const studentId = btn.getAttribute('data-id');
        const studentName = btn.getAttribute('data-name');
        
        if (studentId && studentName) {
          downloadStudentReport(studentId, studentName);
        }
      }
      
      // Edit student button
      if (e.target.classList.contains('edit-student-btn') || e.target.closest('.edit-student-btn')) {
        const btn = e.target.classList.contains('edit-student-btn') ? e.target : e.target.closest('.edit-student-btn');
        const studentData = {
          name: btn.getAttribute('data-name'),
          email: btn.getAttribute('data-email'),
          college: btn.getAttribute('data-college'),
          dept: btn.getAttribute('data-dept'),
          section: btn.getAttribute('data-section')
        };
        editStudent(btn.getAttribute('data-id'), studentData);
      }
      
      // Delete student button
      if (e.target.classList.contains('delete-student-btn') || e.target.closest('.delete-student-btn')) {
        const btn = e.target.classList.contains('delete-student-btn') ? e.target : e.target.closest('.delete-student-btn');
        deleteStudent(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
      }
      
      // Download transcript button
      if (e.target.classList.contains('download-transcript-btn') || e.target.closest('.download-transcript-btn')) {
        const btn = e.target.classList.contains('download-transcript-btn') ? e.target : e.target.closest('.download-transcript-btn');
        const interviewId = btn.getAttribute('data-id');
        const studentName = btn.getAttribute('data-student');
        
        if (interviewId && studentName) {
          downloadInterviewTranscript(interviewId, studentName);
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


const cleanDisplayStyles = `
<style>
/* Clean Session Cards */
.session-detail-card-clean {
  border: 1px solid #e3e6f0;
  border-radius: 8px;
  margin-bottom: 15px;
  background: #fff;
  overflow: hidden;
}

.session-header-clean {
  background: linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%);
  padding: 15px;
  border-bottom: 1px solid #e3e6f0;
}

/* Clean Interview Cards */
.interview-detail-card-clean {
  border: 1px solid #e3e6f0;
  border-radius: 8px;
  margin-bottom: 15px;
  background: #fff;
  overflow: hidden;
}

.interview-header-clean {
  background: linear-gradient(135deg, #f8f9fc 0%, #ffffff 100%);
  padding: 15px;
  border-bottom: 1px solid #e3e6f0;
}

/* Job Requirements Summary */
.job-requirements-summary {
  background: #f8f9fa;
  padding: 12px 15px;
  border-top: 1px solid #e3e6f0;
}

.requirement-item {
  font-size: 0.9rem;
  margin-bottom: 5px;
}

/* Clean Skills Tags */
.skills-tags-clean {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.skill-tag-clean {
  display: inline-block;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.more-skills {
  display: inline-block;
  background: #6c757d;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-style: italic;
}

/* Clean Score Badges */
.scores-summary-clean {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  padding: 8px;
  border: 1px solid #e3e6f0;
}

.score-badge-clean {
  display: block;
  padding: 4px 6px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 2px;
}

.score-label-clean {
  font-size: 0.7rem;
  color: #6c757d;
  display: block;
}

.score-technical { background-color: #e3f2fd; color: #1976d2; }
.score-communication { background-color: #e8f5e8; color: #388e3c; }
.score-behavioral { background-color: #fff3e0; color: #f57c00; }

/* Responsive adjustments for clean display */
@media (max-width: 768px) {
  .session-header-clean,
  .interview-header-clean {
    padding: 12px;
  }
  
  .interview-actions {
    flex-direction: column;
    gap: 5px;
  }
  
  .scores-summary-clean .col-3 {
    margin-bottom: 8px;
  }
  
  .job-requirements-summary {
    padding: 10px 12px;
  }
  
  .requirement-item {
    font-size: 0.8rem;
  }
  
  .skill-tag-clean {
    font-size: 0.7rem;
    padding: 1px 6px;
  }
}

/* No scores message */
.no-scores-message {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}
</style>
`;

// Inject the clean display styles
if (!document.getElementById('clean-display-styles')) {
  const styleElement = document.createElement('div');
  styleElement.id = 'clean-display-styles';
  styleElement.innerHTML = cleanDisplayStyles;
  document.head.appendChild(styleElement);
}

// Initialize jsPDF when the page loads
document.addEventListener('DOMContentLoaded', () => {
  loadJsPDF().catch(error => {
    console.error('Error loading jsPDF:', error);
  });
});

// Export PDF functions
window.pdfDownloads = {
  downloadStudentReport,
  downloadInterviewTranscript,
  loadJsPDF
};

// Export the clean display functions
window.cleanDashboardDisplay = {
  displaySessions,
  displayInterviews
};

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
  filterInterviews,
  downloadStudentReport,
  downloadInterviewTranscript
};