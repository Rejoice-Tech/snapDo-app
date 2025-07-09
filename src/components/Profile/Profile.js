import React from 'react';
import './Profile.css';

function Profile() {
  return (
    <div className="profile-container">
      {/* Header Section */}
      <div className="profile-header">
        <h1>Royce Stephane</h1>
        <p className="username">@royce_productive</p>
        <p className="bio">"Turning daily progress into social connection"</p>
      </div>

      {/* Stats Section */}
      <div className="profile-stats">
        <div className="stat">
          <span className="stat-number">16</span>
          <span className="stat-label">Current Streak</span>
        </div>
        <div className="stat">
          <span className="stat-number">343</span>
          <span className="stat-label">Total Posts</span>
        </div>
        <div className="stat">
          <span className="stat-number">28</span>
          <span className="stat-label">Best Streak</span>
        </div>
      </div>

      {/* Recent Posts Section */}
      <div className="recent-posts">
        <h3>Recent Posts</h3>
        <div className="post">
          <p>"Completed my morning workout routine and meal prep for the week!"</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;