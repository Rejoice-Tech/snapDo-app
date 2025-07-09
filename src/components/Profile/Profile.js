import React from 'react';
import './Profile.css';

function Profile() {
  // User data
  const user = {
    name: "Royce Stephane",
    username: "@royce_productive",
    bio: "Turning daily progress into social connection",
    stats: {
      streak: 16,
      posts: 343,
      bestStreak: 28
    },
    recentPost: "Completed my morning workout routine and meal prep for the week!"
  };

  return (
    <div className="profile-screen">
      {/* Header */}
      <div className="app-header">
        <h1>ProductiveFlow</h1>
        <div className="header-meta">
          <span>10:40 AM</span>
          <span>95%</span>
        </div>
      </div>

      {/* Profile Section */}
      <div className="profile-section">
        <div className="profile-header">
          <h2>Profile</h2>
          <div className="user-info">
            <h3>{user.name}</h3>
            <p className="username">{user.username}</p>
            <p className="bio">"{user.bio}"</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value">{user.stats.streak}</span>
            <span className="stat-label">Current Streak</span>
          </div>
          <div className="stat">
            <span className="stat-value">{user.stats.posts}</span>
            <span className="stat-label">Total Posts</span>
          </div>
          <div className="stat">
            <span className="stat-value">{user.stats.bestStreak}</span>
            <span className="stat-label">Best Streak</span>
          </div>
        </div>

        {/* Recent Post */}
        <div className="recent-post">
          <h3>Recent Posts</h3>
          <div className="post-content">
            <p>"{user.recentPost}"</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bottom-nav">
        <button>Home</button>
        <button>Post</button>
        <button>Feed</button>
        <button className="active">Profile</button>
      </nav>
    </div>
  );
}

export default Profile;