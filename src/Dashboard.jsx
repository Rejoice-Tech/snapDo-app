import React from "react";
import "./Dashboard.css";

function Dashboard() {
  return (
    <div className="dashboard">
      {/* En-tête */}
      <div className="dashboard-header">
        <div className="header-top"></div>
        <h1>Dashboard</h1>
        <div className="stats-icon">📊</div>
      </div>
<div className="text"><p><strong> Today's Process</strong></p></div>
      {/* Statistiques */}
      <div className="stats">
        <div className="stat-card">
          <div className="stat-number">15</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">0</div>
          <div className="stat-label">Videos Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">342</div>
          <div className="stat-label">Total Videos</div>
        </div>
      </div>

      {/* État verrouillé */}
      <div className="locked-state">
        <div className="lock-icon">🎬</div>
        <h3>Feed Locked</h3>
        <p>Record your daily process video to unlock the community feed</p>
        <button className="btn-primary">📹 Record Process Video</button>
      </div>

      {/* Focus du jour */}
      <div className="daily-focus">
        <strong>💡 Today's Focus:</strong> Show your work process, not just results.
      </div>
      
    <div className="footer">
        <div className="footer-item">
          <div className="footer-icon">🏠</div>
          <div className="footer-label">Home</div>
        </div>
        <div className="footer-item">
          <div className="footer-icon">🎬</div>
          <div className="footer-label">Record</div>
        </div>
        <div className="footer-item">
          <div className="footer-icon">🔒</div>
          <div className="footer-label">Feed</div>
        </div>
        <div className="footer-item">
          <div className="footer-icon">👤</div>
          <div className="footer-label">Profile</div>
        </div>
      </div>
    </div>
  ); 
}

export default Dashboard;