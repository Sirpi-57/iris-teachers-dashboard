// IRIS - Teacher Portal App Logic

document.addEventListener('DOMContentLoaded', function() {
    // Add custom CSS styling for conversation transcript
    if (window.location.pathname === '/dashboard.html') {
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
    }
  });
  
  // Helper function to format dates
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      console.error('Error formatting date:', e);
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
  
  // Helper function to download data as JSON file
  function downloadObjectAsJson(exportObj, exportName) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  
  // Helper function to determine score class
  function getScoreClass(score) {
    if (typeof score !== 'number') return '';
    if (score >= 70) return 'score-high';
    if (score >= 40) return 'score-medium';
    return 'score-low';
  }
  
  // Helper function to determine status badge class
  function getStatusBadgeClass(status) {
    switch(status?.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'processing': return 'status-processing';
      case 'failed': return 'status-failed';
      case 'active': return 'status-active';
      default: return 'status-processing';
    }
  }
  
  // Dashboard-specific functionality
  if (window.location.pathname === '/dashboard.html') {
    document.addEventListener('DOMContentLoaded', function() {
      // Add event listeners for session detail view
      document.addEventListener('click', function(e) {
        // Export data functionality
        if (e.target.classList.contains('export-data-btn') || e.target.closest('.export-data-btn')) {
          const dataType = e.target.getAttribute('data-type') || 
                           e.target.closest('.export-data-btn').getAttribute('data-type');
          
          if (dataType === 'students') {
            downloadObjectAsJson(window.irisTeacher.getUserProfile().students || [], 'students_data');
          } else if (dataType === 'sessions') {
            downloadObjectAsJson(window.irisTeacher.getUserProfile().sessions || [], 'sessions_data');
          } else if (dataType === 'interviews') {
            downloadObjectAsJson(window.irisTeacher.getUserProfile().interviews || [], 'interviews_data');
          }
        }
      });
      
      // Add search functionality to tables
      const studentSearch = document.getElementById('student-search');
      if (studentSearch) {
        studentSearch.addEventListener('input', function() {
          filterStudents(this.value);
        });
      }
      
      const sessionSearch = document.getElementById('session-search');
      if (sessionSearch) {
        sessionSearch.addEventListener('input', function() {
          filterSessions(this.value);
        });
      }
      
      const interviewSearch = document.getElementById('interview-search');
      if (interviewSearch) {
        interviewSearch.addEventListener('input', function() {
          filterInterviews(this.value);
        });
      }
    });
    
    // Function to filter students table
    function filterStudents(searchText) {
      if (typeof window.irisTeacher.filterStudents === 'function') {
        window.irisTeacher.filterStudents(searchText);
      }
    }
    
    // Function to filter sessions table
    function filterSessions(searchText) {
      if (typeof window.irisTeacher.filterSessions === 'function') {
        window.irisTeacher.filterSessions(searchText);
      }
    }
    
    // Function to filter interviews table
    function filterInterviews(searchText) {
      if (typeof window.irisTeacher.filterInterviews === 'function') {
        window.irisTeacher.filterInterviews(searchText);
      }
    }
  }
  
  // Handle refresh button functionality
  document.addEventListener('DOMContentLoaded', function() {
    const refreshStudentsBtn = document.getElementById('refresh-students-btn');
    if (refreshStudentsBtn) {
      refreshStudentsBtn.addEventListener('click', function() {
        this.disabled = true;
        const originalHTML = this.innerHTML;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
        
        if (typeof window.irisTeacher.refreshStudentData === 'function') {
          window.irisTeacher.refreshStudentData()
            .finally(() => {
              this.disabled = false;
              this.innerHTML = originalHTML;
            });
        } else {
          this.disabled = false;
          this.innerHTML = originalHTML;
        }
      });
    }
    
    const refreshSessionsBtn = document.getElementById('refresh-sessions-btn');
    if (refreshSessionsBtn) {
      refreshSessionsBtn.addEventListener('click', function() {
        this.disabled = true;
        const originalHTML = this.innerHTML;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
        
        if (typeof window.irisTeacher.refreshSessionData === 'function') {
          window.irisTeacher.refreshSessionData()
            .finally(() => {
              this.disabled = false;
              this.innerHTML = originalHTML;
            });
        } else {
          this.disabled = false;
          this.innerHTML = originalHTML;
        }
      });
    }
    
    const refreshInterviewsBtn = document.getElementById('refresh-interviews-btn');
    if (refreshInterviewsBtn) {
      refreshInterviewsBtn.addEventListener('click', function() {
        this.disabled = true;
        const originalHTML = this.innerHTML;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Refreshing...';
        
        if (typeof window.irisTeacher.refreshInterviewData === 'function') {
          window.irisTeacher.refreshInterviewData()
            .finally(() => {
              this.disabled = false;
              this.innerHTML = originalHTML;
            });
        } else {
          this.disabled = false;
          this.innerHTML = originalHTML;
        }
      });
    }
  });