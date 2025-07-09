import React, { useState, useEffect } from 'react';
import './Profile.css';

function Profile() {
  // Enhanced user data with state
  const [user, setUser] = useState({
    name: "Royce Stephane",
    username: "@royce_productive",
    bio: "Turning daily progress into social connection",
    stats: {
      streak: 16,
      posts: 343,
      bestStreak: 28
    },
    recentPosts: [
      "Completed my morning workout routine and meal prep for the week!",
      "Just shipped a new feature to production 🚀"
    ],
    activeTab: 'profile'
  });

  // Time and progress simulation
  const [time, setTime] = useState('10:40 AM');
  const [progress, setProgress] = useState(95);

  useEffect(() => {
    // Update time every minute
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Tab navigation handler
  const handleTabChange = (tab) => {
    setUser({...user, activeTab: tab});
  };

  return (
    <div className="profile-screen">
      {/* Header with dynamic time */}
      <div className="app-header">
        <h1>ProductiveFlow</h1>
        <div className="header-meta">
          <span>{time}</span>
          <span>{progress}%</span>
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
          {Object.entries(user.stats).map(([key, value]) => (
            <div key={key} className="stat">
              <span className="stat-value">{value}</span>
              <span className="stat-label">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
            </div>
          ))}
        </div>

        {/* Recent Posts with multiple posts */}
        <div className="recent-posts">
          <h3>Recent Posts</h3>
          {user.recentPosts.map((post, index) => (
            <div key={index} className="post-card">
              <p>"{post}"</p>
              <div className="post-actions">
                <button className="like-btn">👍 Like</button>
                <button className="comment-btn">💬 Comment</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation with active state */}
      <nav className="bottom-nav">
        {['home', 'post', 'feed', 'profile'].map((tab) => (
          <button
            key={tab}
            className={user.activeTab === tab ? 'active' : ''}
            onClick={() => handleTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Profile;
